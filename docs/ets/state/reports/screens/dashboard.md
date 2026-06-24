# Auditoria de tela — Dashboard

> **Rota:** `src/client/routes/_authenticated/dashboard.tsx`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código** (source: exports, `*.variants.ts`, `*.types.ts`, tokens). Sem render/Figma.
> **Data:** 2026-06-23
> **Fidelidade:** 🟡 **68%** — usa os componentes certos, mas perde emitters/estados e tem tipografia/empty-state crus.
>
> Severidade: 🔴 alta (quebra DS ou UX) · 🟡 média (foge do DS, funciona) · 🔵 baixa (polish)

---

## 0. Elementos da tela (o que está renderizado)

| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | 4× stat card | `@etus/seven-react` | `DashboardCard` |
| 2 | 3× quick-action card | `@etus/seven-react` | `Card` (+ `CardHeader/CardTitle/CardDescription/CardContent`) |
| 3 | 1× recent-activity card | `@etus/seven-react` | `Card` + empty-state interno cru |
| 4 | título "Welcome back" | raw `<h1>` | — |
| 5 | subtítulos/parágrafos | raw `<p>` | — |
| 6 | ícones | `@/components/icons` (lucide) | — (convenção do projeto, ok) |

---

## 1. GAPS de componentes & sub-componentes

| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | Empty-state à mão | `Recent Activity` usa `<div className="… rounded-md border border-dashed">` em vez de `EmptyState` (existe no beta.4) | 🟡 | trocar por `<EmptyState title icon description action>` |
| **C2** | Tipografia em HTML cru | `<h1>` e `<p>` em vez de `Heading` / `Text`·`Paragraph` (todos exportados) | 🟡 | `Heading` no título, `Text` nos parágrafos |
| **C3** | Quick-action sem slot de ação | `Card` usa só `CardHeader/Content`; **não** usa `CardAction` nem `CardFooter` — os sub-componentes próprios pra botão/CTA | 🔴 | ver E1 |
| **C4** | `DashboardCard` sub-componentes compostos não usados | há `DashboardCardHeader/Title/Value/Content/Footer` pra composição custom; a tela usa só a forma "props" (ok, mas limita badge/cta) | 🔵 | ok manter props; ciente da via composta |

**Sub-componentes do `Card` disponíveis e NÃO usados:** `CardMedia`, `CardAction`, `CardFooter`.

---

## 2. GAPS de emitters / interações (callbacks, CTA, handlers)

> A tela inteira é **estática — zero `onClick`/`href`/handler**. Vários cards *descrevem ações* mas não disparam nada.

| ID | Emitter/ação ausente | Onde | Sev. | Correção |
|---|---|---|---|---|
| **E1** | Cards de ação sem ação | "Invite Team Members" / "Database" / "Security" dizem *"Add collaborators…"*, *"Use the API to send invitations"* — mas **não há botão/link**. UI morta. | 🔴 | `CardAction` ou `CardFooter` com `Button` (ex.: "Convidar", "Abrir") |
| **E2** | `DashboardCard.ctaLink` / `ctaText` / `ctaDescription` não usados | stats não navegáveis (ex.: "Total Users" → `/team`) | 🟡 | passar `ctaLink="/team"` `ctaText="Ver equipe"` |
| **E3** | `DashboardCard.loading` não usado | sem skeleton durante fetch (o componente tem estado de loading nativo) | 🟡 | `loading={isLoading}` |
| **E4** | `DashboardCard.badge` não usado | sem indicador de tendência/delta (ex.: "+12%") | 🔵 | `badge={<Badge>+12%</Badge>}` |
| **E5** | Valores hardcoded | `value="0"`, `"1"`, `"100%"` são **literais**, não ligados a dados reais | 🔴 | ligar a query real (fora de DS, mas é gap funcional — Regra 6) |

---

## 3. GAPS de cores / tokens

| Elemento | Usa | Token Seven? | Veredito |
|---|---|---|---|
| `DashboardCard` bg | `bg-card` (interno do componente) | ✅ `--card-root-background` | ✅ |
| `Card` bg/borda/sombra | tokens internos `--card-root-*`, `--border` | ✅ | ✅ |
| texto secundário | `text-muted-foreground` | ✅ `--muted-foreground` | ✅ |
| título h1 | sem cor (herda `--foreground`) | parcial | 🔵 ok, mas via `Heading` ficaria explícito |
| **empty-state** | `border-dashed` | ❌ sem token; tracejado não é padrão Seven | 🟡 **CL1** — resolver via `EmptyState` (C1) |

→ Cores estão **majoritariamente corretas** (herdadas dos componentes). Único ponto cru: o `border-dashed` do empty-state.

---

## 4. GAPS de espaçamento

