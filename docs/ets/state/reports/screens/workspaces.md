# Auditoria de tela — Workspaces

> **Rota:** `src/client/routes/_authenticated/workspaces.tsx`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código** (source: exports, `*.variants.ts`, `*.types.ts`, tokens). Sem render/Figma.
> **Data:** 2026-06-24
> **Fidelidade:** 🟢 **82%** — usa os componentes certos (`Card`, `Badge`, `Callout`, `Empty`) com **dados reais e 3 estados**; perde só tipografia crua (`h1`/`p`), spinner fora do DS e polish. Sem estilo off-system.
>
> Severidade: 🔴 alta (quebra DS ou UX) · 🟡 média (foge do DS, funciona) · 🔵 baixa (polish)

---

## 0. Elementos da tela (o que está renderizado)

| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | bloco de cabeçalho (título + descrição) | raw `<h1>` + `<p>` | — |
| 2 | banner "Super admin" (condicional) | `@etus/seven-react` | `Callout` (`variant="success"`, `icon`, `title`) |
| 3 | estado de carregamento | raw `<div>` + `Icons.spinner` (lucide `Loader2`) | — (spinner manual) |
| 4 | estado vazio | `@etus/seven-react` | `Empty` + `EmptyHeader` + `EmptyMedia(variant="icon")` + `EmptyTitle` + `EmptyDescription` |
| 5 | grid de workspaces | `@etus/seven-react` | `Card` + `CardHeader/CardTitle/CardDescription/CardContent` |
| 6 | badge de papel (role) por card | `@etus/seven-react` | `Badge` (`color`) |
| 7 | blurb do papel por card | raw `<p>` | — |
| 8 | ícones (shield, layers, spinner) | `@/components/icons` (lucide) | — (convenção do projeto, ok) |

> **Destaque vs Dashboard:** esta tela **já adota o `Empty` do Seven** para o vazio (o Dashboard rolava `border-dashed` à mão) e **liga dados reais** (`accounts.map`, `superAdmin`, `isLoading`) — sem valores hardcoded nem "UI morta". É um patamar de fidelidade acima.

---

## 1. GAPS de componentes & sub-componentes

| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | Tipografia em HTML cru | `<h1>` (título) e `<p>` (×2: descrição da página + blurb do card) em vez de `Heading` / `Text`·`Paragraph` (todos exportados no beta.4) | 🟡 | `Heading` no título, `Text`/`Paragraph` nos parágrafos |
| **C2** | Loading montado à mão | estado de carregamento usa `<div className="flex…">` + `Icons.spinner` (lucide `Loader2`) com `animate-spin`; o Seven exporta **`Spinner`** (`size`/`color`/`variant`) e **`SkeletonLoader`** (`shape`/`size`/`animation`) | 🟡 | `Spinner` inline **ou** `SkeletonLoader` no formato do grid (skeleton de cards é mais on-system que spinner-row) |
| **C3** | `Empty` sem slot de ação | usa `Empty/Header/Media/Title/Description` mas **não** usa `EmptyContent` — o slot próprio pra CTA no vazio (ex.: "Atualizar", "Pedir acesso") | 🔵 | `EmptyContent` + `Button` quando fizer sentido oferecer ação |
| **C4** | `Card` sem sub-componentes de ação/mídia | usa só `CardHeader/Title/Description/Content`; **não** usa `CardAction`, `CardFooter` nem `CardMedia` (ok p/ diretório read-only, mas fecha a porta pra CTA/avatar do workspace) | 🔵 | opcional: `CardMedia`/`Avatar` p/ marca do workspace; `CardFooter` se surgir ação |

**Sub-componentes do `Card` disponíveis e NÃO usados:** `CardMedia`, `CardAction`, `CardFooter`.
**Sub-componente do `Empty` disponível e NÃO usado:** `EmptyContent`.

---

## 2. GAPS de emitters / interações (callbacks, CTA, handlers)

> A tela é **majoritariamente read-only por design** (um diretório de papéis por workspace), então a ausência de cliques **não é "UI morta"** como no Dashboard. O gap material aqui é de **fluxo de dados/erro**, não de CTA decorativa.

