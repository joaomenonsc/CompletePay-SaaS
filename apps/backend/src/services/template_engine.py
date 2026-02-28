"""
Template Engine para Email Marketing — renderizacao via Jinja2.

Funcionalidades:
- compile-once / render-per-subscriber (performance para 10K+ emails)
- HTML autoescape (previne XSS via variaveis)
- SandboxedEnvironment (impede execucao arbitraria de codigo)
- Sanitizacao de HTML (remove scripts, on* handlers)
- Extracao automatica de variaveis do template
"""
import logging
import re
from functools import lru_cache

from jinja2 import Undefined as Jinja2Undefined
from jinja2.sandbox import SandboxedEnvironment
from markupsafe import Markup

logger = logging.getLogger("completepay.template_engine")

# Limite maximo de tamanho do HTML de template (500KB)
MAX_TEMPLATE_SIZE = 512_000

# Patterns perigosos a serem removidos na sanitizacao
_SCRIPT_TAG_RE = re.compile(r"<script[\s\S]*?</script>", re.IGNORECASE)
_ON_HANDLER_RE = re.compile(r"\s+on\w+\s*=\s*[\"'][^\"']*[\"']", re.IGNORECASE)
_JAVASCRIPT_URI_RE = re.compile(r'href\s*=\s*["\']javascript:[^"\']*["\']', re.IGNORECASE)

# Pattern para extrair variaveis Jinja2: {{ variavel }} ou {{ variavel|filtro }}
_VARIABLE_RE = re.compile(r"\{\{\s*(\w+)(?:\s*\|[^}]*)?\s*\}\}")


# ── SandboxedEnvironment singleton ──────────────────────────────────────────


class _SilentUndefined(Jinja2Undefined):
    """Variaveis nao encontradas retornam string vazia em vez de erro."""

    def __str__(self):
        return ""

    def __iter__(self):
        return iter([])

    def __bool__(self):
        return False


@lru_cache(maxsize=1)
def _get_env() -> SandboxedEnvironment:
    """Retorna ambiente Jinja2 sandboxed singleton."""
    return SandboxedEnvironment(
        autoescape=True,
        undefined=_SilentUndefined,
        keep_trailing_newline=True,
    )


# ── Compile / Render ────────────────────────────────────────────────────────


def compile_template(html: str):
    """
    Compila HTML string em template Jinja2.
    Use este metodo UMA VEZ fora do loop e depois chame
    render_for_subscriber() para cada destinatario.

    Retorna um objeto jinja2.Template compilado.
    """
    env = _get_env()
    return env.from_string(html or "")


def render_for_subscriber(compiled_template, variables: dict[str, str]) -> str:
    """
    Renderiza template compilado com variaveis do subscriber.
    Variaveis sao HTML-escaped automaticamente (autoescape=True).

    Para inserir HTML confiavel (ex: unsubscribe link), use Markup():
        variables["unsubscribe_link"] = Markup('<a href="...">Descadastrar</a>')
    """
    try:
        return compiled_template.render(**variables)
    except Exception as e:
        logger.error("Template render failed: %s", e)
        return ""


def render_html(html: str, variables: dict[str, str]) -> str:
    """
    Atalho: compila + renderiza em uma unica chamada.
    Util para renderizacoes unicas (preview, etc).
    Para bulk send, prefira compile_template() + render_for_subscriber().
    """
    compiled = compile_template(html)
    return render_for_subscriber(compiled, variables)


def render_subject(subject: str, variables: dict[str, str]) -> str:
    """
    Renderiza subject line com variaveis.
    Nao usa autoescape (subject nao e HTML).
    """
    if not subject:
        return ""
    env = _get_env()
    # Subject nao precisa de autoescape — desabilitar para texto puro
    tmpl = env.from_string(subject)
    try:
        result = tmpl.render(**variables)
        # Remover tags HTML residuais do subject (seguranca)
        return re.sub(r"<[^>]+>", "", result).strip()
    except Exception as e:
        logger.error("Subject render failed: %s", e)
        return subject


# ── Variable extraction ─────────────────────────────────────────────────────


def extract_variables(html: str) -> list[str]:
    """
    Extrai todas as variaveis referenciadas no template.
    Retorna lista unica, ordenada.

    Exemplos:
        "Olá {{ nome_paciente }}" -> ["nome_paciente"]
        "{{ email }} e {{ telefone|default('N/A') }}" -> ["email", "telefone"]
    """
    if not html:
        return []
    found = set(_VARIABLE_RE.findall(html or ""))
    return sorted(found)


# ── Sanitization & Validation ───────────────────────────────────────────────


def sanitize_html(html: str) -> str:
    """
    Remove conteudo perigoso do HTML de template:
    - Tags <script>...</script>
    - Atributos on* (onclick, onload, onerror, etc)
    - URIs javascript: em href

    Retorna HTML limpo.
    """
    if not html:
        return ""
    result = _SCRIPT_TAG_RE.sub("", html)
    result = _ON_HANDLER_RE.sub("", result)
    result = _JAVASCRIPT_URI_RE.sub('href="#"', result)
    return result


def validate_template(html: str) -> list[str]:
    """
    Valida template HTML antes de salvar.
    Retorna lista de erros encontrados (vazia = OK).
    """
    errors: list[str] = []

    if not html:
        return errors

    # 1. Tamanho maximo
    if len(html) > MAX_TEMPLATE_SIZE:
        errors.append(
            f"Template excede o tamanho maximo de {MAX_TEMPLATE_SIZE // 1024}KB "
            f"({len(html) // 1024}KB atual)."
        )

    # 2. Scripts
    if _SCRIPT_TAG_RE.search(html):
        errors.append(
            "Template contem tags <script> que serao removidas automaticamente."
        )

    # 3. Event handlers
    if _ON_HANDLER_RE.search(html):
        errors.append(
            "Template contem atributos on* (onclick, etc) que serao removidos."
        )

    # 4. JavaScript URIs
    if _JAVASCRIPT_URI_RE.search(html):
        errors.append(
            "Template contem links javascript: que serao removidos."
        )

    # 5. Verificar se template compila
    try:
        compile_template(html)
    except Exception as e:
        errors.append(f"Erro de sintaxe Jinja2: {e}")

    return errors
