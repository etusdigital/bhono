# Auditoria de tela — Landing

> **Rota:** `src/client/routes/index.tsx`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código** (source: exports, `*.variants.ts`, `*.types.ts`, tokens). Sem render/Figma.
> **Data:** 2026-06-24
> **Fidelidade:** 🟡 **52%** — usa só `Button` (correto, via `asChild`), mas toda a estrutura — nav, hero, pill, feature cards, tech badges, footer — é HTML de marketing cru que ignora a camada de componentes do Seven. Em compensação as **cores são token-limpas**, o spacing é value-aligned e os **CTAs estão ligados** (5/6).
>
> Severidade: 🔴 alta (quebra DS ou UX) · 🟡 média (foge do DS, funciona) · 🔵 baixa (polish)

---

## 0. Elementos da tela (o que está renderizado)

| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | 3× CTA (Get Started ×2, GitHub) | `@etus/seven-react` | `Button` (`asChild`, `size`, `variant="outline"`) |
| 2 | header sticky + nav | raw `<header>`/`<nav>` + `<div>` | — (deveria ser `Navbar`/`Header`) |
| 3 | logo plate (mint) | raw `<div rounded-lg bg-primary>` + ícone | — (deveria ser `FeaturedIcon`) |
| 4 | pill "Built on Cloudflare Workers" | raw `<div rounded-full border bg-muted>` + ícone + `<span>` | — (deveria ser `Badge`) |
| 5 | título hero / heading tech / título de feature | raw `<h1>`/`<h2>`/`<h3>` | — (deveria ser `Heading`) |
| 6 | parágrafos / wordmark / copy | raw `<p>`/`<span>` | — (deveria ser `Text`/`Paragraph`) |
| 7 | 3× feature card (`FeatureCard` local) | raw `<div>` centrado + plate + `<h3>` + `<p>` | — (deveria ser `Card`+`FeaturedIcon`+`Heading`+`Text` ou `FeatureItem`) |
| 8 | 6× tech badge (`TechBadge` local) | raw `<span>` | — (deveria ser `Badge`) |
| 9 | footer + link GitHub | raw `<footer>` + `border-t` + `<a>` | — (`Container`+`Divider`+`Flex`; **não há `Footer` no beta.4**) |
| 10 | sections / container / grid | raw `<section>`/`container`/`grid` | — (`Section`/`Container`/`Grid`) |
| 11 | ícones | `@/components/icons` (lucide) | — (convenção do projeto, ok) |
| 12 | landmarks `<header>/<main>/<footer>/<nav>/<section>` | semântica HTML | ⚪ correto (layout/semântico) |

> **Adoção de componentes Seven: 1 família (Button) de ~9 famílias de elementos.** A tela é majoritariamente markup de marketing cru.

---

## 1. GAPS de componentes & sub-componentes

| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | Nav/header à mão | `<header className="sticky top-0 z-50 … border-b …"><nav>` reimplementa sticky/borda/container em vez de `Navbar` (existe: `sticky`, `variant="bordered"`, `contained`, `size`) ou `Header` | 🟡 | `Navbar sticky variant="bordered" contained` + `NavbarBrand href="/"` + `NavbarContent justify="end"` + `NavbarItem`/`NavbarLink` |
| **C2** | Logo plate cru | `<div className="… size-8 rounded-lg bg-primary text-primary-foreground">` + ícone = placa de ícone à mão | 🟡 | `FeaturedIcon size="sm" tone="brand"` (placa+ícone vêm de token; ícone auto-sized) |
| **C3** | Pill de marketing cru | `<div className="… rounded-full border bg-muted px-4 py-1.5 text-sm font-medium">` + ícone + `<span>` é literalmente um badge | 🟡 | `Badge` com `leadingIcon`/`icon` (+ `dot` opcional); padding/radius vêm do componente |
| **C4** | Tipografia em HTML cru | `<h1>/<h2>/<h3>` → `Heading`; `<p>` → `Text`/`Paragraph`; wordmark `<span>` → `Text` (todos exportados) | 🟡 | `Heading level={1..3}` nos títulos, `Text`/`Paragraph` no corpo (= TY1/TY2) |
| **C5** | `FeatureCard` local cru | componente local: `<div>` centrado + `<div className="rounded-lg bg-muted p-3">` (plate) + `<h3>` + `<p>` | 🟡 | `Card` + `FeaturedIcon` + `Heading` + `Text`; **ou** `FeatureItem` (`icon`/`title`/`description`/`action`) — *atenção:* `FeatureItem` é layout **ícone-à-esquerda** (`flex items-start`), a tela é centralizada |
| **C6** | `TechBadge` local cru | componente local: `<span className="text-sm font-medium">` | 🟡 | `Badge` (variante `ghost`/`secondary`); o nome do tech vira conteúdo do badge |
| **C7** | Footer cru | `<footer className="border-t py-6">` + `<a>` solto | 🔵 | `Container` + `Divider` (no lugar do `border-t`) + `Flex`; **NÃO existe componente `Footer` standalone no beta.4** (verificado: só `CardFooter`/`SidebarFooter`/… ) |
| **C8** | Layout cru | `container`/`grid`/`<section>` em vez de `Container`/`Section`/`Grid` | 🔵 | `Section` (ritmo vertical via token) + `Container` (`--content-*`) + `Grid` |
| **C9** | Ícone inline no `Button` | hero/GitHub embutem `<Icon className="ml-2/mr-2 h-4 w-4">` nos children | 🔵 | em `asChild` o Slot limita `leftIcon`/`rightIcon`; mesmo assim `h-4 w-4` é redundante (Button faz `[&_svg…]:size-4`) e `ml-2`/`mr-2` duplica o `gap` do Button (= SZ2) |

