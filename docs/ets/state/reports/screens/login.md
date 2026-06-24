# Auditoria de tela — Login

> **Rota:** `src/client/routes/login.tsx`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código** (source: exports, `*.variants.ts`, `*.types.ts`, tokens). Sem render/Figma.
> **Data:** 2026-06-24
> **Fidelidade:** 🟡 **62%** — tokens/cores limpíssimos e o CTA principal está ligado, mas reinventa à mão componentes que o Seven já entrega prontos (`Divider`, `Link`, `Heading`, `Text`) e subaproveita a API do `Button`.
>
> Severidade: 🔴 alta (quebra DS ou UX) · 🟡 média (foge do DS, funciona) · 🔵 baixa (polish)

---

## 0. Elementos da tela (o que está renderizado)

| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | painel de formulário | raw `<main>` | — (landmark semântico, ⚪ correto) |
| 2 | painel de marca (lado direito) | raw `<aside>` | — (landmark semântico, ⚪ correto) |
| 3 | brand mark (ícone + wordmark "Hono") | `<Link to="/">` (TanStack) + `<div>`/`<span>` crus | — (routing ok; conteúdo cru) |
| 4 | quadrado do ícone da marca | raw `<div className="… bg-primary">` | — (deveria ser `FeaturedIcon`) |
| 5 | título "Welcome back" | raw `<h1>` | — (deveria ser `Heading`) |
| 6 | subtítulo "Sign in to your account…" | raw `<p>` | — (deveria ser `Text`/`Paragraph`) |
| 7 | botão "Continue with ETUS" | `@etus/seven-react` | **`Button`** ✅ (único Seven na tela) |
| 8 | divisória "Secure authentication" | `<div>`+`<span border-t>` à mão | — (deveria ser `Divider type="text"`) |
| 9 | parágrafo de termos + 2 links | raw `<p>` + 2× raw `<a href="#">` | — (deveria ser `Text` + `Link`) |
| 10 | linha "Contact us" + link | raw `<div>` + raw `<a href="#">` | — (deveria ser `Text` + `Link`) |
| 11 | título "Welcome to Hono" (painel marca) | raw `<h2>` | — (deveria ser `Heading`) |
| 12 | parágrafo do painel de marca | raw `<p>` | — (deveria ser `Text`/`Paragraph`) |
| 13 | ícones (command, shield, spinner) | `@/components/icons` (lucide) | — (convenção do projeto, ok) |

---

## 1. GAPS de componentes & sub-componentes

| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | Títulos em HTML cru | `<h1>` ("Welcome back") e `<h2>` ("Welcome to Hono") em vez de `Heading` (exportado) | 🟡 | `<Heading level={1} size="3xl" weight="bold">` |
| **C2** | Corpo de texto em HTML cru | 4× `<p>` (subtítulo, termos, contato, pitch do painel) em vez de `Text`/`Paragraph` | 🟡 | `Text` (variants `p1/p2/caption*`) ou `Paragraph` |
| **C3** | Wordmark cru | `<span className="font-semibold">Hono</span>` em vez de `Text`/`Heading` | 🔵 | `<Text weight="semibold">` |
| **C4** | **Divisória reinventada à mão** | 10 linhas de `relative`/`absolute inset-0`/`border-t`/label centralizada (l.48–57) reconstroem **exatamente** o que o `Divider` faz nativo | 🟡 | `<Divider type="text" labelPosition="center">Secure authentication</Divider>` |
| **C5** | Âncoras cruas em vez de `Link` | 3× `<a href="#">` (Terms, Privacy, Contact) — o Seven exporta `Link` com `variant`/`underline`/`external`/foco | 🟡 | `<Link href="…" underline="always">` |
| **C6** | Quadrado de ícone da marca à mão | `<div className="… size-8 rounded-lg bg-primary">` em vez do primitivo `FeaturedIcon` | 🔵 | `<FeaturedIcon icon={<Icons.command/>}>` |

**Único componente Seven realmente usado:** `Button`. Tudo o mais é HTML cru reproduzindo primitivos que já existem no beta.4 (`Heading`, `Text`, `Paragraph`, `Divider`, `Link`, `FeaturedIcon` — todos confirmados no `index.d.ts` consumido).

