# SQLAlchemy: engine, session e modelos (agent_configs, calendario, crm, marketing).
from src.db.session import Base, get_db, engine, SessionLocal

from src.db import models  # registra Organization, AgentConfig em Base.metadata
from src.db import models_calendar  # registra tabelas do modulo Calendario
from src.db import models_marketing  # registra tabelas emk_* do modulo Email Marketing

__all__ = ["Base", "get_db", "engine", "SessionLocal", "models", "models_calendar", "models_marketing"]
