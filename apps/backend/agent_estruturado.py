"""
Agente de Saude com AgentOS e Gestao de Sessoes.

Sessoes (docs.agno.com/sessions/overview):
- Cada conversa e uma sessao identificada por session_id.
- user_id separa usuarios; session_id separa threads (ex.: abas de chat).
- Historico das ultimas num_history_runs interacoes e enviado no contexto.

Endpoints de gestao de sessao (AgentOS):
- POST /agents/assistente-saude/runs  -> Enviar mensagem (Form: message, session_id, user_id).
  Se session_id nao for enviado, uma nova sessao e criada e o session_id vem na resposta.
- POST /sessions?type=agent            -> Criar sessao (body: agent_id, user_id, session_name).
- GET  /sessions                      -> Listar sessoes (query: user_id, session_name).
- GET  /sessions/{session_id}         -> Detalhe da sessao.
- GET  /sessions/{session_id}/runs    -> Runs (mensagens) da sessao.

Entrada/Saida (docs.agno.com/input-output/overview):
- Agente padrao: texto livre (message string).
- Agente estruturado (assistente-saude-estruturado): entrada/saida Pydantic, modelo de saida, multimodal.
  Entrada: JSON com schema PerguntaSaudeInput. Saida: RespostaSaudeOutput.
  Multimodal: run(..., images=[...], audio=[...]) - ver exemplo_io.py.

Fluxo em duas etapas (busca + estruturado):
- POST /agents/assistente-saude-estruturado/runs-com-busca: recebe o mesmo JSON de entrada;
  faz uma busca na web (Tavily) e envia o resultado em contexto_extra para o agente
  estruturado, que devolve RespostaSaudeOutput sem chamar ferramentas (sem loop).

Avaliacoes (Evals, docs.agno.com/evals/overview):
- Execute: python evals_saude.py
"""
import json
from io import BytesIO
from pathlib import Path

from typing import List, Optional

from fastapi import File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from agno.media import Audio, Image, Video
from agno.media import File as FileMedia
from agno.os.utils import process_audio, process_document, process_image, process_video

from agno.agent import Agent
from agno.models.google import Gemini
from agno.tools.tavily import TavilyTools
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.tools.valyu import ValyuTools
from agno.os import AgentOS
from agno.db.sqlite import SqliteDb
from dotenv import load_dotenv

from schemas_io import PerguntaSaudeInput, RespostaSaudeOutput

load_dotenv()


