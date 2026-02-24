"""Servico de autenticacao: hash de senha (bcrypt) e emissao de JWT."""
import time
import uuid
from typing import Any

import bcrypt

from src.config.settings import get_settings

# Bcrypt: 12 rounds recomendado para producao
BCRYPT_ROUNDS = 12

try:
    import jwt as pyjwt
    _JWT_AVAILABLE = True
except ImportError:
    _JWT_AVAILABLE = False


def hash_password(plain_password: str) -> str:
    """Retorna o hash bcrypt da senha."""
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica se a senha em texto corresponde ao hash."""
    if not plain_password or not password_hash:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(
    sub: str,
    expires_in_seconds: int = 86400,
    role: str = "user",
) -> tuple[str, str]:  # (token, jti) - 24h
    """
    Gera um JWT com claim 'sub' (user_id), 'role' (RBAC) e 'jti' (id da sessao).
    Retorna (token, jti) para registrar a sessao em user_sessions.
    """
    if not _JWT_AVAILABLE:
        raise RuntimeError("pyjwt nao instalado")
    secret = get_settings().jwt_secret
    now = int(time.time())
    jti = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "sub": str(sub),
        "role": (role or "user"),
        "jti": jti,
        "iat": now,
        "exp": now + expires_in_seconds,
    }
    token = pyjwt.encode(payload, secret, algorithm="HS256")
    token_str = token if isinstance(token, str) else token.decode("utf-8")
    return (token_str, jti)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decodifica e valida um JWT de acesso.
    Retorna o payload (sub, role, iat, exp).
    Levanta Exception se o token for invalido ou expirado.
    Usado pelo WebSocket /ws/chat para autenticar no handshake.
    """
    if not _JWT_AVAILABLE:
        raise RuntimeError("pyjwt nao instalado")
    if not token or not token.strip():
        raise ValueError("Token ausente")
    secret = get_settings().jwt_secret
    payload = pyjwt.decode(token.strip(), secret, algorithms=["HS256"])
    return payload
