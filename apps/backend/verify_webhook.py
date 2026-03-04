import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.db.session import SessionLocal
from src.db.models_marketing import EmkInboundEmail

db = SessionLocal()
emails = db.query(EmkInboundEmail).all()
for email in emails:
    print(f"ID: {email.id}, From: {email.from_email}, To: {email.to_email}, Subject: {email.subject}, Status: {email.status}")
db.close()
