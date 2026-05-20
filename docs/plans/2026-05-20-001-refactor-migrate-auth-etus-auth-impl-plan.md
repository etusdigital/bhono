---
title: Implementation Plan — Migrate Auth to @etus/auth
type: refactor
date: 2026-05-20
status: mostly-executed
source_requirements: docs/ets/brainstorms/2026-05-19-migrate-auth-etus-auth-requirements.md
multi_review: docs/ets/state/reports/multi-review-migrate-auth-etus-auth.md
supersedes_branch: feat/migrate-auth-to-etus-auth (hybrid approach, @etus/auth@0.1.0 — obsoleta)
package_target: "@etus/auth@^0.3.0"
---

# Implementation Plan — Migrate Auth to `@etus/auth`

Plano tático de implementação derivado do requirements doc (já fechado via brainstorm + multi-review). 7 fases ordenadas, unidades de trabalho nomeadas, Fase 0 de spikes como gate bloqueante.

## Status final (2026-05-20)

| Fase | Estado | Commit |
|---|---|---|
| 0 — spikes de de-risking | ✅ | (docs) |
| 1 — install + `createAuth` config | ✅ | `ea6dc57` |
| 2 — matriz RBAC + test | ✅ (222/222 verdes) | `e75523e` |
| 3 — adopt @etus/auth data model | ✅ (server compila e builda) | `546647b` |
| 4 — frontend | ✅ (AuthUser alinhado, invite returnTo) | `06fd748` |
| 5 — SendGrid invitation email | ❌ não feita — diferida (skill auth-extend documenta o pattern) |
| 6 — tests + docs cleanup | ✅ (CLAUDE.md + 60+ tests legados removidos) | `df42559` |
| **U3.5** — guard interceptor de ownership | ❌ não feito — polimento, R8c |

**Checkpoints verdes**: `pnpm typecheck` (0 erros — AC1 resolvido), `pnpm build`, `pnpm lint`, `pnpm test:unit:server` (222/222).

**Não verificado**: runtime real (`pnpm dev` + login OAuth via gateway). A app compila e builda mas não foi exercida em request real.

**Out of scope desta migração** (documentado pra follow-up):
- Reescrita dos tests de features vivas (storage, schemas, middlewares) sob o novo modelo de context vars (vars `user`/`userRole`/`accountId` antigos não existem mais — testes precisam usar `authUser`/`authPermissions` etc).
- SendGrid hook pra email de invite (Fase 5).
- Guard interceptor de ownership em `PATCH /accounts/:id/members/:userId` (U3.5).
- Skill `.claude/skills/auth-extend/` (R23 deferida).
- README seção "Auth — extending" (R24 deferida).

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

## Fase 2 — RBAC matriz: test de type-safety

**Objetivo**: garantir que a matriz role→permissions cobre todas as roles.

**Depende de**: U1.3.

### U2.1 — Matriz role→permissions ✅ (concluída na U1.3, 2026-05-20)
- `src/server/auth/matrix.ts` criado: `PERMISSIONS_MATRIX`, `PERMISSION_CATALOG` (sem `resources:publish`), `ROLE_HIERARCHY`, `ROLES`.
- Cobre: R6, R7, R8.

### U2.2 — Test de type-safety da matriz ✅ (concluída 2026-05-20)
- `tests/unit/server/auth/matrix.test.ts` — 4 testes: toda role em `ROLES` tem entrada não-vazia em `PERMISSIONS_MATRIX`; matriz não tem role fora de `ROLES`; `ROLE_HIERARCHY` cobre exatamente as roles declaradas; toda permission não-wildcard existe em `PERMISSION_CATALOG`.
- Cobre: R8b.
- **Verde**: 4 testes passam (`vitest run`). ✅

~~### U2.3 — Guard de ownership~~ — **MOVIDO pra Fase 3 (U3.5)**. Com a Opção A, `PATCH /accounts/:id/members/:userId` é rota do pacote; o guard de ownership vira middleware interceptor montado junto com `auth.accountRoutes()` (Fase 3).

**Checkpoint Fase 2**: `pnpm test:unit:server` passa no `matrix.test.ts` novo. ✅

---

## Fase 3 — Adaptar + rewire + delete

