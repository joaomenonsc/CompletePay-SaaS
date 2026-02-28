---
paths: "apps/backend/tests/**"
---

# Tests — Backend (pytest)

> Última verificação: 2026-02-25
> Atualizar quando: adicionar novo tipo de fixture, mudar convenção de naming, novo módulo CRM

## Estrutura

```
tests/
├── conftest.py              # Fixtures compartilhadas (atualmente vazio — fixtures por módulo)
├── unit/                    # Testes sem dependências externas (sem DB, sem HTTP)
│   ├── test_calendar/       # Availability engine, booking service, webhook service
│   ├── test_guardrails/     # Input validators, PII detector, output sanitizers
│   ├── test_tools/          # Payment, support, compliance tools
│   ├── test_workflows/      # Payment dispute workflow
│   └── test_ws_chat.py
└── integration/             # Testes com DB real ou TestClient
    ├── test_calendar/       # Calendar API (public + autenticada) + conftest.py com fixtures
    ├── test_agents/
    ├── test_rag_e2e.py
    └── test_agent_with_knowledge_rag.py
```

## Executar testes

```bash
# Da raiz do backend
cd apps/backend
pytest                              # todos
pytest tests/unit/                  # apenas unit
pytest tests/integration/           # apenas integração (requer DATABASE_URL)
pytest -m "not integration"         # excluir integração
pytest tests/unit/test_calendar/    # módulo específico
pytest -v -s                        # verbose com print output
```

## Padrão de fixture (conftest.py por módulo)

Baseado em `tests/integration/test_calendar/conftest.py`:

```python
"""Fixtures para testes de <módulo>."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from src.api.app import app
from src.db.session import SessionLocal
from src.db.models import Organization, UserOrganization

TEST_ORG_SLUG = "test-<modulo>-int"
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture(scope="module")
def db_session():
    """Sessão de DB compartilhada no módulo."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module")
def client():
    """TestClient da aplicação FastAPI."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def seed(db_session):
    """Cria dados de teste. Remove no teardown."""
    org = Organization(name="Test Org", slug=TEST_ORG_SLUG)
    db_session.add(org)
    db_session.commit()

    yield {"org_id": org.id, "org_slug": org.slug}

    # Teardown: deletar em ordem inversa de dependências
    db_session.execute(delete(Organization).where(Organization.id == org.id))
    db_session.commit()


@pytest.fixture(scope="module")
def auth_headers(db_session, seed):
    """Headers JWT + X-Organization-Id para rotas autenticadas."""
    import jwt
    from src.config.settings import get_settings

    uo = UserOrganization(
        user_id=TEST_USER_ID,
        organization_id=seed["org_id"],
        role="gcl",  # usar role com permissão para os endpoints testados
    )
    db_session.add(uo)
    db_session.commit()

    secret = get_settings().jwt_secret
    token = jwt.encode({"sub": TEST_USER_ID, "role": "user"}, secret, algorithm="HS256")

    yield {
        "Authorization": f"Bearer {token}",
        "X-Organization-Id": seed["org_id"],
    }

    db_session.execute(
        delete(UserOrganization).where(
            UserOrganization.user_id == TEST_USER_ID,
            UserOrganization.organization_id == seed["org_id"],
        )
    )
    db_session.commit()
```

## Padrão de teste de rota CRM

```python
def test_list_patients(client, auth_headers, seed):
    response = client.get(
        "/api/v1/crm/patients",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)


def test_create_patient(client, auth_headers, seed):
    payload = {
        "full_name": "João da Silva",
        "birth_date": "1990-01-15",
        "phone": "11987654321",
    }
    response = client.post(
        "/api/v1/crm/patients",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["full_name"] == "João da Silva"
    assert "id" in data
```

## Convenções

| Item | Convenção |
|------|-----------|
| Arquivo | `test_<modulo>.py` |
| Função | `test_<acao>_<cenario>` (ex: `test_create_patient_duplicate_cpf`) |
| Fixtures | `scope="module"` para fixtures pesadas (DB seed) |
| IDs de teste | Usar UUIDs fixos `00000000-0000-0000-0000-00000000000X` |
| Slugs de teste | Prefixar com `test-` (ex: `test-calendar-int`) |
| Teardown | Sempre remover dados criados em fixtures — na ordem inversa de FK |

## Markers

```python
# Marcar testes que precisam de DB
@pytest.mark.integration
def test_algo_com_banco(...):
    ...
```

```bash
# Rodar sem integração (CI sem banco)
pytest -m "not integration"
```

## Regras

1. Unit tests: **sem** `db_session`, **sem** `client` — usar mocks/stubs
2. Integration tests: usar `TestClient(app)` — não `requests` direto
3. Nunca hardcodar `organization_id` reais — usar fixture `seed`
4. Teardown obrigatório: testes sujos deixam dados que quebram outros testes
5. Ordem de delete no teardown: respeitar foreign keys (filhos antes de pais)
6. Para testar CRM, o role na fixture deve corresponder ao `require_org_role` do endpoint
