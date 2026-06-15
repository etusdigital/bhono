# BHono App - Guia de Setup Completo

## Setup Rápido (Recomendado)

O script `init.sh` foi atualizado para resolver automaticamente todos os problemas documentados neste guia.

### Para Projetos Novos

```bash
# Criar projeto
npm init bhono-app@latest meu-projeto -- --yes
cd meu-projeto

# Setup completo com credenciais do ETUS Auth Gateway
./scripts/init.sh --port 8787 \
  --auth-client-id "seu-client-id" \
  --auth-secret "seu-secret"

# Ou setup básico (configure credenciais depois)
./scripts/init.sh --port 8787
```

### Para Projetos Existentes

```bash
# Setup completo
./scripts/init.sh --port 8787 \
  --auth-client-id "seu-client-id" \
  --auth-secret "seu-secret"

# Setup sem provisionar recursos Cloudflare
./scripts/init.sh --no-provision --port 8787

# Setup sem iniciar o servidor
./scripts/init.sh --skip-dev
```

### Múltiplas Contas Cloudflare

```bash
CLOUDFLARE_ACCOUNT_ID=seu-account-id ./scripts/init.sh
```

### O que o init.sh faz automaticamente:

1. ✅ Corrige nome do projeto em `package.json`, `etus.config.json`, `wrangler.json`
2. ✅ Configura `vite.config.ts` (configPath + porta)
3. ✅ Cria `config/.dev.vars` com todas as variáveis necessárias
4. ✅ Adiciona `config/.dev.vars` ao `.gitignore`
5. ✅ Aumenta rate limit de auth para desenvolvimento (100 req/min)
6. ✅ Corrige caminhos no `drizzle.config.ts`
7. ✅ Sincroniza bancos SQLite (resolve problema de hash do plugin)
8. ✅ Provisiona recursos Cloudflare (D1, KV, R2)
9. ✅ Aplica schema e seed no banco de dados

---

## Resumo dos Problemas Encontrados e Soluções

### 1. Criação do Projeto com Prompts Interativos

**Problema:** O comando `npm init bhono-app@latest .` falha em ambientes não-TTY (como Claude Code ou CI/CD) porque usa prompts interativos.

**Solução:** Usar a flag `--yes` para pular os prompts:
```bash
npm init bhono-app@latest . -- --yes
```

---

### 2. Nome do Projeto Incorreto

**Problema:** Quando usado com `.` como diretório, o nome do projeto fica como "." em vez do nome da pasta, causando:
- `wrangler.json` com nomes inválidos (`.-db`, `.-storage`)
- `package.json` com `"name": "."`
- Erros de validação do Cloudflare

**Solução:** Após criar o projeto, corrigir manualmente:

**package.json:**
```json
{
  "name": "nome-do-projeto"
}
```

**config/wrangler.json:**
- Substituir todas ocorrências de `"."` e `".-"` pelo nome correto do projeto
- Corrigir: `name`, `database_name`, `bucket_name`, URLs em `vars`

---

### 3. Múltiplas Contas Cloudflare

**Problema:** Se você tem múltiplas contas Cloudflare, o wrangler falha com:
```
More than one account available but unable to select one in non-interactive mode
```

**Solução:** Definir a variável de ambiente `CLOUDFLARE_ACCOUNT_ID`:
```bash
CLOUDFLARE_ACCOUNT_ID=seu-account-id ./scripts/init.sh
```

Ou adicionar `account_id` no `wrangler.json`:
```json
{
  "account_id": "seu-account-id"
}
```

---

### 4. Cloudflare Vite Plugin não Encontra wrangler.json

**Problema:** O plugin `@cloudflare/vite-plugin` não encontra o `wrangler.json` quando está em `config/`.

**Solução:** Configurar o caminho no `vite.config.ts`:
```typescript
cloudflare({
  configPath: './config/wrangler.json',
}),
```

---

### 5. Variáveis de Ambiente não Carregadas

**Problema:** O arquivo `.dev.vars` precisa estar no mesmo diretório que o `wrangler.json` para ser carregado.

