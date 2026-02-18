# CompletePay SaaS — Monorepo

Monorepo que reúne o **backend** (API Python/FastAPI) e o **frontend** (Next.js) do SaaS CompletePay.

## Estrutura

```
SaaS/
├── apps/
│   ├── backend/     # API CompletePay Agent (Python, FastAPI, Agno)
│   └── frontend/    # Plataforma web (Next.js)
├── package.json     # Raiz: workspaces e scripts
└── README.md
```

## Pré-requisitos

- **Node.js** ≥ 20 (para o frontend e scripts do monorepo)
- **Python** ≥ 3.11 (para o backend)
- **npm** (ou pnpm/yarn)

## Instalação

Na raiz do repositório:

```bash
npm install
```

Isso instala as dependências do frontend e do pacote da raiz (ex.: `concurrently`). O backend usa Python: entre em `apps/backend` e use o ambiente virtual existente ou crie um:

```bash
cd apps/backend
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
pip install -e ".[dev]"     # ou pip install -r requirements.txt + deps do pyproject.toml
```

## Scripts (raiz)

| Comando | Descrição |
|--------|-----------|
| `npm run dev` | Sobe backend e frontend em modo desenvolvimento |
| `npm run dev:backend` | Só o backend (API em http://localhost:8000) |
| `npm run dev:frontend` | Só o frontend (Next.js) |
| `npm run build` | Build do frontend |
| `npm run start:frontend` | Inicia o frontend em modo produção (após `build`) |
| `npm run lint` | Lint do frontend |

## Rodar só um app

- **Backend:** `npm run dev:backend` ou, dentro de `apps/backend`, `npm run dev` (com venv ativo).
- **Frontend:** `npm run dev:frontend` ou, dentro de `apps/frontend`, `npm run dev`.

## Workspaces (npm)

- `@saas/backend` — `apps/backend` (scripts para uvicorn)
- `@saas/frontend` — `apps/frontend` (Next.js)

Dependências do Node ficam nos respectivos `apps/*`; a raiz usa **npm workspaces** para orquestrar comandos e instalação.
