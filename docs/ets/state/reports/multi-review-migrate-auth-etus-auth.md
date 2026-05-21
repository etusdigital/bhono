---
title: Multi-Review — Migrate Auth to @etus/auth Requirements
type: review-report
artifact: docs/ets/brainstorms/2026-05-19-migrate-auth-etus-auth-requirements.md
personas: [ce-security-lens, ce-scope-guardian, ce-feasibility, ce-coherence]
mode: parallel
severity_floor: medium
date: 2026-05-20
---

# Multi-Review Consolidated Report

Artefato revisto: `docs/ets/brainstorms/2026-05-19-migrate-auth-etus-auth-requirements.md`
Modo: 4 personas independentes em paralelo, zero contexto compartilhado.

## Veredito

**O doc NÃO está pronto pra ir a `/a3s-plan` sem ajustes.** Há **5 findings convergentes** (mais de uma persona apontou independentemente o mesmo problema) — esse é o sinal mais forte. Há também 1 finding `CRITICAL` único de Security que invalida 1 dos 8 Success Criteria.

A boa notícia: os ajustes são todos cirúrgicos. Não há necessidade de re-arquitetar o plano. O núcleo (R1–R8, R17–R21) está sólido.

## Findings convergentes (consenso entre personas)

### 🔴 CRITICAL — `R12 / R25 / SC3` (audit cross-owner): apontado por **TODAS as 4 personas**

| Persona | Ângulo |
|---|---|
| Security #1 | `accountMiddleware` retorna `authMembership=null` quando staff não é membro → `accountId` no log fica null → audit inútil |
| Security #4 | `eventType='admin.cross_owner_action'` não está na union `AuditEventType` → `query()` quebra em compile-time |
| Feasibility #1 | Mesmo achado — `auditLogger.log()` aceita via cast, mas `query()` não |
| Scope #2 | Audit hook não-built-in pertence a produto, não a boilerplate |
| Coherence #2 | Hook `onMutation` ambíguo: dentro do pipeline ou paralelo? |
| Coherence #4 | Confusão entre `audit_logs` (R5) e `auth_audit_logs` (R12) |

**Recomendação**: **Remover R12, R25 e SC3 do escopo do boilerplate.** A demanda real é "todo produto interno ETUS deve auditar ações sensíveis de admin" — isso pode virar um pattern documentado na skill `auth-extend`, não um requisito hard-coded no boilerplate. O boilerplate fica com `audit.enabled=true` do pacote (que já cobre lifecycle: login, member added, etc) e produtos adicionam audit custom de mutação se precisarem.

### 🔴 HIGH — `R11 / D6` (staff promoção): apontado por Security #2 + Feasibility #3

Staff é promovido a `admin` **apenas no callback de login** (`routes.ts:199, 281-283`). Não há reconciliação contínua. Consequências:
- Email removido de `access.admins` → user continua admin até logout+login
- Email adicionado → user precisa fazer login de novo
- Sessão ativa de 30 dias mantém `admin` mesmo se email saiu da lista hoje

**Recomendação**: Adicionar D11 reconhecendo o comportamento stateful. Adicionar R sobre TTL curto para admins (ex: 8h). Documentar procedimento de revogação.

### 🟡 HIGH — `R27` (dual-runtime Node+Postgres): apontado por Scope #1 + Feasibility #7

YAGNI puro. Boilerplate é CF Workers-only. Pacote tem PG adapter, mas **não tem KV adapter** — sessões não funcionam em Node sem trabalho extra.

**Recomendação**: **Mover R27 inteiro pra out-of-scope** com nota: "Produtos que rodarem fora de CF Workers configuram adapter próprio."

### 🟡 HIGH — `R26` (SLA 50ms p95): apontado por Scope #3 (e implicitamente Feasibility)

Não-mensurável (sem baseline), não-implementável (código no pacote, não no boilerplate).

**Recomendação**: **Remover R26.** Se performance importar, substituir por test de integração que valide `/auth/me < Xms` em wrangler dev.

### 🟡 MEDIUM — `R5b` (email-list de staff): apontado por Scope #5 + Security #2

Hardcoded no boilerplate → propagação para N produtos sem garantia. Drift quando alguém sai.

**Recomendação**: R5b passa a especificar env var `AUTH_ADMIN_EMAILS` (CSV) que cada produto popula. Boilerplate vem com `[]` + comentário.

## Findings únicos relevantes

### 🔴 CRITICAL — `Actors table` ainda menciona `gatewayRole=admin` (Coherence #1)

Linhas 49 e 59 do doc usam `gatewayRole=admin` como critério, mas D6 e Q1 RESOLVIDA dizem explicitamente que `gatewayRole` **não existe**. Contradição interna direta.

**Recomendação**: Fix textual imediato. Reescrever as duas linhas pra usar "emails em `access.admins`".

### 🔴 HIGH — Session fingerprinting descartado silenciosamente (Security #3)

Plano antigo flagou como HIGH. Pacote suporta (`fingerprint.enabled` em `SessionConfig`). Doc atual nem menciona. Decisão de postura de segurança sem registro.

**Recomendação**: Adicionar D12 com decisão explícita (habilitar com `mode='reauth'` recomendado, ou justificar descarte).

### 🔴 HIGH — Bootstrap problem (Security #5)

`approval-required` + email-list ETUS = produto novo de cliente sem admin local fica em deadlock. Único caminho: dev ETUS aprova manualmente (não escala).

**Recomendação**: Adicionar R/Q sobre procedimento de bootstrap (modo `open` inicial trocado pra `approval-required` após primeiro admin local).

### 🟡 HIGH — `R8` `resources:publish` sem consumidor (Scope #6)

