"""Rotas de autenticacao: registro e login (bcrypt + JWT)."""
import re

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.api.middleware.auth import require_user_id
from src.auth.repository import (
    confirm_user_email,
    create_email_confirm_token,
    create_password_reset_token,
    create_session,
    create_user,
    delete_confirm_token,
    delete_reset_token,
    delete_session_and_revoke,
    get_user_by_email,
    get_user_by_id,
    get_user_id_by_confirm_token,
    get_user_id_by_reset_token,
    list_sessions,
    revoke_all_sessions_for_user,
    update_user_avatar,
    update_user_name,
    update_user_password,
)
from src.auth.service import create_access_token, hash_password, verify_password
from src.config.settings import get_settings
from src.db.session import get_db
from src.services.avatar_storage import save_avatar
from src.organizations.service import create_organization
from src.services.email_service import EmailService

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


class RegisterResponse(BaseModel):
    message: str
    email: str


class ConfirmEmailBody(BaseModel):
    token: str = Field(..., min_length=1)


class ResendConfirmBody(BaseModel):
    email: str = Field(..., min_length=1)


def _validate_email(email: str) -> None:
    if not EMAIL_RE.match(email.strip()):
        raise HTTPException(status_code=400, detail="Email invalido.")


def _client_info(request: Request) -> tuple[str | None, str | None]:
    """Retorna (device_info, ip_address) a partir do request."""
    ua = request.headers.get("User-Agent") or ""
    ip = request.client.host if request.client else None
    return (ua[:512] if ua else None, ip)


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(
    body: RegisterBody,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    """
    Registra um novo usuario e envia email de confirmacao.
    Apos clicar no link do email, o usuario deve usar POST /auth/confirm-email
    e depois fazer login.
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

    confirm_token = create_email_confirm_token(str(user_id))
    frontend_url = get_settings().frontend_url.rstrip("/")
    confirm_url = f"{frontend_url}/confirmar-email?token={confirm_token}"
    email_svc = EmailService(db)
    email_svc.send_account_confirmation(body.email.strip().lower(), confirm_url)

    return RegisterResponse(
        message="Enviamos um email de confirmação. Acesse o link no seu email para ativar sua conta.",
        email=body.email.strip().lower(),
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginBody, request: Request) -> TokenResponse:
    """
    Autentica por email e senha. Retorna JWT.
    Exige que o email tenha sido confirmado.
    """
    _validate_email(body.email)
    user = get_user_by_email(body.email)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais invalidas.")
    if not getattr(user, "email_confirmed_at", None):
        raise HTTPException(
            status_code=403,
            detail="Confirme seu email antes de fazer login. Verifique sua caixa de entrada ou reenvie o email de confirmação.",
        )
    token, jti = create_access_token(str(user.id), role=getattr(user, "role", "user"))
    device_info, ip_address = _client_info(request)
    create_session(str(user.id), jti, device_info=device_info, ip_address=ip_address)
    return TokenResponse(access_token=token)


@router.post("/confirm-email", response_model=TokenResponse)
def confirm_email(
    body: ConfirmEmailBody,
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Confirma o email usando o token enviado por email. Invalida o token e retorna JWT (login automatico).
    """
    user_id = get_user_id_by_confirm_token(body.token.strip())
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Link inválido ou expirado. Solicite um novo email de confirmação.",
        )
    confirm_user_email(user_id)
    delete_confirm_token(body.token.strip())
    user = get_user_by_id(user_id)
    role = getattr(user, "role", "user") if user else "user"
    token, jti = create_access_token(user_id, role=role)
    device_info, ip_address = _client_info(request)
    create_session(user_id, jti, device_info=device_info, ip_address=ip_address)

    # Envia email de boas-vindas (criacao_conta.html)
    if user:
        email_svc = EmailService(db)
        user_email = getattr(user, "email", "")
        user_name = getattr(user, "name", None)
        email_svc.send_welcome_email(user_email, user_name=user_name, user_id=user_id)

    return TokenResponse(access_token=token)


@router.post("/resend-confirmation")
def resend_confirmation(
    body: ResendConfirmBody,
    db: Session = Depends(get_db),
) -> dict:
    """
    Reenvia o email de confirmacao para o endereco informado (se a conta existir e nao estiver confirmada).
    """
    _validate_email(body.email)
    user = get_user_by_email(body.email.strip().lower())
    if not user:
        raise HTTPException(status_code=404, detail="Nenhuma conta encontrada com este email.")
    if getattr(user, "email_confirmed_at", None):
        raise HTTPException(status_code=400, detail="Este email já foi confirmado. Faça login.")
    confirm_token = create_email_confirm_token(str(user.id))
    frontend_url = get_settings().frontend_url.rstrip("/")
    confirm_url = f"{frontend_url}/confirmar-email?token={confirm_token}"
    email_svc = EmailService(db)
    email_svc.send_account_confirmation(user.email, confirm_url)
    return {"message": "Email de confirmação reenviado. Verifique sua caixa de entrada."}


class ForgotPasswordBody(BaseModel):
    email: str = Field(..., min_length=1)


class ResetPasswordBody(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=MIN_PASSWORD_LEN)