**Solução:** Criar `config/.dev.vars` com todas as variáveis necessárias:
```env
# Environment
ENVIRONMENT=development
APP_URL=http://localhost:8787

# ETUS Auth Gateway
ETUS_GATEWAY=https://ag.etus.io
ETUS_CLIENT_ID=seu-client-id
ETUS_CLIENT_SECRET=seu-client-secret
ETUS_ALLOWED_DOMAINS=seudominio.com
ETUS_ADMIN_EMAILS=admin@seudominio.com

# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@example.com
```

**Importante:** `ETUS_ADMIN_EMAILS` deve ter pelo menos um email. Esses emails
recebem `role='admin'` no callback OAuth e conseguem acessar `/auth/admin/*`
e `/audit/logs`. Com **gateway-as-authority** ligado (abaixo), esse allowlist
vira apenas o bootstrap do dia 0 — o papel admin real passa a vir do gateway.

---

### Gateway-as-authority (opcional, @etus/auth v0.7.0)

Por padrão o app decide as permissões localmente (`PERMISSIONS_MATRIX`). Para
tornar o **gateway a fonte de autoridade** — ou seja, derivar as permissões do
que o gateway resolveu para o usuário neste app (`RBAC ∪ access_grants`) —
ative `ETUS_GATEWAY_AUTHORITY`. O app continua BFF (não guarda tokens do
usuário); ele consulta o gateway com a **integration key do próprio app**.

Onboarding (uma vez, por app):

1. **Registrar o app como resource `web_app` no gateway** (um admin do gateway,
   no console). Declare o vocabulário de scopes igual às **chaves do `SCOPE_MAP`**
   em `src/server/auth/matrix.ts` (o template usa `bhono:admin|editor|viewer` —
   renomeie para o prefixo do seu app). ⚠️ Há **duas** referências a esse
   vocabulário: as chaves do `SCOPE_MAP` **e** `adminScopes` em
   `src/server/auth/setup.ts` — renomeie as duas em lockstep, senão a promoção a
   admin via gateway quebra silenciosamente.
2. **Provisionar uma integration key** bound a esse resource, com o scope
   **`app.grants.read`**. Copie o segredo `ag_app_<slug>_…` (mostrado uma vez).
3. **Configurar o app:**
   - `ETUS_GATEWAY_AUTHORITY=true`
   - `ETUS_RESOURCE_ID=<slug do resource>` (var, em `config/wrangler.json`)
   - `ETUS_INTEGRATION_KEY=<a key>` — **secret**:
     `wrangler secret put ETUS_INTEGRATION_KEY --config config/wrangler.json`
     em produção/staging. Nunca commitar.
4. **Conceder roles/grants aos usuários no gateway** que resolvam para `bhono:*`.
   O app passa a ler isso no login (e revalida a cada `ttlSeconds`).

> **Dev local (importante):** `pnpm dev` usa o `@cloudflare/vite-plugin` com
> `configPath: ./config/wrangler.json`, que lê as variáveis de
> `config/wrangler.json` e os secrets de **`config/.dev.vars`** — NÃO do
> `.dev.vars` na raiz do projeto. Para testar gateway-as-authority localmente,
> ponha `ETUS_GATEWAY_AUTHORITY`/`ETUS_RESOURCE_ID` nas `vars` de
> `config/wrangler.json` e `ETUS_INTEGRATION_KEY` em `config/.dev.vars`
> (gitignored). Variáveis postas no `.dev.vars` da raiz são silenciosamente
> ignoradas (o app cai no default `ETUS_GATEWAY_AUTHORITY=false`).

Verificação: logar → o middleware popula `authPermissions` a partir do
`SCOPE_MAP` → `requirePermission(...)` autoriza. Se **todo** request der 403,
cheque que a key tem `app.grants.read` e que o vocabulário do resource bate com
as chaves do `SCOPE_MAP`. Disponibilidade: uma negação explícita do gateway
bloqueia; uma indisponibilidade transitória serve o cache (não derruba o app).

