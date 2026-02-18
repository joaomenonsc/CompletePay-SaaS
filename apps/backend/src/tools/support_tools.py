"""Tools de suporte: create_ticket, get_faq."""
from agno.tools import tool

from src.models.support import TicketCreate
from src.tools.repositories import get_support_repository


@tool
def create_ticket(subject: str, description: str, priority: str = "medium") -> str:
    """Cria um ticket de suporte ao cliente.

    Args:
        subject: Assunto do ticket.
        description: Descricao do problema.
        priority: Prioridade (low, medium, high). Padrao: medium.
    """
    repo = get_support_repository()
    data = TicketCreate(subject=subject, description=description, priority=priority)
    result = repo.create_ticket(data)
    return f"{result.message} Ticket: {result.ticket_id}"


@tool
def get_faq(category: str | None = None) -> str:
    """Retorna perguntas frequentes. Opcionalmente filtra por categoria.

    Args:
        category: Categoria (ex: conta, pagamentos). Opcional.
    """
    repo = get_support_repository()
    items = repo.get_faq(category=category)
    if not items:
        return "Nenhum FAQ encontrado."
    lines = [f"P: {q.question}\nR: {q.answer}" for q in items]
    return "\n---\n".join(lines)
