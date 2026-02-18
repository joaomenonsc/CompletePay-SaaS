# CompletePay Agent

Agente de IA do CompletePay baseado no framework [Agno](https://github.com/agno-agi/agno), com memoria persistente, RAG, time de agentes especializados e guardrails de seguranca.

## Requisitos

- Python 3.11+
- PostgreSQL com extensao [pgvector](https://github.com/pgvector/pgvector)
- Redis (opcional, para cache)
- Chaves de API: Google (Gemini) para o agente e embeddings; opcional Anthropic/OpenAI

## Configuracao

1. Copie o ambiente e ajuste as variaveis:

```bash
cp .env.example .env
# Edite .env: DATABASE_URL, REDIS_URL, GOOGLE_API_KEY, etc.
```

2. Suba os servicos (PostgreSQL e Redis) com Docker:

```bash
docker compose -f docker/docker-compose.yml up -d
```

3. Rode as migracoes e prepare o banco (tabelas do Agno, schema, pgvector):

```bash
python scripts/migrate_db.py
```

4. Popule a base de conhecimento (RAG) com politicas e FAQ:

```bash
completepay-agent seed-knowledge
# ou: python scripts/seed_knowledge.py
```

Requer `GOOGLE_API_KEY` para gerar os embeddings.

## Execucao local

### CLI (chat interativo)

```bash
# Instalar dependencias (na raiz do projeto)
pip install -e .

# Chat com modelo padrao (gemini_fast)
completepay-agent chat

# Com opcoes: user-id, session-id, modelo
completepay-agent chat --user-id user-123 --model quality
```

Modelos disponiveis: `quality`, `speed`, `cost`, `gemini_fast`, `gemini_pro`.

### API

```bash
uvicorn src.api.app:app --host 0.0.0.0 --port 8000
```

- Documentacao interativa: http://localhost:8000/docs  
- Health: `GET http://localhost:8000/health`  
- Chat: `POST http://localhost:8000/chat` com body JSON: `{"message": "Ola", "user_id": "default"}`

### Verificar saude dos servicos

```bash
completepay-agent health
# ou: python scripts/health_check.py
```

## Stack completo (Backend + Frontend no Docker)

Para subir backend, frontend, Postgres e Redis de uma vez:

```bash
# A partir de apps/backend
docker compose -f docker/docker-compose.full-stack.yml up -d
```

- Frontend: http://localhost:3000  
- Backend API: http://localhost:8000 (docs: http://localhost:8000/docs)

O frontend (Next.js) é buildado com `NEXT_PUBLIC_API_URL=http://localhost:8000` para o navegador chamar a API. Para outra URL (ex.: produção), use o build-arg `NEXT_PUBLIC_API_URL` no serviço `frontend` do compose.

## Producao (Docker)

Build e execucao com docker-compose de producao:

```bash
docker compose -f docker/docker-compose.prod.yml up -d
```

A aplicacao sobe na porta 8000, com politicas de restart e limites de recursos. Configure `.env` com `APP_ENV=production` e variaveis de producao (incl. `DATABASE_URL`, `REDIS_URL`, `GOOGLE_API_KEY`).

## Deploy na Vercel

É possível publicar a API FastAPI na Vercel como **serverless** (uma função por requisição).

### Passos

1. No [dashboard da Vercel](https://vercel.com), crie um **novo projeto** e importe o mesmo repositório do frontend.
2. Em **Root Directory**, defina: `apps/backend`.
3. A Vercel detecta FastAPI e usa o entrypoint `src/app.py` (que re-exporta a aplicação).
4. **Variáveis de ambiente**: em Settings → Environment Variables, configure pelo menos:
   - `DATABASE_URL` – PostgreSQL (ex.: Vercel Postgres, Neon, Supabase)
   - `REDIS_URL` – Redis (ex.: Upstash)
   - `JWT_SECRET` – segredo para tokens
   - `CORS_ORIGINS` – domínio do frontend (ex.: `https://seu-app.vercel.app`)
   - `GOOGLE_API_KEY` (e outras chaves de LLM que usar)
5. As migrações e o seed do banco precisam ser rodados **fora** da Vercel (localmente ou em outro job), apontando para o mesmo `DATABASE_URL`.

### Limitações

- **WebSockets**: a Vercel executa uma função por requisição HTTP. O endpoint de **chat por WebSocket** (`/ws/chat`) pode não funcionar como conexão longa; para chat em tempo real em produção, avalie um serviço dedicado (ex.: Ably, Pusher) ou hospedar o backend em Railway/Render/Fly.io onde o processo fica ativo.
- **Tamanho do bundle**: o deploy tem limite de 250 MB; evite incluir arquivos desnecessários (a Vercel ignora automaticamente pastas como `__pycache__` e `.venv` quando aplicável).

## Estrutura principal

- `src/agents/` – Agente base e especialistas (Payment, Support, Fraud)
- `src/teams/` – Time CompletePay (Supervisor)
- `src/workflows/` – Workflow de disputa de pagamento
- `src/guardrails/` – Validacao de entrada/saida e PII
- `src/api/` – FastAPI: rotas `/chat`, `/health` e middlewares
- `src/cli/` – CLI Typer (chat, seed-knowledge, health)
- `src/knowledge/` – Configuracao RAG e documentos fonte

## Rodar no Portainer

Para subir a aplicacao como stack no [Portainer](https://www.portainer.io/), use o compose em `docker/docker-compose.portainer.yml` e siga o guia **[docs/portainer.md](docs/portainer.md)** (build a partir do Git ou uso de imagem pre-construida).

## Documentacao

- [Referencia da API](docs/api.md) – Endpoints e exemplos
- [Portainer](docs/portainer.md) – Deploy no Portainer
- [Arquitetura](agno-agent-architecture.md) – Visao geral e fases do projeto

## Licenca

Uso interno CompletePay.