---

## 2. GAPS de emitters / interações (callbacks, CTA, handlers)

> Diferente do dashboard, aqui **há ação ligada**: o `Button` tem `onClick={handleLogin}` + `disabled={isLoading}` e redireciona pra `/auth/login`. O problema é a **API do `Button` subaproveitada** e os **3 links mortos**.

| ID | Emitter/ação | Onde | Sev. | Correção |
|---|---|---|---|---|
| **E1** | `Button.loading` não usado | há troca manual `isLoading ? spinner : shield` + texto manual; o `Button` tem `loading` (mostra spinner nativo e **auto-desabilita**) | 🟡 | `loading={isLoading}` `loadingText="Redirecting..."` |
| **E2** | `Button.leftIcon` não usado | ícone vai como `children` com `mr-2` manual | 🟡 | `leftIcon={<Icons.shield className="size-4" />}` |
| **E3** | `Button.fullWidth` não usado | usa `className="w-full"` em vez do prop idiomático | 🔵 | `fullWidth` |
| **E4** | **3 links mortos** | `<a href="#">` Terms / Privacy / Contact — afordância que **não navega** (UI morta) | 🔴 | `Link href` real (rota/URL) — ver A3/A4/A5 |
| **E5** | Spinner manual | `<Icons.spinner className="animate-spin" />` duplica o spinner interno do `Button` (`loading`) e do primitivo `Spinner` | 🔵 | resolve junto com E1 |

**Pontos certos:** `onClick` ligado e funcional · `disabled` durante o loading · `<Link to="/">` (TanStack) na marca navega de fato.

---

## 3. GAPS de cores / tokens

| Elemento | Usa | Token Seven? | Veredito |
|---|---|---|---|
| quadrado da marca | `bg-primary` / `text-primary-foreground` | ✅ `--primary` / `--primary-foreground` | ✅ |
| textos secundários (×6) | `text-muted-foreground` | ✅ `--muted-foreground` | ✅ |
| links (hover/cor) | `hover:text-foreground` / `text-foreground` | ✅ `--foreground` | ✅ |
| label da divisória | `bg-background` | ✅ `--background` | ✅ |
| linha da divisória | `border-t` | ✅ `--border` | ✅ |
| painel de marca | `bg-muted` | ✅ `--muted` | ✅ |

→ **Cores 100% token-backed. Zero hardcoded** — nenhum hex, `text-*-500`, `bg-gray-*`. **Nenhum gap de cor** (CL = ∅). O único item fora de token na tela é dimensional (`w-[350px]`, ver §6/§11), não cromático.

---

## 4. GAPS de espaçamento

| Onde | Usa | Tipo | Veredito |
|---|---|---|---|
| card do formulário | `gap-6` (24px) | layout de página (raw Tailwind) | 🟢 = `--spacing-6` |
| grupos internos | `gap-2` (8px) ·`gap-4` (16px) | layout (raw) | 🟢 = `--spacing-2/4` |
| painel de marca | `space-y-2` (8px) ·`p-10` (40px) | layout (raw) | 🟢 = `--spacing-2/10` |
| padding do `<main>` | `px-4` (16) ·`py-12` (48) | layout (raw) | 🟢 = `--spacing-4/12` |
| ícone/label | `px-2` ·`mr-2` (8px) | layout (raw) | 🟢 = `--spacing-2` |
| **ritmo misto** | `gap-6` no card vs `space-y-2` no painel | — | 🔵 **SP1** ritmos diferentes nos dois painéis (cosmético) |

→ Espaçamento **todo value-aligned** com a escala do Seven (que espelha a do Tailwind). Sem violação de spacing.

---

## 5. GAPS de tipografia

