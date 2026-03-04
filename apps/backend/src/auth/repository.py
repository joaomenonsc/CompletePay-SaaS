"""Repositorio de usuarios (tabela users) para autenticacao."""
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import cast

import psycopg
from psycopg.rows import class_row

from src.config.settings import get_settings


class UserRow:
    """Linha da tabela users (ordem dos campos igual ao SELECT)."""

    def __init__(
        self,
        id: uuid.UUID,
        email: str,
        password_hash: str,
        role: str,
        created_at,
        name: str | None = None,
        avatar_url: str | None = None,
        email_confirmed_at=None,
    ):
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.role = role or "user"
        self.created_at = created_at
        self.name = name
        self.avatar_url = avatar_url
        self.email_confirmed_at = email_confirmed_at


def _get_connection():
    url = get_settings().database_url
    return psycopg.connect(url, connect_timeout=10)


def get_user_by_email(email: str) -> UserRow | None:
    """Retorna o usuario pelo email ou None."""
    with _get_connection() as conn:
        with conn.cursor(row_factory=class_row(UserRow)) as cur:
            cur.execute(
                "SELECT id, email, password_hash, COALESCE(role, 'user') AS role, created_at, name, avatar_url, email_confirmed_at FROM users WHERE LOWER(email) = LOWER(%s)",
                (email.strip(),),
            )
            return cast(UserRow | None, cur.fetchone())


def create_user(email: str, password_hash: str, role: str = "user") -> uuid.UUID:
    """Cria usuario e retorna o id. Levanta ValueError se email ja existir."""
    email = email.strip().lower()
    user_id = uuid.uuid4()
    r = (role or "user").strip() or "user"
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (id, email, password_hash, role) VALUES (%s, %s, %s, %s)",
                (str(user_id), email, password_hash, r),
            )
            conn.commit()
    return user_id


def get_user_by_id(user_id: str) -> UserRow | None:
    """Retorna o usuario pelo id ou None."""
    with _get_connection() as conn:
        with conn.cursor(row_factory=class_row(UserRow)) as cur:
            cur.execute(
                "SELECT id, email, password_hash, COALESCE(role, 'user') AS role, created_at, name, avatar_url, email_confirmed_at FROM users WHERE id = %s",
                (user_id.strip(),),
            )
            return cast(UserRow | None, cur.fetchone())


def update_user_name(user_id: str, name: str) -> None:
    """Atualiza o nome do usuario. name pode ser vazio (sera armazenado como NULL)."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET name = %s WHERE id = %s",
                (name.strip() or None, user_id.strip()),
            )
            conn.commit()


def update_user_avatar(user_id: str, avatar_url: str | None) -> None:
    """Atualiza a URL do avatar do usuario. None remove o avatar."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET avatar_url = %s WHERE id = %s",
                (avatar_url, user_id.strip()),
            )
            conn.commit()


def update_user_password(user_id: str, password_hash: str) -> None:
    """Atualiza a senha do usuario (hash bcrypt)."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (password_hash, user_id.strip()),
            )
            conn.commit()


# --- Sessoes (user_sessions + revoked_tokens) ---


def create_session(
    user_id: str,
    jti: str,
    device_info: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Registra uma nova sessao (login/register)."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO user_sessions (id, user_id, jti, device_info, ip_address)
                   VALUES (gen_random_uuid(), %s, %s, %s, %s)""",
                (user_id.strip(), jti, (device_info or "")[:512], (ip_address or "")[:64]),
            )
            conn.commit()


def list_sessions(user_id: str) -> list[dict]:
    """Lista sessoes do usuario: id, jti, device_info, ip_address, created_at."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, jti, device_info, ip_address, created_at
                   FROM user_sessions WHERE user_id = %s ORDER BY created_at DESC""",
                (user_id.strip(),),
            )
            rows = cur.fetchall()
    return [
        {
            "id": str(r[0]),
            "jti": r[1],
            "device_info": r[2] or "",
            "ip_address": r[3] or "",
            "created_at": r[4].isoformat() if hasattr(r[4], "isoformat") else str(r[4]),
        }
        for r in rows
    ]


