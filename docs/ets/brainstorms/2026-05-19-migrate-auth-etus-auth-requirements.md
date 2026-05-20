---
title: Migrate Auth to @etus/auth (Boilerplate Hono)
type: requirements
tier: standard
status: draft
date: 2026-05-19
revised: 2026-05-20
supersedes: docs/plans/2026-02-03-refactor-migrate-auth-to-etus-auth-plan.md
multi_review: docs/ets/state/reports/multi-review-migrate-auth-etus-auth.md
package_version: "@etus/auth@^0.3.0"
related:
  - docs/plans/2026-02-03-refactor-migrate-auth-to-etus-auth-plan.md
  - .claude/skills/etus-auth/SKILL.md
  - /Users/albertoandre/Dropbox/aa-projects/Github/oauth-gateway/packages/auth/README.md
---

# Migrate Auth to `@etus/auth` — Boilerplate Hono

## Summary

Substituir a implementação custom de autenticação/autorização do `boilerplate-hono` por uma configuração do pacote interno `@etus/auth` v0.3.0, transformando o boilerplate em uma base reutilizável para todos os produtos internos do time ETUS. A migração reduz ~340 LOC de código de auth próprio, adota o gateway centralizado `ag.etus.io` para SSO via Google, e estabelece um modelo RBAC enxuto baseado em 4 roles hierárquicos (owner > admin > member > guest) adequado ao contexto multi-account da ETUS.

Como o boilerplate **não tem usuários reais em produção**, a migração é uma reescrita limpa (big delete), não uma migração de dados. O trabalho real concentra-se em: (1) configurar `createAuth()` usando os built-ins do pacote (permissions, roleHierarchy, multiTenant, audit, invitations), (2) definir matriz role→permissions hard-coded, (3) listar emails de staff ETUS em `access.admins`, (4) deletar código antigo, (5) documentar como cada produto downstream estende o modelo.

> **Findings da investigação Q1-Q3** (2026-05-19, lendo source `packages/auth/src/`):
> - `AuthUser` **não expõe** `gatewayRole` — staff é definido via email-list em `access.admins`, que automaticamente vira `role='admin'` local.
> - `permissions.resolver` é chamado em **toda request autenticada** com pipeline built-in de 5 passos (static → hierarchy → merge → dynamic D1 → custom resolver).
> - O pacote já entrega `roleHierarchy` e `dynamicPermissions.enabled` built-in — não precisamos reinventar.
> - **Custom roles per-account foram removidos do escopo** — boilerplate fica enxuto; produtos que precisarem ativam `dynamicPermissions` built-in.
>
> **Findings do multi-review** (2026-05-20, 4 personas ce-* em paralelo):
> - **Audit cross-owner (R12/R25/SC3) REMOVIDO** — 4/4 personas apontaram problemas: `accountMiddleware` zera membership de staff, `eventType` viola union strict de `AuditEventType`, é feature de produto não-boilerplate.
> - **R26 SLA 50ms REMOVIDO** — não-mensurável (sem baseline) e não-implementável (código no pacote).
> - **R27 dual-runtime MOVIDO out-of-scope** — pacote não tem KV adapter pra Node.
> - **Staff promoção é stateful** (só no callback de login) — adicionada D11 e R sobre TTL curto pra admins.
> - **Session fingerprinting** descartado silenciosamente — adicionada D12 com decisão explícita.
> - **Bootstrap problem** documentado — produto novo sem admin local pode ficar em deadlock.

## Problem Frame

### Situação atual

- Boilerplate implementa auth do zero em ~12 arquivos (`src/server/auth/`, `src/server/lib/{oauth,session,tokens}.ts`, `src/server/services/auth.ts`, rotas `/auth/*` próprias).
- Sistema RBAC com **7 roles hierárquicos** (`ADMIN/MANAGER/EDITOR/AUTHOR/VIEWER/BILLING/ANALYTICS`) + **27 permissions granulares**, das quais o code review interno apontou que **27 nunca são consumidas** e 3 das 7 roles nunca aparecem em guards.
- Inconsistência conhecida: TypeScript define 7 roles, `schema.sql` permite só 4 (`viewer/user/manager/admin`).
- OAuth direto com Google (não passa pelo gateway ETUS), session em KV com fingerprinting custom.
- Cada novo produto interno reimplementa auth do zero — não há padrão compartilhado.