| Elemento | Tela | Seven esperado | Sev. |
|---|---|---|---|
| `<h1>` / `<h2>` | `text-3xl font-bold tracking-tight` (escala Tailwind solta) | `Heading` (`level`/`size`/`weight` por token) | 🟡 **TY1** (= C1) |
| `<p>` subtítulo / pitch | `text-balance text-muted-foreground` · `text-lg` | `Text`/`Paragraph` (variant `p1`/`lead`) | 🟡 **TY2** (= C2) |
| `<p>` termos / contato | `text-xs` · `text-sm` | `Text` (variant `caption1`/`p3`, `color="muted"`) | 🟡 **TY2** (= C2) |
| pesos crus | `font-semibold` (wordmark) · `font-medium` (link) · `font-bold` (títulos) | prop `weight` de `Heading`/`Text` | 🟡 **TY3** |
| `tracking-tight` | -0.025em | == `--font-tracking-tight` | 🟢 (valor alinhado) |
| `uppercase` na label da divisória | text-transform | utilitário, sem token | ⚪ (some com `Divider`) |

> O guard-rail do ESLint **não** bane `h1/h2/p/span/a` (só `button/input/select/textarea`) — passa o lint, mas é drift de DS.

---

## 6. GAPS de sizing / ícones

| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | **Largura arbitrária off-grid** | `w-[350px]` no card — 350px **não** está na escala de spacing (fora do grid de 4px) nem em nenhum token | 🔵 | trocar por `max-w-sm` (384px) ou `Container` |
| **SZ2** | `w-full` na largura do `Button` | deveria vir do prop `fullWidth` (= E3) | 🔵 | `fullWidth` |
| **SZ3** | Sizing de ícone **consistente** | todos os ícones em `size-4` (16px); quadrado da marca `size-8` (32px) | ✅ | (ponto positivo — sem mistura `h-x w-x`) |

→ Ícones padronizados (melhor que o dashboard, que misturava `size-4`/`h-5 w-5`). Único ponto cru é a largura `w-[350px]`.

---

## 7. GAPS de estados

| Estado | Tela | Seven oferece | Sev. |
|---|---|---|---|
| loading | 🟡 presente, porém **manual** (swap de ícone + texto) | `Button.loading` + `loadingText` (spinner nativo, auto-disable) | 🟡 **ST1** (= E1) |
| disabled | ✅ presente (`disabled={isLoading}`) | nativo do `Button` | ✅ |
| hover | ✅ links têm `hover:text-foreground`; `Button` tem hover nativo | — | ✅ |
| focus-visible | 🟡 só o `Button` tem ring nativo; os 3 `<a>` crus **não têm anel de foco** (a11y) | `Link` adiciona foco do DS | 🟡 **ST2** |
| erro | ❌ se o redirect `/auth/login` falhar, fica preso em `loading` sem feedback | `Alert`/`Message`/`Toast` | 🔵 **ST3** |

---

## 8. Consolidado — backlog priorizado

| Prioridade | IDs | Resumo |
|---|---|---|
| 🔴 **Must-fix** | E4 | 3 links mortos (`href="#"`) — Terms / Privacy / Contact não navegam |
| 🟡 **Should-fix** | C4, C5·ST2, C1·TY1, C2·TY2·TY3, E1·E2·ST1 | divisória→`Divider`; âncoras→`Link` (+foco); títulos→`Heading`; corpo→`Text`; `Button.loading`/`leftIcon` |
| 🔵 **Nice-to-have** | C3, C6, E3·SZ2, SP1, SZ1, ST3 | wordmark→`Text`; marca→`FeaturedIcon`; `fullWidth`; ritmo; `max-w-sm`; estado de erro |

**Pontos corretos (não mexer):** `Button` usado e **ligado** · cores/tokens 100% limpos · spacing value-aligned · ícones consistentes em `size-4` · landmarks `<main>`/`<aside>` semânticos · `<Link to="/">` navegando.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

> Inventário do que o Seven oferece e a tela **não** aproveita. `[u]` = não usado.

### 9.1 — Botão de login (hoje `Button`)
| Categoria | Disponível no Seven | Usado? |
|---|---|---|
| Props usados | `className` · `disabled` · `onClick` | ✅ |
| Props `[u]` | `loading` · `loadingText` · `leftIcon` · `rightIcon` · `icon` · `fullWidth` · `badge` · `badgeColor` · `badgeSize` · `tooltip` · `tone` · `asChild` · `shape` | ❌ |
| Variants `[u]` | `primary` · `secondary` · `secondary-gray` · `secondary-color` · `outline` · `dashed` · `ghost` · `link` · `link-gray` · `link-color` · `tertiary-gray` · `tertiary-color` · `destructive` · `success` · `warning` · `unstyled` (usa `default`) | ❌ |
| Sizes `[u]` | `sm` · `lg` · `icon` · `icon-sm` (usa `default`) | ❌ |
| Emitters `[u]` | `onFocus` · `onBlur` · `onKeyDown` + payload `ButtonEventPayload` (`id`,`isLoading`,`timestamp`); `onClick` usado mas **sem** payload | ❌/parcial |