def get_session_by_id(session_id: str, user_id: str) -> dict | None:
    """Retorna a sessao se pertencer ao usuario."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, jti, device_info, ip_address, created_at FROM user_sessions WHERE id = %s AND user_id = %s",
                (session_id.strip(), user_id.strip()),
            )
            r = cur.fetchone()
    if not r:
        return None
    return {
        "id": str(r[0]),
        "jti": r[1],
        "device_info": r[2] or "",
        "ip_address": r[3] or "",
        "created_at": r[4].isoformat() if hasattr(r[4], "isoformat") else str(r[4]),
    }


def delete_session_and_revoke(session_id: str, user_id: str) -> bool:
    """Remove a sessao e adiciona o jti à blacklist. Retorna True se encontrou."""
    sess = get_session_by_id(session_id, user_id)
    if not sess:
        return False
    jti = sess["jti"]
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_sessions WHERE id = %s AND user_id = %s", (session_id.strip(), user_id.strip()))
            cur.execute("INSERT INTO revoked_tokens (jti) VALUES (%s) ON CONFLICT (jti) DO NOTHING", (jti,))
            conn.commit()
    return True


def revoke_all_sessions_for_user(user_id: str) -> None:
    """Invalida todas as sessoes do usuario: blacklist de jtis e remove linhas de user_sessions."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT jti FROM user_sessions WHERE user_id = %s", (user_id.strip(),))
            jtis = [r[0] for r in cur.fetchall()]
            for jti in jtis:
                cur.execute("INSERT INTO revoked_tokens (jti) VALUES (%s) ON CONFLICT (jti) DO NOTHING", (jti,))
            cur.execute("DELETE FROM user_sessions WHERE user_id = %s", (user_id.strip(),))
            conn.commit()


def is_jti_revoked(jti: str) -> bool:
    """Verifica se o token (jti) foi revogado."""
    if not jti:
        return False
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM revoked_tokens WHERE jti = %s", (jti.strip(),))
            return cur.fetchone() is not None


# --- Confirmacao de email ---

CONFIRM_TOKEN_EXPIRY_HOURS = 24


def create_email_confirm_token(user_id: str) -> str:
    """Cria um token de confirmacao de email e retorna o token (para enviar no link)."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=CONFIRM_TOKEN_EXPIRY_HOURS)
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO email_confirm_tokens (token, user_id, expires_at) VALUES (%s, %s, %s)",
                (token, user_id.strip(), expires_at),
            )
            conn.commit()
    return token


def get_user_id_by_confirm_token(token: str) -> str | None:
    """Retorna user_id se o token for valido e nao expirado. None caso contrario."""
    if not token or len(token) > 64:
        return None
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id FROM email_confirm_tokens WHERE token = %s AND expires_at > now()",
                (token.strip(),),
            )
            row = cur.fetchone()
    return str(row[0]) if row else None


def confirm_user_email(user_id: str) -> None:
    """Marca o usuario como email confirmado."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET email_confirmed_at = now() WHERE id = %s",
                (user_id.strip(),),
            )
            conn.commit()


def delete_confirm_token(token: str) -> None:
    """Remove o token de confirmacao (apos uso)."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM email_confirm_tokens WHERE token = %s", (token.strip(),))
            conn.commit()


# --- Redefinicao de senha ---

RESET_TOKEN_EXPIRY_MINUTES = 30


def create_password_reset_token(user_id: str) -> str:
    """Cria um token de redefinicao de senha e retorna o token (para enviar no link)."""
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRY_MINUTES)
    with _get_connection() as conn:
        with conn.cursor() as cur:
            # Remove tokens anteriores para evitar acumulo
            cur.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (user_id.strip(),))
            cur.execute(
                "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (%s, %s, %s)",
                (token, user_id.strip(), expires_at),
            )
            conn.commit()
    return token


def get_user_id_by_reset_token(token: str) -> str | None:
    """Retorna user_id se o token for valido e nao expirado. None caso contrario."""
    if not token or len(token) > 64:
        return None
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT user_id FROM password_reset_tokens WHERE token = %s AND expires_at > now()",
                (token.strip(),),
            )
            row = cur.fetchone()
    return str(row[0]) if row else None


def delete_reset_token(token: str) -> None:
    """Remove o token de redefinicao (apos uso)."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM password_reset_tokens WHERE token = %s", (token.strip(),))
            conn.commit()


def delete_all_reset_tokens_for_user(user_id: str) -> None:
    """Remove todos os tokens de redefinicao do usuario."""
    with _get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (user_id.strip(),))
            conn.commit()
