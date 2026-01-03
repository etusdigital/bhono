# Plano de Melhoria de Cobertura de Testes v2

## Estado Atual (Após Sprint 1)

| Suite | Statements | Branches | Functions | Lines | Status |
|-------|------------|----------|-----------|-------|--------|
| **Unit Server** | 93.56% (90%) | **83.01% (84%)** | 95.51% (85%) | 93.87% (90%) | ❌ -0.99% branches |
| **Unit Client** | 90.82% (65%) | 87.82% (70%) | 96.87% (58%) | 91.97% (67%) | ✅ |
| **Integration** | 93.27% (90%) | 85.04% (80%) | 92.48% (90%) | 93.59% (90%) | ✅ |
| **E2E** | 51.39% (90%) | 9.79% (84%) | 16.84% (85%) | — (90%) | ❌ Gap enorme |

---

## Fase 1: Unit Server - Fechar Gap de Branches (0.99%)

### Análise de Branches Descobertos

| Arquivo | Branches | Linhas | Cenário Não Coberto |
|---------|----------|--------|---------------------|
| `lib/session.ts` | 78.04% | 159-160 | Cookie jar com cookies |
| `routes/invitations/handlers.ts` | 56.25% | 18,38,51,65 | Erros de contexto e DB |
| `routes/users/handlers.ts` | 71.42% | 181-202,215 | Erros de update/delete |
| `routes/auth/handlers.ts` | 71.05% | 11,137,156,199 | Erros de OAuth |
| `routes/accounts/handlers.ts` | 80% | — | Erros de update |
| `routes/audits/handlers.ts` | 80% | 17 | Erro de DB |
| `routes/storage/handlers.ts` | 77.77% | 22,45 | Erros de upload |
| `routes/storage/index.ts` | 75% | 34 | Branch de export |
| `routes/health/handlers.ts` | 83.33% | 9,24,77 | Health check errors |
| `services/auth.ts` | 73.91% | 202-213 | User not found |
| `services/users.ts` | 75% | 196,335 | Edge cases |
| `middleware/cors.ts` | 83.33% | 19 | Origin not allowed |

### Tarefas Fase 1 (Impacto: +1-2% branches)

#### 1.1 Expandir `session.test.ts` - Branches de cookies

```typescript
// Cenário: Cookie jar com cookies definidos durante a request
it('sets cookies from cookie jar after request', async () => {
  // Simular middleware que adiciona cookies ao jar
  // Verificar que Set-Cookie headers são aplicados
})
```

**Arquivo:** `src/server/lib/session.test.ts`
**Linhas a cobrir:** 159-160

#### 1.2 Expandir testes de handlers - Erro paths

**invitations/handlers.ts (56.25% → 84%)**
```typescript
// Linhas 17-18: !accountId || !user
it('returns 500 when accountId missing', async () => {
  // Mock context without accountId
})

// Linhas 37-38, 50-51, 64-65: !db
it('returns 500 when db not initialized', async () => {
  // Mock context without db
})
```

**users/handlers.ts (71.42% → 84%)**
```typescript
// Linhas 181-202: updateUserHandler error paths
it('returns 404 when user to update not found', async () => {})
it('returns 403 when updating another user without permission', async () => {})

// Linha 215: deleteUserHandler
it('returns 404 when user to delete not found', async () => {})
```

**auth/handlers.ts (71.05% → 84%)**
```typescript
// Linha 11: missing state
it('returns 400 when OAuth state missing', async () => {})
// Linha 137: provider error
it('handles OAuth provider error', async () => {})
// Linha 156: user creation failure
it('handles user creation failure', async () => {})
// Linha 199: session creation failure
it('handles session creation failure', async () => {})
```

#### 1.3 Expandir services - Error paths

**services/auth.ts (73.91% → 84%)**
```typescript
// Linhas 202-213: getCurrentUser quando user não existe
it('throws UnauthorizedError when user not found', async () => {
  // Query returns empty
})
it('throws UnauthorizedError when user is deleted', async () => {
  // Query returns user with deletedAt set
})
```

**services/users.ts (75% → 84%)**
```typescript
// Linha 196: edge case em update
it('handles update with no changes', async () => {})
// Linha 335: edge case em query
it('handles empty result set', async () => {})
```

---

## Fase 2: E2E - Fechar Gap Massivo

