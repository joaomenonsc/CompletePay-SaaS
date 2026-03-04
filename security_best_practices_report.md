# Security Best Practices Report — CompletePay SaaS

Date: 2026-03-04  
Scope: `apps/backend` (FastAPI/Python), `apps/frontend` (Next.js/React)

## Executive Summary

Foram identificados **12 achados**: **3 críticos**, **4 altos** e **5 médios**.  
Os principais riscos hoje são:

1. Exposição pública de arquivos sensíveis em `/uploads` (incluindo documentos de pacientes).
2. Validação de assinatura de webhooks com bypass (permite forjar eventos).
3. Execução dinâmica de Python (`exec`) em automações.

Esses três pontos, combinados, podem levar a **vazamento de dados sensíveis, execução de ações não autorizadas e potencial comprometimento do backend**.

---

## Critical

### [SBP-001] Exposição pública de arquivos sensíveis em `/uploads` (bypass de RBAC)

- Severity: Critical
- Location:
  - `apps/backend/src/api/app.py:99`
  - `apps/backend/src/api/middleware/auth.py:38`
  - `apps/backend/src/services/document_storage.py:21`
  - `apps/backend/src/schemas/crm.py:295`
- Evidence:
  - A aplicação monta `StaticFiles` em `/uploads`.
  - `/uploads` está na lista de rotas públicas (sem JWT).
  - Documentos de pacientes são salvos em `uploads/documents/...`.
  - `file_path` desses documentos é retornado em API.
- Impact:
  - Documentos que deveriam ser protegidos por RBAC podem ser acessados diretamente por URL.
  - Vazamento de dados clínicos/PII/LGPD.
- Fix:
  - Não expor `uploads` inteiro publicamente.
  - Separar storage público (ex.: avatares) e storage privado (documentos clínicos).
  - Remover `("GET", "/uploads")` de rotas públicas.
  - Servir documentos privados apenas por endpoint autenticado/autorizado com `FileResponse`.
- Mitigation:
  - Rotacionar URLs já expostas e revisar logs de acesso de `/uploads/documents`.
- False positive notes:
  - Se houver proxy/CDN bloqueando `/uploads/documents` externamente, o risco diminui, mas isso não está visível no código.

### [SBP-002] Validação de assinatura de webhook com bypass (Email Marketing)

- Severity: Critical
- Location:
  - `apps/backend/src/api/routes/emk_public.py:49`
  - `apps/backend/src/api/routes/emk_public.py:54`
  - `apps/backend/src/api/routes/emk_public.py:55`
  - `apps/backend/src/services/esp_adapter.py:182`
  - `apps/backend/src/services/esp_adapter.py:184`
- Evidence:
  - A validação usa `svix-secret` vindo do próprio request.
  - Se `svix-signature` não vier, o webhook segue sem bloquear.
  - Em ausência de `svix`, `verify_webhook` retorna `True` (fail-open).
- Impact:
  - Atacante pode forjar eventos de webhook, alterar métricas de campanha e disparar fluxos indevidos.
- Fix:
  - Usar segredo de webhook armazenado no servidor (env/secret manager), nunca header do cliente.
  - Tornar assinatura obrigatória em produção e falhar fechado (401).
  - Remover comportamento fail-open na ausência de `svix`.
- Mitigation:
  - Aplicar allowlist de IPs do provedor e rate limit específico para webhooks.
- False positive notes:
  - Se webhook estiver atrás de gateway que já valida assinatura e remove headers, validar essa garantia.

### [SBP-003] Execução de código Python dinâmico em automações (`exec`)

- Severity: Critical
- Location:
  - `apps/backend/src/services/automation_service.py:745`
  - `apps/backend/src/services/automation_service.py:756`
  - `apps/backend/src/services/automation_service.py:344`
- Evidence:
  - Node `CodeScript` executa string com `exec(...)`.
  - Validação atual exige apenas presença de `code`, sem política de segurança.
- Impact:
  - Possível RCE/sandbox escape, comprometendo servidor e dados multi-tenant.
- Fix:
  - Remover `CodeScript` em produção; trocar por DSL segura de transformações.
  - Se indispensável: executar em sandbox isolada (processo/container restrito sem rede/fs), com allowlist de operações.
- Mitigation:
  - Restringir o recurso a role administrativa e ambiente interno até correção.
- False positive notes:
  - `__builtins__={}` não é defesa suficiente para considerar seguro contra escape.

---

## High

### [SBP-004] SSRF por URLs arbitrárias em automações e webhooks de calendário

- Severity: High
- Location:
  - `apps/backend/src/services/automation_service.py:638`
  - `apps/backend/src/services/automation_service.py:646`
  - `apps/backend/src/api/routes/calendar.py:1134`
  - `apps/backend/src/services/webhook_service.py:127`
- Evidence:
  - `HttpRequest` em automações envia para URL livre definida em workflow.
  - Webhook de calendário aceita URL arbitrária e backend faz POST nela.
- Impact:
  - Scan/acesso a rede interna, metadata endpoints e serviços internos via backend.
- Fix:
  - Validar URL com denylist de ranges privados e allowlist de domínios.
  - Bloquear protocolos não HTTP(S), redirecionamentos para IP interno e portas sensíveis.

### [SBP-005] Token JWT no frontend em `localStorage` e cookie manipulável por JS

