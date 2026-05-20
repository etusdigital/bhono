---
title: Implementation Plan — Migrate Auth to @etus/auth
type: refactor
date: 2026-05-20
status: confirmed
source_requirements: docs/ets/brainstorms/2026-05-19-migrate-auth-etus-auth-requirements.md
multi_review: docs/ets/state/reports/multi-review-migrate-auth-etus-auth.md
supersedes_branch: feat/migrate-auth-to-etus-auth (hybrid approach, @etus/auth@0.1.0 — obsoleta)
package_target: "@etus/auth@^0.3.0"
---

# Implementation Plan — Migrate Auth to `@etus/auth`

Plano tático de implementação derivado do requirements doc (já fechado via brainstorm + multi-review). 7 fases ordenadas, unidades de trabalho nomeadas, Fase 0 de spikes como gate bloqueante.

## Objetivo

Substituir a camada de auth custom do `boilerplate-hono` por configuração do `@etus/auth@^0.3.0`, transformando o boilerplate em base reutilizável pra produtos internos ETUS. Big delete + rewrite limpo — sem migração de dados (boilerplate sem usuários reais).

## Estratégia de branch

- **Branch nova** a partir de `master` (ex: `feat/auth-etus-v2`).
- A branch remota `feat/migrate-auth-to-etus-auth` é **referência arqueológica apenas** — usa `@etus/auth@0.1.0` (abordagem híbrida, premissa obsoleta). Consultar para: lista de arquivos a deletar, padrão de mount em `index.ts`, padrões `invite.ts` / `dev/test-login.ts`. **Não fazer merge nem rebase dela.**

## Definition of Ready (DoR)

- [x] Requirements doc fechado e multi-reviewed
- [x] Estado da branch antiga investigado
- [ ] Acesso ao npm scope `@etus` confirmado (`npm whoami`) — **pré-requisito da Fase 1**
- [ ] Cliente OAuth registrado no gateway (`npx @etus/auth init`) ou credenciais disponíveis — **pré-requisito da Fase 1**
- [ ] Branch nova criada a partir de `master`

---

## Fase 0 — De-risking (GATE BLOQUEANTE)

**Objetivo**: validar 3 incógnitas técnicas antes de tocar código de produção. Nenhuma fase seguinte começa até os 3 spikes terem resultado registrado.

**Depende de**: DoR completo.

### U0.1 — Spike `/auth/me` + frontend
- **Pergunta**: o shape `{ user: {id,email,name,picture,role} }` do pacote cobre o que `useAuth`, `<UserMenu>`, `<Sidebar>` e route guards consomem hoje?
- **Ação**: ler `src/client/hooks/use-auth.ts` + componentes que usam `useAuth`; comparar com shape do pacote (`routes.ts:417-425`).
- **Decide**: R17b — endpoint agregador `/api/me` **vs** `useAuth` com `useQueries` paralelo.
- **Verde**: decisão registrada no plano (editar U4.2 abaixo).

### U0.2 — Spike SendGrid hook
- **Pergunta**: `onMemberAdded` (callback built-in) ou wrap do route handler `POST /accounts/:id/members/invite` entrega email de convite funcional?
- **Ação**: protótipo descartável — montar `auth.accountRoutes()` num Hono parent, interceptar o 201, disparar SendGrid.
- **Decide**: R19b — mecanismo do envio de email.
- **Verde**: protótipo dispara email com link de aceite válido; mecanismo escolhido registrado.

### U0.3 — Spike `getAuditLogger().query()` tipos
- **Pergunta**: a API `query()` aceita filtros de event type fora da union `AuditEventType`?
- **Ação**: chamar `auth.getAuditLogger().query()` com filtro custom; observar erro de tipo/runtime.
- **Decide**: confirma que audit custom (se um produto downstream quiser) é viável; informa o que documentar na skill `auth-extend` (deferida).
- **Verde**: comportamento documentado em 2-3 linhas no requirements doc (seção Spikes).