**Sub-componentes/alternativas NÃO usadas:** `Navbar*` (Brand/Content/Item/Link/Menu/MenuToggle) · `Header*` (Brand/Nav/Actions) · `FeaturedIcon` · `Badge` · `Heading` · `Text`/`Paragraph` · `Card*` · `FeatureItem` · `Container`/`Section`/`Grid`/`Stack`/`Flex` · `Divider`.

---

## 2. GAPS de emitters / interações (callbacks, CTA, handlers)

> Diferente do dashboard, **os CTAs aqui estão ligados** (navegação via `Link`/`<a>` + `Button asChild`). Os gaps são de **destino** (placeholder) e de **superfície de emitters não usada**.

| ID | Emitter/ação | Onde | Sev. | Correção |
|---|---|---|---|---|
| **E1** | Links GitHub são placeholder | hero e footer apontam para `href="https://github.com"` (homepage genérica, não o repo do produto) — ligado, porém stub (Regra 6) | 🟡 | apontar para o repositório real (×2) |
| **E2** | Logo não navega | wordmark "Hono" + ícone são `<div>`/`<span>` sem `Link` — falta o padrão "logo → `/`" | 🔵 | `NavbarBrand href="/"` **ou** `<Link to="/">` (= A6) |
| **E3** | Superfície de emitters do `Button` ociosa | `onClick`/`onFocus`/`onBlur`/`onKeyDown` (payload `ButtonEventPayload`) + `loading`/`loadingText` não usados — ok p/ CTA de navegação, mas sem estado de loading | 🔵 | ligar `loading` se o destino virar async |
| **E4** | Tech badges / pill estáticos | 6 tech badges e o pill não linkam (docs/stack) — informacional por design | 🔵 | opcional: `Badge interactive` + `href` (= A7) |

---

## 3. GAPS de cores / tokens

| Elemento | Usa | Token Seven? | Veredito |
|---|---|---|---|
| logo plate | `bg-primary` / `text-primary-foreground` | ✅ `--primary` / `--primary-foreground` | ✅ |
| pill / icon plate / tech section | `bg-muted` | ✅ `--muted` | ✅ |
| texto secundário (×6) | `text-muted-foreground` | ✅ `--muted-foreground` | ✅ |
| hover de links | `hover:text-foreground` | ✅ `--foreground` | ✅ |
| bordas | `border` / `border-b` / `border-t` | ✅ `--border` | ✅ |
| **header "glass"** | `bg-background/95` + `supports-[backdrop-filter]:bg-background/60` | ❌ opacidade sobre token semântico — não é padrão Seven | 🔴 **CL1** |
| **header blur** | `backdrop-blur` | ❌ efeito decorativo sem token Seven | 🔴 **CL2** |
| **tech section** | `bg-muted/50` | ❌ opacidade sobre token | 🔴 **CL3** |

→ Cores **majoritariamente corretas** (todas as cores sólidas resolvem em token; zero hex/`text-*-500`/`bg-gray-*`). Os únicos pontos fora do sistema são os **3 efeitos decorativos com opacidade/blur** no header e na faixa tech.

