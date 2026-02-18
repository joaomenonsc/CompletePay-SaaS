"""Repositorio de usuarios (tabela users) para autenticacao."""
import uuid
from typing import cast

import psycopg
from psycopg.rows import class_row

from src.config.settings import get_settings


class UserRow:
    """Linha da tabela users (ordem dos campos igual ao SELECT)."""

    def __init__(self, id: uuid.UUID, email: str, password_hash: str, role: str, created_at):
        self.id = id
        self.email = email
        self.password_hash = password_hash
        self.role = role or "user"
        self.created_at = created_at


def _get_connection():
    url = get_settings().database_url
    return psycopg.connect(url, connect_timeout=10)


def get_user_by_email(email: str) -> UserRow | None:
    """Retorna o usuario pelo email ou None."""
    with _get_connection() as conn:
        with conn.cursor(row_factory=class_row(UserRow)) as cur:
            cur.execute(
                "SELECT id, email, password_hash, COALESCE(role, 'user') AS role, created_at FROM users WHERE LOWER(email) = LOWER(%s)",
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
