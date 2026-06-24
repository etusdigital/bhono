# Auditoria de tela — Integrations

> **Rota:** `src/client/routes/_authenticated/integrations.tsx`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código** (source: exports, `*.variants.ts`, `*.types.ts`, tokens). Sem render/Figma.
> **Data:** 2026-06-24
> **Fidelidade:** 🟡 **71%** — adota muitos componentes certos (Dialog+Form+Checkbox+TextInput compostos, Badge, Button, Card, Divider) e liga 10/12 ações, mas quebra o DS na **cor** (paleta `emerald`/`amber` crua) e desperdiça emitters/estados (loading, leftIcon, Switch, variantes de Card) + tipografia crua.
>
> Severidade: 🔴 alta (quebra DS ou UX) · 🟡 média (foge do DS, funciona) · 🔵 baixa (polish)

---

## 0. Elementos da tela (o que está renderizado)

| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | Header da página (título + subtítulo + contador "X connected") | raw `<h1>`/`<p>` + `<div>` dot | — / dot cru |
| 2 | Busca de integrações | `@etus/seven-react` | `TextInput` (+ ícone `<Icons.search>` absoluto cru) |
| 3 | Filtros por categoria (5 pills) | `@etus/seven-react` | `Button` (`default`/`ghost`, `size="sm"`) |
| 4 | Grid de integrações (6 cards) | `@etus/seven-react` | `Card` + `CardContent` (`IntegrationCard`) |
| 5 | Badge "Connected" / categoria | `@etus/seven-react` | `Badge` (`color="success"` / `type="badge-outline"`) |
| 6 | Botão Connect/Configure por card | `@etus/seven-react` | `Button` (+ spinner manual) |
| 7 | Empty-state "No integrations found" | raw `<div className="border-dashed">` | — (deveria ser `Empty`) |
| 8 | Divisores de seção (2×) | `@etus/seven-react` | `Divider` (bare, `type="line"` default) |
| 9 | Seção Webhooks (lista de 1 card) | `@etus/seven-react` | `Card` + `CardContent` (`WebhookCard`) |
| 10 | Status dot do webhook + chips de evento | raw `<div>` dot + `Badge` | dot cru / `Badge color="muted"` |
| 11 | Botões editar/excluir webhook | `@etus/seven-react` | `Button` (`ghost`, `size="icon"`) |
| 12 | Empty-state "No webhooks configured" | `Card` + `CardContent` cru | — (deveria ser `Empty`) |
| 13 | Card "Build Custom Integrations" + CTA | `@etus/seven-react` | `Card` (`bg-muted/50`) + `Button outline` |
| 14 | Dialog "Create Webhook" | `@etus/seven-react` | `Dialog` + `DialogTrigger/Content/Header/Title/Description/Footer` |
| 15 | Form do webhook (URL + grid de eventos) | `@etus/seven-react` | `Form` + `FormField/Item/Label/Control/Description/Message` + `TextInput` + `Checkbox` |
| 16 | Grid de eventos (6 checkboxes) | raw `<label>` + `Checkbox` | — (deveria ser `RadioCardGroup`/`CheckboxGroup`) |
| 17 | Ícones (lucide + SVG custom de marcas) | `@/components/icons` + SVG inline | — (convenção do projeto, ok) |

---

## 1. GAPS de componentes & sub-componentes

| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | Tipografia em HTML cru | `<h1>` (1×), `<h2>` (2×), `<p>` (vários), `<code>` (1×) em vez de `Heading`/`Text`/`Paragraph` (todos exportados no beta.4) | 🟡 | `Heading level={1}` no título, `Heading level={2}` nas seções, `Text` nos parágrafos |
| **C2** | Empty-states à mão (2×) | "No integrations found" usa `<div className="… border-dashed">`; "No webhooks configured" usa `Card>CardContent` cru. Existe `Empty`+`EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent` | 🟡 | `<Empty><EmptyMedia variant="icon"><EmptyTitle><EmptyDescription>` |
| **C3** | Status dots hand-built | header (`<div className="h-2 w-2 rounded-full bg-emerald-500">`) e webhook (`bg-emerald-500`/`bg-amber-500`) reimplementam `StatusIndicator` (existe, com `variant` success/warning/error/info/neutral + `pulse`) | 🟡 | `<StatusIndicator variant="success" shape="dot" pulse>` |
| **C4** | `Card` usa só `CardContent` | toda a estrutura (título, descrição, ação, footer) é montada com `<div>` crus dentro de um único `CardContent className="p-4"`; ignora `CardHeader/CardTitle/CardDescription/CardAction/CardFooter/CardMedia` | 🟡 | compor com sub-componentes do `Card` (padding/grid vêm dos tokens) |
| **C5** | Grid de eventos com `<label>` cru | seleção de eventos usa `<label className="… border-primary bg-primary/5">` + `Checkbox`, replicando à mão um cartão selecionável. Existe `RadioCardGroup`/`CheckboxGroup` (forms) e `Card variant="selectable"` | 🟡 | `CheckboxGroup`/`RadioCardGroup`, ou `Card selectable` com `onToggleSelect` |
| **C6** | Ícone de busca posicionado à mão | `<Icons.search className="absolute left-3 top-1/2 …">` + `TextInput className="pl-9"`; o `TextInput` tem prop `leadingIcon` (auto-padding via `--input-icon-padding-*`) e existe `SearchInput` (com `searchIcon`+`onClear`+botão limpar) | 🟡 | `<TextInput leadingIcon={<Icons.search/>}>` ou `SearchInput` |
| **C7** | Filtros como `Button` em vez de tabs | 5 pills de categoria são `Button` com toggle manual de `variant`; o padrão semântico é `TabNavigation` (`variant line`/`solid`, `onValueChange`) ou `Tabs`/`TabsList`/`TabsTrigger` | 🔵 | `TabNavigation` (mantém aparência, ganha semântica de tablist/aria) |

**Sub-componentes do `Card` disponíveis e NÃO usados:** `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardFooter`, `CardMedia`.
**Sub-componentes do `Dialog` disponíveis e NÃO usados:** `DialogClose`, `DialogOverlay`, `DialogPortal` (+ prop `showCloseButton`).

---

## 2. GAPS de emitters / interações (callbacks, CTA, handlers)

> A tela é **majoritariamente interativa** (10/12 gatilhos ligados) — bem acima do dashboard. Os furos são **2 botões mortos**, 1 botão semanticamente errado e handlers mock que não persistem.

| ID | Emitter/ação ausente ou quebrada | Onde | Sev. | Correção |
|---|---|---|---|---|
| **E1** | Botão "Edit webhook" sem `onClick` | `WebhookCard` — `<Button variant="ghost" size="icon">` (pencil) **não tem handler** | 🔴 | ligar `onClick` (abrir Dialog de edição) |
| **E2** | Botão "View API Docs" sem ação | card "Build Custom Integrations" — `<Button variant="outline">` sem `onClick`/`href`/`asChild`. UI morta | 🔴 | `Button asChild` → `<a href>` (link de docs) |
| **E3** | "Configure" não configura | quando `connected`, o botão mostra "Configure" (ícone settings) mas o `onClick` chama `handleToggle` → **desconecta**. Rótulo ≠ comportamento | 🔴 | separar: "Configure" abre `Dialog`; ação de desconectar vai pra menu/`Switch` |
| **E4** | Spinner de loading manual (3×) | `Icons.spinner animate-spin` dentro de `Button` em `IntegrationCard`, delete do `WebhookCard` e submit do Dialog — o `Button` tem prop nativa `loading`/`loadingText` | 🟡 | `<Button loading={isConnecting} loadingText="…">` |
| **E5** | Ícones colados à mão no `Button` | `Icons.plus className="mr-2"`, `Icons.settings className="mr-2"`, `Icons.arrowRight className="ml-2"` — o `Button` tem `leftIcon`/`rightIcon`/`icon` | 🔵 | `<Button leftIcon={<Icons.plus/>}>` / `rightIcon` |
| **E6** | Handlers mock não persistem | `handleToggle` (connect), `handleDelete` (delete), `onSubmit` (create) usam `setTimeout`+`console.log`; `handleDelete` nem remove do array `webhooks` | 🔴 | ligar a mutations reais (fora do DS, mas é gap funcional — Regra 6) |
| **E7** | `Badge.onDismiss` não usado nos chips de evento | os chips de evento do webhook são read-only; poderiam ser removíveis | 🔵 | `Badge onDismiss` quando os eventos forem editáveis |

---

## 3. GAPS de cores / tokens