| ID | Emitter/ação ausente | Onde | Sev. | Correção |
|---|---|---|---|---|
| **E1** | Erro engolido vira "vazio" | `fetchGatewayAccounts` (hook) faz `if (!res.ok) return { accounts: [], superAdmin: false }` → uma falha de rede é **indistinguível** de "sem workspaces"; a UI mostra o empty-state genérico (Regra 6: estado mente sobre o que aconteceu) | 🟡 | tratar erro do `useQuery` (`isError`) e renderizar estado de erro distinto (`Callout variant="error"` + retry) |
| **E2** | Sem retry/refresh ligado | `useGatewayAccounts` expõe `useQuery`, mas a tela **não** oferece `refetch()` em nenhum gatilho (nem no loading, nem no vazio, nem em erro) | 🟡 | `Button` ("Atualizar") chamando `refetch` no empty/erro |
| **E3** | `Badge` sem `tooltip`/`interactive` | o papel mostra só o rótulo; `meta.blurb` (a explicação) **já existe** mas só aparece no card. `Badge` suporta `tooltip` e `interactive`/`onClick` — não usados | 🔵 | `Badge tooltip={meta.blurb}` p/ explicar o papel on-hover |
| **E4** | Cards não navegam/selecionam | `Card` default, sem `onClick`/link/`variant="selectable"` — nenhum drill-down nem "tornar workspace ativo" | 🔵 | se houver destino, `Card variant="selectable"` (+`onToggleSelect`) ou título via `Heading asChild`+link; ver §10 A1 |

> **Conclusão de interações:** 0 ações ligadas, mas — diferente do Dashboard — isso é **quase tudo by-design**. O único gap funcional real é **E1/E2** (erro silencioso sem retry).

---

## 3. GAPS de cores / tokens

| Elemento | Usa | Token Seven? | Veredito |
|---|---|---|---|
| `Card` bg/borda/sombra | tokens internos `--card-root-background` / `--border` / `--card-root-shadow-sm` | ✅ | ✅ |
| `CardDescription` cor | `--card-description-color` (interno) | ✅ | ✅ |
| `Badge` cor (`color={meta.color}`) | `--badge-color-*` (primary/info/success/muted) via `pill-color` | ✅ | ✅ |
| `Callout` success | `--success-subtle` (bg) + `--success` (borda) + `text-success` (ícone) | ✅ | ✅ |
| `Empty` borda | `border` → `--border` (somado ao `border-dashed` **da base do próprio `Empty`**) | ✅ | ✅ tracejado vem do componente, não é hand-rolled |
| texto secundário (`<p>`, loading) | `text-muted-foreground` → `--muted-foreground` | ✅ | ✅ |

→ **Cores 100% token-backed. Zero hardcoded** (`text-*-500`, hex, `bg-gray-*` etc. inexistentes). O `border-dashed` que no Dashboard era off-system **aqui não é classe autoral** — está na base do `Empty` do Seven (`EmptyState.tsx:10`). **Sem gaps de cor.**

---

## 4. GAPS de espaçamento

| Onde | Usa | Tipo | Veredito |
|---|---|---|---|
| wrapper da página | `space-y-8` (32px) | layout de página (raw Tailwind) | ✅ aceitável (= `--spacing-8`) |
| grid de cards | `gap-4` (16px) | layout (raw) | ✅ aceitável (= `--spacing-4`) |
| header/loading internos | `gap-2` (8px ×2) | layout (raw) | ✅ aceitável (= `--spacing-2`) |
| **ritmo da página** | `space-y-8` (32) vs `gap-4`/`gap-2` na mesma tela | — | 🔵 **SP1** ritmo vertical levemente misto (mesmo padrão do Dashboard) |
| interno dos cards | `--card-root-gap` / `--card-root-padding-y` / `--card-header-gap` / `--card-content-padding-x` | tokens Seven (não sobrescritos) | ✅ correto |
| `CardHeader` override | `space-y-0` (zera o ritmo default p/ controlar via `flex`/`gap-2`) | layout reset | ✅ ok |

→ Espaçamento **interno** vem certo dos tokens. Só o **ritmo de layout da página** é cru (value-aligned) e levemente inconsistente.

---

## 5. GAPS de tipografia

