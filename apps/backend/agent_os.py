"""
Agente de Saúde com AgentOS e Gestão de Sessões.

Sessões (docs.agno.com/sessions/overview):
- Cada conversa é uma sessão identificada por session_id.
- user_id separa usuários; session_id separa threads (ex.: abas de chat).
- Histórico das últimas num_history_runs interações é enviado no contexto.

Endpoints de gestão de sessão (AgentOS):
- POST /agents/assistente-saude/runs  → Enviar mensagem (Form: message, session_id, user_id).
  Se session_id não for enviado, uma nova sessão é criada e o session_id vem na resposta.
- POST /sessions?type=agent            → Criar sessão (body: agent_id, user_id, session_name).
- GET  /sessions                      → Listar sessões (query: user_id, session_name).
- GET  /sessions/{session_id}         → Detalhe da sessão.
- GET  /sessions/{session_id}/runs    → Runs (mensagens) da sessão.

Entrada/Saída (docs.agno.com/input-output/overview):
- Agente padrão: texto livre (message string).
- Agente estruturado (assistente-saude-estruturado): entrada/saída Pydantic, modelo de saída, multimodal.
  Entrada: JSON com schema PerguntaSaudeInput. Saída: RespostaSaudeOutput.
  Multimodal: run(..., images=[...], audio=[...]) — ver exemplo_io.py.

Avaliações (Evals, docs.agno.com/evals/overview):
- Execute: python evals_saude.py
"""
from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools.tavily import TavilyTools
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.valyu import ValyuTools
from agno.os import AgentOS
from agno.db.sqlite import SqliteDb
from dotenv import load_dotenv


load_dotenv()

# Banco SQLite para sessões, histórico e contexto (docs.agno.com/database/overview)
db = SqliteDb(db_file="agent_os.db")

AGENT_ID = "assistente-saude"
AGENT_ESTRUTURADO_ID = "assistente-saude-estruturado"

# Instruções comuns para preencher o schema de saída
# "Uma busca basta" evita que o modelo chame várias ferramentas em sequência desnecessariamente.
INSTRUCOES_SAUDE = [
    "Busque fontes confiáveis sobre o tema da pergunta quando necessário; uma busca costuma bastar.",
    "Use no máximo uma ou duas ferramentas de busca; depois responda com base no que encontrou.",
    "Se a pergunta não for sobre saúde, defina fora_do_escopo=True e responda de forma educada.",
    "Preencha sempre resumo, pontos_principais (lista) e aviso_medico.",
]

# Agente principal: entrada/saída em texto livre (chat)
# tool_call_limit evita loop: o modelo não pode ficar chamando ferramentas indefinidamente (docs.agno.com/basics/tools/tool-call-limit)
agent = Agent(
    id=AGENT_ID,
    name="Assistente de Saúde",
    role="Responda perguntas baseadas em contextos buscados na internet e em artigos científicos.",
    instructions=INSTRUCOES_SAUDE,
    model=Gemini(id="gemini-2.0-flash"),
    tools=[DuckDuckGoTools(), ValyuTools(), TavilyTools()],
    tool_call_limit=5,
    db=db,
    add_history_to_context=True,
    num_history_runs=3,
    debug_mode=True,
)

# Agente com Entrada/Saída estruturada + Modelo de saída (docs.agno.com/input-output/overview)
# - input_schema: valida entrada (JSON/dict → PerguntaSaudeInput)
# - output_schema: resposta como RespostaSaudeOutput (Pydantic)
# - output_model: segundo modelo reescreve/refina a resposta (ex.: mais barato ou focado em clareza)
# - Multimodal: aceita images=, audio=, videos=, files= em run() — ver exemplo_io.py
# agent_estruturado = Agent(
#     id=AGENT_ESTRUTURADO_ID,
#     name="Assistente de Saúde (Estruturado)",
#     role="Responda perguntas de saúde e preencha sempre os campos do schema de saída (resumo, pontos_principais, aviso_medico).",
#     instructions=INSTRUCOES_SAUDE,
#     model=Gemini(id="gemini-2.0-flash"),
#     tools=[DuckDuckGoTools(), ValyuTools(), TavilyTools()],
#     tool_call_limit=5,
#     input_schema=PerguntaSaudeInput,
#     output_schema=RespostaSaudeOutput,
#     output_model=Gemini(id="gemini-2.0-flash-lite"),
#     output_model_prompt=(
#         "Reescreva a resposta do assistente mantendo a estrutura: resumo (texto principal), "
#         "pontos_principais (lista de tópicos), aviso_medico (frase padrão) e fora_do_escopo (bool). "
#         "Mantenha o conteúdo correto; apenas torne a linguagem mais clara e objetiva."
#     ),
#     db=db,
#     add_history_to_context=True,
#     num_history_runs=3,
#     debug_mode=True,
# )

agent_os = AgentOS(agents=[agent], db=db)
app = agent_os.get_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)