### Análise Detalhada por Arquivo

| Diretório/Arquivo | Statements | Branches | Functions | Ação Prioritária |
|-------------------|------------|----------|-----------|------------------|
| **components/** | | | | |
| `sidebar.tsx` | 19.44% | 0% | 0% | **Alta** - Testar navegação |
| `icons.tsx` | 80% | 100% | 50% | Baixa - Já ok |
| **routes/** | | | | |
| `_authenticated.tsx` | 27.77% | 14.28% | 0% | **Alta** - Testar layout autenticado |
| `__root.tsx` | 50% | 37.5% | 16.66% | **Alta** - Testar error boundary |
| `$.tsx` | 100% | 16.66% | 0% | Média - 404 page |
| `index.tsx` | 100% | 16.66% | 0% | Baixa - Landing page |
| **routes/_authenticated/** | | | | |
| `account.tsx` | ~80% | ~17% | 0% | **Alta** - Funções não testadas |
| `team.tsx` | ~80% | ~17% | 0% | **Alta** - CRUD membros |
| `settings.tsx` | ~82% | ~95% | 0% | Média |
| `integrations.tsx` | ~85% | ~85% | 0% | Média |
| `dashboard.tsx` | 100% | 100% | 100% | ✅ |
| **hooks/** | | | | |
| `use-auth.ts` | 61.4% | 29.41% | 58.82% | **Alta** - Estados de auth |
| `use-theme.tsx` | 61.4% | 29.41% | 58.82% | Média - Toggle theme |
| **components/ui/** | | | | |
| Various | 47.12% | 2.38% | 9.67% | Média - Interações UI |

### Estratégia E2E: Priorização por Impacto

O E2E cobre **apenas código client** via Istanbul. Para maximizar cobertura:

#### Prioridade 1: Arquivos com 0% functions (maior impacto)

1. **`sidebar.tsx`** - 0% functions, 0% branches
   - Cada click em nav item cobre uma função
   - Testar: expand/collapse, navegação, active state

2. **`_authenticated.tsx`** - 0% functions
   - Layout wrapper - cada render cobre funções
   - Testar: loading state, error state, auth redirect

3. **`account.tsx`** - 0% functions
   - CRUD de conta - cada operação cobre função
   - Testar: create, switch, delete account

4. **`team.tsx`** - 0% functions
   - Gerenciamento de membros
   - Testar: invite, remove, change role

#### Prioridade 2: Hooks com baixa cobertura

5. **`use-auth.ts`** - 58.82% functions
   - Testar estados: loading, authenticated, unauthenticated, error
   - Testar: logout, refresh

6. **`use-theme.tsx`** - 58.82% functions
   - Testar: toggle, persist preference

### Testes E2E a Criar/Expandir

#### 2.1 `tests/e2e/navigation/sidebar.spec.ts` (Expandir)

```typescript
describe('Sidebar Navigation', () => {
  describe('Desktop', () => {
    test('navigates to all main routes', async ({ authedPage }) => {
      // Click each nav item, verify URL and content
      // Covers: sidebar.tsx functions
    })

    test('shows active state for current route', async ({ authedPage }) => {
      // Navigate and verify active styling
      // Covers: sidebar.tsx branches
    })

    test('expands/collapses sidebar', async ({ authedPage }) => {
      // Toggle sidebar state
      // Covers: sidebar.tsx state functions
    })
  })

  describe('Mobile', () => {
    test('@mobile opens/closes mobile menu', async ({ page }) => {
      // Test hamburger menu
      // Covers: sidebar.tsx mobile branches
    })
  })
})
```

**Impacto estimado:** +15% statements, +10% functions

#### 2.2 `tests/e2e/auth/auth-states.spec.ts` (Novo)

```typescript
describe('Authentication States', () => {
  test('shows loading state while checking auth', async ({ page }) => {
    // Intercept auth check, verify loading UI
    // Covers: use-auth.ts loading branch
  })

  test('redirects to login when unauthenticated', async ({ page }) => {
    // Clear auth, navigate to protected route
    // Covers: _authenticated.tsx redirect
  })

  test('shows authenticated content when logged in', async ({ authedPage }) => {
    // Verify dashboard loads
    // Covers: _authenticated.tsx success path
  })

  test('handles auth error gracefully', async ({ page }) => {
    // Mock auth error, verify error UI
    // Covers: use-auth.ts error branch
  })
})
```

**Impacto estimado:** +10% statements, +15% branches

#### 2.3 `tests/e2e/features/account-management.spec.ts` (Expandir)

```typescript
describe('Account Management', () => {
  test('creates new account', async ({ authedPage }) => {
    // Fill form, submit, verify created
    // Covers: account.tsx create functions
  })

  test('switches between accounts', async ({ authedPage }) => {
    // Click account switcher, select different
    // Covers: account.tsx switch functions
  })

  test('edits account details', async ({ authedPage }) => {
    // Update name/slug, verify saved
    // Covers: account.tsx edit functions
  })

  test('deletes account with confirmation', async ({ authedPage }) => {
    // Delete flow with confirmation dialog
    // Covers: account.tsx delete branches
  })
})
```

**Impacto estimado:** +8% statements, +10% functions

#### 2.4 `tests/e2e/features/team-management.spec.ts` (Expandir)

```typescript
describe('Team Management', () => {
  test('invites new team member', async ({ authedPage }) => {
    // Open dialog, fill email, send invite
    // Covers: team.tsx invite functions
  })

  test('changes member role', async ({ authedPage }) => {
    // Select member, change role dropdown
    // Covers: team.tsx role change branches
  })

  test('removes team member', async ({ authedPage }) => {
    // Remove with confirmation
    // Covers: team.tsx remove functions
  })

  test('shows pagination for large teams', async ({ authedPage }) => {
    // Navigate pages
    // Covers: team.tsx pagination branches
  })
})
```

**Impacto estimado:** +8% statements, +8% functions

#### 2.5 `tests/e2e/features/theme-toggle.spec.ts` (Novo)

```typescript
describe('Theme Toggle', () => {
  test('toggles between light and dark mode', async ({ authedPage }) => {
    // Click theme button, verify class changes
    // Covers: use-theme.tsx toggle function
  })

  test('persists theme preference', async ({ authedPage, context }) => {
    // Toggle, reload, verify persisted
    // Covers: use-theme.tsx localStorage branches
  })

  test('respects system preference initially', async ({ authedPage }) => {
    // Set prefer-color-scheme, verify initial state
    // Covers: use-theme.tsx system detection
  })
})
```

**Impacto estimado:** +5% statements, +5% branches

#### 2.6 `tests/e2e/errors/error-boundary.spec.ts` (Expandir)

```typescript
describe('Error Boundary', () => {
  test('catches render errors and shows fallback', async ({ authedPage }) => {
    // Trigger component error
    // Covers: __root.tsx error boundary
  })

  test('allows retry after error', async ({ authedPage }) => {
    // Click retry button
    // Covers: error-fallback.tsx retry function
  })

  test('shows 404 page for unknown routes', async ({ authedPage }) => {
    // Navigate to /unknown-route
    // Covers: $.tsx not found page
  })
})
```

**Impacto estimado:** +5% statements, +10% branches

---

## Fase 3: UI Components (Bonus)

Se após Fase 2 ainda não atingir 90%, adicionar:

#### 3.1 `tests/e2e/components/dialog.spec.ts`

```typescript
describe('Dialog Component', () => {
  test('opens and closes via button', async ({ authedPage }) => {})
  test('closes on escape key', async ({ authedPage }) => {})
  test('closes on overlay click', async ({ authedPage }) => {})
  test('traps focus inside dialog', async ({ authedPage }) => {})
})
```

#### 3.2 `tests/e2e/components/form-validation.spec.ts`

```typescript
describe('Form Validation', () => {
  test('shows inline validation errors', async ({ authedPage }) => {})
  test('disables submit when invalid', async ({ authedPage }) => {})
  test('clears errors on valid input', async ({ authedPage }) => {})
})
```

---

## Resumo de Impacto Estimado

### Unit Server

| Tarefa | Branches Atual | Branches Esperado | Gap Fechado |
|--------|----------------|-------------------|-------------|
| session.ts cookies | 78.04% | 90% | +12% arquivo |
| invitations handlers | 56.25% | 85% | +29% arquivo |
| users handlers | 71.42% | 85% | +14% arquivo |
| auth handlers | 71.05% | 85% | +14% arquivo |
| services/auth | 73.91% | 85% | +11% arquivo |
| **Total Geral** | **83.01%** | **~85%** | **+2%** |

### E2E

| Tarefa | Statements | Branches | Functions |
|--------|------------|----------|-----------|
| Sidebar navigation | +15% | +10% | +10% |
| Auth states | +10% | +15% | +8% |
| Account management | +8% | +10% | +10% |
| Team management | +8% | +8% | +8% |
| Theme toggle | +5% | +5% | +5% |
| Error boundary | +5% | +10% | +5% |
| **Total Estimado** | **+51%** | **+58%** | **+46%** |
| **Projeção Final** | **~102%** | **~68%** | **~63%** |

**Nota:** As projeções de E2E são otimistas. Branches em E2E é difícil de atingir 84% porque muitos branches são condições internas de React/libs que não são facilmente exercitados por testes de UI.

---

## Plano de Execução

### Sprint 2: Unit Server Branches (Imediato)

| # | Tarefa | Arquivo de Teste | Casos |
|---|--------|------------------|-------|
| 1 | Expandir session.ts | `lib/session.test.ts` | 2-3 |
| 2 | Expandir invitations handlers | `routes/invitations/__tests__/handlers.test.ts` | 4-5 |
| 3 | Expandir users handlers | `routes/users/__tests__/handlers.test.ts` | 3-4 |
| 4 | Expandir auth handlers | `routes/auth/__tests__/handlers.test.ts` | 4-5 |
| 5 | Expandir services/auth | `services/__tests__/auth.test.ts` | 2-3 |

**Meta:** 83.01% → 84%+ branches

### Sprint 3: E2E Core (Após Sprint 2)

| # | Tarefa | Arquivo de Teste | Casos |
|---|--------|------------------|-------|
| 1 | Sidebar navigation | `navigation/sidebar.spec.ts` | 6-8 |
| 2 | Auth states | `auth/auth-states.spec.ts` | 4-5 |
| 3 | Account management | `crud/account.spec.ts` | 5-6 |
| 4 | Team management | `crud/team.spec.ts` | 5-6 |

**Meta:** 51% → 75%+ statements

### Sprint 4: E2E Polishing

| # | Tarefa | Arquivo de Teste | Casos |
|---|--------|------------------|-------|
| 1 | Theme toggle | `features/theme-toggle.spec.ts` | 3-4 |
| 2 | Error boundary | `errors/error-boundary.spec.ts` | 3-4 |
| 3 | UI components | Various | 8-10 |

**Meta:** 75% → 90%+ statements

---

## Configuração Atualizada

### `.nycrc.json` (E2E Thresholds)

```json
{
  "check-coverage": true,
  "lines": 90,
  "statements": 90,
  "branches": 84,
  "functions": 85,
  "include": ["src/client/**/*.{ts,tsx}"],
  "exclude": [
    "**/*.test.*",
    "**/__tests__/**",
    "**/routeTree.gen.ts",
    "**/main.tsx"
  ]
}
```

### Verificação de Progresso

```bash
# Unit Server
pnpm test:unit:server 2>&1 | grep "All files"