| Elemento | Tela | Seven esperado | Sev. |
|---|---|---|---|
| título h1 | `<h1 className="text-2xl font-semibold tracking-tight">` (escala Tailwind solta) | `Heading` (`level`/`size`/`weight`/`color`/`align`) | 🟡 **TY1** (= C1) |
| descrição da página | `<p className="text-muted-foreground">` | `Text`/`Paragraph` | 🟡 **TY2** (= C1) |
| blurb do card | `<p className="text-sm text-muted-foreground">` | `Text` (`size="sm"`) | 🟡 **TY3** (= C1) |
| `CardTitle` | override `truncate text-base` — define tamanho explícito (a base do `CardTitle` só fixa `leading-tight` + `--card-title-weight`, sem size) | `CardTitle` aceita override; `text-base` (1rem) é value-aligned | 🔵 ok (size explícito aditivo) |
| `Callout` título | `title="Super admin"` → renderiza `<h5>` interno com tokens do componente | — | ✅ |
| `Badge` rótulo | herda `text-[length:var(--badge-size-md-text)]` + `capitalize` | — | ✅ |

> Nota: o guard-rail do ESLint **não** bane `h1/p` (só `button/input/select/textarea`) — passa o lint, mas `h1`+3×`p` crus são drift de DS. **Único cluster de tipografia, idêntico ao Dashboard.**

---

## 6. GAPS de sizing / ícones

| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | Spinner dimensionado à mão | `Icons.spinner className="h-4 w-4 animate-spin"` (16px + animação Tailwind) em vez do `Spinner` do Seven (que tem `size`/`color`/`variant` tokenizados) | 🔵 (= C2) |
| — | Ícones de componente | `Empty`/`Callout`/`Badge` dimensionam ícones por tokens internos (`--empty-state-media-icon-icon-size`, `size-4` do Callout, `[&_svg]:size-3.5` do Badge) | ✅ |

→ Diferente do Dashboard, **não há conflito de convenção** (`size-4` vs `h-5 w-5`) — só um ícone autoral (`h-4 w-4`), cujo conserto real é adotar `Spinner`.

---

## 7. GAPS de estados

| Estado | Tela | Seven oferece | Sev. |
|---|---|---|---|
| loading | 🟡 presente, porém cru (spinner manual) | `Spinner` / `SkeletonLoader` | 🟡 **ST1** (= C2) |
| empty | ✅ **presente e on-system** (`Empty` family) | `Empty*` | ✅ **ponto correto** |
| populated | ✅ grid de `Card` com dados reais | `Card` | ✅ |
| erro | 🟡 ausente — falha de fetch cai no empty-state silenciosamente | `Callout variant="error"` + `useQuery.isError` | 🟡 **ST2** (= E1) |
| hover/clicável | 🔵 cards não interativos (by-design) | `Card variant="selectable"` / link | 🔵 **ST3** (= E4) |

---

## 8. Consolidado — backlog priorizado

| Prioridade | IDs | Resumo |
|---|---|---|
| 🔴 **Must-fix** | — | **nenhum** — sem quebra de DS, sem off-system, sem `button/input` cru, dados reais |
| 🟡 **Should-fix** | E1·ST2, C1·TY1·TY2·TY3, C2·ST1·SZ1, E2 | erro silencioso vira "vazio" (tratar `isError`); tipografia crua→`Heading`/`Text`; loading→`Spinner`/`SkeletonLoader`; oferecer `refetch` |
| 🔵 **Nice-to-have** | C3, C4, E3, E4·ST3, SP1 | `EmptyContent` p/ CTA; `CardFooter`/`CardMedia`/`Avatar`; `Badge tooltip`; cards `selectable`; ritmo de espaçamento |

**Pontos corretos (não mexer):** `Empty` on-system (vs Dashboard) · `Callout` correto · `Badge` com `color` semântico · `Card` + composição · cores/tokens 100% internos · dados reais + 3 estados · zero off-system.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

> Inventário do que o Seven oferece e a tela **não** aproveita — props, variants, sub-componentes, estados e **componentes alternativos**. `[u]` = não usado. Todos verificados em `@etus/ui@0.4.0-beta.4` (`dist/index.d.ts`).

### 9.1 — Badge de papel (hoje `Badge`)
| Categoria | Disponível no Seven | Usado? |
|---|---|---|
| Props usadas | `color` · `className` · children | ✅ |
| Props `[u]` | `type` · `size` · `dot` · `icon`/`leadingIcon`/`trailingIcon` · `iconOnly` · `avatar` · `country` · `onDismiss`/`dismissLabel` · `interactive` · `tooltip` · `asChild` · `disabled` | ❌ |
| Variants `type` `[u]` | `pill-outline` · `badge-color` · `badge-outline` · `badge-modern` (usa `pill-color` default) | ❌ |
| Sizes `[u]` | `sm` · `lg` (usa `default`/md) | ❌ |
| **Oportunidade** | `dot`/`leadingIcon` p/ leitura rápida do papel; `tooltip={meta.blurb}` (a explicação já existe no código) | — |

