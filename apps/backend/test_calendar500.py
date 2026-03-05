import os
import sys
from fastapi.testclient import TestClient
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.app import app

client = TestClient(app)

def main():
    # Hit the slots endpoint with random org/event that doesn't exist
    # If _resolve_event_type throws 404, we'll get 404. Let's see if it throws 500.
    response = client.get("/api/v1/public/calendar/org-test-123/event-test-123/slots?month=2026-04&timezone=America/Sao_Paulo")
    print("Non-existent event -> Status:", response.status_code)
    print("Non-existent event -> Response:", response.json())

    # We can also hit the actual one the user tried if it exists in the local DB.
    # We'll just print it:
    response2 = client.get("/api/v1/public/calendar/meu-espaco-2f9a372b715b/consulta-dr-joao/slots?month=2026-04&timezone=America/Sao_Paulo")
    print("Real event -> Status:", response2.status_code)
    try:
        print("Real event -> Response:", response2.json())
    except:
        print("Real event -> Response:", response2.text)

if __name__ == "__main__":
    main()