| Elemento | Usa | Token Seven? | Veredito |
|---|---|---|---|
| dot "connected" (header) | `bg-emerald-500` | ❌ paleta crua; existe `--success`/`StatusIndicator variant="success"` | 🔴 **CL1** |
| ring "connected" (IntegrationCard) | `ring-1 ring-emerald-500/20` | ❌ paleta crua | 🔴 **CL1** |
| ícone "connected" bg/fg | `bg-emerald-100 dark:bg-emerald-900/30` · `text-emerald-600 dark:text-emerald-400` | ❌ paleta crua; existe `--success-subtle`/`--success-foreground` | 🔴 **CL1** |
| dot status do webhook | `bg-emerald-500` / `bg-amber-500` | ❌ paleta crua; existe `--success`/`--warning` | 🔴 **CL1** |
| `lastStatus` success | `text-emerald-600` | ❌ paleta crua | 🔴 **CL1** |
| `lastStatus` error | `text-destructive` | ✅ `--destructive` | ✅ |
| card "Build Custom…" bg | `bg-muted/50` | parcial — `muted` é token, mas sobrescreve `--card-root-background` | 🟡 **CL2** |
| ícone container neutro | `bg-muted` · `bg-background` | ✅ `--muted` / `--background` | ✅ |
| texto secundário | `text-muted-foreground` (+ `/50`) | ✅ `--muted-foreground` | ✅ |
| seleção de evento | `border-primary` · `bg-primary/5` · `border-border` | ✅ `--primary` / `--border` | ✅ |
| chips/mono | `font-mono` | ✅ `--font-mono` (JetBrains Mono, definido no `index.css`) | ✅ |

→ **CL1 é o achado central:** `emerald`/`amber` têm **0 ocorrências** no catálogo `@etus/tokens` (verificado). O Seven oferece **`--success`/`--warning`/`--info`** (com `-subtle`/`-foreground`/`-border`), `StatusIndicator` (variantes `success`/`warning`/`error`/`info`/`neutral`) e `Badge color="success"|"warning"`. O próprio `index.css` já define `--color-success-solid` — e a tela ignora. Passa no ESLint (o ban de cor mira literais `oklch()/rgb()/hsl()`, não utilitários Tailwind), mas é **off-system de fato**.

---

## 4. GAPS de espaçamento

| Onde | Usa | Tipo | Veredito |
|---|---|---|---|
| wrapper da página | `space-y-8` (32px) | layout de página (raw) | ✅ aceitável (= `--spacing-8`) |
| seções | `space-y-4` (16) / `space-y-3` (12) | layout (raw) | ✅ value-aligned |
| grids/flex | `gap-4` (16) · `gap-2` (8) · `gap-1` (4) · `gap-1.5` (6) | layout (raw) | ✅ value-aligned |
| **`CardContent className="p-4"`** | 16px | sobrescreve `--card-content-padding-x` (e adiciona padding-y, já que o `Card` root tem `py-[var(--card-root-padding-y)]`) | 🟡 **SP1** usar padding do token |
| **busca `pl-9`** + ícone absoluto | 36px | offset manual em vez de `TextInput leadingIcon` (auto-pad `--input-icon-padding-*`) | 🟡 **SP2** (= C6) |
| ritmo vertical misto | `space-y-8`/`space-y-4`/`space-y-3`/`py-4` | — | 🔵 **SP3** padronizar |
| interno dos cards/inputs/badges | `--card-*` / `--input-size-*` / `--badge-size-*` | tokens (quando não sobrescritos) | ✅ correto |

→ Espaçamento de layout é quase todo value-aligned. Os furos reais: **SP1** (p-4 sobre o token do Card) e **SP2** (pl-9 manual em vez de `leadingIcon`).

---

## 5. GAPS de tipografia

| Elemento | Tela | Seven esperado | Sev. |
|---|---|---|---|
| título h1 | `<h1 className="text-2xl font-semibold tracking-tight">` | `Heading level={1}` (tokens de tipografia) | 🟡 **TY1** (= C1) |
| seções h2 (2×) | `<h2 className="text-lg font-medium">` | `Heading level={2}` | 🟡 **TY2** (= C1) |
| parágrafos / `<code>` | `<p className="text-sm text-muted-foreground">`, `<code className="text-sm font-mono">` | `Text`/`Paragraph` | 🟡 **TY3** (= C1) |
| **`Badge className="text-xs"` (3×)** | encolhe a fonte do badge à mão | `Badge size="sm"` (eixo `size` sm/default/lg existe) | 🟡 **TY4** |
| `Badge type="badge-outline"` categoria | sem `color` → cai em `primary` (border-primary/text-primary) | provavelmente queria `color="muted"`/`secondary` | 🔵 cor implícita |

> O guard-rail do ESLint **não** bane `h1/h2/p/code/label` (só `button/input/select/textarea`) — passa o lint, mas é drift de DS.

---

## 6. GAPS de sizing / ícones

| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | Icon-button sobrescreve token | `WebhookCard`: `<Button size="icon" className="h-8 w-8">` força 32px sobre `--button-size-icon-size`; existe `size="icon-sm"` | 🟡 |
| **SZ2** | Convenção de ícone mista | `h-4 w-4` (16) · `h-5 w-5` (20) · `h-6 w-6` (24) · `h-8 w-8` (32) · `h-3 w-3` (12) · `size-3` na mesma tela | 🔵 padronizar p/ `size-*` |
| **SZ3** | Badge `text-xs` em vez de `size` | (= TY4) o tamanho do badge deveria vir do eixo `size`, não de `text-xs` | 🟡 |

---

## 7. GAPS de estados

| Estado | Tela | Seven oferece | Sev. |
|---|---|---|---|
| loading (botões) | 🟡 presente, porém **hand-built** (`Icons.spinner animate-spin`) | `Button.loading` / `Button.loadingText` (spinner nativo + `aria-busy`) | 🟡 **ST1** (= E4) |
| toggle conectar/desconectar | `Button` que alterna estado | `Switch`/`Toggle` (semântica on/off, `switchText`/`descriptionText`) seria mais expressivo | 🟡 **ST2** |
| ênfase "connected" no card | manual: `ring-1 ring-emerald-500/20 hover:shadow-md` | `Card variant="selectable"` (`data-selected`, ring via token `--primary`) ou `variant="elevated"` | 🟡 **ST3** |
| empty (2×) | 🟡 presente, porém cru | `Empty`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription` | 🟡 **ST4** (= C2) |
| botões mortos | ❌ Edit/View API Docs sem handler nem `disabled` | `Button` ligado / `asChild` link | 🔴 **ST5** (= E1/E2) |
| erro (form) | ✅ `FormMessage` ligado ao `zodResolver` | — | ✅ correto |
| hover/focus dos controles | ✅ herdado de `Button`/`TextInput`/`Checkbox` | — | ✅ |

---

## 8. Consolidado — backlog priorizado

| Prioridade | IDs | Resumo |
|---|---|---|
| 🔴 **Must-fix** | CL1, E1·E2·ST5, E3, E6 | **cores `emerald`/`amber` off-system**; 2 botões mortos (Edit, API Docs); "Configure" que desconecta; handlers mock sem persistência |
| 🟡 **Should-fix** | C1·TY1·TY2·TY3, C2·ST4, C3, C4, E4·ST1, TY4·SZ3, ST2, ST3, SP1, SP2, C5, C6, CL2 | tipografia→`Heading`/`Text`; empty→`Empty`; dots→`StatusIndicator`; compor `Card`; `Button.loading`; `Badge size`; `Switch`; `Card selectable`; padding via token; `leadingIcon`; `bg-muted/50` |
| 🔵 **Nice-to-have** | C7, E5, E7, SP3, SZ1, SZ2 | filtros→`TabNavigation`; `leftIcon`/`rightIcon`; chips removíveis; ritmo; `size="icon-sm"`; padronizar ícones |

**Pontos corretos (não mexer):** `Dialog`+`Form`+`FormField/Control/Message`+`Checkbox`+`TextInput` compostos e validados (zod) · `Badge`/`Button`/`Divider` com API certa · cores `primary`/`muted`/`border`/`destructive`/`font-mono` token-backed · **guard-rail limpo** (zero `<button>/<input>/<select>/<textarea>` cru) · padding/gap internos dos componentes via token.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

> Inventário do que o Seven oferece e a tela **não** aproveita — props, variants, sub-componentes, estados e **componentes alternativos**. `[u]` = não usado.

### 9.1 — `Badge` (status "Connected", categoria, chips de evento)
| Categoria | Disponível no Seven | Usado? |
|---|---|---|
| Props | `color` · `type` · `className` | ✅ (parcial) |
| Props `[u]` | `size` (sm/default/lg) · `dot` · `icon`/`leadingIcon`/`trailingIcon` · `onDismiss` · `interactive` · `tooltip` · `iconOnly` · `avatar` · `country` · `disabled` · `asChild` | ❌ (usa `text-xs` no lugar de `size`) |
| Types `[u]` | `pill-color` · `pill-outline` · `badge-color` · `badge-modern` (usa `pill-color`/`badge-outline`) | ❌ |
| Colors `[u]` | `warning` · `info` · `tip` · `primary`/`secondary`/`destructive` | ❌ |

### 9.2 — `Button` (filtros, connect, ícones, CTA)
| Categoria | Disponível | Usado? |
|---|---|---|
| Variants usados | `default` · `ghost` · `outline` | ✅ |
| Variants `[u]` | `primary` · `destructive` · `dashed` · `secondary`(+`tone`) · `link`(+`tone`) · `tertiary` · `success` · `warning` · `unstyled` | ❌ |
| Sizes `[u]` | `lg` · `icon-sm` (usa `default`/`sm`/`icon`) | ❌ |
| Props `[u]` | **`loading`/`loadingText`** · **`leftIcon`/`rightIcon`/`icon`** · `badge`/`badgeColor`/`badgeSize` · `tooltip` · `fullWidth` · `asChild` · `shape` · `tone` · `data-id` | ❌ |
| Emitters `[u]` | `onFocus` · `onBlur` · `onKeyDown` (payload `ButtonEventPayload`: `id`,`isLoading`,`timestamp`) | ❌ |

### 9.3 — `Card` (integração, webhook, API)
| Categoria | Disponível | Usado? |
|---|---|---|
| Sub-componentes usados | `CardContent` | ✅ (só esse) |
| Sub-componentes `[u]` | `CardHeader` · `CardTitle` · `CardDescription` · `CardAction` · `CardFooter` · `CardMedia` | ❌ |
| Variants `[u]` | `elevated` · `outlined` · `ghost` · **`selectable`** (`onToggleSelect`/`onTogglePin`/`selected`/`pinned`/`selectableProps`) | ❌ (usa `default` + ring/hover manuais) |

### 9.4 — `TextInput` / busca
| Categoria | Disponível | Usado? |
|---|---|---|
| Props `[u]` | **`leadingIcon`/`trailingIcon`** (+`*Interactive`) · `size` (xs→xl) · `variant` (default/filled/flushed/unstyled) | ❌ (ícone absoluto + `pl-9` manual) |
| **Componente alternativo `[u]`** | **`SearchInput`** — `searchIcon` · `onClear` · `showClearButton` · `clearIcon` | ❌ nunca considerado |

### 9.5 — `Dialog` (create webhook)
| Categoria | Disponível | Usado? |
|---|---|---|
| Sub-componentes usados | `DialogTrigger/Content/Header/Title/Description/Footer` | ✅ (bem composto) |
| Sub-componentes/props `[u]` | `DialogClose` · `DialogOverlay` · `DialogPortal` · `showCloseButton` | ❌ (ok — `Cancel` manual cobre) |

### 9.6 — `Checkbox` + grid de eventos
| Categoria | Disponível | Usado? |
|---|---|---|
| Props `[u]` | `size` (sm/md/lg) · estado `indeterminate` | ❌ |
| **Componentes alternativos `[u]`** | **`CheckboxGroup`** · **`RadioCardGroup`** (cartões selecionáveis nativos) · `Card variant="selectable"` | ❌ (usa `<label>` cru com estilo manual) |

### 9.7 — `Divider`
| Categoria | Disponível | Usado? |
|---|---|---|
| Props `[u]` | `type` (text/heading/button/button-group/…) · `visualStyle` (single/dual/background-fill) · `lineType` (solid/dashed/dotted) · `labelPosition` · `children` | ❌ (usa bare `type="line"` — ✅ ok) |

### 9.8 — Status / dots / tipografia / layout (hoje crus)
| Elemento | Componente Seven `[u]` | Eixos não aproveitados |
|---|---|---|
| dots de status | **`StatusIndicator`** | `variant`(success/warning/error/info/neutral) · `shape`(dot/bar) · `size`(xs→2xl) · `pulse` · `label`/`labelPosition` |
| toggle on/off | **`Switch`** / **`Toggle`** | `switchText` · `descriptionText` · `type`(box) · `size` |
| `<h1>`/`<h2>` | **`Heading`** | `level(1-6)` · `size` · `weight` · `align` · `color` · `gradient` · `asChild` |
| `<p>`/`<code>` | **`Text`** / **`Paragraph`** | `variant`(p1-3/caption/code/display) · `weight` · `color` |
| empty-states | **`Empty`** (+`EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent`) | composição + `variant="icon"` |
| lista de webhooks | **`Item`** · **`List`** (data-display) | `variant`/`size`/`media` para linhas estruturadas |
| filtros | **`TabNavigation`** / **`Tabs`** | `variant`(line/solid) · `onValueChange` |
| layout da página | `Section` · `Container` · `Grid` · `Stack` · `Flex` | estruturariam com tokens de espaçamento |

---

## 10. Ações possíveis do usuário (mapa completo)

> Todo gatilho da tela, o status atual e o primitivo Seven que o ligaria.
> **Resultado: 10 de 12 gatilhos estão ligados; 2 botões mortos (Editar webhook, Ver API Docs). 3 handlers são mock (não persistem) e 1 está semanticamente errado ("Configure").**

| # | Ação possível | Gatilho (elemento) | Status | Observação / como ligar (Seven) |
|---|---|---|---|---|
| A1 | Buscar integrações | `TextInput` (busca) | ✅ ligada | `onChange`→`setSearchQuery`; migrar p/ `SearchInput onClear` p/ limpar |
| A2 | Filtrar por categoria | `Button` ×5 | ✅ ligada | `onClick`→`setActiveCategory`; semântica via `TabNavigation` |
| A3 | Conectar integração | `Button` (Connect) | 🟡 ligada (mock) | `onClick`→`handleToggle` (`setTimeout`, estado local) — sem API |
| A4 | Configurar integração | `Button` (Configure) | 🔴 **mislabeled** | rótulo "Configure" mas `onClick` **desconecta**; falta `Dialog` de config (E3) |
| A5 | Desconectar integração | `Button` (Configure) | 🟡 ligada (mock) | mesmo toggle de A3/A4 |
| A6 | Abrir "Add Webhook" | `DialogTrigger`>`Button` | ✅ ligada | `Dialog open/onOpenChange` |
| A7 | Preencher URL do webhook | `TextInput` (RHF `field`) | ✅ ligada | `FormField`+`zodResolver` |
| A8 | Selecionar eventos | `Checkbox` ×6 | ✅ ligada | `onCheckedChange`→`toggleEvent` |
| A9 | Cancelar dialog | `Button` (Cancel) | ✅ ligada | `onClick`→`setIsOpen(false)` |
| A10 | Submeter webhook | `<form onSubmit>` + `Button submit` | 🟡 ligada (mock) | `handleSubmit(onSubmit)` → `console.log`, sem API (Regra 6) |
| A11 | Fechar dialog (X/Esc/overlay) | `DialogContent` (`showCloseButton` default) | ✅ ligada (nativo) | vem do Radix |
| A12 | Editar webhook | `Button` (pencil) | 🔴 **não-ligada** | sem `onClick` — botão morto (E1) |
| A13 | Excluir webhook | `Button` (trash) | 🟡 ligada (mock) | `onClick`→`handleDelete` (`setTimeout`, **não remove do array**) |
| A14 | Ver API Docs | `Button` (outline) | 🔴 **não-ligada** | sem `onClick`/`href`/`asChild` — botão morto (E2) |

**Emitters do `Button` disponíveis quando as ações forem ligadas:** `onClick` · `onFocus` · `onBlur` · `onKeyDown` (payload `ButtonEventPayload`: `id`, `isLoading`, `timestamp`). **Wired: 10/12** (A12, A14 mortos; A4 semanticamente errado; A3/A5/A10/A13 mock).

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)

> **Toda** família de classe literal da tela, classificada contra os tokens do Seven. Legenda:
> ✅ **token-backed** · 🟢 **value-aligned** (utilitário Tailwind cujo valor == token Seven) · 🟡 **drift** (cru onde um componente/token Seven deveria mandar) · 🔴 **off-system** (sem token equivalente) · ⚪ layout (estrutural, sem token de design)
>
> Nota-chave: o spacing do Seven **espelha o Tailwind** (`--spacing-8`=32=`space-y-8`; `--spacing-4`=16=`gap-4`; `--spacing-2`=8=`gap-2`) e `--font-tracking-tight`=`tracking-tight`. Por isso muito "cru" é 🟢, não violação.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `text-muted-foreground` (+`/50`) | `--muted-foreground` | ✅ |
| `bg-muted` · `bg-background` · `border` · `border-border` | `--muted`/`--background`/`--border` | ✅ |
| `border-primary` · `bg-primary/5` · `border-primary/50` | `--primary` | ✅ |
| `text-destructive` (×2) | `--destructive` | ✅ |
| `font-mono` | `--font-mono` (JetBrains Mono, brand) | ✅ |
| `bg-muted/50` (card API) | `--muted` @50% — sobrescreve `--card-root-background` | 🟡 **CL2** |
| **`bg-emerald-500`** (header+webhook dot) | — (paleta Tailwind; `--success` existe) | 🔴 **CL1** |
| **`ring-emerald-500/20`** | — | 🔴 **CL1** |
| **`bg-emerald-100` · `dark:bg-emerald-900/30`** | — (`--success-subtle` existe) | 🔴 **CL1** |
| **`text-emerald-600` · `dark:text-emerald-400`** | — (`--success-foreground` existe) | 🔴 **CL1** |
| **`bg-amber-500`** (webhook pending) | — (`--warning` existe) | 🔴 **CL1** |

### 11.2 — Espaçamento
| Classe | Valor | Token Seven equiv. | Veredito |
|---|---|---|---|
| `space-y-8` | 32 | `--spacing-8` | 🟢 |
| `space-y-4` · `gap-4` · `p-4`(layout) · `mt-4` | 16 | `--spacing-4` | 🟢 |
| `space-y-3` · `p-3` | 12 | `--spacing-3` | 🟢 |
| `gap-2` · `mr-2`/`ml-2` · `mt-2` · `py-4`* | 8 | `--spacing-2` | 🟢 |
| `gap-1` · `gap-1.5` · `pb-1` · `mt-1` | 4/6 | `--spacing-1`/`1.5` | 🟢 |
| `p-8` | 32 | `--spacing-8` | 🟢 (porém empty-state cru → `Empty`) |
| **`pl-9`** | 36 | offset manual do ícone | 🟡 **SP2** (usar `leadingIcon`) |
| **`CardContent p-4`** | 16 | sobrescreve `--card-content-padding-x` | 🟡 **SP1** |

### 11.3 — Bordas & radius
| Classe | Resolve em | Veredito |
|---|---|---|
| `rounded-lg` | `--radius-lg` | ✅ |
| `rounded-full` | `--radius-full` | ✅ |
| `border` · `border-border` · `border-primary` | `--border`/`--primary` | ✅ |
| **`border-dashed`** (empty-state) | sem **token**, mas o próprio `Empty` do Seven usa `border-dashed` (e `Divider lineType="dashed"`) | 🟡 (não é off-system; é drift → adotar `Empty`) |

### 11.4 — Tipografia
| Classe | Valor | Veredito | Observação |
|---|---|---|---|
| `text-2xl` (h1) | 1.5rem | 🟡 | deveria vir de `Heading` |
| `text-lg` (h2 ×2) | 1.125rem | 🟡 | `Heading level={2}` |
| `font-semibold`/`font-medium` | 600/500 | 🟡 | peso do `Heading`/`Text` |
| `tracking-tight` | -0.025em | 🟢 | == `--font-tracking-tight` |
| `text-sm` (vários) | 0.875rem | 🟡 | corpo deveria vir de `Text` |
| **`text-xs` em `Badge` (×3)** | 0.75rem | 🟡 **TY4** | usar `Badge size="sm"` |
| `text-xs` (metadados) | 0.75rem | 🟡 | `Text variant="caption"` |
| `capitalize` · `truncate` · `line-clamp-2` | — | ⚪ | utilitário de texto (ok) |

### 11.5 — Sizing (ícones / dimensões)
| Classe | Valor | Veredito |
|---|---|---|
| `h-4 w-4` / `h-3 w-3` / `size-3` | 16/12 | 🟢 valor alinhado (mas convenção mista) |
| `h-5 w-5` / `h-6 w-6` | 20/24 | 🟢 (convenção mista, SZ2) |
| `h-2 w-2` (dots) | 8 | 🟢 valor; porém dot cru → `StatusIndicator` |
| `h-10 w-10` / `h-12 w-12` | 40/48 | 🟢 containers de ícone |
| **`h-8 w-8` em `Button size="icon"`** | 32 | 🟡 **SZ1** sobrescreve `--button-size-icon-size` (usar `icon-sm`) |
| `max-w-sm` / `max-w-lg` / `min-w-0` | — | ⚪ layout |

### 11.6 — Layout (⚪ sem token de design — ok)
`flex` · `grid` · `flex-col` · `flex-1` · `items-center` · `items-start` · `items-baseline` · `justify-between` · `justify-center` · `shrink-0` · `relative` · `absolute` · `overflow-hidden` · `overflow-x-auto` · `transition-all` · `transition-colors` · `animate-spin` · `hover:shadow-md` · `mx-auto` · `text-center` · `top-1/2` · `left-3` · `-translate-y-1/2` · `sm:flex-row` · `sm:items-center` · `sm:grid-cols-2` · `lg:grid-cols-3` · `grid-cols-2` · `sm:max-w-lg`

### 11.7 — Veredito do estilo
| Classificação | Qtde (famílias) | Itens |
|---|---|---|
| ✅ token-backed | ~7 | `muted`/`muted-foreground`/`background`/`border`/`primary`/`destructive`/`font-mono`, `rounded-lg`/`rounded-full` |
| 🟢 value-aligned | ~10 | `space-y-8/4/3`, `gap-4/2/1/1.5`, `p-8/4/3`, `mt-*`/`mr-2`/`ml-2`, `tracking-tight`, `h-*/w-*/size-*` de ícone |
| 🟡 drift | ~10 | `text-2xl`/`text-lg`/`font-semibold`/`font-medium`/`text-sm`/`text-xs`(badge), `CardContent p-4`, `pl-9`, `h-8 w-8`, `bg-muted/50`, `border-dashed` |
| 🔴 off-system | **7** | **`emerald-500` · `emerald-500/20` · `emerald-100` · `emerald-900/30` · `emerald-600` · `emerald-400` · `amber-500`** |

> **Conclusão de estilo:** ao contrário do dashboard (token-limpo), esta tela tem **uma quebra de cor real e repetida**: a família `emerald`/`amber` (7 utilitários distintos, em dots/ring/ícone/status) **não existe** no `@etus/tokens` e ignora os semânticos `--success`/`--warning`/`--info`, `StatusIndicator` e `Badge color`. O `border-dashed`, diferente do exemplar, **não** é off-system aqui (o `Empty` do Seven usa border-dashed) — é drift que some ao adotar `Empty`. O restante é drift de tipografia/sizing (resolve com `Heading`/`Text`/`Badge size`/`Button loading`).

---

### Linha do coverage-matrix (índice)
```yaml
integrations:
  route: src/client/routes/_authenticated/integrations.tsx
  fidelity: 0.71
  components_used: [Badge, Button, Card, CardContent, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Divider, Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, TextInput]
  components_missing: [Heading, Text, Paragraph, Empty, EmptyMedia, EmptyTitle, EmptyDescription, StatusIndicator, Switch, SearchInput, TabNavigation, RadioCardGroup, CheckboxGroup, CardHeader, CardTitle, CardDescription, CardAction, CardFooter, Item, List]
  gaps:
    components: [C1, C2, C3, C4, C5, C6, C7]
    emitters:   [E1, E2, E3, E4, E5, E6, E7]
    colors:     [CL1, CL2]
    spacing:    [SP1, SP2, SP3]
    typography: [TY1, TY2, TY3, TY4]
    sizing:     [SZ1, SZ2, SZ3]
    states:     [ST1, ST2, ST3, ST4, ST5]
  severity: { high: 5, medium: 16, low: 6 }
  unused_seven:
    alternative_components: [StatusIndicator, Switch, Toggle, SearchInput, TabNavigation, Tabs, RadioCardGroup, CheckboxGroup, Empty, Heading, Text, Paragraph, Item, List, Section, Container, Grid, Stack, Flex]
    unused_props:
      Button: [loading, loadingText, leftIcon, rightIcon, icon, badge, tooltip, fullWidth, asChild, shape, tone]
      Badge:  [size, dot, leadingIcon, trailingIcon, onDismiss, interactive, tooltip, iconOnly]
      TextInput: [leadingIcon, trailingIcon, size, variant]
      Checkbox: [size, indeterminate]
    unused_variants:
      Card: [elevated, outlined, ghost, selectable]
      Button: [primary, destructive, dashed, secondary, link, tertiary, success, warning]
      Badge: [pill-outline, badge-color, badge-modern]
    unused_subcomponents:
      Card: [CardHeader, CardTitle, CardDescription, CardAction, CardFooter, CardMedia]
      Dialog: [DialogClose, DialogOverlay, DialogPortal]
  user_actions:
    total: 12
    wired: 10
    unwired: [A12, A14]                # botões mortos (Edit, View API Docs)
    broken_or_mock: [A4, A3, A5, A10, A13]   # A4 mislabeled; demais mock/sem persistência
  style_audit:
    token_backed: [muted, muted-foreground, background, border, primary, destructive, font-mono, rounded-lg, rounded-full]
    value_aligned: [space-y-8, space-y-4, space-y-3, gap-4, gap-2, gap-1, gap-1.5, p-8, tracking-tight, icon-sizes]
    drift: [text-2xl, text-lg, font-semibold, font-medium, text-sm, badge-text-xs, card-p-4, pl-9, h-8-w-8, bg-muted-50, border-dashed]
    off_system: [emerald-500, emerald-500/20, emerald-100, emerald-900/30, emerald-600, emerald-400, amber-500]
    hardcoded_colors: 7                 # toda a família emerald/amber (paleta Tailwind, sem token Seven)
  guardrail_raw_controls: 0             # zero <button>/<input>/<select>/<textarea> crus — guard-rail limpo
```
