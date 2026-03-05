"""
Criptografia AES-256-GCM para API keys e dados sensíveis do módulo WhatsApp.
Usa a variável de ambiente WHATSAPP_ENCRYPTION_KEY (valor base64 de 32 bytes).

Gerar uma nova chave:
    python -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
"""
import base64
import os
import secrets

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    _CRYPTO_AVAILABLE = True
except ImportError:
    _CRYPTO_AVAILABLE = False


def _get_key() -> bytes:
    """Carrega WHATSAPP_ENCRYPTION_KEY do ambiente e decodifica de base64."""
    raw = os.environ.get("WHATSAPP_ENCRYPTION_KEY", "").strip()
    if not raw:
        raise RuntimeError(
            "WHATSAPP_ENCRYPTION_KEY não configurada. "
            "Gere uma chave com: "
            "python -c \"import secrets,base64;print(base64.b64encode(secrets.token_bytes(32)).decode())\""
        )
    # Adiciona padding correto: (4 - len % 4) % 4 caracteres '='
    # Ex: 43 chars → +1 '='; 42 chars → +2 '='; 44 chars → +0 '='
    padding_needed = (4 - len(raw) % 4) % 4
    padded = raw + "=" * padding_needed
    try:
        # Tenta standard base64 primeiro, depois urlsafe
        try:
            key = base64.b64decode(padded)
        except Exception:
            key = base64.urlsafe_b64decode(padded)
    except Exception:
        raise RuntimeError("WHATSAPP_ENCRYPTION_KEY deve ser uma string base64 válida.")
    if len(key) != 32:
        raise RuntimeError(
            f"WHATSAPP_ENCRYPTION_KEY deve ter 32 bytes (256 bits). "
            f"Tamanho atual: {len(key)} bytes."
        )
    return key


def encrypt_api_key(plain: str) -> str:
    """
    Criptografa uma API key usando AES-256-GCM.
    Retorna: base64( nonce[12] + ciphertext + tag[16] )
    """
    if not _CRYPTO_AVAILABLE:
        raise RuntimeError(
            "Pacote 'cryptography' não instalado. "
            "Execute: pip install cryptography"
        )
    if not plain:
        raise ValueError("API key não pode ser vazia.")

    key = _get_key()
    aesgcm = AESGCM(key)
    nonce = secrets.token_bytes(12)  # 96 bits — padrão GCM
    ciphertext = aesgcm.encrypt(nonce, plain.encode("utf-8"), associated_data=None)
    # ciphertext já inclui o authentication tag de 16 bytes ao final
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def decrypt_api_key(encrypted: str) -> str:
    """
    Descriptografa uma API key previamente criptografada com encrypt_api_key().
    Levanta ValueError se a chave for inválida ou dados corrompidos.
    """
    if not _CRYPTO_AVAILABLE:
        raise RuntimeError(
            "Pacote 'cryptography' não instalado. "
            "Execute: pip install cryptography"
        )
    if not encrypted:
        raise ValueError("String criptografada não pode ser vazia.")

    key = _get_key()
    try:
        raw = base64.b64decode(encrypted)
    except Exception:
        raise ValueError("Dado criptografado inválido (base64 malformado).")

    if len(raw) < 12 + 16:
        raise ValueError("Dado criptografado muito curto.")

    nonce = raw[:12]
    ciphertext = raw[12:]  # inclui tag ao final
    aesgcm = AESGCM(key)
    try:
        plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data=None)
    except Exception:
        raise ValueError(
            "Falha ao descriptografar: chave incorreta ou dados corrompidos."
        )
    return plaintext.decode("utf-8")
