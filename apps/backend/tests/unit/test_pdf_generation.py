import pytest
from fastapi.testclient import TestClient
from src.app import app
from src.db.session import get_db

client = TestClient(app)

# The backend requires auth. We will mock the auth for this test.
def override_require_user_id():
    return "test_user_id"

def override_require_organization_id():
    return "test_org_id"

def override_require_org_role():
    def _require_role():
        return "med"
    return _require_role

from src.api.middleware.auth import require_user_id
from src.api.deps import require_organization_id, require_org_role

app.dependency_overrides[require_user_id] = override_require_user_id
app.dependency_overrides[require_organization_id] = override_require_organization_id
app.dependency_overrides[require_org_role] = override_require_org_role

def test_pdf_service_can_be_imported():
    # Simple check that we can import reportlab without errors
    import reportlab
    from src.services.pdf_service import generate_prescription_pdf, generate_payment_receipt_pdf
    assert True