@router.post("/forgot-password")
def forgot_password(
    body: ForgotPasswordBody,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    """
    Solicita redefinicao de senha. Envia email com link se a conta existir.
    Sempre retorna 200 para nao revelar se o email esta cadastrado.
    """
    _validate_email(body.email)
    user = get_user_by_email(body.email.strip().lower())
    if user:
        reset_token = create_password_reset_token(str(user.id))
        frontend_url = get_settings().frontend_url.rstrip("/")
        reset_url = f"{frontend_url}/auth/v2/redefinir-senha?token={reset_token}"
        _, ip_address = _client_info(request)
        email_svc = EmailService(db)
        email_svc.send_password_reset(
            to_email=user.email,
            reset_url=reset_url,
            user_name=getattr(user, "name", None),
            ip_address=ip_address,
        )
    # Always return success to avoid email enumeration
    return {"message": "Se o email estiver cadastrado, você receberá um link para redefinir sua senha."}


@router.post("/reset-password")
def reset_password(
    body: ResetPasswordBody,
    request: Request,
) -> dict:
    """
    Redefine a senha usando o token enviado por email.
    Invalida o token, atualiza a senha e revoga todas as sessoes.
    """
    user_id = get_user_id_by_reset_token(body.token.strip())
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Link inválido ou expirado. Solicite um novo email de redefinição.",
        )
    new_hash = hash_password(body.new_password)
    update_user_password(user_id, new_hash)
    revoke_all_sessions_for_user(user_id)
    delete_reset_token(body.token.strip())
    return {"message": "Senha redefinida com sucesso! Faça login com sua nova senha."}

class UpdateMeBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class ChangePasswordBody(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=MIN_PASSWORD_LEN)


@router.get("/me")
def me(request: Request, user_id: str = Depends(require_user_id)) -> dict:
    """
    Rota protegida: exige Authorization Bearer. Retorna user_id, role, email e name.
    """
    role = getattr(request.state, "role", "user")
    user = get_user_by_id(user_id)
    if not user:
        return {"user_id": user_id, "role": role, "email": "", "name": ""}
    return {
        "user_id": user_id,
        "role": role,
        "email": user.email,
        "name": getattr(user, "name", None) or "",
        "avatar_url": getattr(user, "avatar_url", None) or "",
    }


@router.get("/me/sessions")
def get_my_sessions(
    request: Request,
    user_id: str = Depends(require_user_id),
) -> dict:
    """
    Lista as sessoes ativas do usuario. Inclui flag 'current' para a sessao do token em uso.
    """
    sessions = list_sessions(user_id)
    current_jti = getattr(request.state, "jti", None)
    for s in sessions:
        s["current"] = current_jti and s.get("jti") == current_jti
    return {"sessions": sessions}


@router.delete("/me/sessions/{session_id}")
def revoke_session(
    session_id: str,
    user_id: str = Depends(require_user_id),
) -> dict:
    """Encerra uma sessao especifica. O token dessa sessao deixa de ser valido."""
    if not delete_session_and_revoke(session_id, user_id):
        raise HTTPException(status_code=404, detail="Sessao nao encontrada.")
    return {"message": "Sessao encerrada."}


@router.post("/me/sessions/revoke-all")
def revoke_all_my_sessions(
    user_id: str = Depends(require_user_id),
) -> dict:
    """
    Encerra todas as sessoes do usuario. O token atual tambem sera invalidado;
    o cliente deve remover o token e redirecionar para login.
    """
    revoke_all_sessions_for_user(user_id)
    return {"message": "Todas as sessoes foram encerradas."}


@router.put("/me/password")
def change_password(
    body: ChangePasswordBody,
    user_id: str = Depends(require_user_id),
) -> dict:
    """
    Altera a senha do usuario logado. Exige a senha atual para confirmar.
    """
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")
    new_hash = hash_password(body.new_password)
    update_user_password(user_id, new_hash)
    return {"message": "Senha alterada com sucesso."}


@router.patch("/me")
def update_me(
    body: UpdateMeBody,
    user_id: str = Depends(require_user_id),
) -> dict:
    """
    Atualiza o perfil do usuario logado (ex.: nome). Retorna os dados atuais.
    """
    update_user_name(user_id, body.name)
    user = get_user_by_id(user_id)
    role = getattr(user, "role", "user") if user else "user"
    return {
        "user_id": user_id,
        "role": role,
        "email": user.email if user else "",
        "name": body.name,
        "avatar_url": getattr(user, "avatar_url", None) or "",
    }


# Extensoes permitidas e tamanho maximo (5MB) para avatar
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
AVATAR_MAX_BYTES = 5 * 1024 * 1024
EXT_BY_CONTENT_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
}


@router.post("/me/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    user_id: str = Depends(require_user_id),
) -> dict:
    """
    Envia uma foto para o avatar do usuario. Aceita JPEG, PNG, GIF ou WebP ate 5MB.
    Retorna os dados atuais do usuario, incluindo avatar_url.
    """
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Formato invalido. Use JPEG, PNG, GIF ou WebP.",
        )
    contents = file.file.read()
    if len(contents) > AVATAR_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Arquivo muito grande. Maximo 5MB.",
        )
    ext = EXT_BY_CONTENT_TYPE.get(file.content_type, "jpg")
    safe_id = user_id.replace("-", "")[:32]
    pathname = f"avatars/{safe_id}.{ext}"
    try:
        avatar_url = save_avatar(pathname, contents, file.content_type or "image/jpeg")
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    update_user_avatar(user_id, avatar_url)
    user = get_user_by_id(user_id)
    role = getattr(user, "role", "user") if user else "user"
    return {
        "user_id": user_id,
        "role": role,
        "email": user.email if user else "",
        "name": getattr(user, "name", None) or "",
        "avatar_url": avatar_url,
    }
