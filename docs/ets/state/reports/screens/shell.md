# Auditoria de tela — Shell (`_authenticated`)

> **Rota:** `src/client/routes/_authenticated.tsx` + `src/client/components/sidebar.tsx` (AppSidebar) + override em `src/client/index.css`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código**.
> **Data:** 2026-06-24
> **Fidelidade:** 🟢 **84%** — o shell é o mais fiel ao Seven (Sidebar+Topbar+Inset corretos, ações ligadas). Gaps são de *superfície não usada* (TopbarTrailing, AccountSwitch), não de erro.
>
> Severidade: 🔴 alta · 🟡 média · 🔵 baixa · ⚪ layout/semântico

---

## 0. Elementos da tela
| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | Provider do shell | `@etus/seven-react` | `SidebarProvider` |
| 2 | Sidebar (rail colapsável) | `@etus/seven-react` | `Sidebar` + `SidebarHeader/Content/Group/Menu/Footer/Rail` |
| 3 | Área de conteúdo | `@etus/seven-react` | `SidebarInset` |
| 4 | Topbar | `@etus/seven-react` | `Topbar` + `TopbarLeading` |
| 5 | Toggle da sidebar | `@etus/seven-react` | `SidebarTrigger` |
| 6 | Breadcrumb | `@etus/seven-react` | `Breadcrumb` + `BreadcrumbList/Item/Page` |
| 7 | Card de conteúdo "tucked" | raw `<div>` | — (estética dual-demo) |
| 8 | User menu | `@etus/seven-react` | `DropdownMenu` + `Avatar` |

---

## 1. GAPS de componentes & sub-componentes
| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | Card de conteúdo cru | `<div className="rounded-tl-[24px] border bg-background p-8">` em vez de `SidebarInset` variant nativo | 🔵 | aceitável (replica o dual-demo); revisitar se Seven expor variant tucked |
| **C2** | Logo plate à mão | `<div className="… rounded-lg bg-primary …">` em vez dos tokens `--sidebar-logo-*` do Seven | 🟡 | usar os tokens de logo do sidebar (bg/fg/radius/size) |
| **C3** | Brand em `<span>` cru | `<span className="font-semibold">Hono</span>` | 🔵 | `Text`/`Heading` |

**Bem composto (não mexer):** `Sidebar` + todos os sub-componentes (`SidebarHeader/Content/Group/GroupLabel/GroupContent/Menu/MenuItem/MenuButton/Footer/Rail`), `SidebarMenuButton` com `asChild`/`isActive`/`tooltip`/`size`, `DropdownMenu` completo, `Avatar`+`AvatarImage`+`AvatarFallback`.

---

## 2. GAPS de emitters / interações
> Diferente das telas de conteúdo, **o shell TEM ações ligadas** — é o melhor da app nesse quesito.

| ID | Item | Status | Nota |
|---|---|---|---|
| ✅ | toggle sidebar (`SidebarTrigger`) | ligado | Seven cuida |
| ✅ | navegação (6 itens `Link` + `isActive`/`aria-current`) | ligado | correto |
| ✅ | ciclar tema (`onClick=cycleTheme`) | ligado | light→dark→system |
| ✅ | abrir user-menu (`DropdownMenuTrigger`) | ligado | |
| ✅ | sign out (`onClick=logout` + `disabled=isLoggingOut`) | ligado | |
| **E1** | trocar conta/workspace | ❌ ausente | app é multi-tenant mas o shell não expõe `AccountSwitch`/`WorkspaceDropdown` |
| **E2** | busca global | ❌ ausente | `TopbarTrailing` vazio |

---

## 3. GAPS de cores / tokens
| Elemento | Usa | Veredito |
|---|---|---|
| Topbar bg | `--topbar-root-background` (=surface, via componente) | ✅ (fix beta.3) |
| Sidebar bg | `--sidebar` (=surface) | ✅ |
| card de conteúdo | `bg-background` + `border` | ✅ |
| logo plate | `bg-primary` `text-primary-foreground` | ✅ tokens |
| texto secundário | `text-muted-foreground` | ✅ |
| *(nenhuma cor hardcoded)* | — | ✅ limpo |

---

## 4. GAPS de espaçamento
| Onde | Usa | Veredito |
|---|---|---|
| card de conteúdo | `p-8` (32px = `--spacing-8`) | 🟢 |
| `SidebarTrigger` | `-ml-1` (nudge -4px) | 🟢 |
| dropdown | `w-56` (224px, largura arbitrária) | 🔵 ⚪ |
| internos da sidebar | tokens `--sidebar-*` | ✅ |

