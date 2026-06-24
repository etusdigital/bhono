# Auditoria de tela — Aceitar convite (invite/$token)

> **Rota:** `src/client/routes/invite.$token.tsx`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código** (source: exports, `*.variants.ts`, `*.types.ts`, tokens). Sem render/Figma.
> **Data:** 2026-06-24
> **Fidelidade:** 🟡 **72%** — componentes certos e ações majoritariamente ligadas (7/8), mas reinventa a API nativa do `Button` (loading/leftIcon/fullWidth), ignora o `FeaturedIcon` nos 3 badges circulares e crava cor `emerald` fora do sistema.
>
> Severidade: 🔴 alta (quebra DS ou UX) · 🟡 média (foge do DS, funciona) · 🔵 baixa (polish)

---

## 0. Elementos da tela (o que está renderizado)

> A tela tem **3 estados** mutuamente exclusivos — `pending` (default), `accepted`, `error` — além do sub-estado *loading* do botão de aceite (`isAccepting`). Todos compartilham o `Shell` (header + main centralizado).

| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | Shell da página (wrapper + header + main) | raw `<div>/<header>/<main>` | — |
| 2 | Marca/logo no header (link → `/`) | raw `<Link>` + `<div>` placa + `<span>` | — (placa caberia `FeaturedIcon`/`Avatar`) |
| 3 | Card do convite (estado `pending`) | `@etus/seven-react` | `Card` + `CardHeader/CardTitle/CardDescription/CardContent` |
| 4 | Card de sucesso (estado `accepted`) | `@etus/seven-react` | `Card` + idem |
| 5 | Card de erro (estado `error`) | `@etus/seven-react` | `Card` + idem |
| 6 | Badge de ícone circular ×3 (1 por estado) | raw `<div className="… rounded-full bg-X">` + ícone lucide | — (deveria ser `FeaturedIcon`) |
| 7 | Botão "Accept Invitation" (+ spinner manual) | `@etus/seven-react` | `Button` (loading feito à mão) |
| 8 | Botão "Decline" | `@etus/seven-react` | `Button variant="outline" asChild` |
| 9 | Botões "Go to Dashboard" / "Go to Homepage" | `@etus/seven-react` | `Button asChild` (Link) |
| 10 | Ícones | `@/components/icons` (lucide) | — (convenção do projeto, ok) |

---

## 1. GAPS de componentes & sub-componentes

| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | Badge circular à mão (×3) | os 3 `<div className="… h-16 w-16 … rounded-full bg-X/10">` + ícone `h-8 w-8 text-X` reproduzem **exatamente** o `FeaturedIcon` (existe no beta.4), que tem `tone` (brand/success/destructive), `shape="circle"` e `size` (plate+icon via token) | 🟡 | `<FeaturedIcon tone="brand\|success\|destructive" shape="circle" size="lg">` — resolve C1+CL1+SZ2 de uma vez |
| **C2** | Ações no `CardContent`, não no `CardFooter` | Accept/Decline e os CTAs de saída vivem em `CardContent`; o slot dedicado a ações é `CardFooter` (tem `--card-footer-padding-top` próprio) | 🔵 | mover botões para `<CardFooter>` |
| **C3** | Loading do botão reinventado | spinner manual (`<Icons.spinner className="… animate-spin" />` + "Accepting…") em vez do `Button.loading`/`loadingText` nativos | 🟡 | ver E1 |
| **C4** | Ícone do botão à mão | `<Icons.check className="mr-2 h-4 w-4" />` dentro do `Button` em vez de `leftIcon` | 🔵 | ver E2 |
| **C5** | Placa do logo à mão | `<div className="… size-8 rounded-lg bg-primary text-primary-foreground">` + ícone reproduz `FeaturedIcon tone="brand"` (ou `Avatar`) | 🔵 | `FeaturedIcon`/`Avatar` |
| **C6** | Wordmark/título crus | `<span className="font-semibold">Hono</span>` e `CardTitle className="text-xl"` poderiam vir de `Text`/`Heading`/token | 🔵 | ver TY1/TY2 |

**Sub-componentes do `Card` disponíveis e NÃO usados:** `CardMedia`, `CardAction`, `CardFooter`.

---

## 2. GAPS de emitters / interações (callbacks, CTA, handlers)