### 9.2 — Banner super admin (hoje `Callout`)
| Categoria | Disponível | Usado? |
|---|---|---|
| Props usadas | `icon` · `title` · `variant="success"` · children | ✅ |
| Props `[u]` | `size` (sm/md/lg — usa md default) | ❌ |
| Variants `[u]` | `info` · `warning` · `error` · `tip` · `transparent` · `default` | ❌ (success é o certo aqui) |
| Nota | `icon={<Icons.shield />}` **sobrescreve** o ícone semântico do success (`CircleCheck`) — escolha consciente, mas troca o sinal visual | — |

### 9.3 — Cards de workspace (hoje `Card`)
| Categoria | Disponível | Usado? |
|---|---|---|
| Sub-componentes usados | `CardHeader` `CardTitle` `CardDescription` `CardContent` | ✅ |
| Sub-componentes `[u]` | `CardMedia` · `CardAction` · `CardFooter` | ❌ |
| Variants `[u]` | `elevated` · `outlined` · `ghost` · `selectable` (usa `default`) | ❌ |
| Estados `[u]` (variant `selectable`) | `selected` · `pinned` · `onToggleSelect` · `onTogglePin` · `selectableProps` · hover-lift · ring | ❌ |
| **Componente alternativo `[u]`** | **`List`** (data-display) — `variant` `selectable` `multiple` `loading` `onSelect` `items` — diretório mais denso que grid de cards | ❌ nunca considerado |
| **Componente alternativo `[u]`** | **`AccountSwitch`** (navigation) — `accounts` `header` `footer` `onSelect(account)` — **fit parcial**: é um *switcher* (dropdown de troca de conta ativa), não um diretório read-only de papéis; só caberia se o objetivo virar "trocar workspace ativo" | ❌ |
| **Componente alternativo `[u]`** | **`Avatar`** — `size` `shape` `bordered` `interactive` `tooltip` — marca/identidade visual por workspace dentro do card | ❌ |

### 9.4 — Estado vazio (hoje `Empty` family)
| Categoria | Disponível | Usado? |
|---|---|---|
| Sub-componentes usados | `Empty` `EmptyHeader` `EmptyMedia(variant="icon")` `EmptyTitle` `EmptyDescription` | ✅ on-system |
| Sub-componentes `[u]` | **`EmptyContent`** (slot de ação/CTA) | ❌ |
| `EmptyMedia` variants `[u]` | `default` (usa `icon`) | ❌ |

### 9.5 — Cabeçalho / textos (hoje `<h1>` / `<p>` crus)
| Elemento | Componente Seven `[u]` | Eixos não aproveitados |
|---|---|---|
| `<h1>` | **`Heading`** | `level(1-6)` · `size` · `weight` · `align` · `color` · `gradient` · `truncate` · `asChild` |
| `<p>` (×2) | **`Text`** / **`Paragraph`** | `Text`: `variant`/`size`/`weight`/`as`/`truncate` · `Paragraph`: `size`/`weight`/`color`/`align`/`leading`/`spacing`/`prose` |
| bloco título+descrição | **`Section`** | `title` · `description` · `footer` · `variant` · `size` (encapsula o header inteiro) |

### 9.6 — Loading & layout (hoje `<div>` + spinner lucide + grid cru)
| Disponível `[u]` | Uso |
|---|---|
| **`Spinner`** (`size`/`color`/`variant`) · **`SkeletonLoader`** (`shape`/`size`/`animation`) | substituiriam o `Loader2`+`animate-spin` manual; skeleton do grid > spinner-row |
| `Section` · `Container` · `Grid` (`cols`/`gap`/`flow`) · `Stack` (`direction`/`spacing`) · `Flex` | estruturariam a página com tokens em vez de `space-y-8`/`grid` crus |

---

## 10. Ações possíveis do usuário (mapa completo)

