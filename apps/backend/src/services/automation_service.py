"""Service de automações — lógica de negócio desacoplada de HTTP."""
import hashlib
import hmac
import logging
import re
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models_automations import (
    AutomationWorkflow, AutomationWorkflowVersion,
    AutomationExecution, AutomationExecutionStep,
    AutomationWebhookEndpoint
)

logger = logging.getLogger("completepay.automations")

# ────────────────────────────────────────────────────────────────────────────
# CONSTANTES
# ────────────────────────────────────────────────────────────────────────────

VALID_NODE_TYPES = {
    "trigger": ["ManualTrigger", "WebhookTrigger"],
    "action":  ["HttpRequest", "SendEmail", "CreateCRMTask"],
    "logic":   ["IfCondition", "Delay"],
    "utils":   ["SetVariable", "Transform"],
    "transform": [
        "CodeScript", "FilterItems", "SortItems", "RemoveDuplicates",
        "SplitBatches", "MergeData", "DateTimeFormat", "RenameKeys",
    ],
}
ALL_VALID_TYPES = {t for types in VALID_NODE_TYPES.values() for t in types}
TRIGGER_TYPES = set(VALID_NODE_TYPES["trigger"])

# MVP: Delay cap (segundos) para execução síncrona
MAX_DELAY_SECONDS = 55


# ────────────────────────────────────────────────────────────────────────────
# CRUD
# ────────────────────────────────────────────────────────────────────────────

def create_workflow(
    db: Session,
    organization_id: str,
    name: str,
    description: Optional[str] = None,
    definition: Optional[dict] = None,
    created_by: Optional[str] = None,
) -> AutomationWorkflow:
    wf = AutomationWorkflow(
        organization_id=organization_id,
        name=name,
        description=description,
        created_by=created_by,
        updated_by=created_by,
    )
    db.add(wf)
    db.flush()

    # Se enviou definition, salvar como rascunho (versão 0)
    if definition:
        ver = AutomationWorkflowVersion(
            workflow_id=wf.id,
            version_number=0,
            definition_json=definition,
        )
        db.add(ver)
        db.flush()
        wf.current_version_id = ver.id

    return wf


def get_workflow(
    db: Session,
    workflow_id: str,
    organization_id: str,
) -> Optional[AutomationWorkflow]:
    return db.query(AutomationWorkflow).filter(
        AutomationWorkflow.id == workflow_id,
        AutomationWorkflow.organization_id == organization_id,
    ).first()