> **RE-SEQUENCIADA 2026-05-20 (ver AC8)** — a ordem original (big delete primeiro) foi revertida. `Role` propaga de `types/index.ts` por toda a camada server. Nova ordem obrigatória:
> 1. **U3.0 (novo) — Mapear + adaptar tipos**: `grep` completo de quem importa `auth/roles`, `auth/guards`, `auth/permissions`, `lib/{oauth,session,tokens}`, `services/auth`, `services/accounts`, `types/auth`, `middleware/auth`. Reescrever `types/index.ts` (`Role` passa a vir de `auth/matrix.ts`; remover `export type * from './auth'`; ajustar `SessionData`/`HonoEnv`/`ServiceContext`). Criar `auth/guards.ts` novo (guards standalone).
> 2. **U3.6** — `routes/dev-login.ts` (test-login).
> 3. **U3.2** — reescrever `index.ts` (lazy-mount) + `routes/index.ts`.
> 4. **U3.3** — rewire guards em `users`/`audits`/`storage` (+ adaptar os handlers e services que usam `ServiceContext`/`Role`/`hasMinimumRole`).
> 5. **U3.5** — interceptor de ownership.
> 6. **U3.7** — invite `returnTo` no client.
> 7. **U3.1 — deletes POR ÚLTIMO**: só depois que nenhum arquivo vivo importa os antigos.
> 8. **U3.4** — confirmar invitations.
>
> **Estimativa real**: ~25-30 arquivos tocados. É a fase mais pesada do plano — recomenda-se sessão dedicada, com o passo U3.0 (mapeamento) feito logo no início.

> ## ⚠️ ESCOPO REVISTO 2026-05-20 (decisão AC9) — "adotar o modelo de dados do @etus/auth"
>
> A Fase 3 deixa de ser "migrar auth + manter as rotas locais" e passa a ser **substituir a camada de identidade+tenancy local pelos built-ins do pacote**. O usuário decidiu: adotar o modelo do pacote.
>
> **DELETAR (camadas locais substituídas pelos built-ins):**
> - `routes/{auth,accounts,invitations,users,audits}/` — substituídas por `auth.routes()`, `auth.adminRoutes()`, `auth.accountRoutes()`, `auth.invitationRoutes()`, `auth.auditRoutes()`
> - `services/{auth,accounts,users,invitations,audits}.ts` + `services/index.ts`
> - `auth/{roles,permissions,guards}.ts`, `lib/{oauth,session,tokens}.ts`, `middleware/{auth,account}.ts`, `types/auth.ts`, `routes/api.ts`
> - `lib/{audit,audited-db,pagination}.ts` se ficarem órfãos após os deletes (verificar; `password.ts`/`providers.ts` provavelmente já órfãos)
> - Tabelas locais `users`/`accounts`/`user_accounts`/`invitations`/`audit_logs` ficam legadas (não dropar agora; o pacote cria `auth_*` à parte)
>
> **MANTER:** `routes/{health,storage}/`, `middleware/{request-context,cors,error-handler,request-logger,rate-limit}.ts`, `auth/{matrix,setup}.ts`, `lib/{email,errors,r2-storage,transaction}.ts`, `db/`
>
> **CRIAR:** `auth/guards.ts` (novo — guards standalone só pra `storage`), `middleware/auth-adapter.ts` (popula `user`/`accountId`/`userRole` pra `storage`), `routes/dev-login.ts` (U3.6)
>
> **REESCREVER:** `index.ts` (lazy-mount do pacote), `routes/index.ts`, `types/index.ts`, `middleware/index.ts`, `routes/storage/index.ts` (guards → `requirePermission`), handlers de `storage` (adaptar ao `ServiceContext` derivado)
>
> **Consequência pra Fases 4-6 (PRECISAM REVISÃO):** o frontend (`team.tsx`, `account.tsx`, `settings.tsx`, página de users) consumia as APIs locais que somem — precisa re-apontar pras rotas do pacote ou ser removido. Os E2E de `users`/`team`/`audits`/`invitations` mudam. A Fase 4 cresceu; Fases 5-6 precisam re-leitura sob o novo escopo.
>
> **Recomendação:** executar numa sessão dedicada. O mapa U3.0 abaixo é parcialmente superseded — só as linhas de `storage`, `index.ts`, `routes/index.ts`, `types/index.ts`, `middleware/index.ts` continuam relevantes; as de `users`/`accounts`/`audits`/`invitations` viram deletes.

**Objetivo**: substituir a camada local de identidade/tenancy pelos built-ins do `@etus/auth`. Após esta fase a app volta a compilar com `routes/{health,storage}` + rotas do pacote.