- Severity: High
- Location:
  - `apps/frontend/src/store/auth-store.ts:13`
  - `apps/frontend/src/store/auth-store.ts:30`
  - `apps/frontend/src/lib/api/client.ts:18`
  - `apps/frontend/src/lib/api/client.ts:19`
- Evidence:
  - Token é persistido em store com `persist` (localStorage).
  - Cookie de auth é criado via `document.cookie` (sem `HttpOnly`; sem `Secure`).
  - Token é lido no client e enviado no header Authorization.
- Impact:
  - Qualquer XSS no front pode exfiltrar token e tomar conta da sessão.
- Fix:
  - Migrar para sessão com cookie `HttpOnly; Secure; SameSite`.
  - Adotar access token curto + refresh rotativo no backend.

### [SBP-006] JWT enviado em query string no WebSocket

- Severity: High
- Location:
  - `apps/frontend/src/hooks/use-websocket-chat.ts:124`
  - `apps/backend/src/api/routes/ws_chat.py:33`
- Evidence:
  - Cliente conecta em `.../ws/chat?token=...`.
  - Backend autentica lendo `query_params.get("token")`.
- Impact:
  - Vazamento de token em logs de proxies, observabilidade e histórico.
- Fix:
  - Usar `Sec-WebSocket-Protocol` com token curto de handshake ou ticket efêmero.

### [SBP-007] Secret de webhook é logado em texto claro na criação

- Severity: High
- Location:
  - `apps/backend/src/services/automation_service.py:247`
  - `apps/backend/src/services/automation_service.py:248`
- Evidence:
  - Log inclui `secret=%s`.
- Impact:
  - Comprometimento do segredo via logs/observabilidade.
- Fix:
  - Não logar segredo bruto; exibir apenas fingerprint parcial.
  - Entregar segredo uma única vez por resposta segura ao usuário autorizado.

---

## Medium

### [SBP-008] Fallback de startup expõe traceback ao cliente

- Severity: Medium
- Location:
  - `apps/backend/src/app.py:20`
  - `apps/backend/src/app.py:22`
- Evidence:
  - Em falha de import/startup, endpoint retorna `message` e `traceback`.
- Impact:
  - Divulgação de detalhes internos (stack, paths, componentes).
- Fix:
  - Retornar erro genérico para cliente e logar detalhes só no servidor.

### [SBP-009] Rotas do calendário sem RBAC granular (somente membership)

- Severity: Medium
- Location:
  - `apps/backend/src/api/routes/calendar.py:119`
  - `apps/backend/src/api/routes/calendar.py:1125`
  - `apps/backend/src/api/deps.py:27`
- Evidence:
  - Múltiplas rotas sensíveis usam apenas `require_user_id + require_organization_id`.
  - `require_organization_id` valida apenas “é membro”, sem role mínima.
- Impact:
  - Membros com privilégios baixos podem executar ações administrativas no calendário.
- Fix:
  - Aplicar `require_org_role(...)` por endpoint (least privilege).
  - Definir matriz de permissões explícita para calendário/webhooks/workflows.

### [SBP-010] Segredo JWT default fraco sem bloqueio de produção

- Severity: Medium
- Location:
  - `apps/backend/src/config/settings.py:20`
  - `apps/backend/src/auth/service.py:51`
- Evidence:
  - `jwt_secret` default: `change-me-in-production`.
  - Emissão/validação de token usa esse valor sem fail-fast.
- Impact:
  - Deploy mal configurado pode permitir forja de JWT.
- Fix:
  - Em `APP_ENV=production`, abortar startup se `JWT_SECRET` estiver default/curto.

### [SBP-011] Endpoints operacionais públicos (`/health`, `/health/db-pool`, `/metrics`, docs)

- Severity: Medium
- Location:
  - `apps/backend/src/api/routes/health.py:10`
  - `apps/backend/src/api/routes/health.py:21`
  - `apps/backend/src/api/app.py:114`
  - `apps/backend/src/api/middleware/auth.py:33`
  - `apps/backend/src/api/middleware/auth.py:35`
- Evidence:
  - Health/pool sem autenticação.
  - `/metrics` exposto quando instrumentator está ativo.
  - `/docs` e `/openapi.json` públicos.
- Impact:
  - Reconhecimento de superfície, metadados de capacidade e descoberta de endpoints.
- Fix:
  - Restringir via auth/rede (allowlist) em produção.
  - Desabilitar docs públicas em produção quando não necessário.

### [SBP-012] Rate limit baseado em `X-Forwarded-For` sem validação de proxy confiável

- Severity: Medium
- Location:
  - `apps/backend/src/api/middleware/rate_limit.py:50`
  - `apps/backend/src/api/middleware/rate_limit.py:52`
- Evidence:
  - Valor de `x-forwarded-for` é aceito diretamente para chave de rate limit.
- Impact:
  - Bypass de rate limit via header forjado.
- Fix:
  - Confiar apenas em IP do proxy conhecido (ou middleware de proxy confiável).
  - Usar header apenas quando vindo de infraestrutura confiável.

---

## Recommended Remediation Order

1. SBP-001, SBP-002, SBP-003 (imediato).
2. SBP-004, SBP-005, SBP-006, SBP-007.
3. Demais itens de hardening e governança.

