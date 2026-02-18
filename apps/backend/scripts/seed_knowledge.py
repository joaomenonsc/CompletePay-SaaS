#!/usr/bin/env python3
"""
Popula a base de conhecimento (RAG) com documentos de politicas e FAQ.
Fase 4 - Pipeline de ingestao. Execute apos migrate_db.py e com PostgreSQL rodando.

Uso:
  python scripts/seed_knowledge.py

Requer GOOGLE_API_KEY para gerar embeddings (Gemini).
"""
import sys
from pathlib import Path

# Projeto na raiz
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()


def main() -> int:
    from src.knowledge.setup import KNOWLEDGE_TABLE_NAME, SOURCES_DIR, get_knowledge

    knowledge = get_knowledge(table_name=KNOWLEDGE_TABLE_NAME)

    # Documentos a ingerir (paths relativos a src/knowledge/sources)
    # Para PDF/URL: knowledge.insert(url="https://...") ou path para .pdf
    docs = [
        ("policies/payment-policies.md", "Politicas de pagamento"),
        ("compliance/compliance-rules.md", "Regras de compliance"),
        ("faq/customer-faq.md", "FAQ do cliente"),
        ("procedures/onboarding.md", "Procedimento de onboarding"),
    ]

    for rel_path, name in docs:
        full_path = SOURCES_DIR / rel_path
        if not full_path.exists():
            print(f"AVISO: Arquivo nao encontrado: {full_path}")
            continue
        try:
            knowledge.insert(path=str(full_path), name=name)
            print(f"Inserido: {name} ({rel_path})")
        except Exception as e:
            print(f"Erro ao inserir {rel_path}: {e}")
            return 1

    print("Seed concluido. Base de conhecimento pronta para uso com search_knowledge=True.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