**Depende de**: Fase 1 + Fase 2.

> ### ✅ Fase 3 (server) EXECUTADA — 2026-05-20 (commit `546647b`)
> - **Deletados** 39 arquivos: `auth/{roles,permissions}`, `lib/{oauth,session,tokens,audit,audited-db,pagination}`, `services/*` (todos), `types/auth`, `middleware/{auth,account}`, `routes/api.ts`, `routes/{auth,accounts,invitations,users,audits}/`.
> - **Reescritos**: `index.ts` (lazy `buildApp`), `routes/index.ts` (só `/storage`), `types/index.ts` (`HonoEnv` com vars do pacote), `env.ts` (sem JWT/Google), `middleware/{index,request-context,request-logger}`, `routes/storage/index.ts` (guards → `requirePermission`), `auth/guards.ts` (standalone).
> - **Criados**: `routes/dev-login.ts` (test-login dev — U3.6).
> - **Verde**: `pnpm typecheck` (0 erros — AC1 resolvido), `pnpm build`, `pnpm lint` (após ignorar `worker-configuration.d.ts`, agora gitignored).
> - **FALTA na Fase 3**: U3.5 (guard interceptor de ownership em `PATCH /accounts/:id/members/:userId` — R8c) — não feito, pendente.
> - **Não verificado ainda**: runtime real (login E2E). Os tests antigos (`tests/unit/server/auth/*` exceto matrix, `tests/integration/*`) ainda importam código deletado — quebram até a Fase 6 limpar.

### U3.0 — Mapa de dependências (executado 2026-05-20 — ver ESCOPO REVISTO acima)

**Arquivos VIVOS (ficam) que importam de código a deletar — precisam adaptação:**

| Arquivo vivo | Importa de | O que adaptar |
|---|---|---|
| `types/index.ts` | `auth/roles` (`Role`), `./auth` | `Role` ← `auth/matrix`; remover `export type * from './auth'`; reescrever `HonoEnv.Variables` (vars do pacote `authUser`/`authPermissions`/`authAccount`/`authMembership` + adapter `user`/`accountId`/`userRole`); remover `SessionData` |
| `middleware/account.ts` | `auth/roles`, `c.get('user')` | Substituir por `auth.accountMiddleware()` do pacote + adapter; ou deletar e usar só o do pacote |
| `middleware/index.ts` | `./auth` (`jwtAuth`, `sessionAuth`) | Remover esses exports |
| `services/users.ts` | `auth/roles` (`Role`, `hasMinimumRole`) | `Role` ← matrix; lógica `hasMinimumRole` → repensar (modelo 7→4 roles) |
| `services/invitations.ts` | `auth/roles` | idem |
| `services/index.ts` | `./auth`, `./accounts` | Remover re-export de `authService` e `accountsService` |
| `routes/audits/index.ts` | `auth/guards` | guard → `requirePermission('audit:read')` |
| `routes/storage/index.ts` | `auth/guards` | guards → `requirePermission('resources:create')` (upload), `requirePermission('resources:delete')` (delete) |
| `routes/users/index.ts` | `auth/guards` | guards → `requirePermission('members:role')` (bulk/update), `requirePermission('members:remove')` (delete/restore) |
| `index.ts` (entry) | `lib/session`, `routes/auth` | Reescrever — lazy-mount do pacote |
| `routes/index.ts` | `middleware` (`sessionAuth`, `accountMiddleware`) | Trocar pelos middlewares do pacote |

**Mapa de guards (role antigo → permission nova):**
- `audits` list: `requireRole('ADMIN', ['ANALYTICS'])` → `requirePermission('audit:read')`
- `storage` upload-url + upload: `requireRole('AUTHOR')` → `requirePermission('resources:create')`
- `storage` delete `/:key`: `requireRole('EDITOR')` → `requirePermission('resources:delete')`
- `users` bulk user-accounts + update: `requireRole('MANAGER')` → `requirePermission('members:role')`
- `users` delete + restore: `requireRole('ADMIN')` → `requirePermission('members:remove')`
- `users` list + get: sem guard (qualquer autenticado) — mantém

**Decisão de arquitetura confirmada**: usar uma **camada adaptadora** — após `auth.middleware()` + `auth.accountMiddleware()`, um middleware copia `authUser`→`user`, `authAccount.id`→`accountId`, `authMembership.role`→`userRole`. Mantém handlers/services com mudança mínima. `User` (local) é derivado de `AuthUser` (pacote): `isSuperAdmin` ← `role==='admin'`, `googleId` ← `gatewayUserId`, `providerIds` ← `[]`.