> Diferente do dashboard, esta tela **está viva**: o aceite tem `onClick`, os CTAs usam `Link`/`asChild`, e o 401 redireciona pro login. Os gaps são de **API nativa não aproveitada** e do caminho de **falha sem retry**.

| ID | Emitter/ação ausente | Onde | Sev. | Correção |
|---|---|---|---|---|
| **E1** | `Button.loading`/`loadingText` não usados | botão de aceite monta spinner manual e controla `disabled={isAccepting}` na mão | 🟡 | `<Button loading={isAccepting} loadingText="Accepting…">` (auto-desabilita e centra o spinner) |
| **E2** | `Button.leftIcon` não usado | ícone do botão é filho com `mr-2` em vez de `leftIcon` (o gap já vem do `--button-size-default-gap`) | 🔵 | `leftIcon={<Icons.check />}` |
| **E3** | `Button.fullWidth` não usado | largura via `className="w-full"` em vez da prop dedicada | 🔵 | `fullWidth` |
| **E4** | Erro sem retry | estado `error` só oferece "Go to Homepage"; **não há "Tentar de novo"** — o usuário cai no erro e perde o fluxo de aceite | 🔴 | `Button onClick={() => setStatus('pending')}` (ou `handleAccept`) — ou `ErrorPage` com `onRetry` (= A7) |
| **E5** | Emitters tipados do `Button` não aproveitados | `onClick` usa assinatura nativa; o Seven entrega `(event, payload: ButtonEventPayload{id,isLoading,timestamp})` + `onFocus/onBlur/onKeyDown` | 🔵 | adotar a assinatura tipada se precisar de telemetria |

---

## 3. GAPS de cores / tokens

| Elemento | Usa | Token Seven? | Veredito |
|---|---|---|---|
| placa do logo | `bg-primary` / `text-primary-foreground` | ✅ `--primary` / `--primary-foreground` | ✅ |
| badge pending | `bg-primary/10` / `text-primary` | ✅ `--primary` (com opacidade) | ✅ |
| badge erro | `bg-destructive/10` / `text-destructive` | ✅ `--destructive` | ✅ |
| **badge sucesso** | `bg-emerald-100 dark:bg-emerald-900/30` / `text-emerald-600 dark:text-emerald-400` | ❌ paleta Tailwind crua | 🔴 **CL1** |
| bg/borda/sombra dos cards | tokens internos (`--card-root-*`, `--border`) | ✅ | ✅ |
| descrição do card | `--card-description-color` (interno) | ✅ | ✅ |

→ **CL1 (🔴):** o Seven **tem** cor de sucesso em oklch — `--success`/`--success-foreground` (usados pelo `Button variant="success"`) e `--featured-icon-color-success-bg/fg`. O grep por `emerald` no `tokens.css` retorna **0**: as 4 classes `emerald-*` são a **única** família genuinamente fora do sistema. Resolve adotando `FeaturedIcon tone="success"` (C1).

---

## 4. GAPS de espaçamento

| Onde | Usa | Tipo | Veredito |
|---|---|---|---|
| main | `px-4` (16px) | layout (raw) | 🟢 `--spacing-4` |
| link da marca | `space-x-2` (8px) | raw | 🟢 `--spacing-2` |
| `CardContent` (pending) | `space-y-3` (12px) | raw | 🟢 `--spacing-3` |
| badges | `mb-4` (16px) | raw | 🟢 `--spacing-4` |
| ícone do botão | `mr-2` (8px) | raw | 🟢 `--spacing-2` (some com `leftIcon`) |
| **`CardHeader`** | `pb-4` (16px) | sobrescreve token | 🔵 **SP1** — reduz o `--card-header-padding-bottom` (24px) pra 16px na mão |
| interno dos cards | `--card-*-padding-*`, `--card-root-gap` | tokens Seven (não sobrescritos) | ✅ |

→ Espaçamento da página é todo **value-aligned** com a escala (que espelha o Tailwind). Único ruído: `pb-4` mexendo no ritmo interno que o `CardHeader` já resolve por token.

---

## 5. GAPS de tipografia

