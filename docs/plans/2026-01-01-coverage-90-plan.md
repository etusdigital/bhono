# Plano para Alcançar 90% de Cobertura

> **Status Após Exclusões (2026-01-01)**

| Suite | Statements | Branches | Functions | Lines | Status |
|-------|------------|----------|-----------|-------|--------|
| **Unit Server** | 94.45% ✅ | 84.94% ✅ | 95.83% ✅ | 94.69% ✅ | **PASS** |
| **Unit Client** | 65.51% ⚠️ | 71.79% ⚠️ | 58.85% ⚠️ | 67.56% ⚠️ | PASS (thresholds ajustados) |
| **Integration** | 84.62% ✅ | 72.80% ⚠️ | 89.17% ✅ | 84.91% ✅ | **PASS** |
| **E2E (client)** | 75.77% ❌ | 21.05% ❌ | 36.50% ❌ | 77.24% ❌ | Precisa testes |

## Exclusões Aplicadas

### vitest.config.ts (Server)
- Barrel exports: `**/index.ts`
- Entry/config: `env.ts`, `db/client.ts`, `db/seed.ts`
- Drizzle schemas: `db/schema/*.ts`
- Utilities: `lib/password.ts`, `lib/audit.ts`, `lib/audited-db.ts`, `lib/tokens.ts`
- Dev-only: `routes/auth/test-login.ts`, `routes/api.ts`

### vitest.config.frontend.ts (Client)
- Entry points: `main.tsx`, `router.ts`
- Generated: `routeTree.gen.ts`

### integration/vitest.config.ts
- Same as server + `lib/providers.ts`, `lib/transaction.ts`

---

## Próximos Passos para 90%

---

## 1. Unit Server (Falta pouco - ~1-2 dias)

### Arquivos Críticos a Testar

| Arquivo | Atual | Problema |
|---------|-------|----------|
| `server/db/schema/index.ts` | 0% | Barrel file - excluir de coverage |
| `server/db/schema/users.ts` | 40% | Lines 27-29 não cobertas |
| `server/db/schema/audit-logs.ts` | 50% | Lines 12-13 |
| `server/db/schema/user-accounts.ts` | 50% | Lines 11-14 |
| `server/db/schema/invitations.ts` | 60% | Lines 13-21 |
| `server/lib/password.ts` | 60% | Lines 99-150 (hashing avançado) |
| `server/lib/schema-helpers.ts` | 0% | Lines 5-11 |
| `server/routes/auth/test-login.ts` | 10% | Lines 58-145 (usado só em E2E) |
| `server/middleware/index.ts` | 0% | Barrel file - excluir |
| `server/services/index.ts` | 0% | Barrel file - excluir |
| `server/routes/index.ts` | 88% | Lines 17, 25 |

### Ações Recomendadas

1. **Excluir barrel files de cobertura** (`index.ts` que só exportam):
   ```typescript
   // vitest.config.ts - adicionar à coverage.exclude
   coverage: {
     exclude: [
       '**/index.ts', // apenas re-exports
       '**/types.ts',
       '**/__integration__/**',
     ]
   }
   ```

2. **Adicionar testes para `password.ts`** (linhas 99-150):
   - Testar `hashPasswordWithScrypt` e `verifyPasswordScrypt`
   - Testar cenários de erro de hashing

3. **Excluir `test-login.ts` de unit tests** (coberto por E2E):
   ```typescript
   exclude: ['**/test-login.ts']
   ```

4. **Testar `schema-helpers.ts`**:
   - Criar testes para `createSelectSchema` helper

**Estimativa:** Com exclusões + 3-4 novos testes = 90%+

---

## 2. Unit Client (Maior esforço - ~3-5 dias)

### Arquivos Críticos a Testar