def _extrair_texto_pdf(pdf_bytes: bytes, max_chars: int = 80000) -> Optional[str]:
    """Extrai texto de um PDF para injetar no contexto; o modelo passa a ver o conteudo como texto."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(pdf_bytes))
        partes = []
        n = 0
        for page in reader.pages:
            t = page.extract_text()
            if t:
                partes.append(t)
            n += 1
        texto = "\n\n".join(partes) if partes else None
        if texto and len(texto) > max_chars:
            texto = texto[:max_chars] + "\n[... texto truncado ...]"
        return texto
    except Exception:
        return None


# Banco SQLite para sessões, histórico e contexto (docs.agno.com/database/overview)
db = SqliteDb(db_file="agent_os.db")

AGENT_ID = "assistente-saude"
AGENT_ESTRUTURADO_ID = "assistente-saude-estruturado"

# Instruções comuns para preencher o schema de saída.
# Regra anti-loop: NO MAXIMO UMA chamada de ferramenta de busca; em seguida responda e preencha o schema.
INSTRUCOES_SAUDE = [
    "Voce pode chamar NO MAXIMO UMA ferramenta de busca (DuckDuckGo, Tavily ou Valyu). Apos receber o resultado, responda imediatamente. Nao chame outra ferramenta.",
    "Se precisar de informacao, faca uma unica busca e use o resultado para preencher resumo, pontos_principais e aviso_medico. Se nao precisar buscar, responda direto.",
    "Se a pergunta nao for sobre saude, defina fora_do_escopo=True e responda de forma educada.",
    "Preencha sempre resumo, pontos_principais (lista) e aviso_medico.",
]

# Agente estruturado sem ferramentas: responde so com conhecimento do modelo (evita loop de tool calls).
# Prioridade: (1) conteudo de arquivos anexados, (2) contexto_extra (ex.: busca web), (3) conhecimento proprio.
INSTRUCOES_SAUDE_ESTRUTURADO = [
    "Se o usuario enviou arquivo(s) anexo(s) (PDF, imagem, documento), a resposta OBRIGATORIAMENTE deve ser baseada no conteudo desse(s) arquivo(s). Use e resuma o documento; NAO responda com conhecimento geral. Comece o resumo com 'Com base no(s) documento(s) anexo(s)' e extraia pontos do proprio documento.",
    "Se contexto_extra for fornecido (ex.: [Resultado da busca na web]) e nao houver arquivos anexados, use esse texto como fonte para resumo e pontos_principais. Nunca deixe resumo ou pontos_principais vazios quando houver contexto_extra.",
    "So quando NAO houver arquivos nem contexto_extra, responda com base no seu conhecimento sobre saude.",
    "Se a pergunta nao for sobre saude, defina fora_do_escopo=True e responda de forma educada.",
    "Preencha sempre resumo (texto com a resposta principal), pontos_principais (lista com pelo menos 2 itens quando houver conteudo) e aviso_medico.",
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
    tool_call_limit=2,
    db=db,
    add_history_to_context=True,
    num_history_runs=3,
    debug_mode=True,
)

# Agente com Entrada/Saída estruturada + Modelo de saída (docs.agno.com/input-output/overview)
# - input_schema: valida entrada (JSON/dict → PerguntaSaudeInput)
# - output_schema: resposta como RespostaSaudeOutput (Pydantic)
# - output_model: segundo modelo reescreve/refina a resposta (ex.: mais barato ou focado em clareza)
# - Sem ferramentas: evita loop (modelo nao fica tentando chamar busca em loop). Responde com base no conhecimento do modelo.
# - Multimodal: aceita images=, audio=, videos=, files= em run() — ver exemplo_io.py
agent_estruturado = Agent(
    id=AGENT_ESTRUTURADO_ID,
    name="Assistente de Saúde (Estruturado)",
    role="Responda perguntas de saúde e preencha sempre os campos do schema de saída (resumo, pontos_principais, aviso_medico).",
    instructions=INSTRUCOES_SAUDE_ESTRUTURADO,
    model=Gemini(id="gemini-2.0-flash"),
    tools=None,
    input_schema=PerguntaSaudeInput,
    output_schema=RespostaSaudeOutput,
    output_model=Gemini(id="gemini-2.0-flash-lite"),
    output_model_prompt=(
        "Reescreva a resposta do assistente mantendo a estrutura: resumo (texto principal), "
        "pontos_principais (lista de tópicos), aviso_medico (frase padrão) e fora_do_escopo (bool). "
        "Mantenha o conteúdo correto; apenas torne a linguagem mais clara e objetiva."
    ),
    db=db,
    add_history_to_context=True,
    num_history_runs=3,
    debug_mode=True,
)

agent_os = AgentOS(agents=[agent, agent_estruturado], db=db)
app = agent_os.get_app()

# ---------------------------------------------------------------------------
# Fluxo em duas etapas: busca na web -> agente estruturado (sem loop)
#
#   [Frontend] --> POST /agents/.../runs-com-busca (message=JSON)
#        |
#        v
#   (1) _buscar_na_web(pergunta)  -->  Tavily API (uma unica chamada)
#        |
#        v
#   (2) contexto_extra = "[Resultado da busca na web]:\n" + resultado_busca
#        |
#        v
#   (3) agent_estruturado.arun({ pergunta, contexto_extra, preferir_resumo })
#        --> modelo gera RespostaSaudeOutput (sem tools, sem loop)
#        --> output_model refina o texto
#        |
#        v
#   Resposta JSON (content: resumo, pontos_principais, aviso_medico, fora_do_escopo)
# ---------------------------------------------------------------------------

_tavily = TavilyTools()


def _buscar_na_web(
    pergunta: str, max_results: int = 5, max_chars: int = 12000
) -> tuple[str, list[str]]:
    """Uma unica chamada a Tavily; retorna (texto da busca, lista de URLs das fontes)."""
    try:
        response = _tavily.client.search(
            query=pergunta,
            search_depth=_tavily.search_depth,
            include_answer=_tavily.include_answer,
            max_results=max_results,
        )
        urls = [r["url"] for r in response.get("results", []) if r.get("url")]
        _markdown = f"# {pergunta}\n\n"
        if "answer" in response:
            _markdown += "### Summary\n" + str(response.get("answer", "")) + "\n\n"
        for result in response.get("results", []):
            title = result.get("title", "")
            url = result.get("url", "")
            content = result.get("content", "")
            _markdown += f"### [{title}]({url})\n{content}\n\n"
        if len(_markdown) > max_chars:
            _markdown = _markdown[:max_chars] + "\n[... texto truncado ...]"
        return _markdown.strip(), urls
    except Exception as e:
        return (
            f"[Erro ao buscar na web: {e}. Responda com base apenas no seu conhecimento e preencha resumo e pontos_principais.]",
            [],
        )


@app.post(
    "/agents/assistente-saude-estruturado/runs-com-busca",
    include_in_schema=True,
    summary="Run estruturado com busca na web",
    description=(
        "Fluxo em duas etapas: (1) busca na web com Tavily; (2) agente estruturado "
        "recebe o resultado em contexto_extra e devolve RespostaSaudeOutput. Evita loop de tool calls."
    ),
)
async def runs_estruturado_com_busca(
    message: str = Form(..., description="JSON com pergunta, contexto_extra opcional, preferir_resumo"),
    files: Optional[List[UploadFile]] = File(None),
):
    """Executa busca na web e depois o agente estruturado com esse contexto. Aceita arquivos como contexto adicional."""
    try:
        payload = json.loads(message)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"message deve ser JSON valido: {e}")

    pergunta = payload.get("pergunta") or ""
    if not pergunta.strip():
        raise HTTPException(status_code=400, detail="pergunta e obrigatoria")

    contexto_usuario = (payload.get("contexto_extra") or "").strip()
    preferir_resumo = bool(payload.get("preferir_resumo", False))

    resultado_busca, urls_fontes = _buscar_na_web(pergunta, max_results=5)
    prefixo_busca = "[Resultado da busca na web] (use este texto para preencher resumo e pontos_principais):\n"
    contexto_com_busca = (
        f"{contexto_usuario}\n\n{prefixo_busca}{resultado_busca}"
        if contexto_usuario
        else f"{prefixo_busca}{resultado_busca}"
    )

    base64_images: List[Image] = []
    base64_audios: List[Audio] = []
    base64_videos: List[Video] = []
    input_files: List[FileMedia] = []
    arquivos_processados: List[str] = []
    conteudo_pdfs: List[tuple[str, str]] = []  # (nome_arquivo, texto_extraido)
    if files:
        for file in files:
            ct = file.content_type or ""
            nome = getattr(file, "filename", None) or "arquivo"
            if ct in (
                "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp",
                "image/bmp", "image/tiff", "image/tif", "image/avif",
            ):
                try:
                    base64_images.append(process_image(file))
                    arquivos_processados.append(nome)
                except Exception:
                    continue
            elif ct in (
                "audio/wav", "audio/wave", "audio/mp3", "audio/mpeg", "audio/ogg",
                "audio/mp4", "audio/m4a", "audio/aac", "audio/flac",
            ):
                try:
                    base64_audios.append(process_audio(file))
                    arquivos_processados.append(nome)
                except Exception:
                    continue
            elif ct in (
                "video/x-flv", "video/quicktime", "video/mpeg", "video/mp4",
                "video/webm", "video/wmv", "video/3gpp",
            ):
                try:
                    base64_videos.append(process_video(file))
                    arquivos_processados.append(nome)
                except Exception:
                    continue
            elif ct == "application/pdf":
                try:
                    pdf_bytes = await file.read()
                    await file.seek(0)
                    texto_pdf = _extrair_texto_pdf(pdf_bytes)
                    if texto_pdf:
                        conteudo_pdfs.append((nome, texto_pdf))
                    f = process_document(file)
                    if f is not None:
                        input_files.append(f)
                        arquivos_processados.append(nome)
                except Exception:
                    continue
            elif ct in (
                "application/json", "text/plain", "text/html",
                "text/css", "text/md", "text/csv", "text/xml", "text/rtf",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ):
                try:
                    f = process_document(file)
                    if f is not None:
                        input_files.append(f)
                        arquivos_processados.append(nome)
                except Exception:
                    continue
            else:
                raise HTTPException(status_code=400, detail=f"Tipo de arquivo nao suportado: {ct}")

    contexto_final = contexto_com_busca.strip()
    if conteudo_pdfs:
        bloco = "[IMPORTANTE] O usuario anexou PDF(s). A resposta DEVE ser baseada no conteudo abaixo. Resuma ou responda usando este(s) documento(s); NAO de resposta generica.\n\n"
        for nome_pdf, texto in conteudo_pdfs:
            bloco += f"[Conteudo do documento {nome_pdf}]:\n{texto}\n\n"
        contexto_final = bloco + contexto_final
    elif arquivos_processados:
        instrucao_arquivos = (
            "[IMPORTANTE] O usuario anexou o(s) arquivo(s): "
            + ", ".join(arquivos_processados)
            + ". A resposta DEVE ser baseada PRINCIPALMENTE no conteudo desses arquivos (artigo, estudo, exame). "
            "Resuma ou responda a pergunta usando o(s) documento(s); NAO de uma resposta generica. "
            "Mencione no resumo que a resposta e baseada no(s) documento(s) anexo(s).\n\n"
        )
        contexto_final = instrucao_arquivos + contexto_final

    entrada = {
        "pergunta": pergunta,
        "contexto_extra": contexto_final,
        "preferir_resumo": preferir_resumo,
    }

    run_response = await agent_estruturado.arun(
        entrada,
        stream=False,
        images=base64_images if base64_images else None,
        audio=base64_audios if base64_audios else None,
        videos=base64_videos if base64_videos else None,
        files=input_files if input_files else None,
    )
    out = run_response.to_dict()
    out["fontes"] = urls_fontes
    out["arquivos_usados"] = arquivos_processados
    return out


# Frontend para testar o agente estruturado (GET /estruturado)
_FRONTEND_HTML = Path(__file__).parent / "frontend_estruturado.html"


@app.get("/estruturado", include_in_schema=False)
def frontend_estruturado():
    """Serve a pagina HTML para testar o Assistente de Saude (Estruturado)."""
    if _FRONTEND_HTML.exists():
        return FileResponse(_FRONTEND_HTML, media_type="text/html")
    raise HTTPException(status_code=404, detail="frontend_estruturado.html not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)