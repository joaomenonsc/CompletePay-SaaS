"""
SBP-001: Endpoint autenticado para servir documentos clínicos.
Substitui o acesso direto via StaticFiles (que era público).
"""
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from src.api.deps import require_organization_id
from src.api.middleware.auth import require_user_id
from src.db.session import get_db

logger = logging.getLogger("completepay.documents")

router = APIRouter(
    prefix="/api/v1/documents",
    tags=["documents"],
)

# Base do diretório de uploads (mesmo que document_storage.py)
_UPLOADS_BASE = Path(__file__).resolve().parent.parent.parent.parent / "uploads"


@router.get("/{org_id}/{patient_id}/{filename}")
def get_document(
    org_id: str,
    patient_id: str,
    filename: str,
    user_id: str = Depends(require_user_id),
    organization_id: str = Depends(require_organization_id),
    db: Session = Depends(get_db),
):
    """
    Serve documento clínico com autenticação e verificação de organização.
    O usuário precisa ser membro da organização que possui o documento.
    """
    # Verificar que o org_id da URL corresponde à organização autenticada
    if org_id.lower() != organization_id.lower():
        raise HTTPException(
            status_code=403,
            detail="Acesso negado: documento pertence a outra organização.",
        )

    # Montar caminho e sanitizar (evitar path traversal)
    doc_path = (_UPLOADS_BASE / "documents" / org_id / patient_id / filename).resolve()

    # Verificar que o path resolvido está dentro do diretório de uploads (path traversal guard)
    allowed_base = (_UPLOADS_BASE / "documents").resolve()
    if not str(doc_path).startswith(str(allowed_base)):
        raise HTTPException(status_code=400, detail="Caminho inválido.")

    if not doc_path.is_file():
        raise HTTPException(status_code=404, detail="Documento não encontrado.")

    logger.info(
        "Document served: org=%s patient=%s file=%s user=%s",
        org_id, patient_id, filename, user_id,
    )

    return FileResponse(
        path=str(doc_path),
        filename=filename,
        media_type="application/octet-stream",
    )
