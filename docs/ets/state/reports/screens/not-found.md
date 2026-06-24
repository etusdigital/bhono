# Auditoria de tela — Not Found (404)

> **Rota:** `src/client/routes/$.tsx`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código** (source: exports, `*.variants.ts`, `*.types.ts`, tokens). Sem render/Figma.
> **Data:** 2026-06-24
> **Fidelidade:** 🟡 **62%** — funciona e é token-limpa, mas **reimplementa à mão o `ErrorPage type="404"`** que o Seven já entrega pronto (com defaults pt-BR), tipa tudo em HTML cru, e adiciona decoração off-brand.
>
> Severidade: 🔴 alta (quebra DS ou UX) · 🟡 média (foge do DS, funciona) · 🔵 baixa (polish)

---

## 0. Elementos da tela (o que está renderizado)

| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | brand mark (plate mint + "Hono") | raw `<div>`+`<span>` dentro de `<Link>` | — (plate intencional do projeto; Seven tem `Logo`/`Brand`) |
| 2 | shell da página (header/main/wrappers) | raw `<header>`/`<main>`/`<div>` | — (Seven: `Section`·`Container`·`Stack`·`Flex`) |
| 3 | "404" gigante (watermark) | raw `<div>` `text-[12rem] text-muted/20` | — (Seven: `Text variant="display1"` **ou** `ErrorPage` slot `code`) |
| 4 | pill "Page not found" | raw `<div>`+`<span>` (`text-lg`) | — (Seven: `Heading`/`Text` **ou** `ErrorPage` slot `title`) |
| 5 | parágrafo de mensagem | raw `<p>` | — (`Text`/`Paragraph` **ou** `ErrorPage` slot `description`) |
| 6 | 2× botão de navegação | `@etus/seven-react` | **`Button`** (`asChild` → `Link` do TanStack) ✅ |
| 7 | help text + "Contact support" | raw `<p>` + raw `<a href="mailto:…">` | — (`Text` + **`Link`**) |
| 8 | 2× blob decorativo (blur) | raw `<div>` `bg-primary/5 blur-3xl` | — (decoração; brand Seven = "no decoration") |
| 9 | ícones | `@/components/icons` (lucide) | — (convenção do projeto, ok) |

> **Achado dominante:** a tela inteira (itens 2–5, 7) é uma reimplementação manual do componente **`ErrorPage`** do Seven, que existe no pacote consumido (`declare function ErrorPage(...)`), cobre exatamente o caso 404 e **já traz as cópias em pt-BR** que esta tela escreveu à mão em inglês. Ver C1.

---

## 1. GAPS de componentes & sub-componentes

| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | Tela reimplementa o `ErrorPage` | Seven exporta `ErrorPage` (feedback) com `type="404"` → entrega `code`, `title`, `description` (defaults **pt-BR**: *"Página não encontrada" / "A página que você está procurando não existe ou foi movida."*), slot `actions`, `showHomeLink`/`showBackLink`, `onRetry`/`loading`, `fullScreen`, `icon`/`illustration`. A tela refaz tudo isso na unha. | 🔴 | trocar o miolo por `<ErrorPage type="404" fullScreen actions={<…Buttons…/>} />` |
| **C2** | Tipografia em HTML cru | "404" (`<div>`), "Page not found" (`<span>`) e 2× `<p>` em vez de `Heading`/`Text`/`Paragraph` (todos exportados) | 🟡 | `Text variant="display1"` no número, `Heading` no título, `Text`/`Paragraph` nos parágrafos |
| **C3** | Link de suporte em `<a>` cru | `<a href="mailto:…">` em vez do primitivo **`Link`** (tem `external`, `leftIcon`/`rightIcon`, `onClick` com payload, `variant`/`underline`) | 🟡 | `<Link href="mailto:…" leftIcon={<Mail/>}>` |
| **C4** | Brand mark hand-rolled | logo plate (`<div bg-primary>` + `Icons.command`) + `<span>Hono</span>`; Seven exporta `Logo`/`Brand`. O plate mint é **intencional** (commit de unificação de marca), mas é superfície Seven ignorada | 🔵 | ok manter o plate; ciente de `Logo`/`Brand` |
| **C5** | `Button` com `asChild` bypassa a própria API | com `asChild` o Radix Slot funde só className no `<Link>`; `leftIcon`/`loading`/`badge`/`tooltip`/`loadingText` do `Button` ficam inertes; o ícone é injetado manualmente | 🔵 | aceitável p/ navegação; ciente de que a API rica do `Button` não é exercida |

