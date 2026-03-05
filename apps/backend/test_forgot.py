import os
import sys
from fastapi.testclient import TestClient
from pathlib import Path

# Add backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.app import app
from src.auth.repository import create_user, get_user_by_email
import uuid

client = TestClient(app)

def main():
    email = f"test_{uuid.uuid4().hex[:8]}@test.com"
    try:
        # Create user
        create_user(email, "hashed_password", "user")
        print(f"Created user: {email}")
        
        # Call forgot password
        response = client.post("/auth/forgot-password", json={"email": email})
        print(f"Status Output: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Exception happened: {e}")

if __name__ == "__main__":
    main()