### Por que mudar agora

- Time interno cresceu — produtos ETUS precisam de **SSO compartilhado** (login uma vez no gateway, vale para todas as ferramentas).
- Existe pacote `@etus/auth` v0.3.0 maduro que entrega RBAC, permissions com wildcards, multi-tenant accounts, audit log, invitations e session fingerprinting **built-in**. Reimplementar isso é desperdício.
- O plano antigo (2026-02-03) foi escrito quando o pacote era mais limitado; suas conclusões (manter implementação custom, ou hibridizar) **não se aplicam mais** ao estado atual do pacote.
- Boilerplate é o momento certo: zero dados em produção, refactor sem risco de regressão para usuários finais.

### Quem é afetado

- **Devs ETUS**: novos produtos clonam o boilerplate e ganham auth ETUS-wide configurada.
- **Staff ETUS** (emails listados em `AUTH_ADMIN_EMAILS` env var): recebem `role='admin'` automaticamente em todo produto, com TTL de sessão reduzido pra mitigar revogação.
- **Usuários finais de produtos baseados no boilerplate**: login único via gateway, aprovação manual por admin do produto.

## Actors

| Ator | Papel | Como interage |
|---|---|---|
| **Dev ETUS** | Clona o boilerplate, configura `AUTH_CLIENT_ID`/`SECRET`, define matriz role→permissions específica do produto | Roda `npx @etus/auth init`, lê skill `auth-extend`, customiza matriz em `src/server/auth/matrix.ts` |
| **Admin do produto** | Aprova novos users, gerencia membros das accounts, define roles customizados (opt-in) | Usa rotas built-in `/auth/admin/*` e `/accounts/:id/members/*` |
| **Usuário final** | Loga via Google no gateway, opera dentro de uma account | Vê `/auth/login`, depois UI normal |
| **Staff ETUS** | Suporte cross-product | Email listado em `AUTH_ADMIN_EMAILS` (env var) → recebe `role='admin'` automático no callback OAuth. Promoção é stateful (ver D11). Sessão TTL 8h (R29). |
| **Outro produto ETUS** (futuro) | Reusa o mesmo gateway pra SSO | Independente — mas mesmo padrão |

## Requirements

### Funcionais — Configuração `@etus/auth`

- **R1**: O boilerplate **deve** instanciar `createAuth()` com `multiTenant.enabled=true`, `audit.enabled=true`, `access.mode='approval-required'`.
- **R2**: O boilerplate **deve** declarar `access.roles = ['owner','admin','member','guest']` e `access.defaultRole = 'guest'`.
- **R3**: O boilerplate **deve** montar todas as rotas built-in do pacote: `auth.routes()`, `auth.adminRoutes()`, `auth.accountRoutes()`, `auth.invitationRoutes()`.
- **R4**: As variáveis de ambiente `AUTH_GATEWAY`, `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET` **devem** estar declaradas em `config/wrangler.json` (vars + secret).
- **R5** ~~callbacks `onNewUser`/`onLogin` custom de audit~~ — **DROPADO (Fase 1, 2026-05-20)**. Validação da API real da 0.3.0: (a) `audit.enabled=true` já loga `auth.login`/`user.created`/account events built-in; (b) os callbacks recebem só `(user)`, sem `Context` — não têm acesso ao `transactionId` da request. Callback custom seria duplicação. **Boilerplate confia 100% no audit built-in.**
- **R5b**: O boilerplate **deve** ler `access.admins` de env var `AUTH_ADMIN_EMAILS` (CSV). O boilerplate vem com `[]` por default (lista vazia) + comentário em `.env.example` explicando o formato. **Não hardcoda nenhum email ETUS no código** — propagação fica centralizada na config de cada produto. Também declara `access.allowedDomains` (obrigatório na API) — default `['brius.com.br','etus.com.br']`.
- **R5c** (bootstrap): O boilerplate **deve** documentar na skill `auth-extend` o procedimento de bootstrap pra produtos novos sem admin local: (a) iniciar com `access.mode='open'` + um único email do owner do produto em `AUTH_ADMIN_EMAILS`, (b) após o primeiro admin aceitar e ser confirmado, trocar pra `access.mode='approval-required'`. Isso evita o deadlock "novo produto, nenhum admin pra aprovar".
- **R5d** ~~TTL 8h só pra admin~~ — **REBAIXADO pra limitação documentada (Fase 1, 2026-05-20)**. `SessionConfig.maxAge` é valor único global — o pacote não suporta TTL condicional por role. Decisão: aceitar o default de 30 dias; revogação de admin comprometido é via ação manual (`POST /auth/admin/users/:id/suspend`). A skill `auth-extend` documenta o procedimento de revogação de emergência. Ver R30.

