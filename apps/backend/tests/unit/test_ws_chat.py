"""Testes para o endpoint WebSocket /ws/chat."""
import pytest
from fastapi.testclient import TestClient

from src.api.app import app
from src.auth.service import create_access_token


@pytest.fixture
def valid_token() -> str:
    """Gera um JWT valido para testes."""
    token, _ = create_access_token(sub="test-user", role="user")
    return token


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_ws_rejects_without_token(client: TestClient) -> None:
    """Conexao sem token: servidor aceita e fecha com code 4001."""
    with client.websocket_connect("/ws/chat") as ws:
        # Servidor aceita e fecha; proxima operacao deve indicar fechamento
        with pytest.raises(Exception):
            ws.receive_json()


def test_ws_rejects_invalid_token(client: TestClient) -> None:
    """Token invalido: servidor aceita e fecha."""
    with client.websocket_connect("/ws/chat?token=invalid-jwt") as ws:
        with pytest.raises(Exception):
            ws.receive_json()


def test_ws_accepts_valid_token(client: TestClient, valid_token: str) -> None:
    """Conexao com token valido deve ser aceita; ping/pong funciona."""
    with client.websocket_connect(f"/ws/chat?token={valid_token}") as ws:
        ws.send_json({"type": "ping"})
        response = ws.receive_json()
        assert response["type"] == "pong"


def test_ws_rejects_empty_message(client: TestClient, valid_token: str) -> None:
    """Mensagem vazia deve retornar erro."""
    with client.websocket_connect(f"/ws/chat?token={valid_token}") as ws:
        ws.send_json({"type": "message", "content": ""})
        response = ws.receive_json()
        assert response["type"] == "error"
        assert "vazia" in response["content"].lower()


def test_ws_rejects_invalid_json(client: TestClient, valid_token: str) -> None:
    """JSON invalido deve retornar erro (nao crashar)."""
    with client.websocket_connect(f"/ws/chat?token={valid_token}") as ws:
        ws.send_text("isso nao e json")
        response = ws.receive_json()
        assert response["type"] == "error"