**Checkpoint Fase 0**: 3 spikes com resultado escrito. Spikes são código descartável — `git stash`/descarta após registrar conclusão.

---

## Fase 1 — Install + configuração `@etus/auth`

**Objetivo**: pacote instalado, `createAuth()` configurado, env vars no lugar. App ainda não compila (rotas antigas quebram) — esperado.

**Depende de**: Fase 0.

### U1.1 — Instalar pacote
- `pnpm add @etus/auth@^0.3.0` (confirmar resolução do scope `@etus`).
- Arquivos: `package.json`, `pnpm-lock.yaml`.
- **Verde**: `pnpm install` resolve sem 404.

### U1.2 — Env vars ✅ (concluída 2026-05-20)
- **Prefixo `ETUS_*`** (decisão Fase 1 — já presente no `wrangler.json` desde commit `2533ec4`, não `AUTH_*`).
- `config/wrangler.json`: já tinha `ETUS_GATEWAY`, `ETUS_CLIENT_ID`, `ETUS_ALLOWED_DOMAINS`, `ETUS_ADMIN_EMAILS` (prod + staging) — **sem mudança**. `ETUS_CLIENT_SECRET` via `wrangler secret`.
- `.env.example`: limpo — removidas `GOOGLE_*`/`JWT_*`/`REFRESH_TOKEN_EXPIRY_DAYS`, adicionadas `ETUS_*` com comentário de bootstrap.
- `src/server/env.ts`: **adicionadas** `ETUS_*` à interface `Env`. As `GOOGLE_*`/`JWT_*`/`REFRESH_*` ficam marcadas DEPRECATED — **remoção da interface adiada pra Fase 3** (big delete), pra não quebrar `oauth.ts`/`tokens.ts` no meio da Fase 1.
- Cobre: R4, R5b. (R21 — remoção do `env.ts` migra pra Fase 3.)
- **Verde**: `pnpm cf-typegen` regenerou tipos sem erro. ✅

### U1.3 — `createAuth()` config ✅ (concluída 2026-05-20)
- **Arquivos reais**: `src/server/auth/matrix.ts` (matriz + catálogo + hierarchy) e `src/server/auth/setup.ts` (`getAuth(env)` lazy singleton factory). Usou-se `setup.ts` em vez de `src/server/auth.ts` pra evitar colisão de resolução com a pasta `src/server/auth/` existente. `matrix.ts` antecipa U2.1 (o factory não compila sem a matriz).
- **Padrão**: `getAuth(env)` é lazy singleton — `createAuth()` roda na 1ª request (ETUS_* vars só existem em request-time no Worker) e é cacheado pro isolate.
- Config original:
  - `access`: `mode: 'approval-required'`, `roles: ['owner','admin','member','guest']`, `defaultRole: 'guest'`, `admins` (de `AUTH_ADMIN_EMAILS`), `allowedDomains: ['brius.com.br','etus.com.br']` (obrigatório na API).
  - `multiTenant: { enabled: true }`, `audit: { enabled: true, retentionDays: 90 }`.
  - `session: { fingerprint: true, fingerprintMode: 'reauth' }` — **shape real da 0.3.0** (dois campos, não objeto aninhado).
  - `roleHierarchy: ['owner','admin','member','guest']`.
  - `db`/`sessions`/`clientSecret` como resolvers `(env) => ...` (Workers — secrets só em request time).
- Cobre: R1, R2, R7b, R29.
- **Nota**: callbacks de audit custom NÃO entram — `audit.enabled` cobre login/user.created built-in (R5 dropado na Fase 1).
- **Verde**: arquivo compila (`tsc`).

~~### U1.4 — Callbacks de audit~~ — **REMOVIDA (Fase 1)**. R5 dropado: `audit.enabled=true` já loga login/user.created; callbacks recebem só `(user)` sem `Context`/`transactionId`. Boilerplate confia no audit built-in.

**Checkpoint Fase 1**: `pnpm typecheck` no arquivo `auth.ts` passa. App inteira ainda não — esperado.