**Sub-componentes/famílias do Seven disponíveis e NÃO usados:** `ErrorPage` (inteiro) · `Empty`/`EmptyHeader`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent` · `Heading` · `Text` · `Paragraph` · `Link` · `Section`/`Container`/`Stack`/`Flex`.

---

## 2. GAPS de emitters / interações (callbacks, CTA, handlers)

> Diferente do Dashboard, **aqui as ações principais ESTÃO ligadas** (navegação via `Button asChild` → `Link`). Os gaps são de ações que o `ErrorPage` ofereceria de graça e de conteúdo hardcoded.

| ID | Emitter/ação ausente | Onde | Sev. | Correção |
|---|---|---|---|---|
| **E1** | Sem "Voltar" | a tela só oferece Home/Dashboard; não há back. `ErrorPage` tem `showBackLink` com handler nativo (`window.history.back()`) | 🟡 | `ErrorPage showBackLink` (default `true`) |
| **E2** | E-mail de suporte hardcoded | `mailto:support@example.com` é **placeholder literal**, não ligado a config/env | 🟡 | apontar p/ e-mail real (Regra 6 — fora de DS, mas é gap funcional) |
| **E3** | `onRetry`/`retryLabel`/`loading` não usados | n/a forte p/ 404, mas o `ErrorPage` oferece o ciclo de retry nativo | 🔵 | só relevante se a rota virar erro recuperável |
| **E4** | Payload callbacks do `Button` não usados | `onClick`/`onFocus`/`onBlur`/`onKeyDown` (`ButtonEventPayload`: `id`/`isLoading`/`timestamp`) — navegação é via `Link`, então ok | 🔵 | manter; ciente da telemetria disponível |
| **E5** | Payload/`external` do `Link` não usado | o `<a>` cru não tem `onClick(payload)` nem `external`/`showExternalIcon` | 🔵 | resolve junto com C3 |

---

## 3. GAPS de cores / tokens

| Elemento | Usa | Token Seven? | Veredito |
|---|---|---|---|
| logo plate bg/fg | `bg-primary` / `text-primary-foreground` | ✅ `--primary` / `--primary-foreground` | ✅ |
| pill | `bg-background` / `ring-border` / `shadow-lg` | ✅ `--background` / `--border` / `--shadow-lg` | ✅ |
| texto secundário | `text-muted-foreground` (×2) | ✅ `--muted-foreground` | ✅ |
| link de suporte | `text-foreground` | ✅ `--foreground` | ✅ |
| **"404" watermark** | `text-muted/20` | ⚠️ `--muted` resolve, mas é token de **superfície** usado como **cor de texto** (o par foreground seria `--muted-foreground`) | 🔵 **CL1** |
| **blobs decorativos** | `bg-primary/5` (×2) | ✅ `--primary` @5% — token ok, mas a **decoração** em si fere o brand ("no decoration") | 🔵 (ver SP1) |

→ Cores **100% token-backed** — zero hex/`text-gray-*`/`bg-[#…]`. Únicas ressalvas são semânticas (`--muted` como texto) e de brand (decoração), não de token.

---

## 4. GAPS de espaçamento

| Onde | Usa | Tipo | Veredito |
|---|---|---|---|
| ritmo da página | `mb-8` (32px ×2), `mt-8` (32px), `gap-3` (12px), `space-x-2` (8px) | layout raw, valores == tokens | 🟢 value-aligned |
| header/shell | `h-14` (56px), `px-4`/`px-6`/`py-2` | raw, == `--spacing-*` | 🟢 |
| ícones/plate | `size-8` (32px), `size-4` (16px), `mr-2` (8px) | raw, == `--spacing-*` | 🟢 |
| **blobs decorativos** | `h-[500px] w-[500px]` (×2) | **arbitrário, sem token** | 🔴 **SP1** (off-system + viola "no decoration") |
| posição dos blobs | `-top-40`/`-bottom-40` (160px) | valor da escala Tailwind, mas posicionamento decorativo | ⚪ |

→ Todo o espaçamento **estrutural** é value-aligned (escala do Seven espelha a do Tailwind). O único furo é o **sizing arbitrário dos blobs** (`[500px]`), que some se a decoração for removida.

---

## 5. GAPS de tipografia

| Elemento | Tela | Seven esperado | Sev. |
|---|---|---|---|
| "404" gigante | `text-[12rem] font-bold leading-none tracking-tighter` (display **arbitrário**) | `Text variant="display1"` (tokens `--typography-display-*`) **ou** slot `code` do `ErrorPage` (`text-6xl md:text-8xl`) | 🔴 **TY1** |
| "Page not found" | `<span className="text-lg font-medium">` (span cru) | `Heading`/`Text` **ou** slot `title` do `ErrorPage` | 🟡 **TY2** |
| parágrafos | `<p className="text-muted-foreground">` / `text-sm` | `Text`/`Paragraph` **ou** slot `description` | 🟡 **TY3** |
| **idioma da cópia** | tudo em **inglês** ("Page not found", "Back to Home", "Need help?", "Contact support") | brand Seven exige **sentence-case pt-BR**; o `ErrorPage` já entrega defaults pt-BR | 🟡 **TY4** (brand/locale) |

> `font-bold`/`font-semibold`/`font-medium`/`tracking-tighter` são **value-aligned** (== `--font-weight-*` / `--font-tracking-tighter`); o problema não é o peso/tracking, é estarem em **HTML cru** e o `text-[12rem]` ser **arbitrário**. Guard-rail do ESLint **não** bane `span/p/a` (só `button/input/select/textarea`) — passa lint, mas é drift de DS.

---

## 6. GAPS de sizing / ícones

| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | Convenção de utilitário mista | plate/ícone usam `size-8`/`size-4`; ícones nos botões usam `h-4 w-4` | 🔵 padronizar p/ `size-*` |
| **SZ2** | `h-4 w-4` redundante nos botões | o `Button` já aplica `[&_svg:not([class*='size-'])]:size-4` — a classe manual é dispensável | 🔵 remover (deixar o Button dimensionar) |
| **SZ3** | "404" `text-[12rem]` = sizing arbitrário | 192px sem token de display | 🔴 (= TY1) |

---

## 7. GAPS de estados

| Estado | Tela | Seven oferece | Sev. |
|---|---|---|---|
| back/voltar | ❌ ausente | `ErrorPage showBackLink` (handler nativo) | 🟡 **ST1** (= E1) |
| loading/retry | ❌ ausente | `ErrorPage loading`/`onRetry`/`retryLabel` | 🔵 **ST2** (= E3) |
| hover/focus dos botões | ✅ vêm do `Button` (`focus-visible:ring-4`, `hover:translate-y-px`, `active:translate-y-0.5`) | — | ✅ |
| focus do link de suporte | 🟡 `<a>` cru só tem `underline-offset-4`; sem o `focus-visible:ring` do `Link` | `Link` (ring de foco nativo) | 🔵 **ST3** (= C3) |

---

## 8. Consolidado — backlog priorizado

| Prioridade | IDs | Resumo |
|---|---|---|
| 🔴 **Must-fix** | C1, TY1·SZ3, SP1 | adotar `ErrorPage type="404"`; matar o display arbitrário `text-[12rem]`; remover sizing arbitrário/decoração dos blobs |
| 🟡 **Should-fix** | C2·TY2·TY3, C3·E5·ST3, TY4, E1·ST1, E2 | tipografia → `Heading`/`Text`/`Paragraph`; `<a>` → `Link`; cópia pt-BR; back link; e-mail de suporte real |
| 🔵 **Nice-to-have** | C4, C5, E3·ST2, CL1, SZ1, SZ2 | ciente de `Logo`/`Brand`; API rica do `Button`; retry; `--muted` como texto; padronizar `size-*` |

**Pontos corretos (não mexer):** uso do `Button` com `asChild` p/ navegação · **ações principais ligadas** (Home/Dashboard/brand/suporte) · cores 100% token-backed · espaçamento estrutural value-aligned · sem violação de guard-rail do ESLint.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

> Inventário do que o Seven oferece e a tela **não** aproveita — props, variants, sub-componentes, estados e **componentes alternativos**. `[u]` = não usado.

### 9.1 — Layout 404 (hoje `<div>`/`<header>`/`<main>` crus)
| Categoria | Disponível no Seven | Usado? |
|---|---|---|
| **Componente alternativo `[u]`** | **`ErrorPage`** — props: `type`(401/403/404/500/generic/maintenance/offline) · `code` · `title` · `description` · `actions` · `icon` · `illustration` · `homeHref` · `showHomeLink` · `showBackLink` · `onRetry` · `retryLabel` · `loading` · `fullScreen` | ❌ nunca considerado |
| **Componente alternativo `[u]`** | **`Empty*`** (`Empty`/`EmptyHeader`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent`) — fit secundário (mais p/ estado-vazio de dados que p/ 404) | ❌ |
| Estrutura `[u]` | `Section` · `Container` · `Stack` · `Flex` (tokens de espaçamento em vez de `flex`/`min-h-screen` crus) | ❌ |

### 9.2 — Botões de navegação (hoje `Button` ✅)
| Categoria | Disponível | Usado? |
|---|---|---|
| Props usadas | `variant` (`default`/`outline`) · `asChild` | ✅ |
| Variants `[u]` | `primary` · `secondary`(+`tone`) · `destructive` · `ghost` · `link`(+`tone`) · `secondary-gray`/`-color` · `tertiary`/`-gray`/`-color` · `link-gray`/`-color` | ❌ |
| Sizes `[u]` | `sm` · `lg` · `icon` · `icon-sm` (usa `default`) | ❌ |
| Shapes `[u]` | `square` · `circle` (usa `default`) | ❌ |
| Props `[u]` | `leftIcon` · `rightIcon` · `icon` · `loading` · `loadingText` · `badge`/`badgeColor`/`badgeSize` · `tooltip` · `fullWidth` · `data-id` | ❌ (bypassadas por `asChild`) |
| Emitters `[u]` | `onClick`/`onFocus`/`onBlur`/`onKeyDown` (`ButtonEventPayload`) | ❌ |

### 9.3 — "404" / título / textos (hoje `<div>`/`<span>`/`<p>` crus)
| Elemento | Componente Seven `[u]` | Eixos não aproveitados |
|---|---|---|
| "404" | **`Text`** | `variant` (`display1`/`display2`/`display3`/`p1`–`p3`/`caption1`/`caption2`/`code`) · `size` · `weight` · `as`/`asChild` |
| "Page not found" | **`Heading`** | `level(1-6)` · `size(sm→4xl)` · `weight` · `align` · `color(default/muted/primary/destructive)` · `gradient(primary/secondary/accent/rainbow)` |
| parágrafos | **`Paragraph`** / **`Text`** | `size` · `weight` · `color(default/muted)` · `align` · `leading` · `spacing` · `prose` |

### 9.4 — Link de suporte (hoje `<a mailto>` cru)
| Categoria | Disponível em **`Link`** `[u]` | Uso |
|---|---|---|
| Variants | `default` · `muted` · `nav` · `inline` | ❌ |
| Props | `external` · `showExternalIcon` · `leftIcon` · `rightIcon` · `underline(always/hover/none)` · `size` · `asChild` · `data-id` | ❌ |
| Emitter | `onClick(event, LinkEventPayload{href,id,isExternal,timestamp})` | ❌ |

### 9.5 — Brand mark (hoje plate `<div>` + `<span>` cru — intencional)
| Disponível `[u]` | Uso |
|---|---|
| `Logo` · `Brand` | exportados no pacote; projeto usa o plate mint de propósito (ciente) |

---

## 10. Ações possíveis do usuário (mapa completo)

> Toda ação que o usuário **poderia** executar, o gatilho, o status atual e o primitivo Seven que a ligaria.
> **Resultado: 4 de 5 ações estão ligadas — esta tela é funcional (≠ Dashboard, que tinha 0/8).**

| # | Ação possível | Gatilho (elemento) | Status | Como (está / ligaria) |
|---|---|---|---|---|
| A1 | Voltar à Home | `Button` "Back to Home" | ✅ **ligada** | `Button asChild` → `<Link to="/">` |
| A2 | Ir ao Dashboard | `Button variant="outline"` "Go to Dashboard" | ✅ **ligada** | `Button asChild` → `<Link to="/dashboard">` (rota protegida → bounce p/ login se deslogado) |
| A3 | Home via brand mark | `<Link to="/">` no header | ✅ **ligada** | `Link` do TanStack (raw `<a>` por baixo) |
| A4 | Falar com suporte | `<a href="mailto:support@example.com">` | ✅ **ligada** (mas `<a>` cru + e-mail placeholder) | hoje raw; ligar via `Link href="mailto:…"` (C3) + e-mail real (E2) |
| A5 | Voltar à página anterior | — (sem elemento) | 🔴 **não-ligada** | `ErrorPage showBackLink` (`window.history.back()` nativo) |
| A6 | Retry/recarregar | — | ⚪ n/a p/ 404 | `ErrorPage onRetry`/`loading` se virar erro recuperável |
| A7 | Foco/teclado nas ações | botões + links | ✅ de graça | `Button` (`focus-visible:ring-4`) e `Link` (ring nativo) |

**Contagem:** **4 ligadas / 5 acionáveis** (A1–A4 ok; A5 "voltar" ausente). A6 = n/a; A7 = grátis. Ressalvas em A2 (rota protegida) e A4 (`<a>` cru + e-mail hardcoded).

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)

> **Toda** classe literal da tela, classificada contra os tokens do Seven. Legenda:
> ✅ **token-backed** · 🟢 **value-aligned** (utilitário Tailwind cujo valor == token Seven) · 🟡 **drift** (cru onde um componente/token Seven deveria mandar) · 🔴 **off-system** (sem token equivalente) · ⚪ layout (estrutural)
>
> Nota-chave: a escala de spacing do Seven **espelha a do Tailwind** (`--spacing-2`=8px=`gap-2`; `--spacing-8`=32px=`mb-8`), `--font-tracking-tighter`=`tracking-tighter`=-0.05em e `--font-weight-bold/semibold/medium`=700/600/500. Por isso muito "cru" é 🟢, não violação.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `bg-primary` / `text-primary-foreground` | `--primary` / `--primary-foreground` | ✅ |
| `bg-background` | `--background` | ✅ |
| `ring-border` | `--border` | ✅ |
| `text-muted-foreground` (×2) | `--muted-foreground` | ✅ |
| `text-foreground` | `--foreground` | ✅ |
| `text-muted/20` | `--muted` @20% (token de superfície usado como texto) | ✅ (nota semântica CL1) |
| `bg-primary/5` (×2) | `--primary` @5% (decorativo) | ✅ (decoração off-brand) |
| *(nenhuma cor hardcoded — hex/`text-*-500`/`bg-gray-*`)* | — | ✅ limpo |

### 11.2 — Espaçamento
| Classe | Valor | Token Seven equiv. | Veredito |
|---|---|---|---|
| `space-x-2` · `py-2` · `mr-2`(×2) | 8px | `--spacing-2` | 🟢 |
| `gap-3` | 12px | `--spacing-3` | 🟢 |
| `px-4` | 16px | `--spacing-4` | 🟢 |
| `px-6` | 24px | `--spacing-6` | 🟢 |
| `mb-8`(×2) · `mt-8` | 32px | `--spacing-8` | 🟢 |
| `h-14` | 56px | `--spacing-14` | 🟢 |
| `-top-40` · `-bottom-40` | 160px | escala Tailwind (decorativo) | ⚪ |
| **`h-[500px]` (×2) · `w-[500px]` (×2)** | 500px | — (arbitrário) | 🔴 |

### 11.3 — Bordas, radius, sombra
| Classe | Resolve em | Veredito |
|---|---|---|
| `rounded-lg` | `--radius-lg` (12px) | ✅ |
| `shadow-lg` | `--shadow-lg` | ✅ |
| `rounded-full` · `ring-1` · `underline-offset-4` | — (full/1px/4px estrutural) | ⚪ |

### 11.4 — Tipografia
| Classe | Valor | Veredito | Observação |
|---|---|---|---|
| **`text-[12rem]`** | 192px | 🔴 | display **arbitrário** sem token → `Text display1` / slot `code` |
| `text-lg` | 1.125rem | 🟡 | span cru → `Heading`/`Text` |
| `text-sm` | 0.875rem | 🟡 | `<p>` cru → `Text`/`Paragraph` |
| `font-bold` | 700 | 🟢 | == `--font-weight-bold` (mas em div cru) |
| `font-semibold` | 600 | 🟢 | == `--font-weight-semibold` (span "Hono" cru) |
| `font-medium` (×2) | 500 | 🟢 | == `--font-weight-medium` |
| `tracking-tighter` | -0.05em | 🟢 | == `--font-tracking-tighter` |
| `leading-none` · `underline` · `select-none` | — | ⚪ | estrutural / deveria vir do `Link` |

### 11.5 — Sizing (ícones / dimensões)
| Classe | Valor | Veredito |
|---|---|---|
| `size-8` | 32px | 🟢 (plate) |
| `size-4` | 16px | 🟢 (ícone command) |
| `h-4 w-4` (×2) | 16px | 🟡 convenção mista vs `size-4` + redundante no `Button` (SZ1/SZ2) |
| `aspect-square` | — | ⚪ |

### 11.6 — Efeitos / layout (⚪ sem token de design)
`blur-3xl`(×2, decorativo — sem token, fere "no decoration") · `rotate-180` · `flex` · `flex-col` · `flex-1` · `min-h-screen` · `container` · `items-center` · `justify-center` · `mx-auto` · `max-w-md` · `text-center` · `relative` · `absolute` · `fixed` · `inset-0` · `-z-10` · `overflow-hidden` · `right-0` · `left-0` · `sm:flex-row` · `sm:justify-center`

### 11.7 — Veredito do estilo
| Classificação | Qtde | Itens |
|---|---|---|
| ✅ token-backed | 8 famílias | todas as cores, `rounded-lg`, `shadow-lg` |
| 🟢 value-aligned | 10 | `space-x-2`, `gap-3`, `px-4`, `px-6`, `py-2`, `mr-2`, `mb-8`, `mt-8`, `h-14`, `size-8`/`size-4`, `font-bold`/`semibold`/`medium`, `tracking-tighter` |
| 🟡 drift (tipografia/sizing crus) | 3 | `text-lg`, `text-sm`, `h-4 w-4` |
| 🔴 off-system | **3** | **`text-[12rem]`**, **`h-[500px]`**, **`w-[500px]`** |

> **Conclusão de estilo:** a tela é **token-limpa em cor** (zero hardcoded) e o spacing/tracking/peso são value-aligned. Os **3** estilos genuinamente fora do sistema são o **número 404 arbitrário** (`text-[12rem]`) e o **par de blobs decorativos** (`h-[500px] w-[500px]`) — ambos some ao adotar o `ErrorPage` e remover a decoração off-brand. O resto é drift de tipografia (resolve com `Heading`/`Text`/`Paragraph`/`Link`). O furo real não é estilo, é **estrutural**: reimplementar um componente (`ErrorPage`) que já existe pronto.

---

### Linha do coverage-matrix (índice)
```yaml
not_found:
  route: src/client/routes/$.tsx
  fidelity: 0.62
  components_used: [Button]
  components_missing: [ErrorPage, Heading, Text, Paragraph, Link]
  gaps:
    components: [C1, C2, C3, C4, C5]
    emitters:   [E1, E2, E3, E4, E5]
    colors:     [CL1]
    spacing:    [SP1]
    typography: [TY1, TY2, TY3, TY4]
    sizing:     [SZ1, SZ2, SZ3]
    states:     [ST1, ST2, ST3]
  severity: { high: 3, medium: 7, low: 9 }
  unused_seven:                      # superfície do DS não aproveitada (seção 9)
    alternative_components: [ErrorPage, Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, Heading, Text, Paragraph, Link, Section, Container, Stack, Flex, Logo, Brand]
    unused_props: { Button: [leftIcon, rightIcon, icon, loading, loadingText, badge, badgeColor, badgeSize, tooltip, fullWidth, data-id] }
    unused_variants: { Button: [primary, secondary, destructive, ghost, link, secondary-gray, secondary-color, tertiary, tertiary-gray, tertiary-color, link-gray, link-color] }
    unused_sizes: { Button: [sm, lg, icon, icon-sm] }
    unused_emitters: { Button: [onClick, onFocus, onBlur, onKeyDown], Link: [onClick] }
  user_actions:                      # seção 10
    total: 5
    wired: 4
    unwired: [A5]                    # A5 = voltar; A6 = n/a; A7 = grátis
  style_audit:                       # seção 11 (classe-a-classe)
    token_backed: [colors, rounded-lg, shadow-lg]
    value_aligned: [space-x-2, gap-3, px-4, px-6, py-2, mr-2, mb-8, mt-8, h-14, size-8, size-4, font-bold, font-semibold, font-medium, tracking-tighter]
    drift: [text-lg, text-sm, h-4 w-4]
    off_system: [text-[12rem], h-[500px], w-[500px]]   # número 404 arbitrário + blobs decorativos
    hardcoded_colors: 0
  notes:
    - "Achado dominante: a tela reimplementa o ErrorPage type=404 (existe no pacote, traz defaults pt-BR)."
    - "Cópia em ingles viola o brand (sentence-case pt-BR) — TY4."
    - "Decoracao (blobs blur) fere o principio 'no decoration' do brand Seven."
    - "Sem violacao de guard-rail ESLint (so <a>/<span>/<p>, nao <button>/<input>/<select>/<textarea>)."
```