| Elemento | Tela | Seven esperado | Sev. |
|---|---|---|---|
| título do card | `CardTitle className="text-xl"` | `CardTitle` só define `[font-weight:var(--card-title-weight)]`+`leading-tight`; o size deveria vir de token/`Heading`, não de `text-xl` cru | 🟡 **TY1** |
| wordmark "Hono" | `<span className="font-semibold">` | `Text`/`Heading` (peso por token) | 🔵 **TY2** |
| `CardTitle`/`CardDescription` | componentes Seven corretos | — | ✅ |

> Nota: o guard-rail do ESLint **não** bane `span`/`h1`/`p` (só `button/input/select/textarea`) — passa o lint, mas `text-xl`/`font-semibold` crus são drift de tipografia.

---

## 6. GAPS de sizing / ícones

| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | Convenção de utilitário mista | `size-8`/`size-4` (placa/ícone do logo) vs `h-16 w-16`/`h-8 w-8`/`h-4 w-4` (badges/ícones) na mesma tela | 🔵 |
| **SZ2** | Badge dimensionado à mão | `h-16 w-16` (plate) + `h-8 w-8` (ícone) deveriam vir do `FeaturedIcon size` (tokens `--featured-icon-size-*-plate/icon`) | 🟡 (= C1) |
| **SZ3** | Ícone do botão redundante | `h-4 w-4` nos ícones do `Button` é redundante — o componente já aplica `[&_svg:not([class*='size-'])]:size-4` (16px) automaticamente | 🔵 |

---

## 7. GAPS de estados

| Estado | Tela | Seven oferece | Sev. |
|---|---|---|---|
| loading (aceite em voo) | 🟡 presente, porém cru (spinner manual + `disabled` na mão) | `Button.loading`/`loadingText` · `Spinner` | 🟡 **ST1** (= E1) |
| accepted (sucesso) | ✅ presente | (badge → `FeaturedIcon tone="success"`) | ✅ (cru — C1/CL1) |
| error | 🟡 presente, mas **sem retry** | `ErrorPage onRetry` · `Button` de "tentar de novo" | 🔴 **ST2** (= E4·A7) |
| pending | ✅ presente | — | ✅ |
| validando convite | ❌ ausente (validação só no aceite, by design) | `Spinner`/`SkeletonLoader` se validasse no mount | 🔵 **ST3** (informativo) |

---

## 8. Consolidado — backlog priorizado

| Prioridade | IDs | Resumo |
|---|---|---|
| 🔴 **Must-fix** | CL1, E4·A7·ST2 | cor `emerald` fora do sistema; estado de erro sem ação de retry |
| 🟡 **Should-fix** | C1·SZ2, C3·E1·ST1, TY1 | badges → `FeaturedIcon`; loading nativo do `Button`; `text-xl` cru no título |
| 🔵 **Nice-to-have** | C2, E2·E3·SZ3, C5, C6·TY2, SP1, SZ1, E5, ST3 | `CardFooter`; `leftIcon`/`fullWidth`; placa do logo; wordmark; ritmo do header; convenção de ícones |

**Pontos corretos (não mexer):** `Card` + composição `Header/Title/Description/Content` · cores `primary`/`destructive` token-backed · ações majoritariamente ligadas (`onClick`/`asChild`/`Link`) · redirect 401→login com `returnTo` · spacing value-aligned.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

> Inventário completo do que o Seven oferece e a tela **não** aproveita — props, variants, sub-componentes, estados e **componentes alternativos**. `[u]` = não usado.

### 9.1 — Cards (hoje `Card` + `Header/Title/Description/Content`)
| Categoria | Disponível no Seven | Usado? |
|---|---|---|
| Sub-componentes | `CardHeader` `CardTitle` `CardDescription` `CardContent` | ✅ usados |
| Sub-componentes `[u]` | `CardMedia` · `CardAction` · `CardFooter` | ❌ |
| Variants `[u]` | `elevated` · `outlined` · `ghost` · `selectable` (usa `default`) | ❌ |
| Estados `[u]` (variant `selectable`) | `onTogglePin` · `onToggleSelect` · `pinned` · `selected` · `data-active`/`data-selected` | ❌ |