def list_workflows(
    db: Session,
    organization_id: str,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> list[AutomationWorkflow]:
    q = db.query(AutomationWorkflow).filter(
        AutomationWorkflow.organization_id == organization_id
    )
    if status:
        q = q.filter(AutomationWorkflow.status == status)
    return q.order_by(AutomationWorkflow.updated_at.desc()).offset(offset).limit(limit).all()


def update_workflow(
    db: Session,
    workflow: AutomationWorkflow,
    name: Optional[str] = None,
    description: Optional[str] = None,
    definition: Optional[dict] = None,
    updated_by: Optional[str] = None,
) -> AutomationWorkflow:
    if name is not None:
        workflow.name = name
    if description is not None:
        workflow.description = description
    if updated_by is not None:
        workflow.updated_by = updated_by

    # Salvar rascunho: cria/atualiza versão 0
    if definition is not None:
        existing_draft = db.query(AutomationWorkflowVersion).filter(
            AutomationWorkflowVersion.workflow_id == workflow.id,
            AutomationWorkflowVersion.version_number == 0,
        ).first()
        if existing_draft:
            existing_draft.definition_json = definition
        else:
            ver = AutomationWorkflowVersion(
                workflow_id=workflow.id,
                version_number=0,
                definition_json=definition,
            )
            db.add(ver)
            db.flush()
            workflow.current_version_id = ver.id

    db.flush()
    return workflow


def delete_workflow(
    db: Session,
    workflow: AutomationWorkflow,
) -> None:
    """Deleta workflow. Apenas DRAFT pode ser deletado (hard delete)."""
    if workflow.status != "DRAFT":
        raise ValueError("Apenas workflows em DRAFT podem ser deletados.")
    db.delete(workflow)
    db.flush()


# ────────────────────────────────────────────────────────────────────────────
# PUBLISH / DISABLE
# ────────────────────────────────────────────────────────────────────────────

def publish_workflow(
    db: Session,
    workflow: AutomationWorkflow,
    definition: dict,
) -> AutomationWorkflowVersion:
    """Valida, cria versão e publica o workflow."""
    errors = validate_definition(definition)
    if errors:
        raise ValueError(errors)

    # Próximo version_number
    max_ver = db.query(func.max(AutomationWorkflowVersion.version_number)).filter(
        AutomationWorkflowVersion.workflow_id == workflow.id,
        AutomationWorkflowVersion.version_number > 0,
    ).scalar() or 0

    version = AutomationWorkflowVersion(
        workflow_id=workflow.id,
        version_number=max_ver + 1,
        definition_json=definition,
        published_at=datetime.now(timezone.utc),
    )
    db.add(version)
    db.flush()

    workflow.status = "PUBLISHED"
    workflow.current_version_id = version.id

    # Se há WebhookTrigger, criar endpoint
    _ensure_webhook_endpoints(db, workflow, definition)

    db.flush()
    return version


def disable_workflow(
    db: Session,
    workflow: AutomationWorkflow,
) -> AutomationWorkflow:
    """Desativa workflow."""
    workflow.status = "DISABLED"
    # Desativar webhooks
    db.query(AutomationWebhookEndpoint).filter(
        AutomationWebhookEndpoint.workflow_id == workflow.id,
    ).update({"is_active": False})
    db.flush()
    return workflow


def _ensure_webhook_endpoints(
    db: Session,
    workflow: AutomationWorkflow,
    definition: dict,
) -> None:
    """Cria/ativa endpoint de webhook se o workflow tem WebhookTrigger."""
    nodes = definition.get("nodes", [])
    webhook_triggers = [n for n in nodes if n.get("type") == "WebhookTrigger"]

    if not webhook_triggers:
        return

    for trigger in webhook_triggers:
        config = trigger.get("data", {}).get("config", {})
        path_slug = config.get("path_slug")

        if not path_slug:
            # Gerar slug único
            path_slug = f"{workflow.id[:8]}-{secrets.token_urlsafe(8)}"

        existing = db.query(AutomationWebhookEndpoint).filter(
            AutomationWebhookEndpoint.workflow_id == workflow.id,
        ).first()

        if existing:
            existing.is_active = True
            existing.path_slug = path_slug
        else:
            # Gerar secret e armazenar apenas o hash
            raw_secret = secrets.token_urlsafe(32)
            secret_hash = hashlib.sha256(raw_secret.encode()).hexdigest()

            endpoint = AutomationWebhookEndpoint(
                workflow_id=workflow.id,
                path_slug=path_slug,
                secret_hash=secret_hash,
            )
            db.add(endpoint)
            db.flush()
            # Logar o secret apenas na criação (para o admin copiar)
            logger.info(
                "Webhook endpoint criado: slug=%s secret=%s (anote este secret, não será exibido novamente)",
                path_slug, raw_secret,
            )


# ────────────────────────────────────────────────────────────────────────────
# VALIDAÇÃO
# ────────────────────────────────────────────────────────────────────────────

def validate_definition(definition: dict) -> list[str]:
    """
    Valida o grafo do workflow. Retorna lista de erros amigáveis.
    Lista vazia = válido.
    """
    errors: list[str] = []
    nodes = definition.get("nodes", [])
    edges = definition.get("edges", [])

    if not nodes:
        errors.append("O workflow precisa ter pelo menos um node.")
        return errors

    node_ids = {n["id"] for n in nodes}

    # 1. Pelo menos um trigger
    triggers = [n for n in nodes if n.get("type") in TRIGGER_TYPES]
    if not triggers:
        errors.append("O workflow precisa ter pelo menos um Trigger (ManualTrigger ou WebhookTrigger).")

    # 2. Tipos de node válidos
    for node in nodes:
        if node.get("type") not in ALL_VALID_TYPES:
            errors.append(f"Tipo de node inválido: '{node.get('type')}' (node ID: {node['id']}).")

    # 3. Edges referenciam nodes existentes
    for edge in edges:
        if edge.get("source") not in node_ids:
            errors.append(f"Edge '{edge['id']}': source '{edge['source']}' não existe.")
        if edge.get("target") not in node_ids:
            errors.append(f"Edge '{edge['id']}': target '{edge['target']}' não existe.")

    # 4. Detecção de ciclos
    try:
        _topological_sort(nodes, edges)
    except ValueError as e:
        errors.append(f"Grafo inválido: {e}")

    # 5. Campos obrigatórios por tipo
    for node in nodes:
        node_errors = _validate_node_config(node)
        errors.extend(node_errors)

    return errors


def _validate_node_config(node: dict) -> list[str]:
    """Valida configuração específica de cada tipo de node."""
    errors: list[str] = []
    ntype = node.get("type")
    config = node.get("data", {}).get("config", {})
    nid = node["id"]

    if ntype == "HttpRequest":
        if not config.get("url"):
            errors.append(f"Node '{nid}' (HttpRequest): campo 'url' é obrigatório.")
        if config.get("method") not in [None, "GET", "POST", "PUT", "PATCH", "DELETE"]:
            errors.append(f"Node '{nid}' (HttpRequest): método HTTP inválido.")
    elif ntype == "SendEmail":
        if not config.get("to"):
            errors.append(f"Node '{nid}' (SendEmail): campo 'to' é obrigatório.")
        if not config.get("subject"):
            errors.append(f"Node '{nid}' (SendEmail): campo 'subject' é obrigatório.")
    elif ntype == "IfCondition":
        if not config.get("left"):
            errors.append(f"Node '{nid}' (IfCondition): campo 'left' é obrigatório.")
        valid_ops = {"eq", "neq", "gt", "lt", "gte", "lte", "contains", "exists"}
        if config.get("operator") not in valid_ops:
            errors.append(f"Node '{nid}' (IfCondition): operador inválido.")
    elif ntype == "SetVariable":
        if not config.get("key"):
            errors.append(f"Node '{nid}' (SetVariable): campo 'key' é obrigatório.")
    elif ntype == "Delay":
        duration = config.get("duration")
        unit = config.get("unit", "seconds")
        if not isinstance(duration, (int, float)) or duration <= 0:
            errors.append(f"Node '{nid}' (Delay): 'duration' deve ser número positivo.")
        if unit not in ["seconds", "minutes"]:
            errors.append(f"Node '{nid}' (Delay): 'unit' deve ser 'seconds' ou 'minutes'.")
        if isinstance(duration, (int, float)) and duration > 0:
            total_seconds = duration if unit == "seconds" else duration * 60
            if total_seconds > MAX_DELAY_SECONDS:
                errors.append(
                    f"Node '{nid}' (Delay): duração máxima no MVP é {MAX_DELAY_SECONDS}s "
                    f"(configurado: {total_seconds}s)."
                )
    # ── Data Transformation nodes ──
    elif ntype == "CodeScript":
        if not config.get("code"):
            errors.append(f"Node '{nid}' (CodeScript): campo 'code' (expressão) é obrigatório.")
    elif ntype == "FilterItems":
        if not config.get("field"):
            errors.append(f"Node '{nid}' (FilterItems): campo 'field' é obrigatório.")
        valid_filter_ops = {"eq", "neq", "gt", "lt", "gte", "lte", "contains", "exists", "not_exists"}
        if config.get("operator") and config["operator"] not in valid_filter_ops:
            errors.append(f"Node '{nid}' (FilterItems): operador inválido.")
    elif ntype == "SortItems":
        if not config.get("field"):
            errors.append(f"Node '{nid}' (SortItems): campo 'field' é obrigatório.")
    elif ntype == "DateTimeFormat":
        if not config.get("input_field"):
            errors.append(f"Node '{nid}' (DateTimeFormat): campo 'input_field' é obrigatório.")
    elif ntype == "RenameKeys":
        if not config.get("mappings"):
            errors.append(f"Node '{nid}' (RenameKeys): campo 'mappings' é obrigatório.")

    return errors


# ────────────────────────────────────────────────────────────────────────────
# TOPOLOGICAL SORT + EXECUÇÃO
# ────────────────────────────────────────────────────────────────────────────

def _topological_sort(nodes: list, edges: list) -> list:
    """
    Kahn's algorithm — retorna nodes em ordem de execução.
    Levanta ValueError se há ciclo.
    """
    in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    graph: dict[str, list[str]] = defaultdict(list)
    node_map = {n["id"]: n for n in nodes}

    for edge in edges:
        src = edge["source"]
        tgt = edge["target"]
        if src in node_map and tgt in node_map:
            graph[src].append(tgt)
            in_degree[tgt] += 1

    queue = deque([node_map[nid] for nid, deg in in_degree.items() if deg == 0])
    result = []

    while queue:
        node = queue.popleft()
        result.append(node)
        for neighbor_id in graph[node["id"]]:
            in_degree[neighbor_id] -= 1
            if in_degree[neighbor_id] == 0:
                queue.append(node_map[neighbor_id])

    if len(result) != len(nodes):
        raise ValueError("Ciclo detectado no grafo — workflows com ciclos não são suportados.")

    return result


def _build_adjacency(edges: list) -> dict[str, list[str]]:
    """Grafo: source → [targets]."""
    graph: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        graph[edge["source"]].append(edge["target"])
    return graph


def _get_if_branch_nodes(
    node: dict,
    edges: list,
    all_nodes: list,
) -> tuple[set[str], set[str]]:
    """
    Para um IfCondition, retorna (true_branch_node_ids, false_branch_node_ids)
    baseado na config true_next_node_id / false_next_node_id.
    """
    config = node.get("data", {}).get("config", {})
    true_id = config.get("true_next_node_id")
    false_id = config.get("false_next_node_id")

    graph = _build_adjacency(edges)
    all_node_ids = {n["id"] for n in all_nodes}

    def _bfs_reachable(start_id: str) -> set[str]:
        if not start_id or start_id not in all_node_ids:
            return set()
        visited = set()
        queue = deque([start_id])
        while queue:
            nid = queue.popleft()
            if nid in visited:
                continue
            visited.add(nid)
            for neighbor in graph.get(nid, []):
                if neighbor not in visited:
                    queue.append(neighbor)
        return visited

    true_set = _bfs_reachable(true_id) if true_id else set()
    false_set = _bfs_reachable(false_id) if false_id else set()

    return true_set, false_set


def execute_workflow_sync(
    db: Session,
    execution: AutomationExecution,
    definition: dict,
    initial_context: dict,
    timeout_s: int = 60,
) -> AutomationExecution:
    """
    Executa workflow de forma síncrona (MVP).
    Percorre nodes em ordem topológica; respeita timeout de 60s.
    IfCondition: avalia condição e pula nodes do branch não-escolhido.
    """
    nodes = definition.get("nodes", [])
    edges = definition.get("edges", [])

    try:
        ordered_nodes = _topological_sort(nodes, edges)
    except ValueError as e:
        execution.status = "FAILED"
        execution.error_summary = str(e)
        return execution

    context: dict[str, Any] = {"trigger": initial_context, "vars": {}, "nodes": {}}
    deadline = time.time() + timeout_s
    skipped_nodes: set[str] = set()

    for node in ordered_nodes:
        if time.time() > deadline:
            execution.status = "FAILED"
            execution.error_summary = f"Timeout após {timeout_s}s."
            break

        if node["id"] in skipped_nodes:
            # Node no branch não-escolhido de um IfCondition
            step = AutomationExecutionStep(
                execution_id=execution.id,
                node_id=node["id"],
                node_type=node["type"],
                status="SKIPPED",
            )
            db.add(step)
            db.flush()
            continue

        step = AutomationExecutionStep(
            execution_id=execution.id,
            node_id=node["id"],
            node_type=node["type"],
            status="RUNNING",
        )
        db.add(step)
        db.flush()

        step.input_json = sanitize_io({"node": node, "context_snapshot": context.get("vars", {})})
        t0 = time.time()

        try:
            output = _execute_node(node, context, db, edges, nodes, skipped_nodes)
            context["nodes"][node["id"]] = output
            step.output_json = sanitize_io(output)
            step.status = "SUCCESS"
        except Exception as exc:
            logger.error("Falha no node %s: %s", node["id"], exc)
            step.status = "FAILED"
            step.error_message = str(exc)
            execution.status = "FAILED"
            execution.error_summary = f"Falha no node {node['id']} ({node['type']}): {exc}"
            step.duration_ms = int((time.time() - t0) * 1000)
            step.finished_at = datetime.now(timezone.utc)
            break

        step.duration_ms = int((time.time() - t0) * 1000)
        step.finished_at = datetime.now(timezone.utc)

    else:
        execution.status = "SUCCESS"

    execution.finished_at = datetime.now(timezone.utc)
    if execution.started_at:
        delta = (execution.finished_at - execution.started_at).total_seconds()
        execution.duration_ms = int(delta * 1000)

    return execution


# ────────────────────────────────────────────────────────────────────────────
# EXECUTORES DE NODE
# ────────────────────────────────────────────────────────────────────────────

def _execute_node(
    node: dict,
    context: dict,
    db: Session,
    edges: list,
    all_nodes: list,
    skipped_nodes: set[str],
) -> dict[str, Any]:
    """Dispatch de execução por tipo de node."""
    ntype = node.get("type")
    config = node.get("data", {}).get("config", {})

    # Resolver templates nos valores da config
    resolved_config = _resolve_config(config, context)

    if ntype in ("ManualTrigger", "WebhookTrigger"):
        return {"type": ntype, "payload": context.get("trigger", {})}

    elif ntype == "SetVariable":
        key = resolved_config.get("key", "")
        value = resolved_config.get("value", "")
        context["vars"][key] = value
        return {"key": key, "value": value}

    elif ntype == "Transform":
        mapping = config.get("mapping", {})
        result = {}
        for new_key, expr in mapping.items():
            if isinstance(expr, str):
                result[new_key] = _resolve_template_string(expr, context)
            else:
                result[new_key] = expr
        # Gravar no context.vars para acesso downstream
        context["vars"].update(result)
        return {"transformed": result}

    elif ntype == "HttpRequest":
        return _execute_http_request(resolved_config)

    elif ntype == "SendEmail":
        return _execute_send_email(resolved_config, db)

    elif ntype == "CreateCRMTask":
        return _execute_create_crm_task(resolved_config)

    elif ntype == "IfCondition":
        return _execute_if_condition(node, resolved_config, context, edges, all_nodes, skipped_nodes)

    elif ntype == "Delay":
        return _execute_delay(resolved_config)

    # ── Data Transformation ──
    elif ntype == "CodeScript":
        return _execute_code_script(resolved_config, context)

    elif ntype == "FilterItems":
        return _execute_filter_items(resolved_config, context)

    elif ntype == "SortItems":
        return _execute_sort_items(resolved_config, context)

    elif ntype == "RemoveDuplicates":
        return _execute_remove_duplicates(resolved_config, context)

    elif ntype == "SplitBatches":
        return _execute_split_batches(resolved_config, context)

    elif ntype == "MergeData":
        return _execute_merge_data(resolved_config, context)

    elif ntype == "DateTimeFormat":
        return _execute_datetime_format(resolved_config)

    elif ntype == "RenameKeys":
        return _execute_rename_keys(resolved_config, context)

    else:
        raise ValueError(f"Tipo de node não suportado: {ntype}")


def _resolve_config(config: dict, context: dict) -> dict:
    """Resolve todas as strings com template no config."""
    resolved = {}
    for k, v in config.items():
        if isinstance(v, str):
            resolved[k] = _resolve_template_string(v, context)
        elif isinstance(v, dict):
            resolved[k] = _resolve_config(v, context)
        else:
            resolved[k] = v
    return resolved


def _execute_http_request(config: dict) -> dict[str, Any]:
    """Executa HTTP request usando httpx."""
    try:
        import httpx
    except ImportError:
        logger.warning("httpx não instalado. Instalando httpx é recomendado para o node HttpRequest.")
        return {"error": "httpx não disponível", "status_code": None}

    url = config.get("url", "")
    method = config.get("method", "GET").upper()
    headers = config.get("headers", {})
    body_template = config.get("body_template", {})
    timeout_s = config.get("timeout_s", 30)

    try:
        with httpx.Client(timeout=timeout_s) as client:
            resp = client.request(
                method=method,
                url=url,
                headers=headers,
                json=body_template if method != "GET" else None,
                params=body_template if method == "GET" else None,
            )
            return {
                "status_code": resp.status_code,
                "body": resp.text[:2000],  # Limitar output
                "headers": dict(resp.headers),
            }
    except Exception as exc:
        raise RuntimeError(f"HttpRequest falhou: {exc}") from exc


def _execute_send_email(config: dict, db: Session) -> dict[str, Any]:
    """Envia email usando email_service existente."""
    to = config.get("to", "")
    subject = config.get("subject", "")
    body = config.get("body", "")

    try:
        from src.services.email_service import send_email
        send_email(to=to, subject=subject, body=body)
        return {"sent_to": to, "subject": subject, "status": "sent"}
    except ImportError:
        logger.warning("email_service não disponível; email não enviado (stub).")
        return {"sent_to": to, "subject": subject, "status": "stub_logged"}
    except Exception as exc:
        raise RuntimeError(f"SendEmail falhou: {exc}") from exc


def _execute_create_crm_task(config: dict) -> dict[str, Any]:
    """Cria nota/tarefa no CRM. Stub no MVP — loga a ação."""
    resource_type = config.get("resource_type", "note")
    patient_id = config.get("patient_id")
    content = config.get("content", "")

    logger.info(
        "CreateCRMTask (stub): resource_type=%s, patient_id=%s, content_len=%d",
        resource_type, patient_id, len(content),
    )
    return {
        "resource_type": resource_type,
        "patient_id": patient_id,
        "status": "stub_logged",
    }


def _execute_if_condition(
    node: dict,
    config: dict,
    context: dict,
    edges: list,
    all_nodes: list,
    skipped_nodes: set[str],
) -> dict[str, Any]:
    """Avalia condição e marca branch oposto como skipped."""
    result = _evaluate_condition(config)

    true_set, false_set = _get_if_branch_nodes(node, edges, all_nodes)

    if result:
        # Condição verdadeira: pular false branch
        # Apenas pular nodes exclusivos do false branch (não compartilhados com true)
        exclusive_false = false_set - true_set
        skipped_nodes.update(exclusive_false)
    else:
        # Condição falsa: pular true branch
        exclusive_true = true_set - false_set
        skipped_nodes.update(exclusive_true)

    return {"condition_result": result, "branch": "true" if result else "false"}


def _execute_delay(config: dict) -> dict[str, Any]:
    """Executa delay (sleep síncrono)."""
    duration = config.get("duration", 0)
    unit = config.get("unit", "seconds")

    try:
        duration = float(duration)
    except (ValueError, TypeError):
        duration = 0

    total_seconds = duration if unit == "seconds" else duration * 60
    # Cap no MVP
    total_seconds = min(total_seconds, MAX_DELAY_SECONDS)

    if total_seconds > 0:
        time.sleep(total_seconds)

    return {"delayed_seconds": total_seconds}


# ── EXECUTORES — DATA TRANSFORMATION ─────────────────────────────────────────


def _execute_code_script(config: dict, context: dict) -> dict[str, Any]:
    """Executa expressão Python simples (sandbox limitado, sem IO)."""
    code = config.get("code", "")
    # Namespace restrito — só acessa variáveis do workflow
    safe_ns: dict[str, Any] = {
        "data": context.get("vars", {}),
        "trigger": context.get("trigger", {}),
        "nodes": context.get("nodes", {}),
        "result": None,
    }
    try:
        exec(code, {"__builtins__": {}}, safe_ns)  # noqa: S102
    except Exception as exc:
        raise RuntimeError(f"CodeScript falhou: {exc}") from exc

    result = safe_ns.get("result", safe_ns.get("data"))
    if isinstance(result, dict):
        context["vars"].update(result)
    return {"result": result}


def _execute_filter_items(config: dict, context: dict) -> dict[str, Any]:
    """Filtra itens de uma lista por campo / operador / valor."""
    field = config.get("field", "")
    operator = config.get("operator", "eq")
    value = config.get("value", "")
    source_var = config.get("source", "items")
    items = context.get("vars", {}).get(source_var, [])

    if not isinstance(items, list):
        return {"filtered": [], "count": 0}

    def _match(item: Any) -> bool:
        item_val = str(item.get(field, "")) if isinstance(item, dict) else str(item)
        if operator == "eq":       return item_val == str(value)
        if operator == "neq":      return item_val != str(value)
        if operator == "contains": return str(value) in item_val
        if operator == "exists":   return bool(item_val)
        if operator == "not_exists": return not bool(item_val)
        try:
            l, r = float(item_val), float(value)
            if operator == "gt":  return l > r
            if operator == "lt":  return l < r
            if operator == "gte": return l >= r
            if operator == "lte": return l <= r
        except (ValueError, TypeError):
            return False
        return False

    filtered = [item for item in items if _match(item)]
    context["vars"][source_var] = filtered
    return {"filtered": filtered, "count": len(filtered)}


def _execute_sort_items(config: dict, context: dict) -> dict[str, Any]:
    """Ordena lista de dicts por campo."""
    field = config.get("field", "")
    order = config.get("order", "asc")
    source_var = config.get("source", "items")
    items = context.get("vars", {}).get(source_var, [])

    if not isinstance(items, list):
        return {"sorted": [], "count": 0}

    def _key(item: Any) -> Any:
        if isinstance(item, dict):
            return str(item.get(field, ""))
        return str(item)

    sorted_items = sorted(items, key=_key, reverse=(order == "desc"))
    context["vars"][source_var] = sorted_items
    return {"sorted": sorted_items, "count": len(sorted_items)}


def _execute_remove_duplicates(config: dict, context: dict) -> dict[str, Any]:
    """Remove duplicatas de uma lista com base em um campo."""
    field = config.get("field", "")
    source_var = config.get("source", "items")
    items = context.get("vars", {}).get(source_var, [])

    if not isinstance(items, list):
        return {"unique": [], "removed": 0}

    seen: set[str] = set()
    unique = []
    for item in items:
        key = str(item.get(field, "")) if isinstance(item, dict) else str(item)
        if key not in seen:
            seen.add(key)
            unique.append(item)

    removed = len(items) - len(unique)
    context["vars"][source_var] = unique
    return {"unique": unique, "count": len(unique), "removed": removed}


def _execute_split_batches(config: dict, context: dict) -> dict[str, Any]:
    """Divide lista em lotes de tamanho fixo."""
    batch_size = int(config.get("batch_size", 10))
    source_var = config.get("source", "items")
    items = context.get("vars", {}).get(source_var, [])

    if not isinstance(items, list):
        return {"batches": [], "batch_count": 0}

    batches = [items[i:i + batch_size] for i in range(0, len(items), batch_size)]
    context["vars"]["batches"] = batches
    return {"batches": batches, "batch_count": len(batches), "total_items": len(items)}


def _execute_merge_data(config: dict, context: dict) -> dict[str, Any]:
    """Combina duas listas/dicts do contexto."""
    source_a = config.get("source_a", "items_a")
    source_b = config.get("source_b", "items_b")
    mode = config.get("mode", "append")  # append | merge_by_key

    data_a = context.get("vars", {}).get(source_a, [])
    data_b = context.get("vars", {}).get(source_b, [])

    if mode == "append":
        if isinstance(data_a, list) and isinstance(data_b, list):
            merged = data_a + data_b
        elif isinstance(data_a, dict) and isinstance(data_b, dict):
            merged = {**data_a, **data_b}
        else:
            merged = [data_a, data_b]
    elif mode == "merge_by_key":
        merge_key = config.get("merge_key", "id")
        if isinstance(data_a, list) and isinstance(data_b, list):
            b_map = {item.get(merge_key): item for item in data_b if isinstance(item, dict)}
            merged = []
            for item in data_a:
                if isinstance(item, dict):
                    key = item.get(merge_key)
                    if key in b_map:
                        merged.append({**item, **b_map[key]})
                    else:
                        merged.append(item)
        else:
            merged = [data_a, data_b]
    else:
        merged = [data_a, data_b]

    context["vars"]["merged"] = merged
    return {"merged": merged, "count": len(merged) if isinstance(merged, list) else 1}


def _execute_datetime_format(config: dict) -> dict[str, Any]:
    """Formata/parseia datas."""
    input_field = config.get("input_field", "")
    input_format = config.get("input_format", "%Y-%m-%dT%H:%M:%S")
    output_format = config.get("output_format", "%d/%m/%Y %H:%M")
    action = config.get("action", "format")  # format | now | add_days

    if action == "now":
        result = datetime.now(timezone.utc).strftime(output_format)
        return {"result": result}

    if action == "add_days":
        days = int(config.get("days", 0))
        from datetime import timedelta
        base = datetime.now(timezone.utc)
        if input_field:
            try:
                base = datetime.strptime(input_field, input_format).replace(tzinfo=timezone.utc)
            except ValueError:
                pass
        result = (base + timedelta(days=days)).strftime(output_format)
        return {"result": result}

    # format
    try:
        dt = datetime.strptime(input_field, input_format)
        result = dt.strftime(output_format)
    except ValueError:
        result = input_field  # fallback
    return {"result": result}


def _execute_rename_keys(config: dict, context: dict) -> dict[str, Any]:
    """Renomeia chaves de um dict ou lista de dicts."""
    mappings = config.get("mappings", {})  # {old_key: new_key}
    source_var = config.get("source", "items")
    data = context.get("vars", {}).get(source_var, {})

    def _rename(item: Any) -> Any:
        if not isinstance(item, dict):
            return item
        return {mappings.get(k, k): v for k, v in item.items()}

    if isinstance(data, list):
        renamed = [_rename(item) for item in data]
    elif isinstance(data, dict):
        renamed = _rename(data)
    else:
        renamed = data

    context["vars"][source_var] = renamed
    return {"renamed": renamed}


# ────────────────────────────────────────────────────────────────────────────
# TEMPLATE RESOLUTION
# ────────────────────────────────────────────────────────────────────────────

def _resolve_template_string(template: str, context: dict) -> str:
    """Substitui {{trigger.field}}, {{vars.x}}, {{node.id.output.y}}."""
    def replace_match(m: re.Match) -> str:
        expr = m.group(1).strip()
        parts = expr.split(".")
        try:
            if parts[0] == "trigger":
                val: Any = context.get("trigger", {})
                for p in parts[1:]:
                    val = val.get(p, "") if isinstance(val, dict) else ""
                return str(val)
            elif parts[0] == "vars":
                return str(context.get("vars", {}).get(parts[1], ""))
            elif parts[0] == "node" and len(parts) >= 3:
                node_out: Any = context.get("nodes", {}).get(parts[1], {})
                for p in parts[2:]:
                    node_out = node_out.get(p, "") if isinstance(node_out, dict) else ""
                return str(node_out)
        except Exception:
            return ""
        return m.group(0)

    return re.sub(r"\{\{([^}]+)\}\}", replace_match, template)


def _evaluate_condition(config: dict) -> bool:
    """Avalia condição simples de IfCondition."""
    left = str(config.get("left", ""))
    right = str(config.get("right", ""))
    op = config.get("operator", "eq")

    if op == "eq":      return left == right
    if op == "neq":     return left != right
    if op == "contains": return right in left
    if op == "exists":  return bool(left)
    try:
        l_f, r_f = float(left), float(right)
        if op == "gt":  return l_f > r_f
        if op == "lt":  return l_f < r_f
        if op == "gte": return l_f >= r_f
        if op == "lte": return l_f <= r_f
    except ValueError:
        return False
    return False


# ────────────────────────────────────────────────────────────────────────────
# SANITIZAÇÃO DE LOGS (LGPD)
# ────────────────────────────────────────────────────────────────────────────

_PII_PATTERNS = [
    (re.compile(r'\b\d{3}\.\d{3}\.\d{3}-\d{2}\b'), "[CPF_REDACTED]"),
    (re.compile(r'\b[\w.+-]+@[\w-]+\.\w+\b'), "[EMAIL_REDACTED]"),
    (re.compile(r'\b(\+55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}\b'), "[PHONE_REDACTED]"),
    (re.compile(r'(?i)(bearer|token|secret|password|api_?key)\s*[:=]\s*\S+'), "[SECRET_REDACTED]"),
    (re.compile(r'\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b'), "[CARD_REDACTED]"),
]


def sanitize_io(data: Any, depth: int = 0) -> Any:
    """Remove/mascara PII e secrets de input/output de steps."""
    if depth > 10:
        return "[TRUNCATED]"
    if isinstance(data, str):
        result = data
        for pattern, replacement in _PII_PATTERNS:
            result = pattern.sub(replacement, result)
        return result
    elif isinstance(data, dict):
        return {k: sanitize_io(v, depth + 1) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_io(item, depth + 1) for item in data[:50]]
    return data


# ────────────────────────────────────────────────────────────────────────────
# WEBHOOK HELPERS
# ────────────────────────────────────────────────────────────────────────────

def get_webhook_endpoint(
    db: Session,
    path_slug: str,
) -> Optional[AutomationWebhookEndpoint]:
    return db.query(AutomationWebhookEndpoint).filter(
        AutomationWebhookEndpoint.path_slug == path_slug,
    ).first()


def trigger_execution_webhook(
    db: Session,
    workflow_id: str,
    payload: dict,
    path_slug: str,
) -> AutomationExecution:
    """Cria e executa workflow disparado por webhook."""
    workflow = db.query(AutomationWorkflow).filter(
        AutomationWorkflow.id == workflow_id,
    ).first()

    if not workflow or workflow.status != "PUBLISHED":
        raise ValueError("Workflow não encontrado ou não está publicado.")

    # Buscar versão publicada
    version = db.query(AutomationWorkflowVersion).filter(
        AutomationWorkflowVersion.id == workflow.current_version_id,
    ).first()

    if not version:
        raise ValueError("Versão do workflow não encontrada.")

    execution = AutomationExecution(
        workflow_id=workflow.id,
        version_id=version.id,
        status="RUNNING",
        trigger_type="webhook",
    )
    db.add(execution)
    db.flush()

    initial_context = {"payload": payload, "webhook_slug": path_slug}
    execution = execute_workflow_sync(db, execution, version.definition_json, initial_context)

    return execution


# ────────────────────────────────────────────────────────────────────────────
# EXECUTIONS QUERIES
# ────────────────────────────────────────────────────────────────────────────

def list_executions(
    db: Session,
    organization_id: str,
    workflow_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> list[AutomationExecution]:
    q = db.query(AutomationExecution).join(
        AutomationWorkflow,
        AutomationExecution.workflow_id == AutomationWorkflow.id,
    ).filter(
        AutomationWorkflow.organization_id == organization_id,
    )
    if workflow_id:
        q = q.filter(AutomationExecution.workflow_id == workflow_id)
    if status:
        q = q.filter(AutomationExecution.status == status)
    return q.order_by(AutomationExecution.started_at.desc()).offset(offset).limit(limit).all()


def get_execution(
    db: Session,
    execution_id: str,
    organization_id: str,
) -> Optional[AutomationExecution]:
    return db.query(AutomationExecution).join(
        AutomationWorkflow,
        AutomationExecution.workflow_id == AutomationWorkflow.id,
    ).filter(
        AutomationExecution.id == execution_id,
        AutomationWorkflow.organization_id == organization_id,
    ).first()


def get_execution_steps(
    db: Session,
    execution_id: str,
) -> list[AutomationExecutionStep]:
    return db.query(AutomationExecutionStep).filter(
        AutomationExecutionStep.execution_id == execution_id,
    ).order_by(AutomationExecutionStep.started_at).all()


def get_workflow_versions(
    db: Session,
    workflow_id: str,
) -> list[AutomationWorkflowVersion]:
    return db.query(AutomationWorkflowVersion).filter(
        AutomationWorkflowVersion.workflow_id == workflow_id,
    ).order_by(AutomationWorkflowVersion.version_number.desc()).all()