Catálogo declara `publish` mas nenhuma role na matriz R7 referencia. Replica o problema das "27 perms órfãs" que justifica a migração.

**Recomendação**: Remover `resources:publish` do R8.

### 🟡 HIGH — Success Criterion #6 grep syntax inválido (Coherence #5)

`grep -r "jwtAuth\|sessionMiddleware\|hasMinimumRole" src/` — usa `\|` sem `-E`. Comando passa false positive (não encontra os termos).

**Recomendação**: `grep -rE "jwtAuth|sessionMiddleware|hasMinimumRole" src/`.

### 🟡 MEDIUM — `R7b / D10` afirma hierarchy NÃO afeta perms — **errado** (Feasibility #4)

`middleware.ts:110-121` injeta `hierarchyPerms` no merge (passo 2). Hierarchy **afeta** perms também.

**Recomendação**: Reescrever D10 — ou aceitar inheritance e simplificar R7 (cada role define só perms ADICIONAIS), ou desabilitar `roleHierarchy` e usar só matriz explícita pra `requireRole` via `requireAnyRole`.

### 🟡 MEDIUM — `R19` invitations: pacote não envia email (Feasibility #6)

`account-routes.ts` cria registro no DB mas não envia email. Boilerplate atual tem SendGrid. Doc não diz quem assume.

**Recomendação**: Adicionar R: "boilerplate mantém SendGrid via hook `onMemberAdded` ou wrapper de `/accounts/:id/members/invite`".

### 🟡 MEDIUM — `R17 / A5` `/auth/me` shape (Feasibility #5)

Pacote retorna só `{id, email, name, picture, role}`. Frontend atual precisa de account/membership/permissions. Sem account context, header/sidebar quebram.

**Recomendação**: Adicionar R sobre endpoint agregador `/api/me` ou aceitar que `useAuth` chama múltiplos endpoints.

### 🟡 MEDIUM — `R23` premature + termo divergente (Scope #4 + Coherence #6)

Skill `auth-extend` documenta extensão de algo que ainda não existe. Termo `account_custom_roles` aparece em R23 mas Out-of-scope usa `dynamicPermissions`.

**Recomendação**: Diferir R23/R24 pra follow-up após implementação verde. Uniformizar termo para `dynamicPermissions`.

### 🟡 MEDIUM — `R7` admin pode rebaixar owner (Security #7)

`admin` tem `members:*` → pode mexer no role do owner via `PATCH /accounts/:id/members/:userId`. Guard built-in protege "último admin" mas não "owner".

**Recomendação**: Adicionar R sobre guard adicional `if targetUserId === account.ownerId: only owner can modify`.

### 🟡 MEDIUM — `R5 vs R12` confusão `audit_logs` vs `auth_audit_logs` (Coherence #4)

Nomes diferentes, intenção ambígua: mesma tabela com `eventType` diferente, ou tabelas separadas?

**Recomendação**: Padronizar nome único e documentar intenção.

## Sumário priorizado

| # | Severidade | Ação | Personas |
|---|---|---|---|
| 1 | 🔴 CRITICAL | **Remover R12/R25/SC3** (audit cross-owner) do escopo do boilerplate | 4 personas |
| 2 | 🔴 CRITICAL | **Fix textual** Actors table (`gatewayRole=admin` → email-list) | Coherence |
| 3 | 🔴 HIGH | **Adicionar D11** sobre staff promoção stateful + TTL curto | 2 personas |
| 4 | 🔴 HIGH | **Adicionar D12** sobre session fingerprinting (habilitar ou justificar descarte) | Security |
| 5 | 🔴 HIGH | **Adicionar R/Q** sobre bootstrap problem (modo `open` inicial) | Security |
| 6 | 🟡 HIGH | **Mover R27 → out-of-scope** (dual-runtime Postgres) | 2 personas |
| 7 | 🟡 HIGH | **Remover R26** (SLA 50ms não-mensurável) | Scope |
| 8 | 🟡 HIGH | **Remover `resources:publish`** de R8 | Scope |
| 9 | 🟡 HIGH | **Fix grep** em SC6 | Coherence |
| 10 | 🟡 MEDIUM | **Reescrever D10** (hierarchy também afeta perms) | Feasibility |
| 11 | 🟡 MEDIUM | **Mudar R5b** pra env var | 2 personas |
| 12 | 🟡 MEDIUM | **Adicionar R** sobre SendGrid pra invitation email | Feasibility |
| 13 | 🟡 MEDIUM | **Adicionar R** sobre endpoint agregador `/api/me` | Feasibility |
| 14 | 🟡 MEDIUM | **Diferir R23/R24** + uniformizar termo `dynamicPermissions` | 2 personas |
| 15 | 🟡 MEDIUM | **Adicionar R** sobre guard protecting `account.ownerId` | Security |
| 16 | 🟡 MEDIUM | **Padronizar** `audit_logs` vs `auth_audit_logs` | Coherence |

## Spikes recomendados antes de implementar (feasibility)

1. **Spike `/auth/me` + frontend** — substituir o hook real, verificar gap de account/membership e decidir endpoint agregador.
2. **Spike SendGrid hook** — wrap `accountRoutes` interceptando 201 do invite e disparando email.
3. **Spike audit query** — confirmar empiricamente se `getAuditLogger().query()` aceita event types fora da union (provavelmente erro de tipo).

## Conclusão

Resolvendo os 5 itens 🔴 (CRITICAL + HIGH convergentes), o doc fica em estado planejável. Os itens 🟡 podem ser tratados em segunda passada ou já no `/a3s-plan` como notas. Os 3 spikes desbloqueiam confiança técnica antes de `git rm` no código antigo.