---

## 4. GAPS de espaçamento

| Onde | Usa | Tipo | Veredito |
|---|---|---|---|
| gaps/space | `gap-2`(8) `gap-4`(16) `gap-8`(32) `space-x-2`(8) `space-x-4`(16) | layout (raw, == `--spacing-*`) | 🟢 aceitável |
| ritmo de section | `py-24`(96) `md:py-32`(128) `py-16`(64) `py-6`(24) | rhythm de página (raw) | 🟢 / 🔵 **SP1** padronizar via `Section` |
| margens internas | `mb-2`(8) `mb-4`(16) `mb-8`(32) `p-3`(12) | layout (raw) | 🟢 |
| **pill** | `py-1.5` (6px) | fora do passo de 8px do Seven | 🔵 **SP2** resolve via `Badge` |

→ Espaçamento é **todo value-aligned** com a escala do Seven (que espelha o Tailwind). Nenhuma violação real; só ritmo de section cru (some com `Section`) e o `py-1.5` do pill (some com `Badge`).

---

## 5. GAPS de tipografia

| Elemento | Tela | Seven esperado | Sev. |
|---|---|---|---|
| `<h1>` hero | `text-4xl font-bold tracking-tight sm:…lg:text-7xl` (escala solta no h1) | `Heading level={1} size weight` | 🟡 **TY1** (= C4) |
| `<h2>` tech | `text-sm font-semibold uppercase tracking-wider` | `Heading level={2}` | 🟡 **TY1** |
| `<h3>` feature | `text-lg font-semibold` | `Heading level={3}` | 🟡 **TY1** |
| `<p>` hero/feature/footer | `text-lg/xl` · `text-sm text-muted-foreground` | `Text`/`Paragraph` | 🟡 **TY2** (= C4) |
| wordmark / nav / badges `<span>` | `font-semibold` / `font-medium` / `text-sm font-medium` | `Text` / `NavbarLink` / `Badge` | 🔵 **TY3** |

> Os **valores** batem com os tokens (`--text-font-size-4xl`=36 … `7xl`=72; `--text-font-weight-bold`=700/`-semibold`=600/`-medium`=500; `tracking-tight`=`--font-tracking-tight`, `tracking-wider`=`--font-tracking-wider`), então não é divergência de valor — é **drift semântico**: o tipo deveria vir de `Heading`/`Text`, não de utilitários soltos em HTML cru. O guard-rail do ESLint **não** bane `h1/h2/h3/p/span/a` (só `button/input/select/textarea`) — passa o lint.

---

## 6. GAPS de sizing / ícones

| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | Tamanho de ícone inconsistente | `size-4`(16, logo) · `h-4 w-4`(16, botões) · `h-5 w-5`(20, footer) · `h-10 w-10`(40, feature) na mesma tela | 🔵 |
| **SZ2** | Ícone inline no Button redundante | `ml-2/mr-2 h-4 w-4`: `h-4 w-4` duplica o `[&_svg]:size-4` do Button e `ml-2`/`mr-2` duplica o `gap` do Button | 🔵 (= C9) |
| **SZ3** | Larguras arbitrárias vs token | `max-w-[42rem]` == `--content-narrow`(42rem) e `max-w-5xl` == `--container-5xl`(64rem) — alinham, mas não referenciam o token | 🔵 |

> Bom: `max-w-[var(--content-wide)]` (header) **referencia** o token real `--content-wide`(96rem) do `@theme` — esse está correto.

---

## 7. GAPS de estados

| Estado | Tela | Seven oferece | Sev. |
|---|---|---|---|
| hover de nav link | hand-coded (`hover:text-foreground transition-colors`) | `NavbarLink` (+ `isActive`) | 🔵 **ST1** |
| loading nos CTAs | ❌ ausente (navegação) | `Button.loading`/`loadingText` | 🔵 **ST2** |
| interativo/hover em feature/badge | ❌ (informacional) | `Badge interactive` · `Card variant="selectable"` | ⚪/🔵 **ST3** |
| foco/teclado | ✅ vem de graça com `Button`/`Link` | — | ✅ |
| active de nav | ❌ (landing pública, sem rota ativa) | `NavbarItem isActive` | ⚪ n/a |

---

## 8. Consolidado — backlog priorizado