> Toda ação que o usuário **poderia** executar, o gatilho, o status atual e o primitivo Seven que a ligaria.
> **Resultado: 0 de 5 ações ligadas** — mas, diferente do Dashboard, a maioria é **read-only por design** (diretório de papéis), não "UI morta". O gap real é A2/A3 (erro/retry).

| # | Ação possível | Gatilho (elemento) | Status | Como ligar (Seven) |
|---|---|---|---|---|
| A1 | Abrir/trocar para um workspace | card de workspace | 🔵 não-ligada (provável by-design; sem rota de detalhe) | `Card variant="selectable"`+`onToggleSelect` **ou** título `Heading asChild`+link **ou** `AccountSwitch onSelect` |
| A2 | Ver estado de erro (em vez de "vazio" falso) | falha de fetch | 🟡 não-ligada (erro engolido pelo hook) | `useQuery.isError` → `Callout variant="error"` |
| A3 | Atualizar/retry a lista | empty/erro | 🟡 não-ligada | `Button` ("Atualizar") → `refetch()` |
| A4 | Entender o papel (explicação on-hover) | `Badge` de papel | 🔵 não-ligada | `Badge tooltip={meta.blurb}` (o blurb já existe) |
| A5 | Foco/teclado em itens interativos | cards | ⚪ n/a (nada interativo) | vem de graça com `selectable`/link |

**Emitters disponíveis quando A1 for ligada:** `Card.onToggleSelect`/`onTogglePin` (payload `CardSelectablePayload`: `id`, `next`, `timestamp`) · `AccountSwitch.onSelect(account)`.

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)

> **Toda** classe literal da tela, classificada contra os tokens do Seven. Legenda:
> ✅ **token-backed** (resolve num token Seven) · 🟢 **value-aligned** (utilitário Tailwind cujo valor == token Seven) · 🟡 **drift** (cru onde um componente/token Seven deveria mandar) · 🔴 **off-system** (sem token equivalente) · ⚪ layout/utilitário (estrutural, sem token de design)
>
> Nota-chave: a escala de spacing do Seven **espelha a do Tailwind** (`--spacing-2`=8px=`gap-2`; `--spacing-4`=16px=`gap-4`; `--spacing-8`=32px=`space-y-8` — verificado em `tokens.css`), e `--font-tracking-tight`=`tracking-tight`=-0.025em. Por isso muito "cru" é 🟢, não violação.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `text-muted-foreground` (×3) | `--muted-foreground` | ✅ |
| `border` (no `Empty`) | `--border` | ✅ |
| bg/borda/sombra dos cards, badge, callout | tokens internos (`--card-root-*`, `--badge-color-*`, `--success-subtle`, `--border`) | ✅ |
| *(nenhuma cor hardcoded — `text-*-500`, hex, `bg-gray-*` etc.)* | — | ✅ limpo |

### 11.2 — Espaçamento
| Classe | Valor | Token Seven equiv. | Veredito |
|---|---|---|---|
| `space-y-8` | 32px | `--spacing-8` | 🟢 |
| `gap-4` | 16px | `--spacing-4` | 🟢 |
| `gap-2` (×2) | 8px | `--spacing-2` | 🟢 |
| `space-y-0` | 0 | reset de layout | ⚪ |
| padding/gap internos dos cards | — | `--card-*` | ✅ |

### 11.3 — Bordas & radius
| Classe | Resolve em | Veredito |
|---|---|---|
| `border` | `--border` (cor/largura) | ✅ |
| *(radius vem dos componentes: `--card-root-radius`, `--callout-root-radius`, `--badge-radius-pill`, `rounded-lg` do `Empty`)* | tokens internos | ✅ |
| **`border-dashed`** | **da base do `Empty` (Seven), não autoral** → não conta como off-system | ✅ |

### 11.4 — Tipografia
| Classe | Valor | Veredito | Observação |
|---|---|---|---|
| `text-2xl` | 1.5rem | 🟡 | título deveria vir do `Heading` |
| `font-semibold` | 600 | 🟡 | idem (peso do `Heading`; `--card-title-weight`=600 existe) |
| `tracking-tight` | -0.025em | 🟢 | valor == `--font-tracking-tight`, via var Tailwind |
| `text-sm` (×2) | 0.875rem | 🟡 | corpo (descrição/blurb) deveria vir do `Text` |
| `text-base` | 1rem | 🟢 | size explícito no `CardTitle` (base); aditivo, value-aligned |
| `capitalize` | text-transform | ⚪ | utilitário tipográfico, sem token (não é violação) |