| Onde | Usa | Tipo | Veredito |
|---|---|---|---|
| wrapper da página | `space-y-8` (32px) | layout de página (raw Tailwind) | ✅ aceitável |
| grids | `gap-4` (16px) | layout (raw) | ✅ aceitável |
| **ritmo inconsistente** | `space-y-8` (32) vs `gap-4` (16) na mesma tela | — | 🔵 **SP1** padronizar o ritmo vertical |
| interno dos cards | `--card-root-padding-y`, `--card-root-gap`, `--card-header-gap` etc. | tokens Seven (não sobrescritos) | ✅ correto |
| `DashboardCard` padding | `p-6` (size=md default) | token de size do componente | ✅ |

→ Espaçamento **interno** dos componentes vem certo dos tokens. Só o **ritmo de layout da página** é cru e levemente inconsistente.

---

## 5. GAPS de tipografia

| Elemento | Tela | Seven esperado | Sev. |
|---|---|---|---|
| título h1 | `text-2xl font-semibold tracking-tight` (escala Tailwind solta) | `Heading` (tokens de tipografia) | 🟡 **TY1** (= C2) |
| parágrafos | `<p className="text-sm text-muted-foreground">` | `Text`/`Paragraph` | 🟡 **TY2** (= C2) |
| `CardTitle` | sobrescrito com `flex items-center gap-2` p/ ícone inline | `CardTitle` usa `[font-weight:var(--card-title-weight)]`; override é aditivo | 🔵 ok, mas o ícone altera a baseline do título |
| valores stat | herdam `text-xl font-semibold tabular-nums` do `DashboardCard` | — | ✅ |

> Nota: o guard-rail do ESLint **não** bane `h1/p` (só `button/input/select/textarea`) — passa o lint, mas é drift de DS.

---

## 6. GAPS de sizing / ícones

| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | Tamanho de ícone inconsistente | `DashboardCard` icon = `size-4` (16px); `CardTitle` icon = `h-5 w-5` (20px) | 🔵 |
| **SZ2** | Convenção de utilitário mista | `size-4` vs `h-5 w-5` na mesma tela | 🔵 padronizar p/ `size-*` |

---

## 7. GAPS de estados

| Estado | Tela | Seven oferece | Sev. |
|---|---|---|---|
| loading | ❌ ausente | `DashboardCard.loading` | 🟡 **ST1** (= E3) |
| hover/clicável | ❌ cards parecem clicáveis mas não são | `Card variant="selectable"` / `CardAction` | 🟡 **ST2** |
| empty | 🟡 presente, porém cru | `EmptyState` | 🟡 **ST3** (= C1) |
| erro | n/a nesta tela | — | — |

---

## 8. Consolidado — backlog priorizado

| Prioridade | IDs | Resumo |
|---|---|---|
| 🔴 **Must-fix** | C3·E1, E5 | cards de ação sem botão (UI morta); valores hardcoded |
| 🟡 **Should-fix** | C1·ST3, C2·TY1·TY2, E2, E3·ST1 | empty-state→`EmptyState`; tipografia→`Heading`/`Text`; CTA nos stats; loading |
| 🔵 **Nice-to-have** | E4, SP1, SZ1, SZ2 | badge de tendência; ritmo de espaçamento; padronizar ícones |

**Pontos corretos (não mexer):** `DashboardCard` com API certa · `Card` + composição · cores/tokens internos · padding/gap internos via token.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

> Inventário completo do que o Seven oferece e a tela **não** aproveita — props, variants, sub-componentes, estados e **componentes alternativos**. `[u]` = não usado.

### 9.1 — Stat cards (hoje `DashboardCard`)
| Categoria | Disponível no Seven | Usado? |
|---|---|---|
| Props | `title` `value` `valueDescription` `icon` | ✅ usados |
| Props `[u]` | `badge` · `ctaText` · `ctaLink` · `ctaDescription` · `loading` · `children` | ❌ |
| Variants `[u]` | `ghost` · `outline` · `elevated` (usa `default`) | ❌ |
| Sizes `[u]` | `sm` · `lg` (usa `md`) | ❌ |
| Sub-componentes compostos `[u]` | `DashboardCardHeader/Title/Value/Content/Footer` | ❌ |
| **Componente alternativo `[u]`** | **`KPICard`** — `delta` `deltaLabel` `trend(up/down/neutral)` `featuredIcon` `helpText` `progressBar` `sparkline` `swap` `dropdownIcon` `action` `showBadge` `loading` | ❌ nunca considerado |
| **Componente alternativo `[u]`** | **`SingleStat`** — count-up `animated`/`animationDuration`, variants `compact/inline/default`, sizes `xs→xl` | ❌ |