| Prioridade | IDs | Resumo |
|---|---|---|
| 🔴 **Must-fix** | CL1, CL2, CL3 | header "glass" (`bg-background/95` + `backdrop-blur` + `supports:bg-/60`) e `bg-muted/50` — **únicos estilos que quebram o DS** (opacidade/blur sem token) |
| 🟡 **Should-fix** | C1·Navbar, C2·FeaturedIcon, C3·Badge, C4·TY1·TY2, C5, C6, E1 | adotar a camada de componentes (nav, plate, pill, tipografia, feature cards, tech badges) + corrigir links GitHub placeholder |
| 🔵 **Nice-to-have** | C7, C8, C9·SZ2, SP1, SP2, SZ1, SZ3, E2, E3, E4, ST1, ST2 | layout via `Section`/`Container`/`Grid`; ícone do Button via gap; ritmo via `Section`; logo→`/`; padronizar ícones |

**Pontos corretos (não mexer):** `Button` (padrão `asChild` correto, `variant="outline"`/default, `size` sm/lg) · todas as cores sólidas em token · spacing/tracking value-aligned · `max-w-[var(--content-wide)]` referenciando token · roteamento via `Link`.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

> Inventário do que o Seven oferece e a tela **não** aproveita — props, variants, sub-componentes, estados e **componentes alternativos**. `[u]` = não usado.

### 9.1 — CTAs (hoje `Button`)
| Categoria | Disponível no Seven | Usado? |
|---|---|---|
| Props | `asChild` · `size`(sm/lg) · `variant`(outline) | ✅ usados |
| Props `[u]` | `leftIcon` · `rightIcon` · `icon` · `loading` · `loadingText` · `fullWidth` · `badge`/`badgeColor`/`badgeSize` · `tone` · `tooltip` · `data-id` | ❌ |
| Emitters `[u]` | `onClick` · `onFocus` · `onBlur` · `onKeyDown` (payload `ButtonEventPayload`: `id`/`isLoading`/`timestamp`) | ❌ (usa `asChild`+nav) |
| Variants `[u]` | `primary` · `secondary`(+`-gray`/`-color`) · `destructive` · `ghost` · `dashed` · `link`(+`-gray`/`-color`) · `tertiary`(+`-gray`/`-color`) · `success` · `warning` · `unstyled` (usa `default`+`outline`) | ❌ |
| Sizes `[u]` | `default` · `icon` · `icon-sm` · shape `square` (usa `sm`/`lg`) | ❌ |

### 9.2 — Nav/header (hoje `<header>/<nav>` cru)
| Categoria | Disponível `[u]` | Uso |
|---|---|---|
| **`Navbar`** | `sticky` · `contained` · `containerClassName` · `size`(sm/md/lg) · `variant`(bordered/default/floating/transparent) | substitui `sticky top-0 z-50`/`border-b`/`container`/`max-w` à mão |
| **`Navbar` sub** | `NavbarBrand`(`href`) · `NavbarContent`(`justify`) · `NavbarItem`(`isActive`) · `NavbarLink`(`isActive`) · `NavbarMenu`/`NavbarMenuToggle`(`isOpen`/`srLabel`) | brand, grupos, links e menu mobile |
| **`Header`** (alt) | `variant` · `size` · `sticky` · `contained` · `layout` + `HeaderBrand`(`asLink`/`href`) · `HeaderNav` · `HeaderActions`(`align`) | alternativa de shell de topo |

### 9.3 — Logo plate (hoje `<div bg-primary>`)
| Categoria | Disponível `[u]` | Uso |
|---|---|---|
| **`FeaturedIcon`** | `size`(sm/md/lg/xl/2xl) · `shape`(default/circle) · `tone`(default/brand/…) | placa+ícone via token; ícone auto-sized (sem `size-4` manual) |

### 9.4 — Pill & tech badges (hoje `<div rounded-full>` / `<span>`)
| Categoria | Disponível `[u]` | Uso |
|---|---|---|
| **`Badge`** | `leadingIcon`/`icon`/`iconOnly` · `dot` · `interactive` · `disabled` · `avatar` · `country` · `asChild` + variants de cor/size | pill "Built on…" e os 6 tech badges |

