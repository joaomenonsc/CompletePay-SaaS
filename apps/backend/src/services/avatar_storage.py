"""
Armazenamento de avatares: filesystem local ou Vercel Blob.
Em producao (Vercel) use BLOB_READ_WRITE_TOKEN para evitar 500 por filesystem read-only.
"""
from pathlib import Path

from src.config.settings import get_settings


def save_avatar(pathname: str, content: bytes, content_type: str) -> str:
    """
    Salva o avatar e retorna a URL para persistir no banco.
    - Com BLOB_READ_WRITE_TOKEN: envia para Vercel Blob e retorna URL absoluta.
    - Sem token: grava em uploads/avatars e retorna path relativo /uploads/avatars/...
    """
    settings = get_settings()
    if settings.blob_read_write_token:
        import os
        # Vercel Blob espera BLOB_READ_WRITE_TOKEN no ambiente
        os.environ["BLOB_READ_WRITE_TOKEN"] = settings.blob_read_write_token
        import vercel_blob  # type: ignore
        resp = vercel_blob.put(
            pathname,
            content,
            {
                "contentType": content_type,
                "access": "public",
                "addRandomSuffix": False,
                "allowOverwrite": True,
            },
        )
        return resp.get("url") or resp.get("downloadUrl") or ""
    base = Path(__file__).resolve().parent.parent.parent
    avatars_dir = base / "uploads" / "avatars"
    try:
        avatars_dir.mkdir(parents=True, exist_ok=True)
    except OSError:
        # Em ambientes read-only (ex.: Vercel sem Blob) nao e possivel criar diretorio
        raise RuntimeError(
            "Upload de avatar indisponivel: defina BLOB_READ_WRITE_TOKEN no projeto Vercel "
            "(Storage > Blob) para usar armazenamento em nuvem."
        ) from None
    filename = Path(pathname).name
    path = avatars_dir / filename
    path.write_bytes(content)
    return f"/uploads/avatars/{filename}"