---

## 5. GAPS de tipografia
| Elemento | Tela | Veredito |
|---|---|---|
| brand "Hono" | `font-semibold` (span cru) | 🔵 TY1 (=C3) |
| nome do user | `font-medium` | 🟡 deveria vir de `Text` |
| email/role | `text-xs text-muted-foreground` | 🟡 idem |
| breadcrumb | `font-semibold` (override em `BreadcrumbPage`) | 🔵 aditivo, ok |

---

## 6. GAPS de sizing / ícones
| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | ícones mistos | `size-4` (logo/chevron) vs ícones de nav (default do `SidebarMenuButton`) | 🔵 |
| **SZ2** | `size-8` no logo/avatar | consistente entre logo e avatar ✅ | — |

---

## 7. GAPS de estados
| Estado | Status | Nota |
|---|---|---|
| colapsado (icon rail) | ✅ `collapsible="icon"` + `group-data-[collapsible=icon]:hidden` | correto |
| ativo (nav) | ✅ `isActive` + `aria-current="page"` | correto |
| loading (logout) | ✅ `disabled={isLoggingOut}` | correto |
| pending (rota) | ✅ `AuthenticatedPendingComponent` → `PageSkeleton` | correto |
| erro (rota) | ✅ `AuthenticatedErrorComponent` → `ErrorFallback` | correto |

---

## 8. Consolidado — backlog priorizado
| Prioridade | IDs | Resumo |
|---|---|---|
| 🟡 **Should-fix** | E1, C2 | expor `AccountSwitch` (multi-tenant); logo via tokens `--sidebar-logo-*` |
| 🔵 **Nice-to-have** | E2, C1, C3, SZ1 | busca no `TopbarTrailing`; card tucked nativo; brand via `Text` |
| ⏸ **Bloqueado (Seven)** | borda | override em `index.css` aguarda `borderless` upstream |

**Pontos corretos:** Sidebar bem composta · Topbar=surface · ações ligadas · estados (active/loading/pending/error) cobertos.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

### 9.1 — Topbar
| Categoria | Disponível | Usado? |
|---|---|---|
| Slots | `TopbarLeading` | ✅ |
| Slots `[u]` | **`TopbarTrailing`** (busca, account, ações) | ❌ vazio |
| Variants `[u]` | `filters` (usa `default`) | ❌ |

### 9.2 — Breadcrumb
| Categoria | Disponível | Usado? |
|---|---|---|
| Usado | `BreadcrumbList` `BreadcrumbItem` `BreadcrumbPage` | ✅ |
| `[u]` | `BreadcrumbLink` · `BreadcrumbSeparator` · `BreadcrumbEllipsis` (hierarquia multinível) | ❌ só 1 nível |

### 9.3 — Sidebar
| Categoria | Disponível | Usado? |
|---|---|---|
| `[u]` componentes | **`AccountSwitch`** · **`WorkspaceDropdown`** (multi-tenant) | ❌ |
| `[u]` tokens logo | `--sidebar-logo-background/foreground/radius/size` | ❌ (plate à mão) |
| `[u]` sub-comp | `SidebarInput` (busca na sidebar) · `SidebarMenuBadge` · `SidebarMenuAction` · `SidebarSeparator` | ❌ |
| `[u]` modo | `mode="dual"` (rail+panel) | ❌ (usa single — correto p/ nav plana) |

### 9.4 — Conteúdo / textos
| Elemento | Componente `[u]` |
|---|---|
| brand `<span>` | `Text`/`Heading` |
| nome/email no footer | `Text` |

---

## 10. Ações possíveis do usuário (mapa completo)
> **6 de 9 ligadas** — o shell é a tela mais interativa da app.

