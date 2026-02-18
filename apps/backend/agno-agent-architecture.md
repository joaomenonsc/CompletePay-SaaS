# Arquitetura do Agente de IA com Agno Framework

**Autor:** Aria (Architect Agent)
**Data:** 2026-02-13
**Status:** Proposta Arquitetural
**Framework:** Agno v2.5.x (https://github.com/agno-agi/agno)

---

## Indice

1. [Visao Geral da Arquitetura](#1-visao-geral-da-arquitetura)
2. [Componentes Principais](#2-componentes-principais)
3. [Fluxo de Dados e Comunicacao](#3-fluxo-de-dados-e-comunicacao)
4. [Estrutura de Diretorios](#4-estrutura-de-diretorios)
5. [Integracoes e Ferramentas](#5-integracoes-e-ferramentas)
6. [Padroes de Design](#6-padroes-de-design)
7. [Escalabilidade e Deployment](#7-escalabilidade-e-deployment)
8. [Seguranca](#8-seguranca)
9. [Decisoes Arquiteturais](#9-decisoes-arquiteturais)
10. [Trade-offs e Alternativas](#10-trade-offs-e-alternativas)

---

## 1. Visao Geral da Arquitetura

### 1.1 Contexto do Sistema

O CompletePay necessita de um agente de IA capaz de operar de forma autonoma, com memoria persistente, acesso a ferramentas externas, e capacidade de aprender com interacoes anteriores. O Agno framework foi selecionado por ser um framework Python leve, model-agnostic, async-first, com suporte nativo a multimodalidade e um ecossistema maduro de 120+ toolkits.

### 1.2 Principios Arquiteturais

| Principio | Descricao | Alinhamento AIOS |
|-----------|-----------|------------------|
| CLI First | O agente deve funcionar 100% via CLI antes de qualquer UI | Constitution Art. I |
| Model-Agnostic | Trocar LLM provider sem reescrever codigo | Flexibilidade |
| Learning by Default | Agente melhora com cada interacao | Valor incremental |
| Data Sovereignty | Dados nunca saem do ambiente do cliente | Seguranca |
| Progressive Complexity | Simples para iniciar, escala quando necessario | Pragmatismo |
| Async-First | Operacoes longas nao bloqueiam o sistema | Performance |

### 1.3 Diagrama de Arquitetura de Alto Nivel

```
+------------------------------------------------------------------+
|                        CompletePay Agent System                   |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------+     +-------------------+                    |
|  |   CLI Interface  |     |   API Interface   |                    |
|  |  (Primary Entry) |     | (FastAPI/AgentOS) |                    |
|  +--------+---------+     +--------+----------+                    |
|           |                        |                               |
|           v                        v                               |
|  +------------------------------------------------+               |
|  |              Agent Orchestration Layer           |               |
|  |  +----------+  +-----------+  +---------------+ |               |
|  |  |  Router  |  | Supervisor|  |   Workflow    | |               |
|  |  |  Agent   |  |   Agent   |  |   Engine      | |               |
|  |  +----------+  +-----------+  +---------------+ |               |
|  +------------------------------------------------+               |
|           |                                                        |
|           v                                                        |
|  +------------------------------------------------+               |
|  |            Specialized Agent Layer              |               |
|  |  +--------+ +--------+ +--------+ +----------+ |               |
|  |  |Payment | |Support | |Fraud   | |Analytics | |               |
|  |  | Agent  | | Agent  | | Agent  | |  Agent   | |               |
|  |  +--------+ +--------+ +--------+ +----------+ |               |
|  +------------------------------------------------+               |
|           |                                                        |
|           v                                                        |
|  +------------------------------------------------+               |
|  |            Core Services Layer                  |               |
|  | +--------+ +--------+ +---------+ +----------+ |               |
|  | | Tools  | | Memory | |Knowledge| | Storage  | |               |
|  | | Engine | | System | |  Base   | |  Layer   | |               |
|  | +--------+ +--------+ +---------+ +----------+ |               |
|  +------------------------------------------------+               |
|           |                                                        |
|           v                                                        |
|  +------------------------------------------------+               |
|  |          Infrastructure Layer                   |               |
|  | +--------+ +----------+ +---------+ +--------+ |               |
|  | |  LLM   | |  Vector  | | SQL DB  | | Cache  | |               |
|  | |Provider| |   Store   | |(Postgres)| |(Redis)| |               |
|  | +--------+ +----------+ +---------+ +--------+ |               |
|  +------------------------------------------------+               |
+------------------------------------------------------------------+
```

---

## 2. Componentes Principais

### 2.1 Agent Core (Nucleo do Agente)

O componente central e a classe `Agent` do Agno, que encapsula o loop de controle stateful sobre o modelo LLM stateless.

```python
from agno.agent import Agent
from agno.models.anthropic import Claude
from agno.db.postgres import PostgresDb

agent = Agent(
    name="completepay-agent",
    model=Claude(id="claude-sonnet-4-5"),
    db=PostgresDb(db_url="postgresql://..."),
    instructions=[
        "Voce e o agente inteligente do CompletePay.",
        "Sempre responda em portugues.",
        "Priorize seguranca em todas as operacoes financeiras.",
    ],
    add_history_to_context=True,
    num_history_runs=5,
    learning=True,
    markdown=True,
)
```

**Responsabilidades:**
- Receber e interpretar input do usuario
- Gerenciar o loop de execucao (input -> model -> tool calls -> response)
- Manter estado da sessao
- Coordenar acesso a tools, memory e knowledge

**Parametros Criticos:**

| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `model` | Model | Provider LLM (Anthropic, OpenAI, Google, local) |
| `db` | Database | Backend de persistencia (PostgresDb, SqliteDb) |
| `tools` | list[Tool] | Ferramentas disponiveis para o agente |
| `instructions` | list[str] | Instrucoes de comportamento |
| `knowledge` | Knowledge | Base de conhecimento (RAG) |
| `learning` | bool | Habilita aprendizado persistente |
| `add_history_to_context` | bool | Inclui historico na janela de contexto |
| `num_history_runs` | int | Quantidade de runs anteriores no contexto |
| `update_memory_on_run` | bool | Atualiza memoria automaticamente |
| `input_schema` | BaseModel | Schema tipado de entrada |
| `output_schema` | BaseModel | Schema tipado de saida |

### 2.2 Tools Engine (Motor de Ferramentas)

Ferramentas permitem ao agente interagir com sistemas externos. O Agno converte automaticamente funcoes Python em JSON Schema para function calling.

```python
from agno.tools import tool
from agno.tools.function import ToolResult

@tool
def process_payment(
    amount: float,
    currency: str,
    recipient_id: str,
    description: str
) -> str:
    """Processa um pagamento no sistema CompletePay.

    Args:
        amount (float): Valor do pagamento.
        currency (str): Moeda (BRL, USD, EUR).
        recipient_id (str): ID do destinatario.
        description (str): Descricao do pagamento.
    """
    # Logica de processamento
    result = payment_service.process(amount, currency, recipient_id, description)
    return f"Pagamento de {amount} {currency} processado. ID: {result.transaction_id}"

@tool
def check_balance(account_id: str) -> str:
    """Consulta o saldo de uma conta.

    Args:
        account_id (str): ID da conta.
    """
    balance = account_service.get_balance(account_id)
    return f"Saldo: {balance.amount} {balance.currency}"
```

**Categorias de Tools:**

| Categoria | Tools | Responsabilidade |
|-----------|-------|------------------|
| Payment | `process_payment`, `refund_payment`, `check_status` | Operacoes financeiras |
| Account | `check_balance`, `get_transactions`, `get_statement` | Consulta de conta |
| Support | `create_ticket`, `escalate_issue`, `get_faq` | Suporte ao cliente |
| Compliance | `verify_identity`, `check_sanctions`, `audit_log` | Conformidade regulatoria |
| Analytics | `get_report`, `get_metrics`, `forecast_revenue` | Relatorios e metricas |
| Internal | `search_docs`, `get_policies`, `check_limits` | Operacoes internas |

**Parametros Built-in Automaticos:**

O Agno injeta automaticamente parametros especiais nas tools:
- `run_context`: Acesso ao estado da sessao e dados persistentes
- `agent`: Referencia ao agente que invocou a tool
- `images`, `videos`, `audio`, `files`: Acesso a midia multimodal

### 2.3 Memory System (Sistema de Memoria)

O sistema de memoria do Agno opera em tres camadas distintas:

```
+--------------------------------------------------+
|                 Memory Architecture               |
+--------------------------------------------------+
|                                                    |
|  Layer 1: Session History (Historico de Sessao)    |
|  +-----------------------------------------+      |
|  | Conversas recentes no contexto           |      |
|  | Controlado por: num_history_runs         |      |
|  | Escopo: Sessao atual                     |      |
|  +-----------------------------------------+      |
|                                                    |
|  Layer 2: User Memory (Memoria do Usuario)         |
|  +-----------------------------------------+      |
|  | Fatos aprendidos sobre o usuario         |      |
|  | Controlado por: update_memory_on_run     |      |
|  | Escopo: Cross-session, por user_id       |      |
|  +-----------------------------------------+      |
|                                                    |
|  Layer 3: Learned Knowledge (Conhecimento)         |
|  +-----------------------------------------+      |
|  | Insights e padroes transferiveis         |      |
|  | Controlado por: learning=True            |      |
|  | Escopo: Cross-user, global               |      |
|  +-----------------------------------------+      |
|                                                    |
+--------------------------------------------------+
```

**Modos de Operacao da Memoria:**

| Modo | Flag | Comportamento |
|------|------|---------------|
| Automatico | `update_memory_on_run=True` | Extrai e armazena fatos apos cada interacao |
| Agentico | `enable_agentic_memory=True` | Agente decide autonomamente o que memorizar |

IMPORTANTE: Estes modos sao mutuamente exclusivos. Se ambos estiverem habilitados, o modo agentico prevalece.

**Esquema de Armazenamento:**

A tabela `agno_memories` e criada automaticamente:

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `memory_id` | UUID | Identificador unico |
| `content` | TEXT | Conteudo da memoria |
| `topics` | ARRAY | Topicos relacionados |
| `input` | TEXT | Input que gerou a memoria |
| `user_id` | VARCHAR | ID do usuario |
| `agent_id` | VARCHAR | ID do agente |
| `team_id` | VARCHAR | ID do time (se aplicavel) |
| `updated_at` | TIMESTAMP | Ultima atualizacao |

### 2.4 Knowledge Base (Base de Conhecimento)

Implementa Retrieval-Augmented Generation (RAG) para fornecer ao agente informacoes alem dos dados de treinamento do modelo.

```python
from agno.knowledge.pdf_url import PDFUrlKnowledgeBase
from agno.knowledge.text import TextKnowledgeBase
from agno.vectordb.pgvector import PgVector
from agno.embedder.openai import OpenAIEmbedder

# Knowledge base com documentos do CompletePay
knowledge_base = TextKnowledgeBase(
    sources=[
        "docs/policies/payment-policies.md",
        "docs/policies/compliance-rules.md",
        "docs/faq/customer-faq.md",
    ],
    vector_db=PgVector(
        table_name="completepay_knowledge",
        db_url="postgresql://...",
        embedder=OpenAIEmbedder(id="text-embedding-3-small"),
    ),
    # Estrategia de chunking
    chunk_size=1000,
    chunk_overlap=200,
)

agent = Agent(
    knowledge=knowledge_base,
    search_knowledge=True,  # Agentic RAG (agente decide quando buscar)
)
```

**Pipeline de Conhecimento:**

```
Documentos  -->  Chunking  -->  Embedding  -->  Vector Store  -->  Agent Query
 (PDF, MD,      (Semantic,     (OpenAI,        (PgVector,        (Hybrid
  CSV, URL)      Fixed,         Cohere,          Pinecone,         Search)
                 Recursive)     HuggingFace)     LanceDB)
```

**Abordagens RAG:**

| Abordagem | Descricao | Quando Usar |
|-----------|-----------|-------------|
| Agentic RAG | Agente decide autonomamente quando buscar | Padrao recomendado |
| Traditional RAG | Injeta contexto em todas as queries | Quando precisao maxima e necessaria |
| Hybrid Search | Combina busca vetorial + keyword | Dados com termos tecnicos especificos |

**Vector Stores Suportados (25+):**

| Categoria | Opcoes |
|-----------|--------|
| Managed | Pinecone, Weaviate, Qdrant, Milvus |
| Self-hosted | PgVector (recomendado), ChromaDB, LanceDB |
| Cloud-native | AWS OpenSearch, Azure AI Search |

[AUTO-DECISION] Qual vector store usar? -> PgVector (reason: CompletePay ja usa PostgreSQL via Supabase conforme technical-preferences, evita nova dependencia de infra)

### 2.5 Storage Layer (Camada de Persistencia)

Gerencia persistencia de sessoes, estado do agente e historico de conversas.

```python
from agno.db.postgres import PostgresDb, AsyncPostgresDb

# Sincrono (desenvolvimento)
db = PostgresDb(db_url="postgresql://user:pass@localhost:5432/completepay")

# Assincrono (producao)
db = AsyncPostgresDb(db_url="postgresql+psycopg_async://user:pass@localhost:5432/completepay")

agent = Agent(
    db=db,
    add_history_to_context=True,
    num_history_runs=5,
)
```

**Backends Suportados (13+):**

| Backend | Uso Recomendado |
|---------|-----------------|
| PostgresDb | Producao (recomendado) |
| AsyncPostgresDb | Producao com alta concorrencia |
| SqliteDb | Desenvolvimento local |
| MongoDb | Dados semi-estruturados |
| Redis | Cache de sessoes de alta performance |

[AUTO-DECISION] Qual backend de storage? -> PostgresDb/AsyncPostgresDb (reason: alinhado com stack existente Supabase/PostgreSQL)

### 2.6 Teams (Equipes de Agentes)

O sistema de Teams permite compor multiplos agentes especializados que colaboram.

```python
from agno.agent import Agent
from agno.team import Team
from agno.models.anthropic import Claude

# Agentes especializados
payment_agent = Agent(
    name="Payment Specialist",
    role="Processa e consulta operacoes de pagamento",
    model=Claude(id="claude-sonnet-4-5"),
    tools=[process_payment, check_status, refund_payment],
    instructions=["Especialista em operacoes de pagamento do CompletePay."],
)

support_agent = Agent(
    name="Support Specialist",
    role="Atende duvidas e problemas dos clientes",
    model=Claude(id="claude-sonnet-4-5"),
    tools=[create_ticket, get_faq, escalate_issue],
    instructions=["Especialista em suporte ao cliente CompletePay."],
)

fraud_agent = Agent(
    name="Fraud Analyst",
    role="Analisa e detecta transacoes suspeitas",
    model=Claude(id="claude-sonnet-4-5"),
    tools=[check_sanctions, verify_identity, audit_log],
    instructions=["Analista de fraude. Priorize seguranca."],
)

# Team com Supervisor
completepay_team = Team(
    name="CompletePay Agent Team",
    mode="supervisor",  # supervisor | router | broadcast
    model=Claude(id="claude-sonnet-4-5"),
    members=[payment_agent, support_agent, fraud_agent],
    instructions=[
        "Voce coordena o time de agentes do CompletePay.",
        "Delegue tarefas ao especialista mais adequado.",
        "Para questoes de pagamento, use Payment Specialist.",
        "Para duvidas gerais, use Support Specialist.",
        "Para suspeitas de fraude, SEMPRE consulte Fraud Analyst.",
    ],
    db=AsyncPostgresDb(db_url="postgresql+psycopg_async://..."),
    learning=True,
)
```

**Modos de Coordenacao:**

| Modo | Comportamento | Caso de Uso |
|------|---------------|-------------|
| `supervisor` | Lider decompoe tarefas, controla qualidade, sintetiza resultados | Padrao. Tarefas complexas multi-dominio |
| `router` | Roteia diretamente ao especialista sem sintese | Classificacao rapida. FAQ e suporte L1 |
| `broadcast` | Envia para todos os membros em paralelo | Analise multi-perspectiva. Due diligence |

### 2.7 Workflows (Fluxos de Trabalho)

Workflows orquestram agentes e funcoes em pipelines sequenciais com branching condicional. Diferem de Teams por serem deterministicos (passos pre-definidos) ao inves de adaptativos.

```python
from agno.workflow import Workflow

class PaymentDisputeWorkflow(Workflow):
    """Workflow para processar disputas de pagamento."""

    fraud_agent: Agent = fraud_agent
    support_agent: Agent = support_agent
    payment_agent: Agent = payment_agent

    def run(self, dispute_id: str) -> str:
        # Step 1: Analise de fraude
        fraud_analysis = self.fraud_agent.run(
            f"Analise a transacao {dispute_id} para indicios de fraude."
        )

        # Step 2: Branching condicional
        if "fraude confirmada" in fraud_analysis.content.lower():
            # Bloqueia e refund automatico
            result = self.payment_agent.run(
                f"Processe refund para disputa {dispute_id}."
            )
        else:
            # Encaminha para suporte humano
            result = self.support_agent.run(
                f"Crie ticket de suporte para disputa {dispute_id}."
            )

        return result.content
```

**Quando usar Teams vs Workflows:**

| Aspecto | Teams | Workflows |
|---------|-------|-----------|
| Controle | Adaptativo (agente decide) | Deterministico (passos fixos) |
| Complexidade | Tarefas abertas | Processos definidos |
| Previsibilidade | Menor | Maior |
| Auditabilidade | Media | Alta |
| Uso ideal | Conversacao, suporte | Processos de negocio, compliance |

### 2.8 Guardrails (Barreiras de Protecao)

Guardrails validam input e output do agente para garantir seguranca e conformidade.

```python
from agno.agent import Agent

def validate_payment_amount(input_text: str) -> tuple[bool, str]:
    """Valida se valores de pagamento estao dentro dos limites."""
    # Logica de validacao
    if detected_amount > MAX_TRANSACTION_LIMIT:
        return False, "Valor excede limite de transacao permitido."
    return True, ""

def sanitize_pii(output_text: str) -> tuple[bool, str]:
    """Remove PII (dados pessoais) do output."""
    # Sanitizacao de CPF, cartao, etc.
    sanitized = pii_detector.redact(output_text)
    return True, sanitized

agent = Agent(
    input_guardrails=[validate_payment_amount],
    output_guardrails=[sanitize_pii],
)
```

---

## 3. Fluxo de Dados e Comunicacao

### 3.1 Fluxo de Execucao Principal

```
                          +------------------+
                          |   User Input     |
                          +--------+---------+
                                   |
                                   v
                          +------------------+
                          | Input Guardrails |
                          | (Validacao)      |
                          +--------+---------+
                                   |
                          +--------v---------+
                          |  Agent Core      |
                          |  (Reasoning)     |
                          +--------+---------+
                                   |
                    +--------------+--------------+
                    |              |              |
                    v              v              v
             +----------+  +----------+  +------------+
             |  Memory  |  | Knowledge|  |   Tools    |
             |  Lookup  |  |  Search  |  |  Execution |
             +----+-----+  +----+-----+  +-----+------+
                  |              |              |
                  +--------------+--------------+
                                   |
                          +--------v---------+
                          |  Model (LLM)     |
                          |  Reasoning +     |
                          |  Response Gen    |
                          +--------+---------+
                                   |
                          +--------v---------+
                          | Output Guardrails|
                          | (Sanitizacao)    |
                          +--------+---------+
                                   |
                          +--------v---------+
                          | Memory Update    |
                          | (Persistencia)   |
                          +--------+---------+
                                   |
                                   v
                          +------------------+
                          |  User Response   |
                          +------------------+
```

### 3.2 Fluxo de Comunicacao Multi-Agent (Team)

```
User Request
     |
     v
+----+----+
|  Team   |
| Leader  |  (Supervisor/Router)
+----+----+
     |
     +----------+----------+----------+
     |          |          |          |
     v          v          v          v
+--------+ +--------+ +--------+ +--------+
|Agent A | |Agent B | |Agent C | |Agent D |
|Payment | |Support | | Fraud  | |Analyt. |
+---+----+ +---+----+ +---+----+ +---+----+
    |          |          |          |
    v          v          v          v
+--------+ +--------+ +--------+ +--------+
|Tools A | |Tools B | |Tools C | |Tools D |
+--------+ +--------+ +--------+ +--------+
     |          |          |          |
     +----------+----------+----------+
                |
                v
         +------+------+
         | Team Leader  |
         | (Synthesize) |
         +------+-------+
                |
                v
         Response to User
```

### 3.3 Fluxo de Dados de Aprendizado

```
Interacao do Usuario
        |
        v
+-------+--------+
| Agent processa  |
| e responde      |
+-------+---------+
        |
        v
+-------+--------+        +----------------+
| Memory extrai  +------->| User Profile   |
| fatos do user  |        | (per-user)     |
+-------+---------+        +----------------+
        |
        v
+-------+---------+        +----------------+
| Learning extrai +------->| Global Knowledge|
| padroes gerais  |        | (cross-user)   |
+----------------+         +----------------+
        |
        v
Proxima interacao usa perfil + conhecimento acumulado
```

---

## 4. Estrutura de Diretorios

### 4.1 Estrutura Recomendada

```
completepay-agent/
|
+-- pyproject.toml                    # Configuracao do projeto Python
+-- .env                              # Variaveis de ambiente (NAO versionar)
+-- .env.example                      # Template de variaveis
+-- README.md                         # Documentacao do projeto
|
+-- src/
|   +-- __init__.py
|   |
|   +-- agents/                       # Definicoes de agentes
|   |   +-- __init__.py
|   |   +-- base.py                   # Configuracao base compartilhada
|   |   +-- payment_agent.py          # Agente de pagamentos
|   |   +-- support_agent.py          # Agente de suporte
|   |   +-- fraud_agent.py            # Agente de fraude
|   |   +-- analytics_agent.py        # Agente de analytics
|   |
|   +-- teams/                        # Composicoes de agentes
|   |   +-- __init__.py
|   |   +-- completepay_team.py       # Team principal
|   |   +-- compliance_team.py        # Team de compliance
|   |
|   +-- workflows/                    # Fluxos de trabalho
|   |   +-- __init__.py
|   |   +-- payment_dispute.py        # Workflow de disputa
|   |   +-- onboarding.py             # Workflow de onboarding
|   |   +-- kyc_verification.py       # Workflow KYC
|   |
|   +-- tools/                        # Ferramentas customizadas
|   |   +-- __init__.py
|   |   +-- payment_tools.py          # Tools de pagamento
|   |   +-- account_tools.py          # Tools de conta
|   |   +-- compliance_tools.py       # Tools de compliance
|   |   +-- support_tools.py          # Tools de suporte
|   |   +-- analytics_tools.py        # Tools de analytics
|   |
|   +-- knowledge/                    # Bases de conhecimento
|   |   +-- __init__.py
|   |   +-- setup.py                  # Configuracao das knowledge bases
|   |   +-- sources/                  # Documentos fonte
|   |   |   +-- policies/             # Politicas de pagamento
|   |   |   +-- compliance/           # Regras de compliance
|   |   |   +-- faq/                  # FAQ
|   |   |   +-- procedures/           # Procedimentos operacionais
|   |
|   +-- guardrails/                   # Validacoes de seguranca
|   |   +-- __init__.py
|   |   +-- input_validators.py       # Validacao de entrada
|   |   +-- output_sanitizers.py      # Sanitizacao de saida
|   |   +-- pii_detector.py           # Detector de dados pessoais
|   |   +-- transaction_limits.py     # Limites de transacao
|   |
|   +-- models/                       # Schemas e tipos
|   |   +-- __init__.py
|   |   +-- payment.py                # Schemas de pagamento
|   |   +-- account.py                # Schemas de conta
|   |   +-- dispute.py                # Schemas de disputa
|   |
|   +-- config/                       # Configuracao
|   |   +-- __init__.py
|   |   +-- settings.py               # Settings com pydantic-settings
|   |   +-- models.py                 # Configuracao de modelos LLM
|   |   +-- database.py               # Configuracao de banco de dados
|   |
|   +-- api/                          # API REST (AgentOS/FastAPI)
|   |   +-- __init__.py
|   |   +-- app.py                    # FastAPI application
|   |   +-- routes/
|   |   |   +-- __init__.py
|   |   |   +-- chat.py               # Endpoints de chat
|   |   |   +-- admin.py              # Endpoints administrativos
|   |   |   +-- health.py             # Health checks
|   |   +-- middleware/
|   |   |   +-- __init__.py
|   |   |   +-- auth.py               # Autenticacao JWT
|   |   |   +-- rate_limit.py         # Rate limiting
|   |   |   +-- logging.py            # Request logging
|   |
|   +-- cli/                          # Interface CLI
|   |   +-- __init__.py
|   |   +-- main.py                   # Entry point CLI (Typer/Click)
|   |   +-- commands/
|   |   |   +-- __init__.py
|   |   |   +-- chat.py               # Comando de chat interativo
|   |   |   +-- knowledge.py          # Gestao de knowledge base
|   |   |   +-- admin.py              # Comandos administrativos
|
+-- tests/                            # Testes
|   +-- __init__.py
|   +-- conftest.py                   # Fixtures compartilhadas
|   +-- unit/
|   |   +-- test_tools/
|   |   +-- test_guardrails/
|   |   +-- test_models/
|   +-- integration/
|   |   +-- test_agents/
|   |   +-- test_teams/
|   |   +-- test_workflows/
|   +-- e2e/
|       +-- test_chat_flow.py
|       +-- test_payment_flow.py
|
+-- scripts/                          # Scripts utilitarios
|   +-- seed_knowledge.py             # Popular knowledge base
|   +-- migrate_db.py                 # Migracoes de banco
|   +-- benchmark.py                  # Benchmark de performance
|
+-- docker/
|   +-- Dockerfile                    # Container da aplicacao
|   +-- docker-compose.yml            # Compose com servicos
|   +-- docker-compose.dev.yml        # Compose para desenvolvimento
|
+-- docs/
    +-- api.md                        # Documentacao da API
    +-- deployment.md                 # Guia de deployment
    +-- tools-reference.md            # Referencia de tools
```

### 4.2 Justificativa da Estrutura

| Diretorio | Responsabilidade | Principio |
|-----------|------------------|-----------|
| `agents/` | Um arquivo por agente especializado | Single Responsibility |
| `teams/` | Composicoes de agentes | Composition over Inheritance |
| `workflows/` | Processos deterministicos | Separation of Concerns |
| `tools/` | Funcoes de integracao externa | Interface Segregation |
| `knowledge/` | RAG e documentos | Data-Centric Design |
| `guardrails/` | Validacao e seguranca | Defense in Depth |
| `models/` | Schemas tipados | Type Safety |
| `config/` | Configuracao centralizada | Configuration as Code |
| `cli/` | Interface primaria | CLI First (Constitution Art. I) |
| `api/` | Interface secundaria | Progressive Enhancement |

---

## 5. Integracoes e Ferramentas

### 5.1 Mapa de Integracoes

```
+------------------------------------------------------------------+
|                    CompletePay Agent Integrations                  |
+------------------------------------------------------------------+
|                                                                    |
|  LLM Providers           Vector Stores          Databases          |
|  +---------------+       +-------------+        +-----------+     |
|  | Anthropic     |       | PgVector    |        | PostgreSQL|     |
|  | (Primary)     |       | (Primary)   |        | (Supabase)|     |
|  +---------------+       +-------------+        +-----------+     |
|  | OpenAI        |       | Pinecone    |        | Redis     |     |
|  | (Fallback)    |       | (Scale-out) |        | (Cache)   |     |
|  +---------------+       +-------------+        +-----------+     |
|                                                                    |
|  External APIs            Internal Services      Observability     |
|  +---------------+       +-------------+        +-----------+     |
|  | Payment GW    |       | Auth Service|        | Logs      |     |
|  | Banking API   |       | User Service|        | Tracing   |     |
|  | KYC Provider  |       | Notification|        | Metrics   |     |
|  | Sanctions DB  |       | Audit Trail |        | AgentOS   |     |
|  +---------------+       +-------------+        +-----------+     |
|                                                                    |
|  Communication           MCP Integration                          |
|  +---------------+       +--------------------+                   |
|  | Slack         |       | Context7 (docs)    |                   |
|  | WhatsApp      |       | Exa (search)       |                   |
|  | Email (SMTP)  |       | Custom MCP servers |                   |
|  +---------------+       +--------------------+                   |
|                                                                    |
+------------------------------------------------------------------+
```

### 5.2 Tools Built-in do Agno Relevantes

| Toolkit | Import | Uso no CompletePay |
|---------|--------|--------------------|
| `DuckDuckGoTools` | `agno.tools.duckduckgo` | Pesquisa web para suporte |
| `Newspaper4kTools` | `agno.tools.newspaper4k` | Extracao de noticias financeiras |
| `MCPTools` | `agno.tools.mcp` | Integracao com servidores MCP |
| `PythonTools` | `agno.tools.python` | Execucao de codigo Python |
| `FileTools` | `agno.tools.file` | Manipulacao de arquivos |
| `SlackTools` | `agno.tools.slack` | Notificacoes via Slack |
| `EmailTools` | `agno.tools.email` | Envio de emails |

### 5.3 MCP Integration

O Agno tem suporte nativo a MCP (Model Context Protocol), permitindo expor o agente como servidor MCP ou consumir servidores MCP externos:

```python
from agno.tools.mcp import MCPTools

# Consumir servidor MCP externo
mcp_tools = MCPTools(server_url="http://localhost:8080/mcp")

agent = Agent(
    tools=[mcp_tools],
)
```

### 5.4 Configuracao de Modelos LLM

```python
# src/config/models.py

from agno.models.anthropic import Claude
from agno.models.openai import OpenAIResponses
from agno.models.google import Gemini

# Modelo primario (alta qualidade)
PRIMARY_MODEL = Claude(id="claude-sonnet-4-5")

# Modelo rapido (baixa latencia)
FAST_MODEL = Claude(id="claude-haiku-3-5")

# Fallback (provider alternativo)
FALLBACK_MODEL = OpenAIResponses(id="gpt-4.1-mini")

# Modelo de embedding
EMBEDDING_MODEL = "text-embedding-3-small"  # OpenAI
```

**Estrategia de selecao de modelo:**

| Cenario | Modelo | Justificativa |
|---------|--------|---------------|
| Conversacao padrao | Claude Sonnet 4.5 | Equilibrio qualidade/custo |
| Classificacao/roteamento | Claude Haiku 3.5 | Baixa latencia |
| Analise complexa de fraude | Claude Sonnet 4.5 | Alta capacidade de raciocinio |
| Fallback | GPT-4.1-mini | Redundancia de provider |

---

## 6. Padroes de Design

### 6.1 Repository Pattern (Acesso a Dados)

```python
# src/tools/payment_tools.py

from abc import ABC, abstractmethod

class PaymentRepository(ABC):
    @abstractmethod
    async def get_transaction(self, tx_id: str) -> Transaction: ...

    @abstractmethod
    async def process_payment(self, payment: PaymentRequest) -> PaymentResult: ...

class SupabasePaymentRepository(PaymentRepository):
    """Implementacao concreta usando Supabase."""

    async def get_transaction(self, tx_id: str) -> Transaction:
        result = await self.client.table("transactions").select("*").eq("id", tx_id).single().execute()
        return Transaction(**result.data)
```

### 6.2 Strategy Pattern (Selecao de Modelo)

```python
# src/config/models.py

from enum import Enum

class ModelStrategy(str, Enum):
    QUALITY = "quality"       # Claude Sonnet 4.5
    SPEED = "speed"           # Claude Haiku 3.5
    COST = "cost"             # GPT-4.1-mini
    FALLBACK = "fallback"     # Provider alternativo

def get_model(strategy: ModelStrategy = ModelStrategy.QUALITY):
    models = {
        ModelStrategy.QUALITY: Claude(id="claude-sonnet-4-5"),
        ModelStrategy.SPEED: Claude(id="claude-haiku-3-5"),
        ModelStrategy.COST: OpenAIResponses(id="gpt-4.1-mini"),
        ModelStrategy.FALLBACK: OpenAIResponses(id="gpt-4.1"),
    }
    return models[strategy]
```

### 6.3 Factory Pattern (Criacao de Agentes)

```python
# src/agents/base.py

from agno.agent import Agent
from src.config.database import get_db
from src.config.models import get_model, ModelStrategy

def create_agent(
    name: str,
    role: str,
    tools: list,
    instructions: list[str],
    model_strategy: ModelStrategy = ModelStrategy.QUALITY,
    learning: bool = True,
) -> Agent:
    """Factory para criar agentes com configuracao padrao."""
    return Agent(
        name=name,
        role=role,
        model=get_model(model_strategy),
        db=get_db(),
        tools=tools,
        instructions=[
            "Voce e um agente do CompletePay.",
            "Sempre responda em portugues.",
            *instructions,
        ],
        add_history_to_context=True,
        num_history_runs=5,
        learning=learning,
        markdown=True,
    )
```

### 6.4 Chain of Responsibility (Guardrails)

```python
# src/guardrails/input_validators.py

def validate_input_chain(input_text: str) -> tuple[bool, str]:
    """Cadeia de validacoes de input."""
    validators = [
        check_injection_attempt,
        validate_transaction_limits,
        check_prohibited_content,
        validate_user_permissions,
    ]

    for validator in validators:
        is_valid, message = validator(input_text)
        if not is_valid:
            return False, message

    return True, ""
```

### 6.5 Observer Pattern (Hooks e Eventos)

O Agno suporta pre/post-hooks nativos que implementam o padrao Observer:

```python
from agno.agent import Agent

def log_interaction(agent, input_text, response):
    """Hook pos-execucao para logging."""
    audit_logger.log(
        agent_id=agent.name,
        input=input_text,
        output=response.content,
        timestamp=datetime.utcnow(),
    )

def check_compliance(agent, input_text):
    """Hook pre-execucao para compliance."""
    if contains_restricted_operation(input_text):
        require_human_approval(input_text)
```

### 6.6 Circuit Breaker (Resiliencia)

```python
# src/config/models.py

import asyncio

class ModelCircuitBreaker:
    """Circuit breaker para fallback de provider LLM."""

    def __init__(self, primary_model, fallback_model, failure_threshold=3):
        self.primary = primary_model
        self.fallback = fallback_model
        self.failures = 0
        self.threshold = failure_threshold
        self.state = "closed"  # closed | open | half-open

    async def call(self, prompt: str):
        if self.state == "open":
            return await self._call_fallback(prompt)

        try:
            result = await self._call_primary(prompt)
            self.failures = 0
            return result
        except Exception:
            self.failures += 1
            if self.failures >= self.threshold:
                self.state = "open"
            return await self._call_fallback(prompt)
```

---

## 7. Escalabilidade e Deployment

### 7.1 Arquitetura de Deployment

```
+------------------------------------------------------------------+
|                     Production Architecture                       |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------+       +------------------+                   |
|  |   Load Balancer  |       |    CDN / WAF     |                   |
|  |   (nginx/ALB)    |       |  (Cloudflare)    |                   |
|  +--------+---------+       +--------+---------+                   |
|           |                          |                             |
|           v                          v                             |
|  +--------------------------------------------------+             |
|  |           AgentOS (FastAPI Runtime)               |             |
|  |  +----------+  +----------+  +----------+        |             |
|  |  | Instance |  | Instance |  | Instance |  x N   |             |
|  |  |    1     |  |    2     |  |    3     |        |             |
|  |  +----------+  +----------+  +----------+        |             |
|  +--------------------------------------------------+             |
|           |                                                        |
|  +--------+----+-------+--------+--------+                         |
|  |             |       |        |        |                         |
|  v             v       v        v        v                         |
|  +--------+ +------+ +------+ +------+ +--------+                 |
|  |Postgres| |PgVec.| |Redis | | LLM  | |Object  |                 |
|  |(Supa.) | |(RAG) | |(Cache)| | APIs | |Storage |                 |
|  +--------+ +------+ +------+ +------+ +--------+                 |
|                                                                    |
+------------------------------------------------------------------+
```

### 7.2 Estrategia de Scaling

| Componente | Scaling | Metricas de Trigger |
|------------|---------|---------------------|
| AgentOS Instances | Horizontal (replicas) | CPU > 70%, Latencia > 2s |
| PostgreSQL | Vertical + Read Replicas | Connections > 80%, Query time > 500ms |
| PgVector | Vertical + Partitioning | Index size, Query latency |
| Redis | Cluster mode | Memory > 80%, Evictions > 0 |
| LLM API | Rate limit aware | 429 responses, Queue depth |

### 7.3 Container Configuration

```yaml
# docker/docker-compose.yml
services:
  agent-api:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://...
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379
      - AGNO_TELEMETRY=false
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 1G
          cpus: "1.0"

  postgres:
    image: pgvector/pgvector:pg16
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: completepay_agent
      POSTGRES_USER: agent
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

### 7.4 Dockerfile

```dockerfile
# docker/Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Instalar dependencias do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[prod]"

# Copiar codigo
COPY src/ src/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Iniciar
CMD ["uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 7.5 Estrategia de Deployment Progressivo

| Fase | Infra | Capacidade | Custo Estimado |
|------|-------|------------|----------------|
| MVP | 1 instancia, SQLite local | 10 users concorrentes | ~$50/mes (LLM) |
| Beta | 2 instancias, Postgres managed | 50 users concorrentes | ~$200/mes |
| Producao | 3+ instancias, Redis, PgVector | 200+ users concorrentes | ~$500-1000/mes |
| Scale | Auto-scaling, Read replicas | 1000+ users concorrentes | ~$2000+/mes |

### 7.6 CLI Entry Point (Constitution Art. I - CLI First)

```python
# src/cli/main.py
import typer
from rich.console import Console

app = typer.Typer(name="completepay-agent")
console = Console()

@app.command()
def chat(
    user_id: str = typer.Option(default="default"),
    session_id: str = typer.Option(default=None),
    model: str = typer.Option(default="quality"),
):
    """Inicia chat interativo com o agente CompletePay."""
    from src.teams.completepay_team import create_team

    team = create_team(model_strategy=model)

    console.print("[bold]CompletePay Agent[/bold] - Digite 'sair' para encerrar.")

    while True:
        user_input = console.input("[bold blue]Voce:[/bold blue] ")
        if user_input.lower() in ("sair", "exit", "quit"):
            break

        response = team.run(user_input, user_id=user_id, session_id=session_id)
        console.print(f"[bold green]Agent:[/bold green] {response.content}")

@app.command()
def seed_knowledge():
    """Popula a knowledge base com documentos."""
    from src.knowledge.setup import seed_all_knowledge_bases
    seed_all_knowledge_bases()
    console.print("[green]Knowledge base populada com sucesso.[/green]")

@app.command()
def health():
    """Verifica saude dos servicos."""
    # Check DB, LLM, Vector Store
    ...

if __name__ == "__main__":
    app()
```

---

## 8. Seguranca

### 8.1 Camadas de Seguranca

```
+------------------------------------------------------------------+
|                     Security Architecture                         |
+------------------------------------------------------------------+
|                                                                    |
|  Layer 1: Network                                                  |
|  +------------------------------------------------------+        |
|  | WAF | TLS 1.3 | Rate Limiting | IP Whitelisting      |        |
|  +------------------------------------------------------+        |
|                                                                    |
|  Layer 2: Authentication & Authorization                           |
|  +------------------------------------------------------+        |
|  | JWT Tokens | RBAC | API Keys | Session Management     |        |
|  +------------------------------------------------------+        |
|                                                                    |
|  Layer 3: Input Validation (Guardrails)                            |
|  +------------------------------------------------------+        |
|  | Prompt Injection Detection | Content Filtering         |        |
|  | Transaction Limit Validation | Schema Validation       |        |
|  +------------------------------------------------------+        |
|                                                                    |
|  Layer 4: Output Sanitization (Guardrails)                         |
|  +------------------------------------------------------+        |
|  | PII Redaction | Sensitive Data Masking                 |        |
|  | Response Schema Validation | Content Safety            |        |
|  +------------------------------------------------------+        |
|                                                                    |
|  Layer 5: Data Protection                                          |
|  +------------------------------------------------------+        |
|  | Encryption at Rest (AES-256) | Encryption in Transit   |        |
|  | Data Sovereignty | Audit Logging | LGPD Compliance     |        |
|  +------------------------------------------------------+        |
|                                                                    |
|  Layer 6: LLM Security                                             |
|  +------------------------------------------------------+        |
|  | Prompt Hardening | System Prompt Protection             |        |
|  | Model Output Monitoring | Hallucination Detection      |        |
|  +------------------------------------------------------+        |
|                                                                    |
+------------------------------------------------------------------+
```

### 8.2 Consideracoes Criticas para Fintech

| Risco | Mitigacao | Prioridade |
|-------|-----------|------------|
| Prompt injection | Input guardrails + prompt hardening | CRITICA |
| Vazamento de PII | Output guardrails + PII redaction | CRITICA |
| Transacao nao autorizada | Human-in-the-loop para valores altos | CRITICA |
| Data exfiltration via LLM | Data sovereignty (dados no seu cloud) | ALTA |
| Alucinacao em dados financeiros | Structured output + validacao contra DB | ALTA |
| Replay attack | Session tokens + nonce | ALTA |
| DDoS no LLM | Rate limiting + circuit breaker | MEDIA |
| Model poisoning via memory | Memory content validation | MEDIA |

### 8.3 Human-in-the-Loop para Operacoes Criticas

```python
from agno.agent import Agent

@tool
def process_high_value_payment(amount: float, currency: str, recipient: str) -> str:
    """Processa pagamento de alto valor (requer aprovacao humana).

    Args:
        amount (float): Valor do pagamento.
        currency (str): Moeda.
        recipient (str): Destinatario.
    """
    if amount > HIGH_VALUE_THRESHOLD:
        # Agno suporta human-in-the-loop nativamente
        approval = request_human_approval(
            action=f"Pagamento de {amount} {currency} para {recipient}",
            reason="Valor acima do limite automatico",
        )
        if not approval.approved:
            return f"Pagamento rejeitado por {approval.reviewer}."

    return payment_service.process(amount, currency, recipient)
```

---

## 9. Decisoes Arquiteturais

### ADR-001: Framework de Agentes

**Decisao:** Agno v2.5.x
**Alternativas Consideradas:** LangChain, CrewAI, AutoGen
**Justificativa:**
- Leve e Pythonico (sem abstractions desnecessarias)
- Learning/memoria nativo (diferencial critico vs. concorrentes)
- Model-agnostic com 700+ modelos suportados
- Async-first para alta concorrencia
- AgentOS para deployment production-ready
- Suporte nativo a MCP e A2A
- Comunidade ativa (37k+ stars, 400+ contributors)

### ADR-002: LLM Provider Primario

**Decisao:** Anthropic Claude Sonnet 4.5
**Justificativa:** Equilibrio entre qualidade de raciocinio, custo e velocidade. Claude tem forte performance em seguir instrucoes complexas e manter guardrails.
**Fallback:** OpenAI GPT-4.1-mini para redundancia de provider.

### ADR-003: Vector Store

**Decisao:** PgVector (extensao PostgreSQL)
**Justificativa:** Reutiliza infraestrutura existente (Supabase), elimina nova dependencia, suporta hybrid search. Para scale-out futuro, migrar para Pinecone.

### ADR-004: Storage Backend

**Decisao:** PostgreSQL (AsyncPostgresDb)
**Justificativa:** Consistente com stack existente. Async para alta concorrencia em producao. SQLite como opcao para desenvolvimento local.

### ADR-005: Modo de Coordenacao Multi-Agent

**Decisao:** Team com modo Supervisor (padrao), Router para classificacao rapida.
**Justificativa:** Supervisor oferece melhor controle de qualidade e sintese. Router para casos de baixa latencia como FAQ.

### ADR-006: Estrategia de Memoria

**Decisao:** Memoria automatica (`update_memory_on_run=True`) + Learning global (`learning=True`)
**Justificativa:** Modo automatico e mais previsivel e auditavel para fintech. Modo agentico seria considerado apos validacao do MVP.

---

## 10. Trade-offs e Alternativas

### 10.1 Agno vs Alternativas

| Aspecto | Agno | LangChain | CrewAI | AutoGen |
|---------|------|-----------|--------|---------|
| Complexidade | Baixa | Alta | Media | Media |
| Learning nativo | Sim | Nao | Nao | Nao |
| Performance | Alta (leve) | Media (overhead) | Media | Media |
| Maturidade | Alta (37k stars) | Alta (90k stars) | Media (20k) | Media (35k) |
| MCP Support | Nativo | Plugin | Nao | Nao |
| Type Safety | Nativa | Parcial | Parcial | Parcial |
| Vendor lock-in | Nenhum | Baixo | Baixo | Microsoft |
| Documentacao | Boa | Excelente | Boa | Boa |

### 10.2 Trade-offs da Arquitetura Proposta

| Decisao | Beneficio | Custo |
|---------|-----------|-------|
| Multi-agent vs Single agent | Especializacao, manutenibilidade | Mais tokens, complexidade de coordenacao |
| PgVector vs Pinecone | Simplicidade de infra, custo | Menor performance em escala extrema |
| Supervisor vs Router | Qualidade de resposta | Maior latencia (2 LLM calls) |
| Learning habilitado | Melhoria continua | Storage crescente, risco de bias |
| AsyncPostgresDb | Alta concorrencia | Complexidade de debugging |
| Claude como primario | Qualidade de raciocinio | Dependencia de provider unico (mitigado com fallback) |

### 10.3 Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| Custo de LLM APIs cresce demais | Media | Alto | Model strategy pattern, caching, Haiku para roteamento |
| Agno muda API (breaking changes) | Baixa | Medio | Pin de versao, camada de abstracao propria |
| Latencia alta em multi-agent | Media | Medio | Router mode, caching de respostas frequentes |
| Knowledge base desatualizada | Alta | Medio | Pipeline automatizado de atualizacao |
| Memoria enviesada (bias) | Baixa | Alto | Auditoria periodica, reset seletivo |

---

## Apendice A: Dependencias Python

```toml
# pyproject.toml
[project]
name = "completepay-agent"
version = "0.1.0"
requires-python = ">=3.11"

dependencies = [
    "agno>=2.5.0,<3.0",
    "anthropic>=0.40.0",
    "openai>=1.50.0",
    "pgvector>=0.3.0",
    "psycopg[binary]>=3.2.0",
    "asyncpg>=0.30.0",
    "redis>=5.0.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
    "typer>=0.15.0",
    "rich>=13.0.0",
    "uvicorn>=0.34.0",
    "fastapi>=0.115.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24.0",
    "pytest-cov>=6.0",
    "ruff>=0.8.0",
    "mypy>=1.13.0",
]
```

## Apendice B: Variaveis de Ambiente

```bash
# .env.example

# LLM Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Database
DATABASE_URL=postgresql://agent:password@localhost:5432/completepay_agent
REDIS_URL=redis://localhost:6379

# Vector Store (PgVector usa mesmo DATABASE_URL)

# Application
APP_ENV=development  # development | staging | production
LOG_LEVEL=INFO
HIGH_VALUE_THRESHOLD=10000

# Agno
AGNO_TELEMETRY=false

# Security
JWT_SECRET=...
API_RATE_LIMIT=100  # requests per minute
```

---

-- Aria, arquitetando o futuro


Tarefas:

📍 Fase 1: Setup Inicial e Infraestrutura
Objetivo: Preparar o ambiente de desenvolvimento e a infraestrutura básica de dados.
* [ ] Inicialização do Projeto
    * [ ] Criar estrutura de diretórios conforme seção 4.1 (src/, docker/, tests/, etc.).
    * [ ] Configurar pyproject.toml com as dependências listadas no Apêndice A (Agno, Anthropic, PgVector, etc.).
    * [ ] Configurar variáveis de ambiente (.env) baseado no template do Apêndice B.
    * [ ] Inicializar repositório Git.
* [ ] Infraestrutura de Dados (Docker)
    * [ ] Criar docker-compose.yml para desenvolvimento (PostgreSQL + PgVector, Redis).
    * [ ] Configurar container do PostgreSQL com extensão pgvector habilitada.
    * [ ] Implementar script de verificação de saúde (Health Check) dos serviços.
* [ ] Configuração do Banco de Dados
    * [ ] Implementar conexão via agno.db.postgres.PostgresDb (desenvolvimento) e AsyncPostgresDb(produção).
    * [ ] Criar tabelas necessárias para o Agno (memória, sessões) via scripts de migração.

📍 Fase 2: Core do Agente e Memória
Objetivo: Implementar o "cérebro" básico e a persistência de contexto.
* [ ] Configuração de Modelos (LLM)
    * [ ] Implementar src/config/models.py com Strategy Pattern (Seção 6.2).
    * [ ] Configurar Claude Sonnet 4.5 como modelo primário e GPT-4.1-mini como fallback.
    * [ ] Implementar Circuit Breaker para chamadas de LLM (Seção 6.6).
* [ ] Sistema de Memória
    * [ ] Implementar lógica de memória em 3 camadas (Sessão, Usuário, Conhecimento) conforme Seção 2.3.
    * [ ] Configurar update_memory_on_run=True para aprendizado automático.
    * [ ] Testar persistência de fatos do usuário entre sessões diferentes.
* [ ] Agente Base
    * [ ] Criar classe factory create_agent (Seção 6.3) para padronizar a criação de novos agentes.
    * [ ] Implementar prompt de sistema base (instruções globais, persona, idioma).

📍 Fase 3: Integrações e Ferramentas (Tools)
Objetivo: Conectar o agente aos sistemas externos e lógicas de negócio.
* [ ] Framework de Tools
    * [ ] Implementar Repository Pattern para acesso a dados (Seção 6.1).
    * [ ] Criar decoradores @tool tipados com Pydantic.
* [ ] Implementação das Tools Específicas
    * [ ] Payment Tools: process_payment, refund_payment, check_status.
    * [ ] Account Tools: check_balance, get_transactions.
    * [ ] Support Tools: create_ticket, get_faq.
    * [ ] Compliance Tools: verify_identity, audit_log.
    * [ ] Integration: Integrar MCPTools para conexão com servidores externos (Seção 5.3).

📍 Fase 4: RAG e Base de Conhecimento
Objetivo: Fornecer contexto documental ao agente.
* [ ] Pipeline de Ingestão
    * [ ] Configurar TextKnowledgeBase e PDFUrlKnowledgeBase (Seção 2.4).
    * [ ] Implementar PgVector como Vector Store.
    * [ ] Criar script seed_knowledge.py para popular a base com documentos de políticas e FAQ.
* [ ] Busca e Recuperação
    * [ ] Configurar estratégia de busca híbrida (Keyword + Semântica).
    * [ ] Habilitar Agentic RAG (search_knowledge=True) nos agentes relevantes.

📍 Fase 5: Agentes Especializados e Orquestração
Objetivo: Criar o time de agentes e os fluxos de trabalho complexos.
* [x] Criação de Agentes Especializados
    * [x] Implementar Payment Specialist (foco em transações).
    * [x] Implementar Support Specialist (foco em FAQ/Atendimento).
    * [x] Implementar Fraud Analyst (foco em segurança/análise).
* [x] Orquestração de Times (Teams)
    * [x] Implementar CompletePay Team no modo Supervisor (Seção 2.6).
    * [x] Definir instruções de delegação para o Supervisor (quem faz o quê).
* [x] Fluxos de Trabalho (Workflows)
    * [x] Implementar PaymentDisputeWorkflow (Seção 2.7) com lógica determinística.
    * [x] Criar testes unitários para validar os branches condicionais do workflow.

📍 Fase 6: Segurança e Guardrails
Objetivo: Proteger o sistema contra abusos e garantir conformidade.
* [x] Validação de Entrada (Input Guardrails)
    * [x] Implementar detectores de Prompt Injection.
    * [x] Implementar validação de limites financeiros (transaction_limits.py).
    * [x] Configurar Chain of Responsibility para validadores (Seção 6.4).
* [x] Sanitização de Saída (Output Guardrails)
    * [x] Implementar redator de PII (CPFs, Cartões) no output.
    * [x] Implementar validação de schema JSON para respostas estruturadas.
* [x] Human-in-the-Loop
    * [x] Implementar lógica de aprovação para transações de alto valor (Seção 8.3).

📍 Fase 7: Interface e API
Objetivo: Expor o agente para uso final.
* [x] Interface CLI (Prioridade 1)
    * [x] Implementar comando chat usando Typer e Rich (Seção 7.6).
    * [x] Adicionar flags para seleção de modelo e user_id via CLI.
* [x] API REST (AgentOS/FastAPI)
    * [x] Criar aplicação FastAPI (src/api/app.py).
    * [x] Implementar rotas /chat e /health.
    * [x] Configurar autenticação JWT e Rate Limiting.
    * [x] Implementar Middleware de logging e observabilidade.

📍 Fase 8: Deployment e Produção
Objetivo: Preparar o artefato final para deploy.
* [x] Containerização Final
    * [x] Otimizar Dockerfile para produção (multi-stage build).
    * [x] Configurar docker-compose.prod.yml com políticas de restart e limites de recursos.
* [x] Observabilidade
    * [x] Configurar logs estruturados.
    * [ ] (Opcional) Integrar com ferramentas de monitoramento de LLM (Arize/LangSmith se compatível, ou logs customizados).
* [x] Documentação Final
    * [x] Gerar referência de API.
    * [x] Atualizar README.md com instruções de seed do banco e execução local.