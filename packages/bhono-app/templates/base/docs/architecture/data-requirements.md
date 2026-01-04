# Data Requirements Document (DRD)

## 1. Objetivo e escopo
Este documento define os requisitos de dados do projeto, cobrindo o modelo relacional (D1/SQLite), armazenamento de sessao (KV) e objetos (R2). Serve como referencia para manutencao, auditoria e evolucao do SQL puro.

## 2. Componentes de armazenamento
- D1 (SQLite): armazenamento relacional principal.
- KV (Cloudflare KV): sessao de usuario com TTL.
- R2 (Cloudflare R2): arquivos enviados pelo usuario (objetos).

## 3. Entidades e relacionamentos
O modelo relacional completo e descrito em `docs/architecture/erd.md`.
Principais entidades:
- users
- accounts
- user_accounts (relacao N:N entre users e accounts)
- invitations
- refresh_tokens
- audit_logs

## 4. Requisitos funcionais de dados por entidade

### 4.1 users
- Representa identidades de usuario autenticadas via Google OAuth.
- Deve armazenar google_id e email (obrigatorios).
- `status` controla ativacao (active/inactive).
- `is_super_admin` habilita acesso global.
- Soft delete via `deleted_at` e campos de auditoria de autoria.

### 4.2 accounts
- Representa workspaces/organizacoes multi-tenant.
- `domain` e opcional e deve ser unico quando informado.
- Soft delete via `deleted_at`.

### 4.3 user_accounts
- Relacao de pertencimento e papel do usuario na conta.
- Chave primaria composta (user_id, account_id).
- `role` deve respeitar o conjunto permitido.

### 4.4 invitations
- Convites pendentes para adicionar usuarios a uma conta.
- Deve ser unico por (account_id, email).
- `token` deve ser unico e opaco.
- `expires_at` controla expiracao do convite.

### 4.5 refresh_tokens
- Armazena tokens de refresh por usuario.
- Apenas hash do token e persistido (token em claro nao e armazenado).
- `expires_at` define expiracao; `revoked_at` controla revogacao.

### 4.6 audit_logs
- Registro de eventos de seguranca e mudancas de dados.
- Deve registrar: acao, entidade, entidade_id, mudancas, ip, user_agent e transaction_id.
- Pode ser global (account_id e user_id podem ser nulos).

## 5. Regras de integridade e consistencia
- FKs conforme ERD; `user_accounts`, `invitations` e `refresh_tokens` usam `on delete cascade`.
- Unicos: `users.google_id`, `accounts.domain`, `invitations.token`, `invitations(account_id, email)`.
- Soft delete obrigatorio para `users` e `accounts` (nao remover fisicamente por padrao).
- Enumeracoes validas:
  - user_accounts.role e invitations.role: ADMIN, MANAGER, EDITOR, AUTHOR, VIEWER, BILLING, ANALYTICS.
  - users.status: active, inactive.
  - audit_logs.action: INSERT, UPDATE, DELETE, LOGIN, LOGOUT, SIGNUP, TOKEN_REFRESH, LOGIN_FAILED.

## 6. Requisitos de acesso e consultas principais
- Autenticacao: buscar user por `google_id` (ativo) e gerar/validar refresh token por `token_hash`.
- Multitenancy: listar contas do usuario via `user_accounts`; listar usuarios por `account_id`.
- Convites: buscar por `token`, filtrar por `account_id` e `email`, verificar expiracao e `accepted_at`.
- Auditoria: inserir evento para operacoes de escrita e autenticacao; consulta por `account_id`/`transaction_id` quando necessario.

## 7. Indices
### 7.1 Indices existentes
- PKs em todas as tabelas.
- Unicos: `users.google_id`, `accounts.domain`, `invitations.token`, `invitations(account_id, email)`.

### 7.2 Indices recomendados (para SQL puro)
- `user_accounts(account_id)` e `user_accounts(user_id)` para filtragens frequentes.
- `users(email)` para buscas e convites.
- `refresh_tokens(token_hash)` e `refresh_tokens(user_id)` para validacao/rotacao.
- `invitations(token)` (ja unique) e `invitations(account_id, accepted_at, expires_at)` para listagem de pendentes.
- `audit_logs(account_id, timestamp)` para auditoria por conta/periodo.

## 8. Seguranca e privacidade
- Dados PII: email, nome, avatar_url, ip_address, user_agent.
- Tokens sensiveis: armazenar apenas hash (refresh_tokens.token_hash).
- Acesso a dados deve respeitar `account_id` e `role` (RBAC).
- Sessao em KV inclui fingerprint (ip e user_agent) para mitigacao de hijacking.

## 9. Retencao e ciclo de vida
- Sessao (KV): TTL padrao 24h com sliding expiration.
- Convites: expiram em 7 dias; convites aceitos/expirados nao devem ser reutilizados.
- Refresh tokens: expiracao configuravel via `REFRESH_TOKEN_EXPIRY_DAYS` (padrao 30 dias) e revogacao explicita.
- Audit logs: sem politica automatica atual; definir retencao conforme compliance.
- Usuarios e contas: soft delete com possibilidade de restauracao.

## 10. Auditoria e rastreabilidade
- Toda operacao de escrita e autenticacao deve gerar `audit_logs`.
- `transaction_id` permite correlacionar multiplas mudancas em uma unica requisicao.
- `changes` armazena diffs ou contexto relevante para compliance.

## 11. Backup e recuperacao
- Requisito: manter procedimento de backup/restore do D1 (ex.: exportacao periodica) e verificar restauracao.
- KV e R2 devem ter estrategia de recuperacao alinhada com RPO/RTO desejados.

## 12. Consideracoes para SQL puro (sem migrations)
- Todas as queries devem ser parametrizadas para evitar SQL injection.
- Manter mapeadores de resultado (ex.: validacao via Zod) para preservar contratos tipados.
- Centralizar SQL em um modulo `db` e reutilizar modelos do ERD.
- `schema.sql` e a fonte de verdade do schema e deve ser aplicado via `wrangler d1 execute`.
- `seed.sql` e gerado a partir de `src/server/db/seed.ts` e aplicado apos o bootstrap quando necessario.