---

## Fase 2 — RBAC matriz + guards

**Objetivo**: matriz role→permissions, hierarchy, guards custom. Pode rodar parcialmente em paralelo à Fase 1.

**Depende de**: U1.3 (precisa do `createAuth` pra passar a matriz).

### U2.1 — Matriz role→permissions
- Novo `src/server/auth/matrix.ts`: matriz R7 (`owner: ['*']`, `admin: [...]`, `member: [...]`, `guest: [...]`), passada a `createAuth({ permissions })`.
- Catálogo R8 (sem `resources:publish`).
- Cobre: R6, R7, R8.
- **Verde**: matriz tipada, importada por `auth.ts`.

### U2.2 — Test de type-safety da matriz
- Helper `defineMatrix<Roles>()` ou test unitário que assegura: toda role em `access.roles` tem entrada em `permissions`.
- Cobre: R8b.
- **Verde**: test passa; remover uma role da matriz faz o test falhar (verifica intent).

### U2.3 — Guard de ownership
- Guard adicional em `PATCH /accounts/:id/members/:userId`: rejeita se `targetUserId === account.ownerId` e requester não é o owner.
- Cobre: R8c.
- **Verde**: test cobre admin tentando rebaixar owner → 403.

**Checkpoint Fase 2**: `pnpm test:unit:server` nos arquivos novos de auth passa.

---

## Fase 3 — Big delete + rewire

**Objetivo**: remover código antigo, montar rotas do pacote, reconectar guards. Após esta fase a app volta a compilar.

**Depende de**: Fase 1 + Fase 2.

### U3.1 — Deletar código antigo
- Deletar: `src/server/auth/{roles,permissions,guards,index}.ts`, `src/server/lib/{oauth,session,tokens}.ts`, `src/server/services/auth.ts`, `src/server/routes/auth/{handlers,routes,schemas,test-login,index}.ts`, `src/server/types/auth.ts`, `src/server/middleware/auth.ts`.
- Cobre: R20.
- **Verde**: `grep -rE "jwtAuth|sessionMiddleware|hasMinimumRole" src/` vazio.

### U3.2 — Mount das rotas do pacote
- `src/server/index.ts`: montar `auth.routes()`, `auth.adminRoutes()`, `auth.accountRoutes()`, `auth.invitationRoutes()`, `auth.middleware()`, `auth.accountMiddleware()`.
- Referência: padrão de mount da branch antiga (`index.ts` +89/-89).
- Cobre: R3.
- **Verde**: ordem de middleware correta (account antes dos guards que dependem dele).

### U3.3 — Rewire dos guards nas rotas
- Reescrever guards em: `routes/{audits,storage,accounts,users}/index.ts` usando `auth.requireRole` / `auth.requirePermission` / `auth.requireAccountRole`.
- Cobre: R9, R10, R11.
- **Verde**: cada rota protegida usa guard do pacote.

### U3.4 — Substituir invitations locais
- Deletar `src/server/routes/invitations/*`. Fluxo passa pra `auth.invitationRoutes()` + `auth.accountRoutes()`.
- Cobre: R19.
- **Verde**: nenhuma referência a `invitationsService` local.

**Checkpoint Fase 3**: `pnpm typecheck` + `pnpm build` passam. App compila inteira.

---

## Fase 4 — Frontend

**Objetivo**: `useAuth` consumindo o pacote, agregação de contexto de account.

**Depende de**: Fase 3 + decisão de U0.1.

### U4.1 — `useAuth` no `/auth/me`
- `src/client/hooks/use-auth.ts`: consumir `/auth/me` do pacote.
- Cobre: R17.
- **Verde**: login → `useAuth` retorna user.