### 9.5 — Feature cards (hoje `FeatureCard` local cru)
| Categoria | Disponível `[u]` | Uso |
|---|---|---|
| **`FeatureItem`** | `icon` · `title` · `description` · `action`(`href`/`label`/`onClick`) · `tone`(subtle/…/brand) | feature com CTA (layout ícone-à-esquerda) |
| **`Card`+`FeaturedIcon`+`Heading`+`Text`** | composição p/ card centralizado | mantém o layout centralizado da tela |

### 9.6 — Tipografia (hoje `<h1>`/`<h2>`/`<h3>`/`<p>` crus)
| Elemento | Componente Seven `[u]` | Eixos não aproveitados |
|---|---|---|
| `<h1..h3>` | **`Heading`** | `level(1-6)` · `size` · `weight` · `align` · `color` · `gradient` · `asChild` |
| `<p>`/`<span>` | **`Text`** / **`Paragraph`** | variants de tamanho/cor/peso |

### 9.7 — Layout & footer (hoje `container`/`grid`/`<footer>` crus)
| Disponível `[u]` | Uso |
|---|---|
| `Section` · `Container` · `Grid` · `Stack` · `Flex` | estruturariam página/feature-grid com tokens em vez de `container`/`grid`/`py-*` crus |
| `Divider` | substitui `border-t` do footer/faixa tech |
| *(sem `Footer` standalone no beta.4)* | montar com `Container`+`Divider`+`Flex` |

---

## 10. Ações possíveis do usuário (mapa completo)

> Toda ação que o usuário **poderia** executar, o gatilho, o status atual e o primitivo Seven que a ligaria.
> **Resultado: 5 de 6 ações acionáveis estão ligadas** — A6 (logo→home) ausente; A4/A5 ligadas porém com `href` placeholder; A7–A9 informacionais/grátis.

| # | Ação possível | Gatilho (elemento) | Status | Como ligar (Seven) |
|---|---|---|---|---|
| A1 | Ir para login | nav "Sign in" (`<Link to="/login">`) | ✅ ligada | migrar p/ `NavbarLink` (mantém `Link` via `asChild`) |
| A2 | Começar (nav) | nav "Get Started" (`Button asChild` → `Link /login`) | ✅ ligada | ok; opcional `NavbarContent` |
| A3 | Começar (hero) | hero "Get Started" (`Button asChild` → `Link /login`) | ✅ ligada | ok |
| A4 | Abrir GitHub (hero) | `Button variant="outline"` → `<a href="https://github.com" target=_blank>` | 🟡 ligada-stub | `href` placeholder → apontar p/ repo real (E1) |
| A5 | Abrir GitHub (footer) | ícone `<a href="https://github.com">` | 🟡 ligada-stub | idem (E1) |
| A6 | Voltar à home | wordmark/logo "Hono" (`<div>`+`<span>`) | 🔴 não-ligada | `NavbarBrand href="/"` **ou** `<Link to="/">` (E2) |
| A7 | Abrir docs do stack | 6 tech badges | ⚪ n/a (informacional) | `Badge interactive` + `href` se desejado |
| A8 | Saber mais (pill) | "Built on Cloudflare Workers" | ⚪ n/a (informacional) | `Badge`/`Link` se virar CTA |
| A9 | Foco/teclado | CTAs/links | ✅ grátis (`Button`/`Link`) | `onKeyDown`/`onFocus` (`ButtonEventPayload`) se necessário |

**Emitters do `Button` disponíveis:** `onClick` · `onFocus` · `onBlur` · `onKeyDown` (payload `ButtonEventPayload`: `id`, `isLoading`, `timestamp`).

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)

> **Toda** classe literal da tela, classificada contra os tokens do Seven. Legenda:
> ✅ **token-backed** (resolve num token Seven) · 🟢 **value-aligned** (utilitário Tailwind cujo valor == token Seven) · 🟡 **drift** (cru onde um componente/token Seven deveria mandar) · 🔴 **off-system** (sem token equivalente) · ⚪ layout (estrutural, sem token de design)
>
> Nota-chave: a escala de spacing do Seven **espelha a do Tailwind** (`--spacing-2`=8, `-4`=16, `-8`=32, `-16`=64) e `--font-tracking-tight`=-0.025em / `-wider`=0.05em. Por isso quase todo "cru" é 🟢, não violação.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `bg-primary` · `text-primary-foreground` | `--primary` / `--primary-foreground` | ✅ |
| `bg-muted` (×3) | `--muted` | ✅ |
| `text-muted-foreground` (×6) | `--muted-foreground` | ✅ |
| `hover:text-foreground` (×2) | `--foreground` | ✅ |
| `border` · `border-b` · `border-t` | `--border` | ✅ |
| **`bg-background/95`** + **`supports-[backdrop-filter]:bg-background/60`** | `--background` com opacidade — não-padrão | 🔴 **CL1** |
| **`backdrop-blur`** | — (efeito decorativo, sem token) | 🔴 **CL2** |
| **`bg-muted/50`** | `--muted` com opacidade — não-padrão | 🔴 **CL3** |
| *(nenhuma cor hardcoded — hex/`text-*-500`/`bg-gray-*`)* | — | ✅ limpo |

