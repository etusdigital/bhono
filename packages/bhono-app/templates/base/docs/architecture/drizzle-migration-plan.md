# Mapeamento do Drizzle e plano de migracao para SQL puro

> Status: Drizzle removido (PDB-823, Jan 2026). Este documento permanece como historico do plano.

Contexto canonico: `docs/app_spec.txt`.

## Objetivo

Documentar onde o Drizzle e utilizado hoje e propor uma sequencia de migracao para SQL puro (D1/SQLite) com menor risco.

## Inventario de uso do Drizzle

### Tooling e configuracao

- `config/drizzle.config.ts`
- `package.json` (scripts `db:push`, `db:generate`, `db:studio`; dependencias `drizzle-orm`, `drizzle-kit`)
- `packages/bhono-app/templates/base/config/drizzle.config.ts`
- `packages/bhono-app/templates/base/package.json` (mesmos scripts/dependencias)

### Schema e helpers

- `src/server/db/schema/index.ts`
- `src/server/db/schema/*.ts` (users, accounts, user-accounts, invitations, refresh-tokens, audit-logs)
- `src/server/lib/schema-helpers.ts`
- `packages/bhono-app/templates/base/src/server/db/schema/*`
- `packages/bhono-app/templates/base/src/server/lib/schema-helpers.ts`

### Client e cross-cutting

- `src/server/db/client.ts` (createDb com `drizzle-orm/d1`)
- `src/server/lib/transaction.ts` (types baseados em `Database['transaction']`)
- `src/server/lib/audited-db.ts` (Table/SQL do Drizzle, `.returning()`)
- `src/server/lib/audit.ts` (grava em `audit_logs` usando `db.insert`)
- `packages/bhono-app/templates/base/src/server/db/client.ts`
- `packages/bhono-app/templates/base/src/server/lib/transaction.ts`
- `packages/bhono-app/templates/base/src/server/lib/audited-db.ts`
- `packages/bhono-app/templates/base/src/server/lib/audit.ts`

### Services (queries principais)

- `src/server/services/auth.ts` (insert/update/returning, tokens, refresh)
- `src/server/services/users.ts` (filtros, subquery IN, soft delete, paginacao)
- `src/server/services/accounts.ts` (filtros, subquery IN, soft delete, paginacao)
- `src/server/services/invitations.ts` (joins, expiracao, create/accept)
- `src/server/services/audits.ts` (filtros, paginacao)
- `packages/bhono-app/templates/base/src/server/services/*` (espelho)

### Middleware e rotas

- `src/server/middleware/auth.ts` (select por id + soft delete)
- `src/server/middleware/account.ts` (select por membership)
- `src/server/routes/health/handlers.ts` (db.run com `sql` do Drizzle)
- `src/server/routes/auth/test-login.ts` (select simples)
- `packages/bhono-app/templates/base/src/server/middleware/*`
- `packages/bhono-app/templates/base/src/server/routes/*`

### Testes

- `tests/integration/setup.ts` (drizzle + better-sqlite3, schema SQL inline)
- `packages/bhono-app/templates/base/tests/integration/*` (espelho com drizzle)
- `packages/bhono-app/templates/base/tests/integration/security/*.test.ts` (comentarios e wrappers de drizzle)

## Padroes de query usados hoje

- Select simples por id + soft delete (`deleted_at IS NULL`).
- Select com join (`invitations` + `users`/`accounts`).
- Subquery com `IN` (multi-tenancy em users/accounts).
- Paginacao com `LIMIT/OFFSET` + `count(*)`.
- `LIKE` para filtros por nome/email/dominio.
- Inserts/updates com `returning()`.
- Soft delete (update de `deleted_at` e audit).
- Transacoes (create user + account + membership; depende de `db.transaction`).
- Uso pontual de SQL raw (`sql\`SELECT 1\`` na healthcheck).

## Sequencia recomendada de migracao

1) Padroes e convencoes de SQL puro (PDB-813)
- Definir placeholders, naming, soft delete, mapeamento/validacao, tratamento de erros.

2) Helper SQL para D1 (PDB-814)
- API de execucao (queryOne/queryAll/exec), bind de parametros e typing.
- Confirmar comportamento de transacoes no D1 (ex.: `batch`) antes de migrar flows criticos.

3) Camadas cross-cutting (PDB-815)
- Reimplementar `audited-db` e `audit` com SQL puro.
- Ajustar `transaction.ts` para o novo helper.

4) Modulos de negocio (PDB-816 a PDB-821)
- Auth -> Users -> Accounts -> Invitations -> Audits -> Middleware.
- Sempre migrar junto com testes afetados.

5) Estrategia sem migrations (PDB-822)
- Consolidar `schema.sql` versionado e bootstrap/reset com `wrangler d1 execute`.
- Alinhar `tests/integration/setup.ts` com `schema.sql`.

6) Remocao de Drizzle (PDB-823)
- Limpar dependencias, scripts e tipos remanescentes.

## Riscos e mitigacoes

- Consistencia multi-tenant: garantir `account_id` em todas as queries.
  - Mitigacao: helper com scoping obrigatorio e testes de autorizacao.

- Perda de audit trail: `audited-*` depende de `returning()`.
  - Mitigacao: selecionar estado anterior antes do update e usar `RETURNING` quando suportado.

- SQL injection: migracao aumenta risco manual.
  - Mitigacao: prepared statements, helpers obrigatorios e proibicao de string interpolation.

- Diferencas de comportamento entre D1 e sqlite local.
  - Mitigacao: alinhar `schema.sql` e tests com D1 (usar `wrangler d1` para smoke tests).

- Quebra de testes e mocks.
  - Mitigacao: atualizar `tests/integration/setup.ts` e mocks ao mesmo tempo que cada modulo.

## Entregaveis desta etapa (PDB-812)

- Inventario de arquivos e padroes de query.
- Sequencia recomendada e dependencias entre modulos.
- Riscos e mitigacoes para orientar as proximas issues.

## Notas

- Tudo que for alterado no `src/` deve ser espelhado em `packages/bhono-app/templates/base/`.
- O seed ja gera SQL puro; pode ser mantido e ajustado conforme o `schema.sql`.