> O binding KV `SESSIONS` em `config/wrangler.json` não é mais usado para sessão
> (v0.6.0+ usa D1 via `createSqlSessionStore`); pode ser removido se nenhum outro
> código depender dele.

#### Papéis por-conta do gateway (@etus/auth v0.9.1)

Além dos **scopes** (`SCOPE_MAP`), o gateway resolve um **papel por conta** do
usuário (modelo Auth0 Organizations: `viewer < editor < manager < admin`, da
migration 0070 do gateway). Este boilerplate **lê** esses papéis para autorização
(camada org-level, ao lado dos workspaces locais) — a gestão de membros continua
**local** (modelo híbrido).

- **`ACCOUNT_ROLE_MAP`** (`src/server/auth/matrix.ts`) — paralelo ao `SCOPE_MAP`,
  mapeia cada papel-por-conta do gateway → permissões locais (entradas do
  `PERMISSION_CATALOG`). Ligado via `gatewayAuthority.accountRoleMap` em
  `setup.ts`. O `@etus/auth` **une** essas permissões entre **todas** as contas do
  usuário (super-admin conta como `admin` em todas) e injeta em `authPermissions`.
  É um grant **coarse, org-level** — ajuste por produto.
- **Gating preciso por-conta** — para "manager nesta conta específica", use o guard
  do pacote `auth.requireGatewayAccountRole(slug, role)` (não o mapa global). Um
  super-admin sempre passa; lança `NotAccountMemberError`/`AccountRoleRequiredError`.
- **Contexto do usuário** — `GET /api/me` (`src/server/routes/me/index.ts`) devolve
  `{ accounts: [{id,slug,name,role}], superAdmin }` resolvido pelo gateway. Vazio /
  `false` quando `ETUS_GATEWAY_AUTHORITY` está off (shape sempre seguro).
- **No client** — o hook `useGatewayAccounts()`
  (`src/client/hooks/use-gateway-accounts.ts`) lê o `/api/me` e expõe `accounts`,
  `superAdmin` e `hasAccountRole(slug, role)` para gatear a UI:

```tsx
const { accounts, superAdmin, hasAccountRole } = useGatewayAccounts()

// badge de papel por conta do gateway:
{accounts.map((a) => <Badge key={a.id}>{a.name}: {a.role}</Badge>)}

// gating de UI — NÃO é fronteira de segurança (o guard do server é a autoridade):
{hasAccountRole('unum', 'manager') && <InviteButton accountSlug="unum" />}
```