### Funcionais — RBAC matriz + hierarchy

- **R6**: O boilerplate **deve** definir uma matriz **hard-coded** em `src/server/auth/matrix.ts` mapeando cada role base para um array de permissions strings (formato `resource:action`), passada para `createAuth({ permissions: { ... } })`.
- **R7**: As 4 roles base **devem** ser imutáveis. Matriz proposta (perms explícitas por role, sem depender de hierarquia pra clareza):
  - `owner`: `['*']`
  - `admin`: `['account:read','account:update','members:*','audit:read','billing:view','billing:manage','resources:*']`
  - `member`: `['account:read','members:invite','resources:create','resources:read','resources:update']`
  - `guest`: `['account:read','resources:read']`
- **R7b**: O boilerplate **deve** declarar `roleHierarchy` built-in do pacote: `owner > admin > member > guest`. **Comportamento real (confirmado em `middleware.ts:110-121` + `hierarchy.ts:24-32`)**: o pipeline injeta `hierarchyPerms` no merge — ou seja, hierarchy **TAMBÉM afeta permissions**, não só guards. Por isso a matriz R7 deve ser pensada como "perms agregadas finais por role" (não "incrementais"). Em caso de duplicação por inheritance, o `dedup` final cuida.
- **R8**: O catálogo de permissions shipado pelo boilerplate **deve** incluir **apenas** perms que têm consumidor declarado (R7) ou guard built-in correspondente:
  - Primitivas universais: `account:read|update|delete`, `members:invite|remove|role`, `audit:read`, `billing:view|manage`
  - Template CRUD genérico: `resources:create|read|update|delete` (renomeáveis por produto)
  - `resources:publish` **removido** — não aparece em nenhuma role da matriz R7. Produtos que precisarem adicionam.
- **R8b** (type-safety): O boilerplate **deve** incluir um helper `defineMatrix<Roles>()` ou um test unitário que valide que **toda role em `access.roles` tem entrada em `permissions`**. O pacote não força essa invariante (PermissionsConfig é `Record<string,string[]>` puro), então a app garante.
- **R8c** (guard de ownership): O boilerplate **deve** incluir guard adicional em `PATCH /accounts/:id/members/:userId` que rejeita se `targetUserId === account.ownerId` E o requester não é o próprio owner. Sem isso, `admin` (que tem `members:*`) pode rebaixar o owner.

### Funcionais — Authorization pipeline

- **R9**: O boilerplate **deve** confiar no pipeline built-in do pacote (`middleware.ts:110-147`):
  1. Static role perms (da matriz R7)
  2. Hierarchy perms (de R7b)
  3. Merge dedup
  4. Dynamic perms D1 (OPT-IN; default desligado)
  5. Custom resolver (OPT-IN; default não setado)
- **R10**: O boilerplate **não deve** implementar `resolvePermissions` custom por padrão — matriz + hierarchy + email-list em `admins` cobre 100% do caso base. Produtos que precisarem adicionam o resolver localmente.
- **R11**: Staff ETUS (emails em `access.admins`) **vira** `role='admin'` automaticamente. Resultado: têm `resources:*`, `members:*`, `audit:read`, etc. — *sem precisar de bypass especial*. **Não há mais conceito de "staff override" como camada separada.**

