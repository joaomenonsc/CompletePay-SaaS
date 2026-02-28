import pytest
from pydantic import ValidationError
from fastapi import HTTPException

from src.schemas.organization import InviteMemberBody, UpdateMemberRoleBody
from src.api.routes.organizations import _require_owner

class TestOrganizationRoles:
    """Testes unitarios para validar as permissoes e papeis do CRM Saude (Story 1.1)."""

    def test_invite_member_with_valid_health_role(self):
        """Cenario 1: InviteMemberBody deve aceitar permissoes validas de saude (ex: gcl, med, rcp)."""
        valid_roles = ["owner", "member", "rcp", "fin", "enf", "med", "gcl", "mkt"]
        for role in valid_roles:
            body = InviteMemberBody(email="test@example.com", role=role)
            assert body.role == role
            assert body.email == "test@example.com"

    def test_invite_member_with_invalid_role_fails(self):
        """Cenario 2: InviteMemberBody deve rejeitar roles inexistentes ou fora do padrao."""
        invalid_roles = ["admin", "superadmin", "medico", ""]
        for role in invalid_roles:
            with pytest.raises(ValidationError) as exc_info:
                InviteMemberBody(email="test@example.com", role=role)
            assert "String should match pattern" in str(exc_info.value)

    def test_require_owner_allows_owner(self):
        """Cenario 3: _require_owner deve permitir a execucao se o usuario for 'owner'."""
        _require_owner("owner")
        _require_owner("OWNER") # Deve ser case insensitive de acordo com o .lower()


    def test_require_owner_allows_gcl(self):
        """Cenario 4: _require_owner deve permitir a execucao se o usuario for Gestor Clinico ('gcl')."""
        _require_owner("gcl")
        _require_owner("GCL")


    def test_require_owner_blocks_other_roles(self):
        """Cenario 5: _require_owner deve bloquear qualquer outra permissao (member, med, rcp, etc)."""
        blocked_roles = ["member", "med", "rcp", "fin", "enf", "mkt", "invalid", "", None]
        for role in blocked_roles:
            with pytest.raises(HTTPException) as exc_info:
                _require_owner(role)
            assert exc_info.value.status_code == 403
            assert "proprietarios ou gestores clinicos" in exc_info.value.detail.lower()

    def test_update_member_role_with_valid_health_role(self):
        """Cenario 6: UpdateMemberRoleBody deve aceitar atualizar para as roles de saude."""
        valid_roles = ["owner", "member", "rcp", "fin", "enf", "med", "gcl", "mkt"]
        for role in valid_roles:
            body = UpdateMemberRoleBody(role=role)
            assert body.role == role

    def test_update_member_role_with_invalid_role_fails(self):
        """Cenario Extra: UpdateMemberRoleBody tambem deve falhar com roles incorretas."""
        invalid_roles = ["admin", "manager"]
        for role in invalid_roles:
            with pytest.raises(ValidationError):
                UpdateMemberRoleBody(role=role)
