"""
Armazenamento de documentos do paciente (CRM). Grava em uploads/documents/.
Seguindo o padrao de avatar_storage (filesystem local).
"""
from pathlib import Path


def save_document(
    organization_id: str,
    patient_id: str,
    document_id: str,
    filename: str,
    content: bytes,
    content_type: str,
) -> str:
    """
    Salva o documento e retorna o path relativo para persistir no banco.
    Path: uploads/documents/{org_id}/{patient_id}/{document_id}_{sanitized_filename}
    """
    base = Path(__file__).resolve().parent.parent.parent
    doc_dir = base / "uploads" / "documents" / organization_id / patient_id
    try:
        doc_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise RuntimeError("Upload de documento indisponivel (diretorio read-only).") from e
    # Sanitize filename: keep extension, safe name
    safe = "".join(c for c in filename if c.isalnum() or c in "._- ").strip() or "document"
    if len(safe) > 200:
        safe = safe[:200]
    ext = Path(filename).suffix or (".pdf" if "pdf" in content_type else ".bin")
    if not safe.endswith(ext):
        safe = safe + ext
    path = doc_dir / f"{document_id}_{safe}"
    path.write_bytes(content)
    return f"/uploads/documents/{organization_id}/{patient_id}/{path.name}"