### 9.2 — Botões (hoje `Button` default/outline)
| Categoria | Disponível | Usado? |
|---|---|---|
| Props usadas | `variant` (outline) · `asChild` · `onClick` · `disabled` · `className` | ✅ |
| Props `[u]` | `loading` · `loadingText` · `leftIcon` · `rightIcon` · `icon` · `fullWidth` · `badge`/`badgeColor`/`badgeSize` · `tone` · `tooltip` · `size` · `shape` · `data-id` | ❌ |
| Emitters `[u]` | `onClick(event,payload)` tipado · `onFocus` · `onBlur` · `onKeyDown` (payload `ButtonEventPayload`) | ❌ |
| Variants `[u]` | `primary` · `destructive` · `secondary` · `secondary-gray` · `secondary-color` · `ghost` · `link`/`link-gray`/`link-color` · `tertiary`/`tertiary-gray`/`tertiary-color` · `success` · `warning` · `unstyled` | ❌ |
| Sizes `[u]` | `sm` · `lg` · `icon` · `icon-sm` (usa `default`) | ❌ |
| Shapes `[u]` | `square` · `circle` (usa `default`) | ❌ |

### 9.3 — Badges circulares (hoje `<div>` cru + ícone lucide)
| Categoria | Disponível | Usado? |
|---|---|---|
| **Componente alternativo `[u]`** | **`FeaturedIcon`** — `tone` (default/brand/success/warning/info/destructive) · `shape` (default/circle) · `size` (sm/md/lg/xl, plate+icon por token) | ❌ nunca considerado |
| Alternativas `[u]` | `Avatar` · `StatusIndicator` | ❌ |

### 9.4 — Loading (hoje `<Icons.spinner className="animate-spin">` manual)
| Categoria | Disponível | Usado? |
|---|---|---|
| **Componente alternativo `[u]`** | **`Spinner`** — `size` (xs→xl) · `color` (primary/success/error…) · `variant` (default/gradient) · `aria-label` | ❌ |
| Nativo `[u]` | `Button.loading` + `loadingText` (encapsula o `animate-spin`) | ❌ |

### 9.5 — Erro (hoje `Card` + badge + 1 CTA)
| Categoria | Disponível `[u]` | Eixos |
|---|---|---|
| **`ErrorPage`** | `type` · `title` · `description` · `actions` · `icon` · `onRetry` | dá retry e ação custom de fábrica |
| `Alert` · `EmptyState` | título/descrição/ícone/ação padronizados | alternativas pro bloco de erro |

### 9.6 — Marca / títulos (hoje `<span>` / `text-xl` crus)
| Elemento | Componente Seven `[u]` | Eixos não aproveitados |
|---|---|---|
| `<span>Hono</span>` | **`Text`** / **`Heading`** | size · weight · color |
| `CardTitle className="text-xl"` | token de size do `CardTitle`/`Heading` | size semântico em vez de `text-xl` |

### 9.7 — Layout da página (hoje `<div>` + flex crus)
| Disponível `[u]` | Uso |
|---|---|
| `Container` · `Section` · `Stack` · `Flex` | estruturariam o Shell com tokens de espaçamento em vez de `flex`/`min-h-screen`/`container` crus |

---

## 10. Ações possíveis do usuário (mapa completo)

> Toda ação que o usuário **poderia** executar nesta tela, o gatilho, o status atual e o primitivo Seven que a ligaria.
> **Resultado: 7 de 8 ações estão ligadas — a tela é funcional; só falta o retry no erro.**

| # | Ação possível | Gatilho (elemento) | Status | Como ligar (Seven) |
|---|---|---|---|---|
| A1 | Aceitar convite | botão "Accept Invitation" | ✅ ligada (`onClick={handleAccept}`) | já usa `Button onClick`; migrar p/ `loading` nativo |
| A2 | Recusar convite | botão "Decline" | ✅ ligada (`asChild` → `Link to="/"`) | ok |
| A3 | Logar p/ aceitar (401) | dentro de `handleAccept` | ✅ ligada (redirect `…/auth/login?returnTo=…`) | ok (programático) |
| A4 | Ir pro Dashboard (pós-sucesso) | botão "Go to Dashboard" | ✅ ligada (`asChild` → `Link to="/dashboard"`) | ok |
| A5 | Ir pra Home (pós-erro) | botão "Go to Homepage" | ✅ ligada (`asChild` → `Link to="/"`) | ok |
| A6 | Voltar pra Home (logo) | `Link` da marca no header | ✅ ligada (`Link to="/"`) | ok |
| A7 | **Tentar de novo após erro** | estado `error` | 🔴 **não-ligada** (só "Go to Homepage") | `Button onClick={() => setStatus('pending')}` **ou** `ErrorPage onRetry` (= E4·ST2) |
| A8 | Foco/teclado nos botões | botões | ⚪ vem de graça do `Button` (`onKeyDown`/`onFocus` tipados) | já funciona; payload tipado disponível |

