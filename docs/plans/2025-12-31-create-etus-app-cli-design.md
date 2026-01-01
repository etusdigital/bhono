# Design: create-etus-app CLI

**Data:** 2025-12-31
**Status:** Aprovado
**Objetivo:** CLI para criar novos projetos a partir do boilerplate com alta customização

## Contexto

- Volume esperado: 15+ projetos/ano
- Usuários: Devs seniores a não-técnicos (misto)
- Customização: Alta (integrações, auth providers, features por projeto)
- Deploy: Sempre Cloudflare Workers
- Evolução: Fork independente (cada projeto vira repo separado)

## Arquitetura Geral

### Stack do CLI

- **Runtime:** Node.js + TypeScript
- **Prompts:** Clack (UX moderna)
- **Cloudflare:** Wrangler SDK + Cloudflare API
- **GitHub:** Octokit
- **Templating:** Handlebars ou EJS
- **Package Manager:** pnpm

### Distribuição

```bash
# Via npm privado
pnpm add -g @etus/create-app

# Ou direto do GitHub
pnpx github:etus/create-etus-app my-saas
```

### Fluxo Principal

```
create-etus-app my-saas
    │
    ├─► Prompts interativos (nome, domínio, módulos, auth...)
    │
    ├─► Copia template base
    │
    ├─► Aplica customizações (remove/adiciona módulos)
    │
    ├─► Substitui placeholders (nome, domínio, IDs)
    │
    ├─► Cria repo no GitHub (opcional)
    │
    ├─► Provisiona Cloudflare (D1, KV, R2)
    │
    └─► Configura secrets no repo
```

## Sistema de Módulos

### Estrutura do Boilerplate

```
boilerplate/
├── base/                    # Core sempre incluído
│   ├── src/server/routes/auth/
│   ├── src/server/routes/health/
│   ├── src/client/routes/_authenticated/
│   └── ...
│
├── modules/                 # Opcionais
│   ├── invitations/         # Sistema de convites
│   ├── storage/             # R2 file upload
│   ├── audit-logs/          # Audit trail completo
│   ├── teams/               # Multi-user por account
│   ├── billing/             # Integração Stripe
│   └── webhooks/            # Sistema de webhooks
│
└── providers/               # Alternativas para mesma feature
    ├── auth-google/         # OAuth Google (default)
    ├── auth-github/         # OAuth GitHub
    ├── auth-email/          # Magic link
    ├── email-sendgrid/      # SendGrid (default)
    └── email-resend/        # Resend
```

### Configuração Gerada

```json
{
  "name": "my-saas",
  "domain": "my-saas.com",
  "modules": ["invitations", "storage", "audit-logs"],
  "providers": {
    "auth": "google",
    "email": "resend"
  },
  "features": {
    "multiTenant": true,
    "darkMode": true
  }
}
```

### Processamento

1. Copia `base/` inteiro
2. Para cada módulo selecionado, merge `modules/{modulo}/` no projeto
3. Substitui provider default pelo escolhido
4. Remove imports/rotas de módulos não selecionados

## Experiência do CLI

### Modo Interativo

```
┌  create-etus-app
│
◆  Nome do projeto?
│  my-awesome-saas
│
◆  Domínio de produção?
│  myawesomesaas.com
│
◆  Quais módulos incluir?
│  ◼ Invitations (convites por email)
│  ◼ Storage (upload de arquivos R2)
│  ◻ Audit Logs (histórico de ações)
│  ◻ Billing (Stripe integration)
│  ◻ Webhooks
│
◆  Provider de autenticação?
│  ● Google OAuth (recomendado)
│  ○ GitHub OAuth
│  ○ Magic Link (email)
│
◆  Provider de email?
│  ● SendGrid
│  ○ Resend
│
◆  Criar repositório no GitHub?
│  ● Sim, público
│  ○ Sim, privado
│  ○ Não, só local
│
◆  Provisionar recursos Cloudflare?
│  ● Sim, criar D1 + KV + R2 agora
│  ○ Não, faço depois manualmente
│
└  Criando projeto...

   ✔ Projeto gerado
   ✔ Repo criado: github.com/etus/my-awesome-saas
   ✔ D1 database criado: my-awesome-saas-db
   ✔ KV namespace criado: my-awesome-saas-sessions
   ✔ Secrets configurados no GitHub

   Próximos passos:
   cd my-awesome-saas
   pnpm install
   pnpm dev
```