> ⚠️ **Regras de segurança do `ACCOUNT_ROLE_MAP`** (é grant **org-level**: o pacote
> une as permissões entre **todas** as contas do usuário, sem escopo por-conta):
> - **Nunca** use `'*'` ou wildcard de namespace (`resources:*`) — um usuário que
>   seja `admin` em **qualquer** conta (até uma não-relacionada) passaria esse guard
>   no app inteiro. Mantenha valores **bounded e não-destrutivos** (sem `:delete`,
>   `billing:manage`). Há um teste que falha se um wildcard entrar.
> - Para autz por conta/workspace **específico** (ex.: "admin DESTA conta pode
>   deletá-la"), use `auth.requireGatewayAccountRole(slug, role)` no server e
>   `hasAccountRole(slug, role)` no client — **não** este mapa.
> - As permissões aqui são **unidas** com as do papel local (aditivas): remover um
>   usuário de uma conta **local** NÃO revoga o que o gateway concede. O gateway é a
>   autoridade do que ele resolve; com gateway-authority ligado, a gestão de membros
>   local não é um kill-switch de autorização.

#### Validar a UI multi-tenant localmente (gateway mock)

Os papéis por-conta do gateway vêm do gateway via HTTP — local não há gateway. Para
**validar a UI** (e escrever testes) sem um gateway ao vivo, há um **mock de dev**:

- **`src/server/dev/gateway-scenario.ts`** — cenário multi-tenant fixo, por e-mail
  (alinhado ao `seed.ts`). O `/api/me`, quando o mock está ligado, resolve as contas
  do gateway do usuário logado a partir desse fixture. Gated **duas vezes**:
  `ENVIRONMENT !== 'production'` **e** `ETUS_GATEWAY_MOCK` truthy — nunca em produção.
- **Página `Workspaces`** (`src/client/routes/_authenticated/workspaces.tsx`, no nav)
  — renderiza `useGatewayAccounts()`: banner de super-admin, um card por conta com o
  badge de papel (viewer/editor/manager/admin) e o que ele concede; empty state.

Usuários do cenário (logue via `/auth/test-login`): `superadmin@example.com`
(super-admin), `admin@example.com` (admin em Acme), `multi@example.com` (**admin em
Initech + viewer em Acme** — o caso de over-grant cross-account que o `ACCOUNT_ROLE_MAP`
conservador protege), `viewer@example.com` (read-only).

```bash
# 1. (opcional) popular o banco local com o cenário
pnpm db:reset:local

# 2. Ligar o mock. IMPORTANTE: o @cloudflare/vite-plugin lê o .dev.vars ao lado do
#    wrangler.json (config/.dev.vars), NÃO o da raiz. Ponha a flag lá:
echo 'ETUS_GATEWAY_MOCK=1' >> config/.dev.vars     # (config/.dev.vars é gitignored)

# 3. Subir e logar como um usuário do cenário, depois abrir /workspaces
pnpm dev
#   → POST /auth/test-login {"email":"multi@example.com"}  → abra http://localhost:8787/workspaces
```

> O mock é **só para dev/teste**. Em produção (`ETUS_GATEWAY_AUTHORITY=true`) o
> `/api/me` resolve do gateway real; o mock é ignorado. Cobertura: unit
> (`tests/unit/server/dev/`), integração (`tests/integration/api/me.test.ts` dirige o
> mock pela wiring real via `buildApp`) e E2E (`tests/e2e/workspaces.spec.ts`).

---

### 6. Banco de Dados com Hash Diferente

**Problema:** O Cloudflare Vite Plugin cria o banco SQLite com um hash baseado nas configurações, não no `database_id` do wrangler.json. Isso causa erro "no such table: users".

**Solução:** Após executar `pnpm db:push`, identificar o arquivo correto e copiar:

```bash
# Encontrar todos os arquivos sqlite
find .wrangler -name "*.sqlite"

# Copiar o banco com dados para o banco que o plugin usa
cp .wrangler/state/v3/d1/miniflare-D1DatabaseObject/ID_CORRETO.sqlite \
   .wrangler/state/v3/d1/miniflare-D1DatabaseObject/HASH_DO_PLUGIN.sqlite
```

**Melhor solução:** Atualizar `config/drizzle.config.ts` para usar o caminho correto do banco usado pelo plugin.

---

### 7. Drizzle Config com Caminhos Relativos Incorretos

**Problema:** O `drizzle.config.ts` usa caminhos relativos que não funcionam quando executado da raiz.

**Solução:** Usar caminhos relativos à raiz do projeto:
```typescript
export default defineConfig({
  schema: './src/server/db/schema/index.ts',
  out: './src/server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './.wrangler/state/v3/d1/miniflare-D1DatabaseObject/SEU_DB_ID.sqlite',
  },
})
```

---

### 8. Rate Limit Muito Restritivo

**Problema:** O rate limit de auth (10 req/min) é atingido rapidamente porque o frontend chama `/auth/me` múltiplas vezes para verificar sessão.

**Solução:** Aumentar o limite em `src/server/middleware/rate-limit.ts`:
```typescript
export function authRateLimit() {
  return rateLimit({
    windowMs: 60000,
    max: 100, // Aumentado de 10 para 100
    message: 'Too many authentication attempts, please try again later',
  })
}
```

---

### 9. Porta do Servidor

**Problema:** Por padrão o Vite usa porta 5173, não a porta configurada no wrangler.json.

**Solução:** Configurar a porta no `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    port: 8787,
  },
  // ...
})
```

---

### 10. Redirect após Login vai para Produção

**Problema:** Após login OAuth, o redirect vai para a URL de produção em vez de localhost.

**Solução:** Adicionar `APP_URL` no `config/.dev.vars`:
```env
APP_URL=http://localhost:8787
```

---

## Checklist de Setup Rápido

Com o `init.sh` atualizado, a maioria destes itens são automáticos:

- [x] ~~Criar projeto com `--yes`~~ (use `npm init bhono-app@latest nome -- --yes`)
- [x] ~~Corrigir nome em arquivos de config~~ (**automático via init.sh**)
- [x] ~~Criar `config/.dev.vars`~~ (**automático via init.sh**)
- [x] ~~Adicionar `config/.dev.vars` ao `.gitignore`~~ (**automático via init.sh**)
- [x] ~~Configurar `vite.config.ts`~~ (**automático via init.sh**)
- [x] ~~Executar `pnpm db:push` e `pnpm db:seed`~~ (**automático via init.sh**)
- [x] ~~Sincronizar bancos sqlite~~ (**automático via init.sh**)
- [x] ~~Aumentar rate limit de auth~~ (**automático via init.sh**)
- [ ] **Criar/configurar client no ETUS Auth Gateway** (manual)

---

## Variáveis de Ambiente Necessárias

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `ENVIRONMENT` | development/staging/production | Sim |
| `APP_URL` | URL da aplicação | Sim |
| `ETUS_GATEWAY` | URL do gateway OAuth ETUS | Sim |
| `ETUS_CLIENT_ID` | Client ID registrado no gateway | Sim |
| `ETUS_CLIENT_SECRET` | Client secret registrado no gateway | Sim* |
| `ETUS_ALLOWED_DOMAINS` | Domínios permitidos para usuários | Sim |
| `ETUS_ADMIN_EMAILS` | Admins iniciais do produto | Sim |
| `SENDGRID_API_KEY` | API key do SendGrid | Opcional* |
| `SENDGRID_FROM_EMAIL` | Email remetente | Opcional* |

`ETUS_CLIENT_SECRET` pode ficar vazio apenas em desenvolvimento local quando o
host é loopback. Em produção/staging ele é obrigatório.

SendGrid é necessário quando o produto decidir enviar emails de convite. O
`@etus/auth` atual persiste o convite, mas o envio do email ainda é
responsabilidade do boilerplate/produto.

---

## ETUS Auth Gateway Setup

1. Registre o produto no gateway ETUS (`ag.etus.io`).
2. Configure os redirects do produto no gateway:
   - `http://localhost:8787/auth/callback` (desenvolvimento)
   - `https://seu-app.workers.dev/auth/callback` (produção)
3. Copie `ETUS_CLIENT_ID` e `ETUS_CLIENT_SECRET` para `config/.dev.vars`.
4. Defina `ETUS_ALLOWED_DOMAINS` com os domínios que podem autenticar.
5. Defina `ETUS_ADMIN_EMAILS` com pelo menos um admin real do produto.

---

## Lacunas Adicionais Descobertas

### 11. Arquivo etus.config.json não Corrigido

**Problema:** O arquivo `etus.config.json` também fica com nome "." após a criação do projeto.

**Solução:** Corrigir manualmente:
```json
{
  "name": "nome-do-projeto",
  "domain": "nome-do-projeto.com",
  "modules": [],
  "providers": {
    "auth": "etus-auth",
    "email": "sendgrid"
  }
}
```

---

### 12. Dois Arquivos .dev.vars (Raiz e config/)

**Problema:** O projeto pode ter dois arquivos `.dev.vars`:
- `.dev.vars` na raiz (usado pelo `scripts/init.sh`)
- `config/.dev.vars` (usado pelo Cloudflare Vite Plugin)

**Solução:** Manter ambos sincronizados com as mesmas variáveis, ou usar apenas `config/.dev.vars` e criar um symlink:
```bash
ln -sf config/.dev.vars .dev.vars
```

---

### 13. Como Descobrir Qual Banco SQLite o Plugin Usa

**Problema:** O Cloudflare Vite Plugin usa um hash diferente do `database_id` para o arquivo SQLite. Difícil saber qual arquivo atualizar.

**Solução:** Verificar qual arquivo foi modificado mais recentemente ou é maior:
```bash
# Listar todos os bancos com tamanho e data
find .wrangler -name "*.sqlite" -not -name "*-shm" -not -name "*-wal" -exec ls -la {} \;

# O maior arquivo geralmente é o que tem dados
# Ou verificar qual foi modificado após fazer uma operação
```

**Dica:** Após descobrir o hash correto, atualize `config/drizzle.config.ts` para apontar para ele.

---

### 14. Atualizar .gitignore para config/.dev.vars

**Problema:** O arquivo `config/.dev.vars` contém credenciais sensíveis mas pode não estar no `.gitignore`.

**Solução:** Adicionar ao `.gitignore`:
```bash
echo "config/.dev.vars" >> .gitignore
```

---

### 15. KV Namespace para Sessions

**Informação:** O projeto usa KV Namespace para armazenar sessões. Em desenvolvimento local, o miniflare cria um arquivo SQLite para simular o KV:
```
.wrangler/state/v3/kv/miniflare-KVNamespaceObject/*.sqlite
```

Este arquivo é gerenciado automaticamente e não precisa de intervenção manual.

---

## Arquivos que Precisam ser Corrigidos (Lista Completa)

> **Nota:** Todos estes arquivos são corrigidos automaticamente pelo `init.sh` atualizado.

| Arquivo | O que corrigir | Status |
|---------|----------------|--------|
| `package.json` | `"name": "."` → `"name": "nome-projeto"` | ✅ Automático |
| `config/wrangler.json` | `name`, `database_name`, `bucket_name`, URLs | ✅ Automático |
| `etus.config.json` | `"name": "."` → `"name": "nome-projeto"` | ✅ Automático |
| `vite.config.ts` | Adicionar `configPath` e `server.port` | ✅ Automático |
| `config/drizzle.config.ts` | Corrigir caminhos e apontar para banco correto | ✅ Automático |
| `config/.dev.vars` | Criar com todas as variáveis | ✅ Automático |
| `.gitignore` | Adicionar `config/.dev.vars` (segurança!) | ✅ Automático |
| `src/server/middleware/rate-limit.ts` | Aumentar `max` de 10 para 100 | ✅ Automático |

---

## Comandos Úteis

```bash
# Verificar tabelas no banco
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite ".tables"

# Ver estrutura de uma tabela
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite ".schema users"

# Executar query
sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite "SELECT * FROM users;"

# Aplicar seed manualmente
sqlite3 ARQUIVO.sqlite < seed.sql

# Listar todos os bancos sqlite
find .wrangler -name "*.sqlite" -not -name "*-shm" -not -name "*-wal"

# Verificar qual banco tem tabelas
for f in $(find .wrangler -name "*.sqlite" -not -name "*-shm" -not -name "*-wal"); do
  echo "=== $f ==="
  sqlite3 "$f" ".tables"
done
```

---

## Testes

```bash
# Rodar todos os testes
pnpm test

# Testes unitários do servidor
pnpm test:unit:server

# Testes unitários do cliente
pnpm test:unit:client

# Testes de integração
pnpm test:integration

# Testes E2E (requer servidor rodando)
pnpm test:e2e

# Testes E2E com UI
pnpm test:e2e:ui
```

---

## Deploy para Produção

### 1. Provisionar Recursos Cloudflare

```bash
# Login no Cloudflare
pnpm exec wrangler login

# Criar D1 Database
pnpm exec wrangler d1 create nome-projeto-db

# Criar KV Namespace
pnpm exec wrangler kv namespace create nome-projeto-sessions

# Criar R2 Bucket
pnpm exec wrangler r2 bucket create nome-projeto-storage
```

### 2. Atualizar wrangler.json com IDs

Após criar os recursos, atualize `config/wrangler.json` com os IDs retornados.

### 3. Configurar Secrets

```bash
# Configurar variáveis secretas
pnpm exec wrangler secret put ETUS_CLIENT_SECRET --config config/wrangler.json
pnpm exec wrangler secret put SENDGRID_API_KEY --config config/wrangler.json
```

### 4. Aplicar Schema no D1 Remoto

```bash
pnpm exec wrangler d1 execute nome-projeto-db --remote --file=seed.sql --config config/wrangler.json
```

### 5. Deploy

```bash
pnpm run deploy
```

---

## Troubleshooting

### Erro: INTERNAL_ERROR 500

```json
{"error":{"code":"INTERNAL_ERROR","message":"Internal server error","status":500}}
```

**Causas possíveis:**

1. **Configuração do ETUS Auth incompleta**
   - `ETUS_GATEWAY`, `ETUS_CLIENT_ID`, `ETUS_ALLOWED_DOMAINS` e
     `ETUS_ADMIN_EMAILS` são obrigatórios
   - Em produção/staging, `ETUS_CLIENT_SECRET` também é obrigatório
   - Verifique `config/.dev.vars`:
   ```env
   ETUS_GATEWAY=https://ag.etus.io
   ETUS_CLIENT_ID=seu-client-id
   ETUS_CLIENT_SECRET=seu-client-secret
   ETUS_ALLOWED_DOMAINS=seudominio.com
   ETUS_ADMIN_EMAILS=admin@seudominio.com
   ```

2. **Variáveis de ambiente não carregadas**
   - O Cloudflare Vite Plugin lê de `config/.dev.vars`, não da raiz
   - Certifique-se que `config/.dev.vars` existe e tem todas as variáveis

3. **Banco de dados sem tabelas**
   - Execute: `pnpm db:push && pnpm db:seed`
   - Verifique com: `sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite ".tables"`

4. **configPath não configurado no vite.config.ts**
   - Adicione ao plugin cloudflare:
   ```typescript
   cloudflare({
     configPath: './config/wrangler.json',
   })
   ```

**Diagnóstico rápido:**
```bash
# Ver logs detalhados
pnpm dev 2>&1 | head -50

# Verificar se config/.dev.vars existe
cat config/.dev.vars

# Verificar se banco tem tabelas
find .wrangler -name "*.sqlite" -exec sqlite3 {} ".tables" \;
```

---

### Erro: "no such table: users"
- Verifique se `pnpm db:push` foi executado
- Verifique se o drizzle.config.ts aponta para o banco correto
- Copie o banco com dados para o arquivo que o plugin usa

### Erro: "ETUS_ADMIN_EMAILS must include at least one admin email"
- Atualize `ETUS_ADMIN_EMAILS` no `config/.dev.vars` com pelo menos um email
  real do produto

### Erro: "Rate limit exceeded"
- Reinicie o servidor para limpar o rate limiter
- Ou aumente o limite em `src/server/middleware/rate-limit.ts`

### Redirect vai para produção após login
- Verifique se `APP_URL=http://localhost:8787` está em `config/.dev.vars`

### Frontend carrega mas API dá 404
- Verifique se `configPath` foi adicionado ao cloudflare plugin no vite.config.ts

### Múltiplas contas Cloudflare
- Defina `CLOUDFLARE_ACCOUNT_ID` antes de executar comandos wrangler

---

## Referência do init.sh

```
BHono - Development Environment Setup

Usage: ./scripts/init.sh [OPTIONS]

Options:
  --port PORT           Set dev server port (default: 8787)
  --auth-client-id ID   Set ETUS Auth client ID
  --auth-secret SEC     Set ETUS Auth client secret
  --no-provision        Skip Cloudflare resource provisioning
  --skip-dev            Don't start dev server after setup
  --skip-seed           Skip database seeding
  --update              Update dependencies
  --help, -h            Show this help message

Examples:
  ./scripts/init.sh
  ./scripts/init.sh --port 3000
  ./scripts/init.sh --port 8787 --auth-client-id 'produto' --auth-secret 'secret'
  CLOUDFLARE_ACCOUNT_ID=xxx ./scripts/init.sh
```