**Emitters do `Button` disponíveis (hoje na assinatura nativa):** `onClick` · `onFocus` · `onBlur` · `onKeyDown` — payload `ButtonEventPayload` (`id`, `isLoading`, `timestamp`).

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)

> **Toda** classe literal da tela, classificada contra os tokens do Seven. Legenda:
> ✅ **token-backed** (resolve num token Seven) · 🟢 **value-aligned** (utilitário Tailwind cujo valor == token Seven; não referencia o token, mas não diverge) · 🟡 **drift** (cru onde um componente/token Seven deveria mandar) · 🔴 **off-system** (sem token equivalente) · ⚪ layout (estrutural, sem token de design)
>
> Nota-chave: a escala de spacing do Seven **espelha a do Tailwind** (`--spacing-2`=8px=`space-x-2`; `--spacing-3`=12px=`space-y-3`; `--spacing-4`=16px=`px-4`), `--radius-lg`=12px=`rounded-lg` e `--radius-full`=`rounded-full`. Por isso muito "cru" é 🟢/✅, não violação.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `bg-primary` · `text-primary-foreground` | `--primary` / `--primary-foreground` | ✅ |
| `bg-primary/10` · `text-primary` | `--primary` (com opacidade) | ✅ |
| `bg-destructive/10` · `text-destructive` | `--destructive` | ✅ |
| bg/borda/sombra/descrição dos cards | tokens internos (`--card-root-*`, `--border`, `--card-description-color`) | ✅ |
| **`bg-emerald-100`** | — (paleta Tailwind; Seven usa `--success`/`--featured-icon-color-success-bg`) | 🔴 |
| **`dark:bg-emerald-900/30`** | — | 🔴 |
| **`text-emerald-600`** | — (Seven: `text-success`/`--featured-icon-color-success-fg`) | 🔴 |
| **`dark:text-emerald-400`** | — | 🔴 |

### 11.2 — Espaçamento
| Classe | Valor | Token Seven equiv. | Veredito |
|---|---|---|---|
| `space-x-2` | 8px | `--spacing-2` | 🟢 |
| `space-y-3` | 12px | `--spacing-3` | 🟢 |
| `px-4` · `mb-4` · `pb-4` | 16px | `--spacing-4` | 🟢 (`pb-4` sobrescreve token interno do `CardHeader` — SP1) |
| `mr-2` | 8px | `--spacing-2` | 🟢 (some com `leftIcon`) |
| padding/gap internos dos cards | — | `--card-*` | ✅ |

### 11.3 — Bordas & radius
| Classe | Resolve em | Veredito |
|---|---|---|
| `rounded-lg` | `--radius-lg` (12px) | ✅ |
| `rounded-full` | `--radius-full` (9999px) | ✅ |
| borda dos cards | `--border` / `--card-root-border-width` (interno) | ✅ |

### 11.4 — Tipografia
| Classe | Valor | Veredito | Observação |
|---|---|---|---|
| `text-xl` (×3) | 1.25rem | 🟡 | size do título deveria vir do `CardTitle`/`Heading` (token), não cru |
| `font-semibold` | 600 | 🟡 | peso cru no wordmark; via `Text`/`Heading` |
| `text-center` (×4) | — | ⚪ | alinhamento estrutural, sem token |

### 11.5 — Sizing (ícones / dimensões)
| Classe | Valor | Veredito |
|---|---|---|
| `size-8` | 32px | 🟢 valor alinhado (placa do logo — cabia `FeaturedIcon`) |
| `size-4` | 16px | 🟢 |
| `h-16 w-16` (×3) | 64px | 🟡 deveria vir do `FeaturedIcon size`; convenção mista c/ `size-*` |
| `h-8 w-8` (×3) | 32px | 🟡 idem (ícone do `FeaturedIcon` é sizing por token) |
| `h-4 w-4` (×2) | 16px | 🟡 redundante (Button auto-aplica `size-4` em svg) |
| `w-full` (×4) | — | 🟡 nos `Button` existe a prop `fullWidth`; nos `Card` é layout (⚪) |
| `max-w-md` (×3) | 28rem | ⚪ largura do card (layout) |
| `aspect-square` | — | ⚪ layout |
| `animate-spin` | — | 🟡 reinventa o `Spinner`/`Button.loading` (que encapsulam o mesmo `animate-spin`) |