# E2E
pnpm test:e2e:coverage 2>&1 | grep -E "(All files|ERROR)"
```

---

## Métricas de Sucesso

### Checkpoint 1 (Após Sprint 2)
- [ ] Unit Server: 84%+ branches ✅
- [ ] Todos os testes passando

### Checkpoint 2 (Após Sprint 3)
- [ ] E2E: 75%+ statements
- [ ] E2E: 50%+ branches

### Checkpoint 3 (Final)
- [ ] E2E: 90%+ statements
- [ ] E2E: 84%+ branches
- [ ] E2E: 85%+ functions
- [ ] Todos os thresholds atingidos

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| E2E branches difícil de atingir 84% | Alta | Considerar reduzir threshold para 70% |
| Testes E2E flaky | Média | Usar retry, web-first assertions |
| Cobertura não reflete qualidade | Média | Focar em paths críticos, não apenas números |

---

## Decisão Necessária

**Pergunta:** O threshold de branches para E2E (84%) pode ser muito agressivo dado que:
1. Muitos branches são internos de React/libs
2. Condições de erro são difíceis de simular em E2E
3. Cobertura atual é apenas 9.79%

**Opções:**
1. Manter 84% e aceitar que pode demorar mais
2. Reduzir para 70% inicialmente, aumentar gradualmente
3. Remover threshold de branches para E2E, focar em statements/functions