| # | Ação | Gatilho | Status | Wire (Seven) |
|---|---|---|---|---|
| A1 | Colapsar/expandir sidebar | `SidebarTrigger` | ✅ ligada | nativo |
| A2 | Navegar (6 destinos) | `SidebarMenuButton`+`Link` | ✅ ligada | `isActive`/`aria-current` |
| A3 | Ciclar tema | footer `onClick` | ✅ ligada | light→dark→system |
| A4 | Abrir user-menu | `DropdownMenuTrigger` | ✅ ligada | |
| A5 | Sign out | `DropdownMenuItem onClick` | ✅ ligada | `disabled` em loading |
| A6 | Logo → dashboard | `Link` | ✅ ligada | |
| A7 | Trocar conta/workspace | — | 🔴 ausente | `AccountSwitch` no header/footer |
| A8 | Busca global | — | 🔴 ausente | `TextInput`/`SearchInput` no `TopbarTrailing` |
| A9 | Notificações | — | 🔵 ausente | `Button`+`Badge` no `TopbarTrailing` |

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)
> Legenda: ✅ token-backed · 🟢 value-aligned · 🟡 drift · 🔴 off-system · ⚪ layout.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `bg-primary` `text-primary-foreground` | `--primary` / `--primary-foreground` | ✅ |
| `text-muted-foreground` | `--muted-foreground` | ✅ |
| `bg-background` `border` | `--background` / `--border` | ✅ |
| *(zero hex/cor arbitrária)* | — | ✅ |

### 11.2 — Espaçamento
| Classe | Valor | Token equiv. | Veredito |
|---|---|---|---|
| `p-8` | 32px | `--spacing-8` | 🟢 |
| `-ml-1` | -4px | `--spacing-1` | 🟢 |
| `ml-auto` | auto | — | ⚪ |
| `w-56` | 224px | — (largura de dropdown) | 🔵 ⚪ |
| internos `--sidebar-*` | — | tokens | ✅ |

### 11.3 — Bordas & radius
| Classe | Resolve em | Veredito |
|---|---|---|
| `border` | `--border` | ✅ |
| `rounded-lg` (logo/avatar) | `--radius-lg` | ✅ |
| `rounded-tl-[24px]` (card) | arbitrário 24px (= o dual-demo do Seven usa o mesmo literal) | 🟡 fiel ao demo, mas não-tokenizado |

### 11.4 — Tipografia
| Classe | Veredito | Observação |
|---|---|---|
| `font-semibold` (brand, breadcrumb) | 🔵/🟡 | brand→`Text`; breadcrumb override aditivo ok |
| `font-medium` (nome user) | 🟡 | `Text` |
| `text-sm` `text-xs` | 🟡 | corpo→`Text` |
| `leading-tight` | 🟢 | == token |

### 11.5 — Sizing (ícones / dimensões)
| Classe | Valor | Veredito |
|---|---|---|
| `size-8` (logo plate, avatar) | 32px | 🟢 consistente |
| `size-4` (command, chevron) | 16px | 🔵 ok, menor que ícones de nav |
| `aspect-square` | — | ⚪ |
| `rotate-90` (chevron) | — | ⚪ decorativo, ok |

### 11.6 — Layout (⚪)
`flex` · `flex-1` · `grid` · `items-center` · `justify-center` · `overflow-auto` · `text-left` · `truncate` · `aspect-square` · `group-data-[collapsible=icon]:hidden`

### 11.7 — Veredito do estilo
| Classificação | Itens |
|---|---|
| ✅ token-backed | todas as cores, `border`, `rounded-lg` |
| 🟢 value-aligned | `p-8`, `-ml-1`, `leading-tight`, `size-8` |
| 🟡 drift | `rounded-tl-[24px]`, `font-medium`, `text-sm/xs` |
| 🔴 off-system | **nenhum** |

> **Conclusão de estilo:** o shell é **100% token-limpo** — zero off-system. Os 🟡 são radius arbitrário (espelha o demo do Seven) + drift de tipografia. É a tela mais fiel da app.

---

### Linha do coverage-matrix (índice)
```yaml
shell:
  route: src/client/routes/_authenticated.tsx
  also: [src/client/components/sidebar.tsx, src/client/index.css]
  fidelity: 0.84
  components_used: [SidebarProvider, Sidebar, SidebarInset, Topbar, TopbarLeading, SidebarTrigger, Breadcrumb, DropdownMenu, Avatar]
  components_missing: [TopbarTrailing, AccountSwitch, WorkspaceDropdown, BreadcrumbLink, SidebarInput]
  gaps:
    components: [C1, C2, C3]
    emitters:   [E1, E2]
    sizing:     [SZ1]
  user_actions: { total: 9, wired: 6, unwired: [A7, A8, A9] }
  style_audit:
    off_system: []          # shell 100% token-limpo
    drift: [rounded-tl-[24px], font-medium, text-sm, text-xs]
    hardcoded_colors: 0
  blocked: [sidebar-borderless-upstream]   # override em index.css aguarda Seven
  severity: { high: 0, medium: 3, low: 5 }
```