### U4.2 — Tipo `AuthUser` ajustado
- **[Decisão U0.1, 2026-05-20]**: endpoint agregador `/api/me` **descartado** — `useAuth` atual é fino, nenhum header/sidebar carrega account context. R17b resolvido sem agregador.
- Atualizar `src/shared/types/auth.ts`: `AuthUser` ganha `role`, renomeia `avatarUrl`→`picture` (shape do pacote). Páginas `account.tsx`/`team.tsx` seguem buscando `/accounts` por conta própria.
- Cobre: R17b.
- **Verde**: tipo bate com `/auth/me` do pacote; sidebar/settings/dashboard compilam.

### U4.3 — Rotas protegidas
- Verificar `_authenticated.tsx` após troca do cookie de sessão.
- Cobre: R18.
- **Verde**: navegação autenticada funciona; prefetch intacto.

**Checkpoint Fase 4**: `pnpm test:client` + login manual no `pnpm dev`.

---

## Fase 5 — Invitation email + bootstrap doc

**Objetivo**: convites disparam email; procedimento de bootstrap documentado.

**Depende de**: Fase 3 + decisão de U0.2.

### U5.1 — SendGrid hook
- **[Decisão U0.2, 2026-05-20]**: pacote NÃO tem callback de invitation — `onMemberAdded` dispara no aceite, tarde demais. **Mecanismo: wrap do route handler** `POST /accounts/:id/members/invite` — interceptar o 201 e disparar SendGrid. Detalhe (middleware `after` vs proxy fetch) decidido na implementação, respeitando R28 (só API pública).
- Reusar `src/server/lib/email.ts` (`sendInvitationEmail`) existente.
- Cobre: R19b.
- **Verde**: convite criado → email recebido com link de aceite funcional.

~~### U5.2 — TTL 8h pra admins~~ — **REMOVIDA (Fase 1)**. `SessionConfig.maxAge` é valor único global na 0.3.0 — sem TTL por-role. R30 rebaixado a limitação documentada; revogação de admin é via `suspend` manual. A skill `auth-extend` (R23, deferida) documenta o procedimento de emergência.

### U5.2 — Bootstrap procedure (documentação inline)
- Comentário em `.env.example` + `auth.ts` explicando o procedimento de bootstrap (R5c): produto novo inicia com `mode='open'` + 1 email, troca pra `approval-required` após primeiro admin.
- Cobre: R5c.
- **Verde**: comentário presente e claro.

**Checkpoint Fase 5**: `pnpm test:integration` nos fluxos de invite/session.

---

## Fase 6 — Tests + docs + verificação final

**Objetivo**: suíte verde, docs atualizadas, build limpo.

**Depende de**: Fases 3, 4, 5.

### U6.1 — Limpar tests antigos
- Deletar: `tests/unit/server/auth/*`, `tests/unit/server/lib/oauth.test.ts`, `tests/unit/server/services/auth.test.ts`, `tests/integration/auth/*`, `tests/integration/lib/oauth.test.ts`.
- Atualizar fixtures de auth (`tests/fixtures/server.ts`) pra mock do `@etus/auth` — estratégia definida em Q4.
- Cobre: R20 (tests).
- **Verde**: nenhum test importa código deletado.

### U6.2 — Test de performance local
- Test de integração: `/auth/me` responde < 200ms em `wrangler dev`.
- Cobre: R26b.
- **Verde**: test passa em ambiente local.

### U6.3 — Atualizar CLAUDE.md
- Remover seção "Authentication Flow" custom; referenciar `@etus/auth`.
- Cobre: R22. (Skill `auth-extend` R23 e README R24 são **deferidos** — não bloqueiam.)
- **Verde**: CLAUDE.md sem referência ao OAuth custom.