### 9.2 — Divisória (hoje `<div>`/`<span border-t>` cru)
| Categoria | Disponível `[u]` | Uso |
|---|---|---|
| **Componente** | **`Divider`** | ❌ reinventado à mão |
| `type` | `line` · **`text`** · `heading` · `button` · `button-group` · `button-icon` · `button-group-icon` | ❌ |
| `labelPosition` | `left` · `center` · `right` | ❌ |
| `visualStyle` | `single-line` · `dual-line` · `background-fill` | ❌ |
| `lineType` | `solid` · `dashed` · `dotted` | ❌ |
| `orientation` | `horizontal` · `vertical` | ❌ |

### 9.3 — Links (hoje 3× `<a href="#">` cru)
| Categoria | Disponível `[u]` (`Link`) | Uso |
|---|---|---|
| `variant` | `default` · `muted` · `subtle` · `nav` · `inline` · `unstyled` | ❌ |
| `size` | `xs` · `sm` · `default` · `lg` · `inherit` | ❌ |
| `underline` | `always` · `hover` · `none` | ❌ |
| Props | `external` · `showExternalIcon` · `leftIcon` · `rightIcon` · `asChild` · `onClick`+`LinkEventPayload` (`href`,`isExternal`,`timestamp`) | ❌ |

### 9.4 — Títulos / textos (hoje `<h1>`/`<h2>`/`<p>`/`<span>` crus)
| Elemento | Componente Seven `[u]` | Eixos não aproveitados |
|---|---|---|
| `<h1>`/`<h2>` | **`Heading`** | `level(1-6)` · `size(4xl…)` · `weight(normal→extrabold)` · `align` · `color(default/muted/primary/destructive)` · `gradient(primary/secondary/accent/rainbow)` |
| `<p>` | **`Text`** / **`Paragraph`** | `variant(display*/p1-p3/caption*/code)` · `size` · `weight` · `color(default/muted)` · `align` · `leading` · `prose` |

### 9.5 — Marca / layout (hoje `<div>`/grid cru)
| Disponível `[u]` | Uso |
|---|---|
| **`FeaturedIcon`** | quadrado do ícone da marca (hoje `div` + `bg-primary`) |
| `Container` · `Section` · `Stack` · `Grid` · `Flex` | estruturariam os painéis com tokens em vez de `grid`/`w-[350px]`/`space-y-*` crus |
| `Card` | poderia envolver o formulário (`CardHeader`/`CardContent`/`CardFooter`) |
| `Form` · `Field` · `Label` | se a tela evoluir pra e-mail/senha além do OAuth |

---

## 10. Ações possíveis do usuário (mapa completo)

> Toda ação que o usuário **poderia** executar, o gatilho, o status atual e o primitivo Seven que a ligaria.
> **Resultado: 2 de 5 ações estão ligadas — o CTA principal e a marca funcionam; os 3 links legais/contato estão mortos.**

| # | Ação possível | Gatilho (elemento) | Status | Como ligar (Seven) |
|---|---|---|---|---|
| A1 | Entrar com ETUS (OAuth) | `Button` "Continue with ETUS" | ✅ **ligada** (`onClick`→`window.location.href='/auth/login'`) | refinar com `loading`/`leftIcon`/`fullWidth` |
| A2 | Ir pra home pela marca | `<Link to="/">` (TanStack) | ✅ **ligada** (routing) | ok (manter) |
| A3 | Abrir Termos de Serviço | `<a href="#">` | 🔴 **não-ligada** (`href="#"`) | `Link href="/terms"` (ou `external`) |
| A4 | Abrir Política de Privacidade | `<a href="#">` | 🔴 **não-ligada** | `Link href="/privacy"` |
| A5 | Falar com o time ("Contact us") | `<a href="#">` | 🔴 **não-ligada** | `Link href="mailto:…"` `external` |
| A6 | Foco/teclado nos links | os 3 `<a>` | ⚪ parcial (âncora nativa, **sem ring do DS**) | vem de graça com `Link` (`focus-visible`) |