### 9.2 — Quick-action cards (hoje `Card`)
| Categoria | Disponível | Usado? |
|---|---|---|
| Sub-componentes usados | `CardHeader` `CardTitle` `CardDescription` `CardContent` | ✅ |
| Sub-componentes `[u]` | `CardMedia` · `CardAction` · `CardFooter` | ❌ |
| Variants `[u]` | `elevated` · `outlined` · `ghost` · `selectable` (usa `default`) | ❌ |
| Estados `[u]` (variant `selectable`) | `data-active` · `data-selected` · hover-lift · ring | ❌ |
| **Faltando p/ ação** | `Button` (variants/sizes/`badge`/`asChild`/emitters) dentro de `CardAction`/`CardFooter` | ❌ |

### 9.3 — Recent activity (hoje `Card` + `<div>` cru)
| Categoria | Disponível | Usado? |
|---|---|---|
| Empty | **`EmptyState`** (+ slot de `action`) | ❌ (div cru) |
| **Render real de atividade `[u]`** | **`Feed`** · **`Timeline`** · **`List`** (data-display) | ❌ nunca considerado |

### 9.4 — Título / textos (hoje `<h1>` / `<p>` crus)
| Elemento | Componente Seven `[u]` | Eixos não aproveitados |
|---|---|---|
| `<h1>` | **`Heading`** | `level(1-6)` · `size` · `weight` · `align` · `color` · `gradient` |
| `<p>` | **`Text`** / **`Paragraph`** | variants de tamanho/cor/peso |

### 9.5 — Layout da página (hoje `<div>` + grid cru)
| Disponível `[u]` | Uso |
|---|---|
| `Section` · `Container` · `Grid` · `Stack` · `Flex` | estruturariam a página com tokens de espaçamento em vez de `space-y-8`/`grid` crus |

---

## 10. Ações possíveis do usuário (mapa completo)

> Toda ação que o usuário **poderia** executar nesta tela, o gatilho, o status atual e o primitivo Seven que a ligaria.
> **Resultado: 0 de 8 ações estão ligadas — a tela é puramente informativa.**

| # | Ação possível | Gatilho (elemento) | Status | Como ligar (Seven) |
|---|---|---|---|---|
| A1 | Abrir fluxo de convite | card "Invite Team Members" | 🔴 não-ligada (sem botão) | `CardAction` + `Button onClick` → modal/`/team` |
| A2 | Abrir config de banco | card "Database" | 🔴 não-ligada | `CardFooter` + `Button asChild` (link) |
| A3 | Abrir config de segurança | card "Security" | 🔴 não-ligada | `CardFooter` + `Button` |
| A4 | Drill-down num stat | stat card (ex.: Total Users → /team) | 🔴 não-ligada | `DashboardCard ctaLink/ctaText` **ou** `Card variant="selectable" onClick` |
| A5 | Ver/atualizar atividade recente | header do card "Recent Activity" | 🔴 não-ligada (sem controle) | `CardAction` + `Button` ("Ver tudo" / refresh) |
| A6 | Ação no estado vazio | bloco "No recent activity" | 🔴 não-ligada (div cru) | `EmptyState` com slot `action` (`Button`) |
| A7 | Foco/teclado em cards interativos | cards | ⚪ n/a (nada interativo) | vem de graça com `Button`/`selectable` (`onKeyDown`/`onFocus`) |
| A8 | Skeleton durante carregamento | stats + cards | 🔴 não-ligada | `DashboardCard loading` / `KPICard loading` / `SkeletonLoader` |

**Emitters do `Button` disponíveis quando as ações forem ligadas:** `onClick` · `onFocus` · `onBlur` · `onKeyDown` (payload `ButtonEventPayload`: `id`, `isLoading`, `timestamp`).

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)

> **Toda** classe literal da tela, classificada contra os tokens do Seven. Legenda:
> ✅ **token-backed** (resolve num token Seven) · 🟢 **value-aligned** (utilitário Tailwind cujo valor == token Seven; não referencia o token, mas não diverge) · 🟡 **drift** (cru onde um componente/token Seven deveria mandar) · 🔴 **off-system** (sem token equivalente) · ⚪ layout (estrutural, sem token de design)
>
> Nota-chave: a escala de spacing do Seven **espelha a do Tailwind** (`--spacing-4`=16px=`gap-4`; `--spacing-8`=32px=`space-y-8`), e `--font-tracking-tight`=`tracking-tight`=-0.025em. Por isso muito "cru" é 🟢, não violação.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `text-muted-foreground` (×3) | `--muted-foreground` | ✅ |
| bg/borda/sombra dos cards | tokens internos (`--card-root-*`, `--border`) | ✅ |
| *(nenhuma cor hardcoded — `text-*-500`, hex, `bg-gray-*` etc.)* | — | ✅ limpo |

