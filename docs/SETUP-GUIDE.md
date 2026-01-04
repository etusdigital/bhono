# BHono App - Guia de Setup Completo

## Setup Rápido (Recomendado)

O script `init.sh` foi atualizado para resolver automaticamente todos os problemas documentados neste guia.

### Para Projetos Novos

```bash
# Criar projeto
npm init bhono-app@latest meu-projeto -- --yes
cd meu-projeto

# Setup completo com credenciais Google
./scripts/init.sh --port 8787 \
  --google-id "seu-client-id.apps.googleusercontent.com" \
  --google-secret "GOCSPX-xxx"

# Ou setup básico (configure credenciais depois)
./scripts/init.sh --port 8787
```

### Para Projetos Existentes

```bash
# Setup completo
./scripts/init.sh --port 8787 \
  --google-id "seu-client-id" \
  --google-secret "seu-secret"

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

# JWT Configuration
JWT_SECRET=super-secret-jwt-key-with-at-least-32-characters-for-security
JWT_EXPIRY_MINUTES=15

# Google OAuth
GOOGLE_CLIENT_ID=seu-client-id
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/callback

# Refresh Token
REFRESH_TOKEN_EXPIRY_DAYS=30

# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@example.com
```

**Importante:** `JWT_SECRET` deve ter pelo menos 32 caracteres.

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
- [ ] **Configurar Google OAuth redirect URI no console** (manual)

---

## Variáveis de Ambiente Necessárias

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `ENVIRONMENT` | development/staging/production | Sim |
| `APP_URL` | URL da aplicação | Sim |
| `JWT_SECRET` | Chave para tokens (min 32 chars) | Sim |
| `JWT_EXPIRY_MINUTES` | Expiração do JWT | Sim |
| `GOOGLE_CLIENT_ID` | ID do OAuth Google | Sim |
| `GOOGLE_CLIENT_SECRET` | Secret do OAuth Google | Sim |
| `GOOGLE_REDIRECT_URI` | URI de callback | Sim |
| `REFRESH_TOKEN_EXPIRY_DAYS` | Dias para refresh token | Sim |
| `SENDGRID_API_KEY` | API key do SendGrid | Opcional* |
| `SENDGRID_FROM_EMAIL` | Email remetente | Opcional* |

*Necessário para envio de convites por email.

---

## Google OAuth Setup

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione existente
3. Vá em APIs & Services > Credentials
4. Crie OAuth 2.0 Client ID (Web application)
5. Adicione os URIs de redirecionamento autorizados:
   - `http://localhost:8787/auth/callback` (desenvolvimento)
   - `https://seu-app.workers.dev/auth/callback` (produção)
6. Copie Client ID e Client Secret para `.dev.vars`

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
    "auth": "google",
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
pnpm exec wrangler secret put JWT_SECRET --config config/wrangler.json
pnpm exec wrangler secret put GOOGLE_CLIENT_ID --config config/wrangler.json
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET --config config/wrangler.json
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

1. **JWT_SECRET muito curto**
   - O JWT_SECRET deve ter pelo menos 32 caracteres
   - Verifique `config/.dev.vars`:
   ```env
   JWT_SECRET=super-secret-jwt-key-with-at-least-32-characters-for-security
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

### Erro: "JWT_SECRET must be at least 32 characters"
- Atualize `JWT_SECRET` no `config/.dev.vars` com pelo menos 32 caracteres

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
  --google-id ID        Set Google OAuth Client ID
  --google-secret SEC   Set Google OAuth Client Secret
  --no-provision        Skip Cloudflare resource provisioning
  --skip-dev            Don't start dev server after setup
  --skip-seed           Skip database seeding
  --update              Update dependencies
  --help, -h            Show this help message

Examples:
  ./scripts/init.sh
  ./scripts/init.sh --port 3000
  ./scripts/init.sh --port 8787 --google-id 'xxx.apps.googleusercontent.com' --google-secret 'GOCSPX-xxx'
  CLOUDFLARE_ACCOUNT_ID=xxx ./scripts/init.sh
```