**Emitters do `Button`/`Link` quando as ações forem ligadas:** `onClick`/`onFocus`/`onBlur`/`onKeyDown` (payload `ButtonEventPayload`); `Link.onClick` (payload `LinkEventPayload`: `href`,`isExternal`,`timestamp`).

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)

> **Toda** classe literal da tela, classificada contra os tokens do Seven. Legenda:
> ✅ **token-backed** · 🟢 **value-aligned** (utilitário Tailwind cujo valor == token Seven) · 🟡 **drift** (cru onde um componente/token Seven deveria mandar) · 🔴 **off-system** (sem token equivalente) · ⚪ layout (estrutural, sem token de design)
>
> Nota-chave: a escala de spacing do Seven **espelha a do Tailwind** (`--spacing-2`=8px=`gap-2`; `--spacing-4`=16px=`gap-4`; `--spacing-6`=24px=`gap-6`), e `--font-tracking-tight`=`tracking-tight`=-0.025em. Por isso muito "cru" é 🟢, não violação.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `bg-primary` · `text-primary-foreground` | `--primary` / `--primary-foreground` | ✅ |
| `text-muted-foreground` (×6) | `--muted-foreground` | ✅ |
| `text-foreground` · `hover:text-foreground` | `--foreground` | ✅ |
| `bg-background` | `--background` | ✅ |
| `bg-muted` | `--muted` | ✅ |
| `border-t` (cor) | `--border` | ✅ |
| *(nenhuma cor hardcoded — hex, `text-*-500`, `bg-gray-*`)* | — | ✅ limpo |

### 11.2 — Espaçamento
| Classe | Valor | Token Seven equiv. | Veredito |
|---|---|---|---|
| `gap-6` | 24px | `--spacing-6` | 🟢 |
| `gap-4` | 16px | `--spacing-4` | 🟢 |
| `gap-2` (×2) | 8px | `--spacing-2` | 🟢 |
| `space-y-2` | 8px | `--spacing-2` | 🟢 |
| `px-4` ·`py-12` | 16 / 48px | `--spacing-4` / `--spacing-12` | 🟢 |
| `p-10` | 40px | `--spacing-10` | 🟢 |
| `px-2` ·`mr-2` (×2) | 8px | `--spacing-2` | 🟢 |

### 11.3 — Bordas & radius
| Classe | Resolve em | Veredito |
|---|---|---|
| `border-t` · `border` | `--border` | ✅ |
| `rounded-lg` | `--radius-lg` (12px no Seven) | ✅ |

### 11.4 — Tipografia
| Classe | Valor | Veredito | Observação |
|---|---|---|---|
| `text-3xl` (×2) | 1.875rem | 🟡 | título deveria vir do `Heading` |
| `text-lg` | 1.125rem | 🟡 | corpo deveria vir do `Text` (`p1`/`lead`) |
| `text-sm` (×2) | 0.875rem | 🟡 | `Text` (`p3`) |
| `text-xs` (×2) | 0.75rem | 🟡 | `Text` (`caption1/2`) |
| `font-bold` (×2) | 700 | 🟡 | peso do `Heading` |
| `font-semibold` | 600 | 🟡 | peso do `Text`/`Heading` |
| `font-medium` | 500 | 🟡 | peso do `Link`/`Text` |
| `tracking-tight` (×2) | -0.025em | 🟢 | == `--font-tracking-tight` |
| `uppercase` | — | ⚪ | text-transform (some com `Divider`) |
| `text-balance` | — | ⚪ | text-wrap utilitário, sem token |
| `underline` · `underline-offset-4` (×3) | — | ⚪ | text-decoration; o próprio `Link` usa `underline-offset-4` interno |

### 11.5 — Sizing (ícones / dimensões)
| Classe | Valor | Veredito |
|---|---|---|
| `size-4` (×3) | 16px | 🟢 (= `--spacing-4`; consistente) |
| `size-8` | 32px | 🟢 (= `--spacing-8`) |
| `aspect-square` | — | ⚪ (ratio, estrutural) |
| **`w-[350px]`** | 350px | 🔴 **único off-system real** — off-grid (4px), sem token; usar `max-w-sm`/`Container` |