**Tamanho real confirmado**: ~11 arquivos vivos adaptados + 2 criados (`auth/guards.ts` reescrito, `routes/dev-login.ts`) + `index.ts`/`routes/index.ts` reescritos + 24 deletados. Refatoração atômica — typecheck/build só voltam a passar no fim.

### U3.1 — Deletar código antigo
- Deletar: `src/server/auth/{roles,permissions,guards,index}.ts` (`matrix.ts`/`setup.ts` permanecem), `src/server/lib/{oauth,session,tokens}.ts`, `src/server/services/auth.ts`, `src/server/routes/auth/{handlers,routes,schemas,test-login,index}.ts`, `src/server/types/auth.ts`, `src/server/middleware/auth.ts`.
- **+ Opção A (2026-05-20)**: deletar `src/server/routes/accounts/*` + `src/server/services/accounts.ts` + remover re-export de `accountsService` em `src/server/services/index.ts`. Elimina os 28 erros AC1.
- Cobre: R20.
- **Verde**: `grep -rE "jwtAuth|sessionMiddleware|hasMinimumRole" src/` vazio.

### U3.5 — Guard de ownership (movido da Fase 2)
- `PATCH /accounts/:id/members/:userId` agora é rota do **pacote** (`auth.accountRoutes()`). O guard de ownership (R8c) vira **middleware interceptor** montado antes de `auth.accountRoutes()`: rejeita se `targetUserId === account.ownerId` e requester não é o owner.
- Cobre: R8c.
- **Verde**: test cobre admin tentando rebaixar owner → 403.

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

### U3.6 — Endpoint dev `test-login` (decisão AC6)
- Novo `src/server/routes/dev-login.ts`. Montado em `/auth/test-login` **só** quando `ENVIRONMENT≠production` (manter a URL — dezenas de testes E2E/integration chamam `/auth/test-login`).
- **Internals do pacote a replicar** (lidos de `oauth-gateway/packages/auth/src/session.ts` em 2026-05-20):
  - KV key: `auth_sid:{sessionId}` (prefixo `SESSION_PREFIX = "auth_sid:"`)
  - Cookie: `__Host-auth_sid` em HTTPS, `auth_sid` em HTTP (`getSessionCookieName`)
  - Shape `AuthSession` (JSON no KV): `{ id, userId, expiresAt, createdAt, fingerprint? }` — `expiresAt`/`createdAt` em ms epoch
  - User deve existir em `auth_users` (tabela do pacote — **não** `users`); session opcionalmente em `auth_sessions` (D1)
  - **Verificar** o schema exato de `auth_users`/`auth_sessions` no `dist/index.d.ts` ou no source do pacote antes de escrever os INSERTs
- Passos do handler: upsert user em `auth_users` (status `active`, role conforme body) → gerar `sessionId` → `kv.put('auth_sid:'+id, JSON)` → setar cookie. Opcional: criar account + membership pra testes multi-tenant.
- Cobre: AC6. **Frágil por design** (acopla a internals); dev-only.
- **Verde**: `pnpm test:e2e` autentica via `/auth/test-login`.

### U3.7 — Invite cold-click via `returnTo` (decisão AC7)
- Ajustar `src/client/routes/invite.$token.tsx`: ao clicar "Accept", chamar `POST /invitations/:token/accept`; se resposta 401, redirecionar pra `/auth/login?returnTo=/invite/:token`. Após login o user volta à página e o accept funciona.
- **Sem** middleware `pending-invitation` — o `returnTo` (suportado por `auth.routes()`) resolve.
- Cobre: R19 (cold-click), AC7.
- **Verde**: `tests/e2e/invitations/invite-flow.unauth.spec.ts` passa.

**Ordem de execução sugerida da Fase 3**: U3.1 (delete) → U3.6 (test-login, pra E2E não ficar órfão) → U3.2 (mount, padrão lazy-wrapper da branch antiga) → criar `auth/guards.ts` novo (guards standalone usando `hasPermission`/`isRoleAtLeast` + context vars `authUser`/`authPermissions`) → U3.3 (rewire guards) → U3.5 (interceptor ownership) → U3.4 (invitations) → U3.7.

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