### 11.2 — Espaçamento
| Classe | Valor | Token Seven equiv. | Veredito |
|---|---|---|---|
| `gap-2` · `space-x-2` | 8 | `--spacing-2` | 🟢 |
| `gap-4`(×4) · `space-x-4` · `mb-4` | 16 | `--spacing-4` | 🟢 |
| `gap-8`(×2) · `mb-8` | 32 | `--spacing-8` | 🟢 |
| `p-3` · `mb-2` · `py-1.5` | 12 / 8 / 6 | `--spacing-3`/`-2` / — | 🟢 (`py-1.5` 6px fora do passo → 🔵 SP2) |
| `py-6`(24) · `py-16`(64) · `py-24`(96) · `md:py-32`(128) | — | `--spacing-6/16/…` | 🟢 (ritmo de section → 🔵 SP1) |

### 11.3 — Bordas & radius
| Classe | Resolve em | Veredito |
|---|---|---|
| `border` / `border-b` / `border-t` | `--border` | ✅ |
| `rounded-lg` (×2) | `--radius-lg` (12px) | ✅ |
| `rounded-full` | `--radius-full` | ✅ |

### 11.4 — Tipografia
| Classe | Valor | Veredito | Observação |
|---|---|---|---|
| `text-4xl`/`sm:text-5xl`/`md:text-6xl`/`lg:text-7xl` | 36–72 | 🟡 | título deveria vir do `Heading` |
| `text-lg`(×2) / `sm:text-xl` | 18 / 20 | 🟡 | corpo/feature → `Heading`/`Text` |
| `text-sm` (×5) | 14 | 🟡 | corpo/nav/badges → `Text`/`NavbarLink`/`Badge` |
| `font-bold` / `font-semibold`(×3) / `font-medium`(×3) | 700/600/500 | 🟡 | pesos via `Heading`/`Text` |
| `tracking-tight` | -0.025em | 🟢 | == `--font-tracking-tight` |
| `tracking-wider` | 0.05em | 🟢 | == `--font-tracking-wider` |
| `uppercase` | — | ⚪ | text-transform, sem token (neutro) |

### 11.5 — Sizing (ícones / larguras)
| Classe | Valor | Veredito |
|---|---|---|
| `size-8` | 32 (plate) | 🟢 valor alinhado; placa deveria vir do `FeaturedIcon` |
| `size-4` | 16 | 🟡 ícone manual (FeaturedIcon/Button auto-sizam) |
| `h-4 w-4` (×2) | 16 | 🟡 redundante dentro do `Button` (SZ2) |
| `h-5 w-5` | 20 | 🟡 convenção mista |
| `h-10 w-10` | 40 | 🟡 ícone de feature manual (→ `FeaturedIcon`) |
| `h-14` | 56 (altura do nav) | 🟢 layout (→ `Navbar size`) |
| `max-w-[var(--content-wide)]` | 96rem | ✅ **referencia token** `--content-wide` |
| `max-w-[42rem]` | 42rem | 🟢 == `--content-narrow` (não referencia) |
| `max-w-5xl` | 64rem | 🟢 == `--container-5xl` |

### 11.6 — Layout (⚪ sem token de design — ok)
`flex` · `flex-col` · `flex-1` · `min-h-screen` · `items-center` · `items-baseline?`(n/a) · `justify-center` · `justify-between` · `aspect-square` · `ml-auto` · `mx-auto` · `text-center` · `w-full` · `top-0` · `z-50` · `sticky` · `grid` · `md:grid-cols-3` · `flex-wrap` · `sm:flex-row` · `md:flex-row` · `container` · `transition-colors` · `supports-[backdrop-filter]:…`(estrutura da query)