### 11.6 — Layout (⚪ sem token de design — ok)
`flex` · `min-h-screen` · `flex-col` · `container` · `h-14` (56px = `--spacing-14`, 🟢) · `items-center` · `justify-center` · `flex-1` · `mx-auto` · `aspect-square`

### 11.7 — Veredito do estilo
| Classificação | Qtde | Itens |
|---|---|---|
| ✅ token-backed | 4 famílias | cores `primary`/`destructive`, `rounded-lg`, `rounded-full`, tokens internos dos cards |
| 🟢 value-aligned | 7 | `space-x-2`, `space-y-3`, `px-4`/`mb-4`/`pb-4`, `mr-2`, `size-8`, `size-4`, `h-14` |
| 🟡 drift (tipografia/sizing/loading) | 8 | `text-xl`, `font-semibold`, `h-16 w-16`, `h-8 w-8`, `h-4 w-4`, `w-full` (em `Button`), `animate-spin` |
| 🔴 off-system | **4** | **`bg-emerald-100`, `dark:bg-emerald-900/30`, `text-emerald-600`, `dark:text-emerald-400`** |

> **Conclusão de estilo:** a tela é **quase token-limpa** — `primary`/`destructive` token-backed, spacing/radius alinhados. O **único** desvio genuinamente fora do sistema é a família **`emerald`** (4 literais) do badge de sucesso, que resolve adotando `FeaturedIcon tone="success"` (cor de sucesso já existe em oklch nos tokens). O resto é drift: tipografia (`text-xl`/`font-semibold`), sizing manual dos badges/ícones e o loading reinventado (resolvem com `FeaturedIcon` + `Button.loading`).

---

### Linha do coverage-matrix (índice)
```yaml
invite:
  route: src/client/routes/invite.$token.tsx
  fidelity: 0.72
  states: [pending, accepted, error]
  components_used: [Button, Card, CardHeader, CardTitle, CardDescription, CardContent]
  components_missing: [FeaturedIcon, Spinner, CardFooter, ErrorPage, Heading, Text]
  gaps:
    components: [C1, C2, C3, C4, C5, C6]
    emitters:   [E1, E2, E3, E4, E5]
    colors:     [CL1]
    spacing:    [SP1]
    typography: [TY1, TY2]
    sizing:     [SZ1, SZ2, SZ3]
    states:     [ST1, ST2, ST3]
  severity: { high: 2, medium: 6, low: 9 }
  unused_seven:                      # superfície do DS não aproveitada (seção 9)
    alternative_components: [FeaturedIcon, Spinner, ErrorPage, Alert, EmptyState, Avatar, StatusIndicator, Container, Section, Stack, Flex, Heading, Text]
    unused_props: { Button: [loading, loadingText, leftIcon, rightIcon, icon, fullWidth, badge, tone, tooltip, size, shape], Card: [variant] }
    unused_variants: { Button: [primary, destructive, secondary, ghost, link, tertiary, success, warning, unstyled], Card: [elevated, outlined, ghost, selectable] }
    unused_subcomponents: { Card: [CardMedia, CardAction, CardFooter] }
  user_actions:                      # seção 10
    total: 8
    wired: 7
    unwired: [A7]                    # retry no erro; A8 = free-from-Button
  style_audit:                       # seção 11 (classe-a-classe)
    token_backed: [primary, destructive, rounded-lg, rounded-full, card-internals]
    value_aligned: [space-x-2, space-y-3, px-4, mb-4, pb-4, mr-2, size-8, size-4, h-14]
    drift: [text-xl, font-semibold, h-16 w-16, h-8 w-8, h-4 w-4, w-full, animate-spin]
    off_system: [bg-emerald-100, dark:bg-emerald-900/30, text-emerald-600, dark:text-emerald-400]
    hardcoded_colors: 4              # família emerald (badge de sucesso)
```