### Funcionais — Auditoria

- **R12**: O boilerplate **deve** confiar exclusivamente no audit logger built-in do pacote (`audit.enabled=true` em R1) — que já cobre `auth.login`, `auth.logout`, `user.created`, `account.member_added`, `account.invitation_*`, etc. **Audit custom de mutação cross-owner foi removido** (multi-review apontou 4/4 personas: hook não é built-in, `eventType` viola union strict, e é feature de produto). Produtos que precisarem adicionam audit custom localmente — documentado na skill `auth-extend` como pattern.

### Funcionais — Frontend

- **R17**: O hook `useAuth` do React **deve** consumir `/auth/me` do pacote (não mais a rota custom atual). **Shape do pacote** (`routes.ts:417-425`): `{ user: { id, email, name, picture, role } }` — sem account context, sem membership, sem permissions.
- **R17b**: O boilerplate **deve** expor endpoint agregador `/api/me` que combina `/auth/me` + `currentAccount` + `membership` em um único response, para evitar que componentes do frontend façam 3 chamadas paralelas. Alternativa aceita: `useAuth` faz 2-3 fetches em paralelo via `useQueries`.
- **R18**: Rotas protegidas em `_authenticated.tsx` **devem** continuar funcionando após troca do session cookie.

### Funcionais — Convites

- **R19**: O boilerplate **deve** delegar todo fluxo de convite (criar, aceitar, expirar) para `auth.invitationRoutes()` + `auth.accountRoutes()`. Tabela `invitations` local atual **deve** ser deletada junto com as rotas.
- **R19b** (envio de email): O pacote **persiste** o token de convite mas **não envia email**. O boilerplate **deve** manter integração SendGrid via callback `onMemberAdded` (built-in) ou wrap do route handler `POST /accounts/:id/members/invite` que intercepta o 201 e dispara email. Sem isso, convites criam registros invisíveis aos usuários.

### Funcionais — Cleanup

- **R20**: Os seguintes arquivos **devem** ser deletados:
  - `src/server/auth/{roles,permissions,guards,index}.ts`
  - `src/server/lib/{oauth,session,tokens}.ts`
  - `src/server/services/auth.ts`
  - `src/server/routes/auth/{handlers,routes,schemas,test-login,index}.ts`
  - `src/server/types/auth.ts`
  - `src/server/routes/invitations/*` (substituído por `auth.invitationRoutes()`)
  - Tests: `tests/unit/server/auth/*`, `tests/unit/server/lib/oauth.test.ts`, `tests/unit/server/services/auth.test.ts`, `tests/integration/auth/*`, `tests/integration/lib/oauth.test.ts`
