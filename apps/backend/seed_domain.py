import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.db.session import SessionLocal
from src.db.models import Organization
from src.db.models_marketing import EmkDomain

db = SessionLocal()
org = db.query(Organization).first()
if not org:
    org = Organization(name="Test Org")
    db.add(org)
    db.commit()
    db.refresh(org)

domain = db.query(EmkDomain).filter(EmkDomain.domain == "app.completepay.digital").first()
if not domain:
    domain = EmkDomain(
        organization_id=org.id,
        domain="app.completepay.digital",
        status="verified",
        region="sa-east-1"
    )
    db.add(domain)
    db.commit()
    print("MOCKED DOMAIN CREATED")
else:
    print("DOMAIN ALREADY EXISTS")

db.close()
