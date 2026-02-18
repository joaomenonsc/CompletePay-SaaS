"""Rotas de autenticacao: registro e login (bcrypt + JWT)."""
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.api.middleware.auth import require_user_id
from src.auth.repository import create_user, get_user_by_email
from src.auth.service import create_access_token, hash_password, verify_password
from src.db.session import get_db
from src.organizations.service import create_organization

router = APIRouter(prefix="/auth", tags=["auth"])

# Email simples: algo@algo.algo
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MIN_PASSWORD_LEN = 8


class RegisterBody(BaseModel):
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=MIN_PASSWORD_LEN)


class LoginBody(BaseModel):
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _validate_email(email: str) -> None:
    if not EMAIL_RE.match(email.strip()):
        raise HTTPException(status_code=400, detail="Email invalido.")


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterBody, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Registra um novo usuario. Cria organizacao default "Meu Espaco" e associa como owner.
    Retorna JWT para uso no header Authorization: Bearer <token>.
    """
    _validate_email(body.email)
    existing = get_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email ja cadastrado.")
    password_hash = hash_password(body.password)
    user_id = create_user(body.email.strip().lower(), password_hash, role="user")
    uid_str = str(user_id).replace("-", "")
    default_slug = f"meu-espaco-{uid_str[:12]}"
    create_organization(db, "Meu Espaço", default_slug, str(user_id))
    token = create_access_token(str(user_id), role="user")
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginBody) -> TokenResponse:
    """
    Autentica por email e senha. Retorna JWT.
    """
    _validate_email(body.email)
    user = get_user_by_email(body.email)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")
    token = create_access_token(str(user.id), role=getattr(user, "role", "user"))
    return TokenResponse(access_token=token)


@router.get("/me")
def me(request: Request, user_id: str = Depends(require_user_id)) -> dict:
    """
    Rota protegida: exige Authorization Bearer. Retorna user_id e role (RBAC).
    """
    role = getattr(request.state, "role", "user")
    return {"user_id": user_id, "role": role}
