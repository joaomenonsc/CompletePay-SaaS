"""
Router agregador do CRM de Saude.
Monta todas as rotas sob o prefixo /api/v1/crm.
"""
from fastapi import APIRouter

from src.api.routes.crm_appointments import router as appointments_router
from src.api.routes.crm_audit import router as audit_router
from src.api.routes.crm_convenios import router as convenios_router
from src.api.routes.crm_clinical import router as clinical_router
from src.api.routes.crm_financial import router as financial_router
from src.api.routes.crm_patients import router as patients_router
from src.api.routes.crm_professionals import router as professionals_router
from src.api.routes.crm_units import router as units_router
from src.api.routes.crm_waitlist import router as waitlist_router

router = APIRouter(prefix="/api/v1/crm", tags=["crm"])
router.include_router(patients_router)
router.include_router(convenios_router)
router.include_router(professionals_router)
router.include_router(units_router)
router.include_router(appointments_router)
router.include_router(waitlist_router)
router.include_router(clinical_router)
router.include_router(financial_router)
router.include_router(audit_router)