- **R21**: As variáveis de ambiente `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `JWT_SECRET`, `JWT_EXPIRY_MINUTES`, `REFRESH_TOKEN_EXPIRY_DAYS` **devem** ser removidas de `.env.example` e `wrangler.json`.

### Funcionais — Documentação

- **R22**: O boilerplate **deve** atualizar `CLAUDE.md` removendo a seção "Authentication Flow" custom e referenciando o pacote `@etus/auth`.
- **R23** (deferred): O boilerplate **deve eventualmente** criar skill `.claude/skills/auth-extend/SKILL.md` explicando: como adicionar permissions ao catálogo, como customizar a matriz, como ativar `dynamicPermissions.enabled` built-in (para custom roles per-account), como wrap-ar guards do pacote, e o procedimento de bootstrap (R5c). **Não bloqueia o MVP** — escrita acontece após a implementação estar verde, pra evitar drift.
- **R24**: O `README` do boilerplate **deve** ganhar seção curta "Auth — extending the defaults" apontando para a skill.

### Não-funcionais

- **R25** ~~Audit log de cross-owner action~~ **REMOVIDO** — feature toda removida (ver R12 revisado).
- **R26** ~~Performance < 50ms p95~~ **REMOVIDO** — não-mensurável (sem baseline) e não-implementável (código no pacote, não no boilerplate). Substituído por R26b.
- **R26b** (Performance, ajustado): O boilerplate **deve** incluir test de integração que asserte que `/auth/me` responde em < 200ms em ambiente `wrangler dev`. Detecta regressões da própria app, não do pacote.
- **R27** ~~Dual-runtime Worker + Postgres~~ **MOVIDO pra out-of-scope** — boilerplate é CF Workers-only. Pacote tem PG adapter pra DB mas não tem KV adapter; sessões precisariam de shim. Sem produto interno usando Node hoje, é YAGNI.
- **R28** (Manutenção): Após migração, o boilerplate **não deve** importar nada de `@etus/auth/internal` ou módulos não-exportados publicamente — só a API pública documentada.
- **R29** (Segurança — Session): O boilerplate **deve** habilitar fingerprinting no `createAuth()`. **Shape real da API 0.3.0** (corrigido na Fase 1): `session: { fingerprint: true, fingerprintMode: 'reauth' }` — dois campos separados, não objeto aninhado. `reauth` força novo login em mismatch. Produtos com staff em VPN de IP rotativo podem mover pra `fingerprintMode: 'log'` (documentado na skill).
- **R30** (Segurança — Admin TTL): **Limitação aceita (Fase 1, 2026-05-20)**. `SessionConfig.maxAge` é valor único global — o pacote 0.3.0 não suporta TTL por-role. Decisão: manter o default de 30 dias; mitigação de admin comprometido é via revogação manual (`POST /auth/admin/users/:id/suspend`, que invalida sessões). A skill `auth-extend` documenta o procedimento de revogação de emergência. Produtos que quiserem TTL curto global ajustam `session.maxAge` por conta própria.

## Success Criteria

A migração é considerada concluída quando:

1. **Login end-to-end funciona**: usuário em `brius.com.br` ou `etus.com.br` faz login via gateway, é redirecionado, e cai em `/dashboard` autenticado.
2. **Guards protegem rotas corretamente**: rotas com `requireRole('admin')` rejeitam `member` com 403; rotas com `requirePermission('resources:delete')` respeitam a matriz.
3. **Staff promoção stateful documentada**: usuário com email em `AUTH_ADMIN_EMAILS` recebe `role='admin'` no callback OAuth (não em runtime). Remover email da lista não rebaixa user até logout+login. Comportamento explícito em D11.
4. **Convites funcionam**: admin convida email, convidado clica no link, faz login, vira member com role definido no convite.
5. **Hierarchy de roles respeitada**: rota com `requireRole('member')` aceita `member`, `admin` e `owner`. Confirmado via test.
6. **Zero código de auth antigo permanece**: `grep -rE "jwtAuth|sessionMiddleware|hasMinimumRole" src/` não retorna nada (exceto comentários de migration). *(Nota: usa `-E` pra regex estendido com `|` literal.)*
7. **Todos os tests verdes**: `pnpm test:unit && pnpm test:integration && pnpm test:e2e` passam — fixtures de auth atualizadas para usar mock do `@etus/auth`.
8. **Documentação publicada**: skill `auth-extend` existe, `CLAUDE.md` atualizado, plano antigo marcado como superseded.

## Scope Boundaries

### In scope

- Reescrita completa da camada de auth do boilerplate usando `@etus/auth` v0.3.0
- Matriz role→permissions hard-coded com 4 roles base (R7) + test que valida cobertura (R8b)
- `roleHierarchy` built-in (afeta guards E perms — ver R7b corrigido)
- `AUTH_ADMIN_EMAILS` env var pra staff ETUS (R5b)
- Bootstrap procedure documentado (R5c)
- Session fingerprinting habilitado (R29) + TTL 8h pra admins (R30)
- Guard adicional protegendo `account.ownerId` (R8c)
- Endpoint agregador `/api/me` ou `useAuth` com fetches paralelos (R17b)
- SendGrid hook pra invitation email (R19b)
- Deleção de código antigo + tests
- Atualização de wrangler.json + `.env.example`
- Atualização de CLAUDE.md

### Out of scope (expandido pelo multi-review)

- **Migração de dados de usuários reais** — boilerplate não tem produção
- **Audit log de mutações cross-owner** — REMOVIDO via multi-review (R12/R25/SC3). Produtos que precisarem implementam audit custom localmente — documentado como pattern na skill auth-extend (R23, deferred).
- **Dual-runtime (Node + Postgres)** — REMOVIDO via multi-review. Boilerplate é CF Workers-only. Pacote não tem KV adapter pra sessões em Node. Produtos Node configuram própria infra.
- **SLA de performance built-in** — REMOVIDO (R26). Substituído por test de integração local (R26b) que mede só a app, não o pacote.
- **Skill `auth-extend` no MVP** — DIFERIDO (R23). Escreve após implementação verde pra evitar drift.
- **Custom roles per-account** — REMOVIDO do escopo após descoberta de `dynamicPermissions` built-in. Produtos que precisarem ativam `dynamicPermissions.enabled` localmente.
- **`permissions.resolver` custom** — não shipa por padrão. Matriz + hierarchy + `AUTH_ADMIN_EMAILS` cobre 100% do caso base. Produtos adicionam se precisarem.
- **ABAC com ownership** (`created_by` checks) — descartado: produtos que precisarem implementam localmente
- **ABAC com status do recurso** — descartado: acoplaria authz a estado de negócio
- **Bypass cross-account separado pra staff** — REMOVIDO: staff vira `role='admin'` natural via email-list, sem camada extra. *Mas atenção a D11* (promoção é stateful).
- **Fetch ao gateway pra buscar role global** — `gatewayRole` não existe no payload do pacote; usa-se email-list em vez de fetch.
- **Fork ou contribuição upstream pro `@etus/auth`** — assume-se que o pacote atende; gaps viram issues, não forks
- **Redesign do frontend além de adaptar `useAuth`** — sidebar, layout etc. ficam iguais. Endpoint agregador `/api/me` adicional (R17b) não é redesign — é só helper.
- **Mudança no padrão de E2E tests** — só atualizar fixtures de auth
- **Multi-gateway support** (vários gateways OAuth diferentes por produto) — assume-se um único gateway ETUS

## Key Decisions

| # | Decisão | Razão | Alternativa rejeitada |
|---|---|---|---|
| D1 | Usar `@etus/auth` em vez de manter custom | Pacote maduro v0.3.0 entrega 80% do trabalho built-in | Manter custom (perde SSO ETUS-wide); fork do pacote (manutenção dobrada) |
| D2 | 4 roles fixos (owner/admin/member/guest) | Cobre 95% dos casos SaaS, type-safe, simples | 7 roles antigos (excesso, ninguém usa); 3 roles (perde granularidade) |
| D3 | Catálogo de perms = primitivas + `resources:*` genéricas | Boilerplate é genérico — perms de domínio (`campaigns:*`) amarrariam a um tipo de produto | Cat. de domínio ETUS completo; só primitivas (sem template CRUD) |
| D4 | Custom roles per-account REMOVIDOS do escopo (após Q1-Q3) | Pacote já tem `dynamicPermissions` built-in; reinventar é desperdício. Produtos opt-in se precisarem | Tabela própria + resolver custom (over-engineering); mapear pra built-in (complexo demais) |
| D5 | Authz só com role + matriz + hierarchy built-in | Cobre 95% dos casos; ABAC ownership/status fica pra produtos | Incluir ownership/status no boilerplate (acoplaria a domínio); criar resolver custom default (overhead) |
| D6 | Staff ETUS = email-list em `access.admins` (após Q1) | `gatewayRole` não existe no payload; email-list é o jeito canônico do pacote, sem fetch extra | Fetch gateway no onLogin (latency); coluna extra (schema bloat); só admin local (perde "staff cross-product") |
| D7 | Confiar no pipeline built-in (sem resolver custom default) | Pacote já tem pipeline de 5 passos eficiente; só adicionar custom resolver se um produto precisar | Implementar resolver custom no boilerplate (código pra zero ganho); cache em session KV (invalidação complexa) |
| D10 | Usar `roleHierarchy` só pra guards de role, não pra perms | Hierarchy em guards é UX win sem ambiguidade; em perms inflate matriz e esconde intent | Sem hierarchy nenhuma (verboso); hierarchy total (perms implícitas, magic) |
| D8 | Big delete + rewrite limpo (não incremental) | Boilerplate sem users → sem motivo pra dual-running ou feature flag | Feature flag + dual-running (exagero pra base sem produção) |
| D9 | Plano antigo marcado como superseded | Conclusões desatualizadas vs `@etus/auth` v0.3.0 atual | Atualizar in-place (perde histórico de decisão) |
| D11 | **Aceitar staff promoção stateful + mitigar via TTL 8h** | Pacote só reavalia role no callback OAuth (`routes.ts:199, 281`); fetch contínuo seria custo desnecessário. TTL 8h reduz janela de revogação tardia. | Fetch ao gateway em toda request (latency cara); reconciliação no middleware (cache complexo); status='suspended' automático (não built-in) |
| D12 | **Habilitar session fingerprinting com `mode='reauth'`** | Pacote suporta built-in (`fingerprint.enabled`). Plano antigo flagou ausência como HIGH. `reauth` força novo login em mismatch — menos disruptivo que `reject` mas mais seguro que `log`. | Manter desabilitado (mantém risco HIGH); usar `mode='reject'` (falso positivo de mobile + VPN derruba sessão); usar `mode='log'` (sem proteção ativa) |
| D13 | **REMOVER audit cross-owner do escopo do boilerplate** (multi-review) | 4/4 personas apontaram: `accountMiddleware` zera membership do staff, `eventType='admin.cross_owner_action'` viola union strict `AuditEventType`, e é feature de produto não de boilerplate genérico | Forçar implementação no boilerplate (build em cima de gap do pacote); contribuir hook upstream (fora do escopo) |
| D14 | **REMOVER dual-runtime Node+Postgres** (multi-review) | KV adapter pra Node não existe no pacote; nenhum produto interno usa Node hoje; YAGNI confirmado | Manter como aspiracional (cria expectativa não cumprível); criar shim KV (escopo de infra grande) |

## Assumptions

Marcadas para serem **revisitadas** se mostrarem-se incorretas:

- **A1**: O modo `approval-required` é o padrão certo pro boilerplate. Justificativa: força admin a aprovar explicitamente novos users, evita auto-onboarding indesejado. Produtos podem trocar pra `open` ou `invite-only` na config.
- **A2**: O hook `onLogin` consegue escrever em `audit_logs` local (não bloqueia se falhar). Justificativa: pattern recomendado no README do pacote.
- **A3**: A skill `.claude/skills/auth-extend/` é o melhor formato pra documentar extensão. Justificativa: projeto já usa skill pattern (`backend-dev-guidelines`, `etus-auth`).
- **A5**: O frontend `useAuth` consegue mapear o shape do `/auth/me` do pacote sem mudança no UI. Se shape divergir muito, pode precisar adapter layer.
- **A6**: O hook `onMutation` (pra audit cross-owner) pode ser implementado como middleware Hono local que roda após `auth.middleware()` — não precisa hook built-in do pacote. Justificativa: pacote não expõe esse hook, mas o context Hono dá tudo necessário.

> ~~**A4** (RESOLVIDA via leitura do source 2026-05-19): `gatewayRole` **não existe** em `AuthUser`. Decisão final adotada: usar `access.admins` email-list. Ver D6.~~

## Outstanding Questions

### Resolve Before Planning

*(Nenhuma — Q1-Q3 foram resolvidas em 2026-05-19 lendo `packages/auth/src/types.ts` e `middleware.ts`. Decisões refletidas em D4, D6, D7, D10.)*

> **Q1 (RESOLVIDA)**: `gatewayRole` **não existe** em `AuthUser`. Adotamos email-list em `access.admins`. Ver D6.
> **Q2 (RESOLVIDA)**: `resolvePermissions` é chamado em toda request autenticada. Pipeline built-in de 5 passos cacheia em `c.set('authPermissions')`. Sem otimização necessária. Ver R9.
> **Q3 (RESOLVIDA)**: Custom roles per-account foi **removido do escopo**. Produtos que precisarem usam `dynamicPermissions.enabled` built-in. Ver D4 e Out-of-scope.

### Deferred to Planning

- **Q4**: Estratégia de testing dos guards do `@etus/auth` — mock do pacote inteiro ou rodar mini-gateway local em test env?
- **Q5** ~~UI cross-owner badge~~ — **REMOVIDA** junto com R12 (audit cross-owner). Sem feature, não há badge.
- **Q6**: Versionamento do catálogo de permissions — se um produto adiciona `campaigns:approve` e depois o boilerplate ganha isso built-in, como evitar conflito?
- **Q7**: Quem aprova mudanças na matriz hard-coded — é PR no boilerplate, herdada por todos os produtos, ou cada produto fork-a a matriz?
- **Q8** ~~`onMutation` hook registration~~ — **REMOVIDA** junto com R12.
- **Q9** (nova, multi-review): Como o test de integração de `/auth/me < 200ms` (R26b) é executado em CI — wrangler dev em GH Actions, ou só local?
- **Q10** (nova, multi-review): O endpoint agregador `/api/me` (R17b) é caminho preferido vs `useAuth` com `useQueries` paralelo? Decisão fica pra implementação após spike do frontend.

### Spikes — RESULTADOS (2026-05-20)

1. **Spike `/auth/me` + frontend** — ✅ RESOLVIDO. `useAuth` atual (`src/client/hooks/use-auth.ts`) é fino: retorna só `{ user }`, consome `AuthUser` de `@shared/types` (`{id,email,name,avatarUrl?}`). Nenhum header/sidebar carrega account context — `account.tsx`/`team.tsx` são páginas dedicadas que buscam o que precisam separadamente. **Decisão R17b: endpoint agregador `/api/me` NÃO é necessário no MVP.** `useAuth` mapeia `/auth/me` do pacote direto. Trabalho mínimo: atualizar tipo `AuthUser` em `src/shared/types/auth.ts` (add `role`, `picture` — pacote usa `picture` não `avatarUrl`).
2. **Spike SendGrid hook** — ✅ RESOLVIDO. O pacote **não expõe callback de invitation** — só `onMemberAdded`/`onMemberRemoved`/`onAccountCreated`, e `onMemberAdded` dispara no *aceite* (tarde demais pro email de convite). `POST /accounts/:id/members/invite` (`account-routes.ts:285-346`) cria o registro via `accountDb.createInvitation()` e retorna `{invitation}` 201 — **sem enviar email**. **Decisão R19b: wrap do route handler** (interceptar 201 e disparar SendGrid), NÃO `onMemberAdded`. Detalhe fino (middleware `after` vs proxy) fica pra Fase 5.
3. **Spike `getAuditLogger().query()` tipos** — ✅ RESOLVIDO. `AuditLogFilters.eventType` é a union fechada `AuditEventType` (`audit.ts:89`). Event types custom quebram em compile-time. Confirma D13: audit custom (se um produto downstream quiser) exige tabela própria, fora da API tipada do pacote. A skill `auth-extend` (deferida) documenta esse pattern.

## References

- `@etus/auth` README: `/Users/albertoandre/Dropbox/aa-projects/Github/oauth-gateway/packages/auth/README.md`
- `@etus/auth` API docs: `/Users/albertoandre/Dropbox/aa-projects/Github/oauth-gateway/packages/auth/documentation/API.md`
- Gateway repo: `/Users/albertoandre/Dropbox/aa-projects/Github/oauth-gateway`
- Skill `etus-auth` (integrator guide): `.claude/skills/etus-auth/SKILL.md` (presente neste projeto)
- Plano antigo superseded: `docs/plans/2026-02-03-refactor-migrate-auth-to-etus-auth-plan.md`
- Multi-review consolidado: `docs/ets/state/reports/multi-review-migrate-auth-etus-auth.md`
- Implementação atual sendo removida: `src/server/auth/`, `src/server/lib/{oauth,session,tokens}.ts`, `src/server/services/auth.ts`, `src/server/routes/auth/`
- Branch existente relacionada: `feat/migrate-auth-to-etus-auth` (remote)