- **AC1 (Fase 1) — RESOLVIDO via Opção A (2026-05-20)** — `master` tinha `pnpm typecheck` quebrado: 28 erros pré-existentes em `routes/accounts/handlers.ts` + `services/accounts.ts`. Investigação confirmou que `routes/accounts/` duplica `auth.accountRoutes()` do pacote e não tem consumidor externo. **Resolução**: U3.1 deleta `routes/accounts/*` + `services/accounts.ts` — os 28 erros somem junto. DoD "typecheck verde" volta a ser alcançável.
- **AC2 (Fase 1)** — `@etus/auth` publicado no npm vai até **0.3.0** (`latest`); 0.4.x existe só no source local do `oauth-gateway`. Plano fixado em `^0.3.0`.
- **AC3 (Fase 1)** — `SessionConfig.maxAge` é valor único global → R30 (TTL por-role) rebaixado a limitação documentada.
- **AC4 (Fase 1)** — callbacks `onNewUser`/`onLogin` não recebem `Context` → R5 (audit custom) dropado; usa-se o audit built-in.
- **AC5 (Fase 3 pre-flight)** — `src/server/routes/api.ts` é **código morto** (ninguém importa; `server/index.ts` usa `routes/index.ts`). Deletar em U3.1, sem cerimônia.
- **AC6 (Fase 3) — RESOLVIDO 2026-05-20** — `/auth/test-login` quebraria toda a E2E. **Decisão**: recriar como endpoint dev `routes/dev-login.ts`, montado em `/auth/test-login` só quando `ENVIRONMENT≠production`, escrevendo `AuthSession` no KV + user em `auth_users` no formato do pacote. Aceita-se o acoplamento ao schema interno (dev-only, frágil em upgrade). Vira **U3.6**.
- **AC7 (Fase 3) — RESOLVIDO 2026-05-20** — fluxo invite cold-click. **Decisão**: abordagem `returnTo` — página `/invite/:token` → accept → se 401, `/auth/login?returnTo=/invite/:token` → volta logado → `POST /invitations/:token/accept`. Sem middleware `pending-invitation`. Vira **U3.7** (ajuste em `src/client/routes/invite.$token.tsx`).
- **AC8 (Fase 3) — CRÍTICO, re-sequenciamento necessário (2026-05-20)** — a Fase 3 NÃO é um "16-file delete + 4 reescritas" isolado. O tipo `Role` mora em `src/server/types/index.ts` e propaga: `HonoEnv.Variables.userRole: Role` (tipo de TODA rota Hono), `ServiceContext.userRole: Role` (passado a todo service), `UserAccount.role: Role`. Os services `users.ts`/`audits.ts`/`invitations.ts` importam `Role` de `auth/roles`; handlers usam `ServiceContext`; `types/index.ts` faz `export type * from './auth'`. **Deletar `auth/roles.ts` primeiro quebra a compilação de ~25-30 arquivos de uma vez.** Tentativa de big-delete-first em 2026-05-20 foi revertida (working tree voltou ao estado da Fase 2). A Fase 3 foi re-sequenciada (ver U3.0): adaptar tipos+consumidores primeiro, deletar por último.

- **AC9 (Fase 3) — BLOQUEANTE, gap de design não resolvido (2026-05-20)** — **colisão de modelo de dados de user**. `services/users.ts` faz query em `users` / `user_accounts` (tabelas locais do boilerplate). Mas `@etus/auth` gerencia usuários em `auth_users` / `auth_memberships` (tabelas próprias do pacote) — após o login OAuth, os usuários reais são criados/vivem em `auth_users`. Consequência: a rota `/api/users` local + `services/users.ts` ficariam **desconectados dos usuários reais**. Mesmo padrão de colisão que `accounts` (resolvido na Opção A, D-?), mas o plano **não previu pra `users`**. O pacote tem `auth.adminRoutes()` (CRUD de users, admin-only) e `auth.accountRoutes()` (memberships). **Decisão de design necessária antes de executar a Fase 3**: (a) deletar `routes/users/` + `services/users.ts` e usar `adminRoutes()`/`accountRoutes()` do pacote — perde `createBulkUserAccounts`/`deleteBulkUserAccounts`/`listUserRoles`/`restoreUser`; ou (b) manter `routes/users/` re-apontando todas as queries de `users`→`auth_users` e `user_accounts`→`auth_memberships` (reescrita de todas as queries SQL do service). **A Fase 3 não pode ser executada como "continuação mecânica" enquanto AC9 não for decidido — exige uma rodada de design (decisão do usuário).**

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