| Arquivo | Atual | Gap |
|---------|-------|-----|
| `client/main.tsx` | 0% | Entry point - difícil testar, excluir |
| `client/router.ts` | 0% | Config - excluir |
| `client/routes/__root.tsx` | 33% | Lines 21-30 (Suspense/ErrorBoundary) |
| `client/routes/_authenticated.tsx` | 54% | Lines 39-64 (beforeLoad redirect) |
| `client/routes/invite.$token.tsx` | 56% | Lines 30-34, 39, 76, 154 |
| `client/routes/_authenticated/account.tsx` | 44% | Lines 200-335, 349-390 |
| `client/routes/_authenticated/team.tsx` | 48% | Lines 200-345, 368-381 |
| `client/routes/_authenticated/integrations.tsx` | 53% | Lines 301-409, 423-493 |
| `client/routes/_authenticated/settings.tsx` | 56% | Lines 39-45, 110, 293 |
| `client/components/ui/page-skeleton.tsx` | 8% | Lines 6-138 (loading states) |
| `client/components/ui/skeleton.tsx` | 0% | Line 7 |
| `client/components/ui/sonner.tsx` | 0% | Lines 7-9 |
| `client/components/ui/avatar.tsx` | 55% | Lines 49-70, 86 |
| `client/components/sidebar.tsx` | 77% | Lines 46-47, 84, 156-189 |

### Estratégia

1. **Excluir arquivos de configuração/entry**:
   ```typescript
   // vitest.config.frontend.ts
   coverage: {
     exclude: [
       '**/main.tsx',
       '**/router.ts',
       '**/routeTree.gen.ts',
     ]
   }
   ```

2. **Prioridade Alta - Páginas principais** (maior impacto):
   - `account.tsx` - Testar formulários de edição, avatar upload, danger zone
   - `team.tsx` - Testar invite modal, member list, role changes
   - `integrations.tsx` - Testar toggle states, webhook form
   - `settings.tsx` - Testar theme toggle, form submission

3. **Prioridade Média - Componentes UI**:
   - `page-skeleton.tsx` - Testar estados de loading
   - `skeleton.tsx` - Teste simples de renderização
   - `sonner.tsx` - Testar toast configurations
   - `avatar.tsx` - Testar fallback, image loading

4. **Prioridade Baixa - Routes framework**:
   - `__root.tsx` - Testar error boundary catch
   - `_authenticated.tsx` - Testar redirect logic

### Testes Necessários (Exemplo)

```typescript
// src/client/routes/_authenticated/__tests__/account-coverage.test.tsx
describe('Account Page Coverage', () => {
  describe('Avatar Upload', () => {
    it('should handle file selection')
    it('should show upload progress')
    it('should handle upload error')
    it('should update avatar on success')
  })

  describe('Profile Form', () => {
    it('should validate required fields')
    it('should submit profile changes')
    it('should handle server errors')
  })

  describe('Danger Zone', () => {
    it('should show confirmation dialog')
    it('should handle account deletion')
  })
})
```

---

## 3. Integration Tests (~2-3 dias)

### Arquivos Críticos

| Arquivo | Atual | Problema |
|---------|-------|----------|
| `server/env.ts` | 0% | Excluir (config) |
| `server/index.ts` | 0% | Entry point - excluir |
| `server/db/client.ts` | 0% | Database init - excluir |
| `server/db/seed.ts` | 0% | Script - excluir |
| `server/lib/providers.ts` | 0% | OAuth providers - testar |
| `server/lib/transaction.ts` | 0% | DB transactions - testar |
| `server/middleware/auth.ts` | 34% | Session validation - testar mais |
| `server/middleware/request-context.ts` | 9% | Context setup - testar |
| `server/routes/api.ts` | 0% | Swagger/OpenAPI - excluir |
| `server/routes/users/handlers.ts` | 68% | CRUD operations |
| `server/services/users.ts` | 68% | Lines 196, 226-301, 335 |
| `server/services/invitations.ts` | 80% | Lines 275-300 |

### Estratégia

1. **Excluir arquivos de setup/config**:
   ```typescript
   // vitest.config.ts para integration
   coverage: {
     exclude: [
       '**/env.ts',
       '**/index.ts',
       '**/client.ts',
       '**/seed.ts',
       '**/api.ts',
     ]
   }
   ```

2. **Testar middleware auth.ts** (34% → 90%):
   - Testar sessão expirada
   - Testar refresh token flow
   - Testar account switching

