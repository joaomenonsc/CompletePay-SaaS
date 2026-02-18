"""
Entry point CLI (Typer + Rich) - Seção 7.6, Fase 7.
Comando chat com flags para modelo e user_id.
"""
import sys
from pathlib import Path

# Garantir que o projeto esta no path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import typer
from rich.console import Console

app = typer.Typer(name="completepay-agent", help="CompletePay Agent CLI")
console = Console()


@app.callback()
def main() -> None:
    """CompletePay Agent - interface em linha de comando (CLI First)."""
    from dotenv import load_dotenv
    load_dotenv()


@app.command()
def chat(
    user_id: str = typer.Option("default", "--user-id", "-u", help="ID do usuario"),
    session_id: str | None = typer.Option(None, "--session-id", "-s", help="ID da sessao (opcional)"),
    model: str = typer.Option(
        "gemini_fast",
        "--model",
        "-m",
        help="Estrategia de modelo: quality, speed, cost, gemini_fast, gemini_pro",
    ),
) -> None:
    """Inicia chat interativo com o agente CompletePay."""
    from src.config.models import ModelStrategy
    from src.teams.completepay_team import get_completepay_team

    try:
        strategy = ModelStrategy(model)
    except ValueError:
        console.print(
            "[red]Modelo invalido. Use: quality, speed, cost, gemini_fast, gemini_pro[/red]"
        )
        raise typer.Exit(1)

    team = get_completepay_team(model_strategy=strategy)
    console.print("[bold]CompletePay Agent[/bold] - Digite 'sair' para encerrar.")
    console.print(f"Modelo: [dim]{model}[/dim] | User: [dim]{user_id}[/dim]\n")

    while True:
        try:
            user_input = console.input("[bold blue]Voce:[/bold blue] ")
        except (EOFError, KeyboardInterrupt):
            break
        if not user_input.strip():
            continue
        if user_input.strip().lower() in ("sair", "exit", "quit"):
            break

        try:
            response = team.run(
                user_input,
                user_id=user_id,
                session_id=session_id,
            )
            content = response.content if hasattr(response, "content") else str(response)
            console.print(f"[bold green]Agent:[/bold green] {content}\n")
        except Exception as e:
            console.print(f"[red]Erro:[/red] {e}\n")


@app.command()
def seed_knowledge() -> None:
    """Popula a knowledge base com documentos de politicas e FAQ."""
    from src.knowledge.setup import KNOWLEDGE_TABLE_NAME, SOURCES_DIR, get_knowledge

    knowledge = get_knowledge(table_name=KNOWLEDGE_TABLE_NAME)
    docs = [
        ("policies/payment-policies.md", "Politicas de pagamento"),
        ("compliance/compliance-rules.md", "Regras de compliance"),
        ("faq/customer-faq.md", "FAQ do cliente"),
        ("procedures/onboarding.md", "Procedimento de onboarding"),
    ]
    for rel_path, name in docs:
        full_path = SOURCES_DIR / rel_path
        if not full_path.exists():
            console.print(f"[yellow]AVISO: Arquivo nao encontrado: {full_path}[/yellow]")
            continue
        try:
            knowledge.insert(path=str(full_path), name=name)
            console.print(f"[green]Inserido:[/green] {name} ({rel_path})")
        except Exception as e:
            console.print(f"[red]Erro ao inserir {rel_path}:[/red] {e}")
            raise typer.Exit(1)
    console.print("[green]Knowledge base populada com sucesso.[/green]")


@app.command()
def health() -> None:
    """Verifica saude dos servicos (PostgreSQL, Redis)."""
    from dotenv import load_dotenv

    from src.health import check_postgres, check_redis

    load_dotenv()
    ok_pg, msg_pg = check_postgres()
    ok_redis, msg_redis = check_redis()
    if ok_pg:
        console.print("[green]POSTGRES:[/green] OK")
    else:
        console.print(f"[red]POSTGRES:[/red] {msg_pg}")
    if ok_redis:
        console.print("[green]REDIS:[/green] OK")
    else:
        console.print(f"[red]REDIS:[/red] {msg_redis}")
    if ok_pg and ok_redis:
        console.print("[green]Todos os servicos OK.[/green]")
        raise typer.Exit(0)
    raise typer.Exit(1)


if __name__ == "__main__":
    app()