### 11.5 — Sizing (ícones / dimensões)
| Classe | Valor | Veredito |
|---|---|---|
| `h-4 w-4` (spinner) | 16px | 🟢 value-aligned; conserto real = `Spinner` (componente), não a medida |
| `animate-spin` | animação | ⚪ utilitário de motion; `Spinner` encapsularia |
| `shrink-0` (Badge) | flex | ⚪ layout (redundante: a base do `Badge` já tem `shrink-0`) |
| `min-w-0` | flex | ⚪ layout (habilita truncamento) |
| `truncate` (×2) | text-overflow | ⚪ layout |

### 11.6 — Layout (⚪ sem token de design — ok)
`flex` · `grid` · `items-center` · `items-start` · `justify-between` · `sm:grid-cols-2` · `lg:grid-cols-3`

### 11.7 — Veredito do estilo
| Classificação | Qtde | Itens |
|---|---|---|
| ✅ token-backed | 2 famílias | cores (`text-muted-foreground`, internos), `border` |
| 🟢 value-aligned | 6 | `space-y-8`, `gap-4`, `gap-2`, `tracking-tight`, `h-4 w-4`, `text-base` |
| 🟡 drift (tipografia) | 4 | `text-2xl`, `font-semibold`, `text-sm` (×2) |
| 🔴 off-system | **0** | — |
| ⚪ layout/utilitário | — | flex/grid/items/justify/`min-w-0`/`truncate`/`space-y-0`/`shrink-0`/`capitalize`/`animate-spin` |

> **Conclusão de estilo:** a tela é **token-limpa e SEM off-system** — zero cor hardcoded, zero `border-dashed` autoral (o tracejado é da base do `Empty` do Seven), spacing/radius alinhados. Supera o Dashboard (que tinha 1 off-system). O **único** smell de estilo é o drift de tipografia (`h1`/`p` → `Heading`/`Text`) — mesma raiz do Dashboard, resolvida com os componentes de texto do Seven.

---

### Linha do coverage-matrix (índice)
```yaml
workspaces:
  route: src/client/routes/_authenticated/workspaces.tsx
  fidelity: 0.82
  components_used: [Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Callout, Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription]
  components_missing: [Heading, Text, Paragraph, Spinner, SkeletonLoader, EmptyContent]
  gaps:
    components: [C1, C2, C3, C4]
    emitters:   [E1, E2, E3, E4]
    colors:     []            # 0 — cores 100% token-backed; border-dashed vem da base do Empty (Seven)
    spacing:    [SP1]
    typography: [TY1, TY2, TY3]
    sizing:     [SZ1]
    states:     [ST1, ST2, ST3]
  severity: { high: 0, medium: 3, low: 6 }   # high=0: sem quebra de DS, sem off-system, sem raw button/input
  unused_seven:                      # superfície do DS não aproveitada (seção 9)
    alternative_components: [List, AccountSwitch, Avatar, Section, Spinner, SkeletonLoader, Grid, Stack, Flex, Container, Heading, Text, Paragraph]
    unused_props: { Badge: [type, size, dot, icon, leadingIcon, trailingIcon, iconOnly, avatar, country, onDismiss, interactive, tooltip, asChild, disabled], Callout: [size], Card: [variant, selected, pinned, onToggleSelect, onTogglePin] }
    unused_variants: { Badge: [pill-outline, badge-color, badge-outline, badge-modern], Card: [elevated, outlined, ghost, selectable], Callout: [info, warning, error, tip, transparent] }
    unused_subcomponents: { Card: [CardMedia, CardAction, CardFooter], Empty: [EmptyContent] }
  user_actions:                      # seção 10
    total: 5
    wired: 0
    unwired: [A1, A2, A3, A4]        # A5 = n/a; A1/A4 são by-design (read-only); A2/A3 é o gap real
  style_audit:                       # seção 11 (classe-a-classe)
    token_backed: [colors, border]
    value_aligned: [space-y-8, gap-4, gap-2, tracking-tight, h-4 w-4, text-base]
    drift: [text-2xl, font-semibold, text-sm]
    off_system: []                   # 0 — border-dashed é da base do Empty (Seven), não autoral
    hardcoded_colors: 0
```
