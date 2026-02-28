"""Testes unitarios do template_engine (Jinja2 rendering, sanitizacao, validacao)."""
from src.services.template_engine import (
    compile_template,
    extract_variables,
    render_for_subscriber,
    render_html,
    render_subject,
    sanitize_html,
    validate_template,
)


# ---------------------------------------------------------------------------
# Render basics
# ---------------------------------------------------------------------------


class TestRenderHtml:
    def test_renderiza_variaveis(self):
        html = "<p>Olá {{ nome_paciente }}, seu email é {{ email }}</p>"
        result = render_html(html, {"nome_paciente": "João", "email": "joao@test.com"})
        assert "João" in result
        assert "joao@test.com" in result

    def test_variavel_inexistente_fica_vazia(self):
        """Diferença do regex anterior: Jinja2 com SilentUndefined retorna ''."""
        html = "<p>{{ variavel_inexistente }}</p>"
        result = render_html(html, {"outra": "valor"})
        assert "variavel_inexistente" not in result

    def test_html_vazio(self):
        assert render_html("", {"a": "b"}) == ""

    def test_html_none(self):
        assert render_html(None, {"a": "b"}) == ""

    def test_sem_variaveis(self):
        html = "<p>Texto fixo sem templates</p>"
        assert render_html(html, {}) == html


class TestRenderSubject:
    def test_renderiza_variaveis(self):
        result = render_subject("Olá {{ nome_paciente }}", {"nome_paciente": "Maria"})
        assert "Maria" in result

    def test_subject_vazio(self):
        assert render_subject("", {}) == ""

    def test_remove_html_tags_do_subject(self):
        result = render_subject("Olá <b>{{ nome }}</b>", {"nome": "Test"})
        assert "<b>" not in result
        assert "Test" in result


# ---------------------------------------------------------------------------
# Compile-once / render-per-subscriber
# ---------------------------------------------------------------------------


class TestCompileOnce:
    def test_compile_e_render_multiplos(self):
        compiled = compile_template("<p>Olá {{ nome }}</p>")
        r1 = render_for_subscriber(compiled, {"nome": "Ana"})
        r2 = render_for_subscriber(compiled, {"nome": "Bruno"})
        r3 = render_for_subscriber(compiled, {"nome": "Carlos"})
        assert "Ana" in r1
        assert "Bruno" in r2
        assert "Carlos" in r3

    def test_compile_template_vazio(self):
        compiled = compile_template("")
        result = render_for_subscriber(compiled, {"nome": "Test"})
        assert result == ""


# ---------------------------------------------------------------------------
# HTML Escaping (XSS prevention)
# ---------------------------------------------------------------------------


class TestHtmlEscaping:
    def test_escapa_tags_html_em_variaveis(self):
        """Autoescape deve prevenir XSS via variáveis."""
        html = "<p>Nome: {{ nome }}</p>"
        result = render_html(html, {"nome": '<script>alert("xss")</script>'})
        assert "<script>" not in result
        assert "&lt;script&gt;" in result

    def test_escapa_aspas(self):
        html = '<input value="{{ valor }}">'
        result = render_html(html, {"valor": '" onclick="alert(1)'})
        assert 'onclick' not in result or '&#34;' in result

    def test_markup_confiavel_nao_escapada(self):
        """Markup() permite inserir HTML confiavel."""
        from markupsafe import Markup
        html = "<div>{{ link }}</div>"
        result = render_html(html, {"link": Markup('<a href="/unsub">Sair</a>')})
        assert '<a href="/unsub">' in result


# ---------------------------------------------------------------------------
# Variable extraction
# ---------------------------------------------------------------------------


class TestExtractVariables:
    def test_extrai_variaveis_simples(self):
        html = "<p>{{ nome_paciente }} - {{ email }}</p>"
        result = extract_variables(html)
        assert result == ["email", "nome_paciente"]

    def test_extrai_com_filtros(self):
        html = "{{ telefone|default('N/A') }}"
        result = extract_variables(html)
        assert "telefone" in result

    def test_sem_variaveis(self):
        assert extract_variables("<p>Sem variaveis</p>") == []

    def test_html_vazio(self):
        assert extract_variables("") == []

    def test_duplicatas_removidas(self):
        html = "{{ nome }} e {{ nome }} e {{ email }}"
        result = extract_variables(html)
        assert result == ["email", "nome"]


# ---------------------------------------------------------------------------
# Sanitization
# ---------------------------------------------------------------------------


class TestSanitizeHtml:
    def test_remove_script_tags(self):
        html = '<p>OK</p><script>alert("xss")</script><p>After</p>'
        result = sanitize_html(html)
        assert "<script>" not in result
        assert "alert" not in result
        assert "<p>OK</p>" in result

    def test_remove_on_handlers(self):
        html = '<button onclick="alert(1)">Click</button>'
        result = sanitize_html(html)
        assert "onclick" not in result
        assert "Click" in result

    def test_remove_javascript_uris(self):
        html = '<a href="javascript:alert(1)">Link</a>'
        result = sanitize_html(html)
        assert "javascript:" not in result

    def test_html_vazio(self):
        assert sanitize_html("") == ""

    def test_html_limpo_permanece_intacto(self):
        html = "<p>Texto normal</p>"
        assert sanitize_html(html) == html


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class TestValidateTemplate:
    def test_template_valido_sem_erros(self):
        assert validate_template("<p>{{ nome }}</p>") == []

    def test_detecta_script_tag(self):
        errors = validate_template("<script>alert(1)</script>")
        assert any("script" in e.lower() for e in errors)

    def test_detecta_on_handler(self):
        errors = validate_template('<div onload="bad()">X</div>')
        assert any("on*" in e.lower() or "on" in e.lower() for e in errors)

    def test_detecta_tamanho_excedido(self):
        huge = "x" * 600_000
        errors = validate_template(huge)
        assert any("tamanho" in e.lower() for e in errors)

    def test_detecta_erro_sintaxe_jinja2(self):
        errors = validate_template("{% for x in %}")
        assert any("sintaxe" in e.lower() or "jinja2" in e.lower() for e in errors)

    def test_template_vazio_sem_erros(self):
        assert validate_template("") == []