### 11.2 — Espaçamento
| Classe | Valor | Token Seven equiv. | Veredito |
|---|---|---|---|
| `space-y-8` | 32px | `--spacing-8` | 🟢 |
| `gap-4` (×2) | 16px | `--spacing-4` | 🟢 |
| `gap-2` (×2) | 8px | `--spacing-2` | 🟢 |
| padding/gap internos dos cards | — | `--card-*` | ✅ |

### 11.3 — Bordas & radius
| Classe | Resolve em | Veredito |
|---|---|---|
| `border` | `--border` (cor) | ✅ |
| `rounded-md` | `--radius-md` (8px, Seven) | ✅ |
| **`border-dashed`** | — (estilo tracejado; Seven não tem token nem padrão) | 🔴 **único off-system real** |

### 11.4 — Tipografia
| Classe | Valor | Veredito | Observação |
|---|---|---|---|
| `text-2xl` | 1.5rem | 🟡 | título deveria vir do `Heading` (token semântico) |
| `font-semibold` | 600 | 🟡 | idem (peso do `Heading`) |
| `tracking-tight` | -0.025em | 🟢 | valor == `--font-tracking-tight`, mas via var Tailwind |
| `text-sm` (×3) | 0.875rem | 🟡 | corpo deveria vir do `Text`/`Paragraph` |

### 11.5 — Sizing (ícones / dimensões)
| Classe | Valor | Veredito |
|---|---|---|
| `size-4` | 16px | 🟡 inconsistente c/ `h-5 w-5` |
| `h-5 w-5` | 20px | 🟡 inconsistente c/ `size-4`; convenção mista |
| `h-32` | 128px (= `--spacing-32`) | 🟢 valor alinhado, porém altura arbitrária do empty-state (some com `EmptyState`) |

### 11.6 — Layout (⚪ sem token de design — ok)
`grid` · `flex` · `items-center` · `items-baseline` · `justify-between` · `justify-center` · `md:grid-cols-2` · `lg:grid-cols-4` · `lg:grid-cols-3`

### 11.7 — Veredito do estilo
| Classificação | Qtde | Itens |
|---|---|---|
| ✅ token-backed | 3 famílias | cores, `border`, `rounded-md` |
| 🟢 value-aligned | 6 | `space-y-8`, `gap-4`, `gap-2`, `tracking-tight`, `h-32` |
| 🟡 drift (tipografia/sizing) | 5 | `text-2xl`, `font-semibold`, `text-sm`, `size-4`, `h-5 w-5` |
| 🔴 off-system | **1** | **`border-dashed`** |

> **Conclusão de estilo:** a tela é **token-limpa** — zero cor hardcoded, spacing/radius alinhados. O **único** estilo genuinamente fora do sistema é `border-dashed` (resolve junto com a adoção do `EmptyState`). O resto é drift de tipografia (resolve com `Heading`/`Text`).

---

### Linha do coverage-matrix (índice)
```yaml
dashboard:
  route: src/client/routes/_authenticated/dashboard.tsx
  fidelity: 0.68
  components_used: [DashboardCard, Card, CardHeader, CardTitle, CardDescription, CardContent]
  components_missing: [EmptyState, CardAction, CardFooter, Heading, Text]
  gaps:
    components: [C1, C2, C3, C4]
    emitters:   [E1, E2, E3, E4, E5]
    colors:     [CL1]
    spacing:    [SP1]
    typography: [TY1, TY2]
    sizing:     [SZ1, SZ2]
    states:     [ST1, ST2, ST3]
  severity: { high: 3, medium: 8, low: 6 }
  unused_seven:                      # superfície do DS não aproveitada (seção 9)
    alternative_components: [KPICard, SingleStat, Feed, Timeline, List, Section, Container, Grid, Stack]
    unused_props: { DashboardCard: [badge, ctaText, ctaLink, ctaDescription, loading, children] }
    unused_variants: { DashboardCard: [ghost, outline, elevated], Card: [elevated, outlined, ghost, selectable] }
    unused_subcomponents: { Card: [CardMedia, CardAction, CardFooter] }
  user_actions:                      # seção 10
    total: 8
    wired: 0
    unwired: [A1, A2, A3, A4, A5, A6, A8]   # A7 = n/a
  style_audit:                       # seção 11 (classe-a-classe)
    token_backed: [colors, border, rounded-md]
    value_aligned: [space-y-8, gap-4, gap-2, tracking-tight, h-32]
    drift: [text-2xl, font-semibold, text-sm, size-4, h-5 w-5]
    off_system: [border-dashed]      # único estilo sem token Seven
    hardcoded_colors: 0
```