3. **Testar services/users.ts** (68% → 90%):
   - Testar `updateProfile` com avatar
   - Testar `deleteUser` cascade
   - Testar role changes

4. **Testar services/invitations.ts** (80% → 90%):
   - Testar invitation expiry
   - Testar resend invitation

---

## 4. E2E Tests (Cobertura Client - ~2-3 dias)

### Problema Principal

E2E coverage mostra:
- **Branches: 21%** - Muitos `if/else` não exercitados
- **Functions: 36%** - Event handlers não chamados

### Arquivos com Baixa Cobertura de Branches

| Diretório | Branches | Problema |
|-----------|----------|----------|
| `client/components/ui` | 10.34% | Conditional rendering |
| `client/routes/_authenticated` | 16.66% | Error/loading states |
| `client/routes` | 23.07% | Auth redirects |
| `client/hooks` | 38.46% | Edge cases |

### Testes E2E Necessários

1. **Error States** (aumenta branch coverage):
   - Testar páginas com API errors (mock 500)
   - Testar network failures
   - Testar validation errors em forms

2. **Loading States**:
   - Verificar skeletons durante loading
   - Testar slow network simulation

3. **Edge Cases em Forms**:
   - Submit com campos inválidos
   - Upload de arquivo muito grande
   - Caracteres especiais em inputs

4. **Conditional UI**:
   - Testar com/sem permissão de admin
   - Testar account sem membros
   - Testar empty states

### Exemplo de E2E para Coverage

```typescript
// e2e/coverage/error-states.spec.ts
test.describe('Error State Coverage', () => {
  test('should show error fallback on API failure', async ({ page }) => {
    await page.route('**/api/accounts/*', route =>
      route.fulfill({ status: 500, body: 'Server Error' })
    )
    await page.goto('/dashboard')
    await expect(page.getByText('Something went wrong')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  test('should handle network timeout', async ({ page }) => {
    await page.route('**/api/**', route => route.abort('timedout'))
    await page.goto('/settings')
    await expect(page.getByText('Network error')).toBeVisible()
  })
})
```

---

## 5. Resumo de Esforço

| Área | Ações | Estimativa |
|------|-------|------------|
| **Exclusões de coverage** | Adicionar index.ts, config files | 2h |
| **Unit Server** | 3-4 testes novos | 4h |
| **Unit Client** | 15-20 testes em 5 arquivos | 2-3 dias |
| **Integration** | 8-10 testes (auth, users, invitations) | 1-2 dias |
| **E2E** | 10-15 testes de error/edge cases | 2 dias |

### Priorização Recomendada

1. **Semana 1:**
   - Configurar exclusões de coverage (impacto imediato)
   - Unit Server → 90%
   - Começar Unit Client (páginas principais)

2. **Semana 2:**
   - Finalizar Unit Client
   - Integration tests
   - E2E error states

### Comandos de Verificação

```bash
# Verificar progresso
pnpm test:unit:server  # Meta: 90%+ em todos
pnpm test:unit:client  # Meta: 90%+ em todos
pnpm test:integration  # Meta: 90%+ em todos
pnpm test:e2e          # Meta: 90%+ em todos
```

---

## 6. Configurações Recomendadas

### vitest.config.ts (Server)

```typescript
coverage: {
  thresholds: {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90,
  },
  exclude: [
    '**/node_modules/**',
    '**/*.test.ts',
    '**/__tests__/**',
    '**/__integration__/**',
    '**/index.ts',        // barrel exports
    '**/env.ts',          // config
    '**/seed.ts',         // scripts
    '**/test-login.ts',   // dev only
  ]
}
```

### vitest.config.frontend.ts (Client)

```typescript
coverage: {
  thresholds: {
    statements: 85,
    branches: 85,
    functions: 60,  // Componentes têm muitas funções internas
    lines: 85,
  },
  exclude: [
    '**/main.tsx',
    '**/router.ts',
    '**/routeTree.gen.ts',
    '**/*.d.ts',
  ]
}
```