### 11.7 — Veredito do estilo
| Classificação | Qtde | Itens |
|---|---|---|
| ✅ token-backed | 8 famílias | `bg-primary`/`-foreground`, `bg-muted`, `text-muted-foreground`, `hover:text-foreground`, `border*`, `rounded-lg`, `rounded-full`, `max-w-[var(--content-wide)]` |
| 🟢 value-aligned | ~12 | `gap-2/4/8`, `space-x-2/4`, `mb-2/4/8`, `p-3`, `py-6/16/24/32`, `tracking-tight/wider`, `size-8`, `h-14`, `max-w-[42rem]`, `max-w-5xl` |
| 🟡 drift (tipografia/sizing) | ~12 | `text-4xl…7xl`, `text-lg/xl`, `text-sm`, `font-bold/semibold/medium`, `size-4`, `h-4 w-4`, `h-5 w-5`, `h-10 w-10` |
| 🔴 off-system | **4** | **`bg-background/95`**, **`supports-[backdrop-filter]:bg-background/60`**, **`backdrop-blur`**, **`bg-muted/50`** |

> **Conclusão de estilo:** a tela é **token-limpa em cor sólida e spacing** — zero hex/cor hardcoded, spacing/radius/tracking alinhados, e até referencia `--content-wide`. Os **4 únicos estilos fora do sistema** são decorativos (opacidade-sobre-token + `backdrop-blur` do header "glass" e a faixa tech `bg-muted/50`). O grosso do débito **não é estilo** — é **componente**: nav, plate, pill, tipografia, feature cards, tech badges e footer são HTML cru que ignora a camada de componentes do Seven (resolvem com `Navbar`/`FeaturedIcon`/`Badge`/`Heading`/`Text`/`Card`/`FeatureItem`).

---

### Linha do coverage-matrix (índice)
```yaml
landing:
  route: src/client/routes/index.tsx
  fidelity: 0.52
  components_used: [Button]
  components_missing: [Navbar, Header, FeaturedIcon, Badge, Heading, Text, Paragraph, Card, FeatureItem, Container, Section, Grid, Divider]
  gaps:
    components: [C1, C2, C3, C4, C5, C6, C7, C8, C9]
    emitters:   [E1, E2, E3, E4]
    colors:     [CL1, CL2, CL3]
    spacing:    [SP1, SP2]
    typography: [TY1, TY2, TY3]
    sizing:     [SZ1, SZ2, SZ3]
    states:     [ST1, ST2, ST3]
  severity: { high: 3, medium: 8, low: 13 }
  unused_seven:                      # superfície do DS não aproveitada (seção 9)
    alternative_components: [Navbar, Header, FeaturedIcon, Badge, Heading, Text, Paragraph, Card, FeatureItem, Container, Section, Grid, Stack, Flex, Divider]
    unused_props: { Button: [leftIcon, rightIcon, icon, loading, loadingText, fullWidth, badge, badgeColor, badgeSize, tone, tooltip, data-id] }
    unused_variants: { Button: [primary, secondary, secondary-gray, secondary-color, destructive, ghost, dashed, link, link-gray, link-color, tertiary, tertiary-gray, tertiary-color, success, warning, unstyled] }
    unused_emitters: { Button: [onClick, onFocus, onBlur, onKeyDown] }
  user_actions:                      # seção 10
    total: 6
    wired: 5
    wired_stub: [A4, A5]             # ligadas porém href placeholder
    unwired: [A6]                    # logo→home; A7/A8/A9 = n/a/grátis
  style_audit:                       # seção 11 (classe-a-classe)
    token_backed: [bg-primary, bg-primary-foreground, bg-muted, text-muted-foreground, hover:text-foreground, border, rounded-lg, rounded-full, "max-w-[var(--content-wide)]"]
    value_aligned: [gap-2, gap-4, gap-8, space-x-2, space-x-4, mb-2, mb-4, mb-8, p-3, py-6, py-16, py-24, py-32, tracking-tight, tracking-wider, size-8, h-14, "max-w-[42rem]", max-w-5xl]
    drift: [text-4xl, text-5xl, text-6xl, text-7xl, text-lg, text-xl, text-sm, font-bold, font-semibold, font-medium, size-4, h-4-w-4, h-5-w-5, h-10-w-10]
    off_system: ["bg-background/95", "supports-backdrop-filter:bg-background/60", backdrop-blur, "bg-muted/50"]
    hardcoded_colors: 0
```