### 11.6 — Layout (⚪ sem token de design — ok)
`w-full` (×3) · `grid` · `lg:grid` · `lg:grid-cols-2` · `min-h-screen` · `lg:min-h-screen` · `lg:min-h-0` · `flex` · `items-center` · `items-baseline`? (n/a) · `justify-center` · `mx-auto` · `relative` · `absolute` · `inset-0` · `hidden` · `lg:block` · `h-full` · `max-w-md` · `text-center` · `animate-spin` (motion utility; resolve via `Button.loading`)

### 11.7 — Veredito do estilo
| Classificação | Qtde | Itens |
|---|---|---|
| ✅ token-backed | 2 famílias | cores (todas), `border`/`rounded-lg` |
| 🟢 value-aligned | 8 | `gap-6/4/2`, `space-y-2`, `px-4`, `py-12`, `p-10`, `px-2`, `mr-2`, `size-4/8`, `tracking-tight` |
| 🟡 drift (tipografia) | 7 | `text-3xl`, `text-lg`, `text-sm`, `text-xs`, `font-bold`, `font-semibold`, `font-medium` |
| 🔴 off-system | **1** | **`w-[350px]`** (largura arbitrária off-grid) |

> **Conclusão de estilo:** a tela é **token-limpa** — **zero cor hardcoded**, spacing/radius/tracking todos alinhados, ícones consistentes. O **único** estilo genuinamente fora do sistema é `w-[350px]` (resolve com `max-w-sm`/`Container`). O grosso da dívida **não é estilo, é componente**: a tela renderiza com `<h1>/<p>/<a>/<div>` aquilo que `Heading`/`Text`/`Link`/`Divider`/`FeaturedIcon` já entregam — drift de tipografia + 3 links mortos + `Button` subaproveitado.

---

### Linha do coverage-matrix (índice)
```yaml
login:
  route: src/client/routes/login.tsx
  fidelity: 0.62
  components_used: [Button]
  components_missing: [Heading, Text, Paragraph, Divider, Link, FeaturedIcon]
  gaps:
    components: [C1, C2, C3, C4, C5, C6]
    emitters:   [E1, E2, E3, E4, E5]
    colors:     []                       # zero hardcoded — cores 100% token-backed
    spacing:    [SP1]
    typography: [TY1, TY2, TY3]
    sizing:     [SZ1, SZ2, SZ3]
    states:     [ST1, ST2, ST3]
  severity: { high: 1, medium: 9, low: 8 }
  unused_seven:                          # superfície do DS não aproveitada (seção 9)
    alternative_components: [Heading, Text, Paragraph, Divider, Link, FeaturedIcon, Container, Section, Stack, Card, Form, Field]
    unused_props: { Button: [loading, loadingText, leftIcon, rightIcon, icon, fullWidth, badge, badgeColor, badgeSize, tooltip, tone, asChild, shape] }
    unused_variants: { Button: [primary, secondary, secondary-gray, secondary-color, outline, dashed, ghost, link, link-gray, link-color, tertiary-gray, tertiary-color, destructive, success, warning, unstyled] }
    unused_subcomponents: { Divider: [type, labelPosition, visualStyle, lineType], Link: [variant, size, underline, external, leftIcon, rightIcon] }
  user_actions:                          # seção 10
    total: 5
    wired: 2                             # A1 (login OAuth) + A2 (brand → home)
    unwired: [A3, A4, A5]                # Terms / Privacy / Contact = href="#" mortos; A6 = parcial (n/a)
  style_audit:                           # seção 11 (classe-a-classe)
    token_backed: [colors, border, rounded-lg]
    value_aligned: [gap-6, gap-4, gap-2, space-y-2, px-4, py-12, p-10, px-2, mr-2, size-4, size-8, tracking-tight]
    drift: [text-3xl, text-lg, text-sm, text-xs, font-bold, font-semibold, font-medium]
    off_system: [w-[350px]]              # único estilo sem token Seven (largura off-grid)
    hardcoded_colors: 0
```