### U6.4 — Verificação final
- Rodar: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`.
- Confirmar R28: `grep -r "@etus/auth/internal" src/` vazio.
- **Verde**: tudo verde.

**Checkpoint Fase 6**: suíte completa verde.

---

## Definition of Done (DoD)

- [ ] Os 8 Success Criteria do requirements doc satisfeitos
- [ ] `pnpm lint && pnpm typecheck && pnpm build` verdes
- [ ] `pnpm test:unit && pnpm test:integration && pnpm test:e2e` verdes
- [ ] `grep -rE "jwtAuth|sessionMiddleware|hasMinimumRole" src/` vazio
- [ ] `grep -r "@etus/auth/internal" src/` vazio
- [ ] Login end-to-end funciona no `pnpm dev`
- [ ] CLAUDE.md atualizado
- [ ] Plano antigo de 2026-02-03 permanece marcado superseded

## Validação por fase

| Fase | Comandos de checkpoint |
|---|---|
| 0 | (manual — spikes registrados) |
| 1 | `pnpm cf-typegen`, `pnpm typecheck` (parcial) |
| 2 | `pnpm test:unit:server` |
| 3 | `pnpm typecheck`, `pnpm build` |
| 4 | `pnpm test:client`, login manual `pnpm dev` |
| 5 | `pnpm test:integration` |
| 6 | `pnpm lint && pnpm typecheck && pnpm build && pnpm test` |

## Grafo de dependências

```
DoR → Fase 0 (gate) → Fase 1 ──┬─→ Fase 3 → ┬─→ Fase 4 (precisa U0.1)
                       Fase 2 ──┘            ├─→ Fase 5 (precisa U0.2)
                                             └─→ Fase 6 (precisa F3+F4+F5)
```
Fase 2 pode iniciar assim que U1.3 existir (paralela ao resto da Fase 1).

## Achados durante a implementação

- **AC1 (Fase 1)** — `master` já tem `pnpm typecheck` quebrado: **28 erros pré-existentes** em `src/server/routes/accounts/handlers.ts` e `src/server/services/accounts.ts` (`MembershipRole` não exportado, `myAccountsRoute`/`switchAccountRoute` inexistentes, `slug/timezone/language` fora dos schemas, `currentAccountId` fora de `SessionData`). **Não relacionado a `@etus/auth`** — é dívida pré-existente. Parte pode ser resolvida naturalmente no rewire de `accounts` (Fase 3); o resto precisa de decisão separada. **Afeta o DoD "typecheck verde"** — ou corrige na Fase 3, ou o DoD precisa ser ajustado pra "typecheck sem erros novos".
- **AC2 (Fase 1)** — `@etus/auth` publicado no npm vai até **0.3.0** (`latest`); 0.4.x existe só no source local do `oauth-gateway`. Plano fixado em `^0.3.0`.
- **AC3 (Fase 1)** — `SessionConfig.maxAge` é valor único global → R30 (TTL por-role) rebaixado a limitação documentada.
- **AC4 (Fase 1)** — callbacks `onNewUser`/`onLogin` não recebem `Context` → R5 (audit custom) dropado; usa-se o audit built-in.

## Assumptions

- **AS1**: Acesso ao npm scope `@etus` está disponível pro dev e pro build do Worker.
- **AS2**: O gateway `ag.etus.io` aceita registro DCR do boilerplate (ou já há cliente registrado).
- **AS3**: `@etus/auth@^0.3.0` é a versão atual e estável no momento da implementação.
- **AS4**: As 5 rotas que usam guards hoje (`audits/storage/accounts/users/invitations`) têm mapeamento direto pros guards do pacote — sem regra de negócio exótica.

## Dependências externas

- npm scope `@etus` (registro privado)
- Gateway `ag.etus.io` (OAuth + DCR)
- SendGrid (envio de email de convite)
- Cloudflare D1 + KV bindings

## Out of scope (do plano)

- Skill `.claude/skills/auth-extend/` (R23) — deferida, follow-up pós-MVP
- Seção de README "Auth — extending" (R24) — deferida
- Audit cross-owner, dual-runtime Postgres, SLA built-in — cortados no multi-review
- Criação de Linear issues — decisão separada do usuário

## Atualizações de docs/tracker

- `CLAUDE.md` — U6.3
- `docs/ets/brainstorms/2026-05-19-...md` — registrar conclusões dos spikes (Fase 0)
- Linear — **não** criar issues sem decisão explícita do usuário (e, se criar, vincular a um project)
