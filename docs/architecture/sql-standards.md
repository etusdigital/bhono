# Padrao de SQL puro e mapeamento de resultados

Contexto canonico: `docs/app_spec.txt`.

## Objetivo

Definir convencoes para SQL puro no D1/SQLite, incluindo bind de parametros,
mapa de resultados e tratamento de erros para manter consistencia e seguranca.

## Escopo

- SQL usado no backend (services, middleware, lib).
- Mapeamento de resultados para tipos de dominio.
- Soft delete, multi-tenancy, auditoria e paginacao.

## Convencoes de SQL

### Estilo

- Keywords em UPPERCASE (SELECT, FROM, WHERE).
- Tabelas e colunas em snake_case (como no schema atual).
- Evitar `SELECT *`: listar colunas para mapear explicitamente.
- Preferir alias curtos (`users u`, `accounts a`) quando houver join.

### Parametros e seguranca

- Nunca interpolar strings diretamente em SQL.
- Usar placeholders posicionais `?` com `stmt.bind(...)`.
- Proibir concatenacao de SQL com valores de usuario.

### Soft delete

- Queries de leitura devem sempre filtrar `deleted_at IS NULL` quando aplicavel.
- Remocoes devem ser soft delete (update de `deleted_at`, `deleted_by_id`, `updated_at`).
- Restauracao deve limpar `deleted_at` e `deleted_by_id`.

### Multi-tenancy

- Toda query de dados multi-tenant deve filtrar `account_id`.
- Para super-admin, permitir bypass explicito em query (flag de contexto).

### Paginacao e filtros

- Paginacao via `LIMIT`/`OFFSET`.
- Contagem total via `SELECT count(*)`.
- Filtros textuais com `LIKE` e `%`.

### Datas e tipos

- Datas em TEXT ISO (ex.: `created_at`) ou INTEGER unix (ex.: `refresh_tokens`).
- Mapear `INTEGER` para boolean quando necessario (0/1).
- Campos JSON em TEXT devem ser parseados ao ler.

## Mapeamento de resultados

### Regra geral

- Toda query deve ter um mapper explicito (funcao ou schema) que:
  - valida shape (preferencialmente com Zod),
  - converte tipos (INTEGER -> boolean, TEXT JSON -> objeto),
  - normaliza campos opcionais.

### Exemplo (conceitual)

- Query retorna `is_super_admin` (INTEGER).
- Mapper converte para boolean e retorna `isSuperAdmin`.
- Campo `provider_ids` (TEXT JSON) vira `string[]`.

## Erros e tratamento

- `NotFoundError` quando `SELECT` nao retorna registros esperados.
- `ConflictError` quando violar unicidade (dominio/email/token).
- `ForbiddenError` para acesso indevido a `account_id`.
- Propagar erro de SQL com mensagem generica (evitar leak de detalhes).

## Transacoes

- D1 nao oferece transacoes nativas. Operacoes multi-step devem ser planejadas
  para serem idempotentes ou dividir em `batch` quando possivel.
- Para fluxos criticos, validar resultados intermediarios e registrar auditoria
  com `transaction_id` compartilhado.

## Auditoria

- Toda mutacao relevante deve registrar `audit_logs`.
- Usar `transaction_id` comum para agrupar operacoes.
- Registrar `changes` apenas com campos relevantes.

## Checklist de migracao por modulo

- Listar queries atuais.
- Reescrever SQL com bind e filtros `account_id`/`deleted_at`.
- Adicionar mapper/validator.
- Atualizar testes afetados.

## Referencias

- `docs/architecture/erd.md`
- `docs/architecture/data-requirements.md`
- `docs/architecture/drizzle-migration-plan.md`