### Modo Não-Interativo (CI/Automação)

```bash
create-etus-app my-saas \
  --domain=mysaas.com \
  --modules=invitations,storage \
  --auth=google \
  --email=sendgrid \
  --github=private \
  --provision
```

## Provisionamento Cloudflare

### Recursos Criados

```
Cloudflare Account
│
├── D1 Database
│   └── {project-name}-db
│       ├── Aplica migrations base
│       └── Seed de dados iniciais (opcional)
│
├── KV Namespaces
│   ├── {project-name}-sessions
│   └── {project-name}-cache (se módulo cache ativo)
│
├── R2 Bucket (se módulo storage ativo)
│   └── {project-name}-files
│
└── Workers
    └── {project-name}
```

### Secrets Configurados

```
✔ Secret: JWT_SECRET (gerado automaticamente - 64 chars)
✔ Secret: GOOGLE_CLIENT_ID (prompt ou flag)
✔ Secret: GOOGLE_CLIENT_SECRET (prompt ou flag)
✔ Secret: SENDGRID_API_KEY (prompt ou flag)
```

### Autenticação

```bash
# Primeira vez - guarda token globalmente
create-etus-app auth

# Usa CLOUDFLARE_API_TOKEN do ambiente ou ~/.etus/config.json
```

### Wrangler.json Gerado

```json
{
  "name": "my-awesome-saas",
  "main": "src/server/index.ts",
  "compatibility_date": "2024-12-01",
  "d1_databases": [{
    "binding": "DB",
    "database_name": "my-awesome-saas-db",
    "database_id": "xxx-gerado-automaticamente"
  }],
  "kv_namespaces": [{
    "binding": "SESSIONS",
    "id": "xxx-gerado-automaticamente"
  }],
  "r2_buckets": [{
    "binding": "R2_BUCKET",
    "bucket_name": "my-awesome-saas-files"
  }]
}
```

## Integração GitHub

### Repo Criado

```
GitHub Repository
│
├── Secrets (para GitHub Actions)
│   ├── CLOUDFLARE_API_TOKEN
│   ├── CLOUDFLARE_ACCOUNT_ID
│   └── (outros secrets do projeto)
│
├── Branch protection (opcional)
│   └── main: require PR, require checks
│
└── GitHub Actions workflows
    ├── .github/workflows/ci.yml        # Lint + Test em PRs
    ├── .github/workflows/deploy.yml    # Deploy em push to main
    └── .github/workflows/e2e.yml       # E2E tests scheduled
```

### CI/CD Workflow

```yaml
# deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm run build
      - run: pnpm wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Output Final

```bash
create-etus-app my-saas --provision --github=private

✔ Projeto gerado em ./my-saas
✔ Repo criado: github.com/etus/my-saas (privado)
✔ Cloudflare provisionado (D1, KV, R2)
✔ Secrets configurados (GitHub + Cloudflare)
✔ CI/CD pronto - push to main faz deploy

Próximos passos:
  cd my-saas
  pnpm install
  pnpm dev

Deploy: git push origin main
```

## Estrutura do Projeto CLI

```
create-etus-app/
├── src/
│   ├── index.ts              # Entry point
│   ├── cli.ts                # Commander/Clack setup
│   ├── prompts/              # Prompt definitions
│   ├── generators/           # Template generation
│   ├── providers/
│   │   ├── cloudflare.ts     # D1, KV, R2, secrets
│   │   └── github.ts         # Repo, secrets, actions
│   └── utils/
├── templates/
│   ├── base/                 # Core boilerplate
│   ├── modules/              # Optional modules
│   └── providers/            # Auth/email providers
├── package.json
└── tsconfig.json
```

## Próximos Passos

1. Criar repo `create-etus-app`
2. Setup inicial do CLI com Clack
3. Implementar sistema de templates/módulos
4. Integrar Cloudflare API
5. Integrar GitHub API
6. Testes e documentação
7. Publicar no npm privado ou GitHub
