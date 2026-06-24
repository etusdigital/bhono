# Auditoria de tela — Account

> **Rota:** `src/client/routes/_authenticated/account.tsx`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código** (source: exports, `*.variants.ts`, `*.types.ts`, tokens). Sem render/Figma.
> **Data:** 2026-06-24
> **Fidelidade:** 🟡 **64%** — vocabulário de componentes rico e um fluxo (delete) realmente ligado e validado, mas perde a composição interna dos cards (interiores em `<div>` cru), tem cores hardcoded (amber), tipografia toda crua e 6 botões mortos.
>
> Severidade: 🔴 alta (quebra DS ou UX) · 🟡 média (foge do DS, funciona) · 🔵 baixa (polish)

---

## 0. Elementos da tela (o que está renderizado)

| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | título "Account" + subtítulo | raw `<h1>` / `<p>` | — |
| 2 | 5× título de seção "Connected Accounts / Security / …" | raw `<h2>` / `<p>` | — |
| 3 | 4× card de provider/segurança (Google, GitHub, 2FA, Password) | `@etus/seven-react` | `Card` + **interior em `<div>` cru** |
| 4 | 4× badge de status (Connected, Not connected, Recommended, Current) | `@etus/seven-react` | `Badge` |
| 5 | ~8× botão de ação (Connect, Enable, Change, Sign out all, logout, Create Key, Export, Delete) | `@etus/seven-react` | `Button` |
| 6 | 2× session card (Chrome/Safari) | raw `<div>` (`SessionCard`) | — (deveria ser `Card`) |
| 7 | 5× `Divider` entre seções | `@etus/seven-react` | `Divider` (`type="line"`) |
| 8 | card "API Keys" + empty-state | `@etus/seven-react` | `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` + **empty-state cru** |
| 9 | Danger Zone (Export / Delete) | `@etus/seven-react` | `Card` + `CardContent` (cores destructive) |
| 10 | modal de confirmação de exclusão | `@etus/seven-react` | `Dialog` + `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` + `TextInput` |
| 11 | caixa "Warning" + lista de avisos no modal | raw `<div>` + `<ul>/<li>` | — (deveria ser `Alert`/`Callout` + `List`) |
| 12 | ícones | `@/components/icons` (lucide) | — (convenção do projeto, ok) |

> Guard-rail do ESLint (`button/input/select/textarea` crus): **limpo** — todo controle é `Button`/`TextInput`. O único `<form>` (linha 358) **não** é banido e é exigido pelo `Form` (FormProvider do react-hook-form). Nenhum 🔴 de guard-rail.

---

## 1. GAPS de componentes & sub-componentes

| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | `SessionCard` é `<div>` cru disfarçado de card | `<div className="flex … rounded-lg border p-4">` replica um `Card` à mão (borda+radius+padding), sem shadow/variants/tokens do componente | 🟡 | trocar por `<Card>` (+ interior composto) |
| **C2** | Cards com casca Seven, interior cru | os 4 cards de provider/segurança usam `<Card>` mas o conteúdo é `<div className="flex items-center gap-4 p-4">` em vez de `CardHeader`+`CardTitle`+`CardDescription`+`CardAction` (slot de botão) | 🟡 | compor com `CardHeader/CardTitle/CardDescription/CardAction` |
| **C3** | Empty-state à mão | "API Keys" usa `<div className="… border border-dashed">` + ícone + 2×`<p>` em vez de `EmptyState` (exporta `EmptyState`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent`) | 🟡 | `<EmptyState>` com slots `EmptyMedia`/`EmptyTitle`/`EmptyDescription` (+ `action`) |
| **C4** | Tipografia em HTML cru | `<h1>`, 5× `<h2>`, vários `<p>`/`<span>` em vez de `Heading` / `Text`·`Paragraph` (todos exportados) | 🟡 | `Heading` nos títulos, `Text`/`Paragraph` no corpo |
| **C5** | Danger zone & "Warning" sem componente semântico | card destructive e a caixa `<div className="… bg-destructive/10">` + `<ul>` no modal deveriam ser `Alert` (`variant="destructive"`/`"warning"`) ou `Callout` | 🟡 | `Alert`/`AlertTitle`/`AlertDescription` (variants existem) |
| **C6** | Delete recria à mão o que o `ConfirmModal` já faz | `Dialog`+`Form`+state de loading manual; o Seven exporta `ConfirmModal` (`variant="destructive"`, `trigger`, `onConfirm` async, `loading`, `icon`) feito pra isso — o input de confirmação cabe no slot `children` | 🔵 | considerar `ConfirmModal variant="destructive"` (corta boilerplate) |
| **C7** | Lista de avisos crua | `<ul className="list-inside list-disc">` + `<li>` em vez de `List`/`ListItem` (data-display) | 🔵 | `List`/`ListItem` |

**Sub-componentes do `Card` disponíveis e NÃO usados:** `CardMedia`, `CardAction`, `CardFooter` (e nos 4 cards de provider, **todos** os de header/content também são ignorados).

---

## 2. GAPS de emitters / interações (callbacks, CTA, handlers)

> Um **único** fluxo está ligado de ponta a ponta: o **Delete Account** (abrir → digitar e-mail → validar zod → cancelar/confirmar). Todos os outros botões de ação são **inertes** — sem `onClick`/`href`.

| ID | Emitter/ação ausente | Onde | Sev. | Correção |
|---|---|---|---|---|
| **E1** | "Connect" GitHub sem ação | `Button variant="outline"` — sem `onClick` | 🔴 | `onClick` → fluxo OAuth de vínculo |
| **E2** | "Enable" 2FA sem ação | `Button variant="outline"` — sem `onClick` | 🔴 | `onClick` → setup de 2FA |
| **E3** | "Sign out all" sem ação | header de Active Sessions — sem `onClick` | 🔴 | `onClick` → revogar sessões |
| **E4** | logout por sessão sem ação | `SessionCard` `Button variant="ghost"` (ícone) — sem `onClick` | 🔴 | `onClick(payload)` → revogar a sessão |
| **E5** | "Create Key" sem ação | card API Keys — sem `onClick` | 🔴 | `onClick` → criar/abrir modal de key |
| **E6** | "Export" sem ação | Danger zone — sem `onClick` | 🔴 | `onClick` → exportar dados |
| **E7** | Loading do submit reimplementado | `isSubmitting ? <spinner animate-spin/> : <trash/>` em vez de `loading={isSubmitting}` + `loadingText="Deleting…"` (props nativas do `Button`) | 🟡 | `Button loading loadingText` |
| **E8** | Ícones por `className` em vez de prop | todo botão usa `<Icon className="mr-2 h-4 w-4"/>` em vez de `leftIcon`/`icon` (perde o `gap`/size de ícone do `Button`) | 🟡 | `leftIcon={<Icons.x/>}` |
| **E9** | Submit é `setTimeout` simulado | `onSubmit` faz `await new Promise(setTimeout 2000)` — sem API real (Regra 6) | 🟡 | ligar à mutação real de delete |

> "Change" (Password) está **`disabled`** por design (login OAuth, sem senha) — não é botão morto, é desabilitado correto. ⚪ N/A.

---

## 3. GAPS de cores / tokens

| Elemento | Usa | Token Seven? | Veredito |
|---|---|---|---|
| texto secundário | `text-muted-foreground` (×muitos) | ✅ `--muted-foreground` | ✅ |
| tiles de ícone | `bg-muted` (×4) | ✅ `--muted` | ✅ |
| danger zone / título / botões | `text-destructive`, `hover:text-destructive` | ✅ `--destructive` | ✅ |
| danger card / caixa warning | `bg-destructive/5`, `bg-destructive/10`, `border-destructive/30` | ✅ `--destructive` + opacity (Tailwind) | ✅ (existe `--destructive-subtle` como alt semântica) |
| ícone do empty-state | `text-muted-foreground/50` | ✅ `--muted-foreground` + opacity | 🟢 |
| **tile do 2FA** | `bg-amber-100 dark:bg-amber-900/30` · `text-amber-600 dark:text-amber-400` | ❌ **paleta Tailwind crua** — existe `--warning` (o próprio badge ao lado é `color="warning"`) | 🔴 **CL1** |
| **GitHub card / empty-state** | `border-dashed` (×2) | ❌ sem token nem padrão tracejado no Seven | 🔴 **CL2** (resolve com `EmptyState` C3 + tirar do Card) |

→ Diferente do Dashboard (zero cor hardcoded), esta tela **tem** cor crua: o bloco **amber** do 2FA. Há token semântico (`warning`) → é violação, não só drift. O resto das cores está correto (herdado/`destructive` com opacity).

---

## 4. GAPS de espaçamento

| Onde | Usa | Tipo | Veredito |
|---|---|---|---|
| wrapper da página | `space-y-8` (32px) | layout (raw Tailwind) | 🟢 `--spacing-8` |
| seções | `space-y-4` (16px) ×5 | layout | 🟢 `--spacing-4` |
| blocos internos | `space-y-2` (8) / `space-y-1` (4) | layout | 🟢 `--spacing-2`/`-1` |
| grids/flex | `gap-4` (16) / `gap-2` (8) | layout | 🟢 |
| **interior dos cards** | `p-4` cru dentro de `<Card>` | sobrepõe o `--card-root-padding-y` do componente (padding em dobro no eixo Y) | 🟡 **SP1** — usar `CardHeader`/`CardContent` (tokens `--card-*-padding-*`) |
| ritmo vertical ad-hoc | `space-y-8` / `-4` / `-2` na mesma árvore | escala válida, porém manual | 🔵 **SP2** — `Section`/`Stack` tokenizariam |

→ Todos os **valores** de spacing são value-aligned (🟢). O problema não é o valor, é **onde**: `p-4` manual dentro do `Card` ignora os tokens de padding do próprio componente.

---

## 5. GAPS de tipografia

| Elemento | Tela | Seven esperado | Sev. |
|---|---|---|---|
| título h1 | `text-2xl font-semibold tracking-tight` | `Heading level={1}` (`size`/`weight`/`color` por token) | 🟡 **TY1** (= C4) |
| 5× h2 de seção | `text-lg font-medium` | `Heading level={2}` | 🟡 **TY2** (= C4) |
| corpo `<p>` | `text-sm`/`text-xs text-muted-foreground` | `Text variant="p2"/"caption1" color="muted"` | 🟡 **TY3** (= C4) |
| ênfase em rótulos | `font-medium` em `<p>` (provider/device/danger) | `Text weight` / `Heading` | 🟡 **TY4** |
| `CardTitle` | sobrescrito com `text-base` | `CardTitle` já tem `[font-weight:var(--card-title-weight)]`; o `text-base` força o size | 🔵 **TY5** |
| `tracking-tight` | -0.025em | == `--font-tracking-tight` (via var Tailwind) | 🟢 |
| `font-mono` (TextInput + span do e-mail) | JetBrains Mono | == `--font-mono` (mono de marca) | ✅ |

> O guard-rail **não** bane `h1/h2/p/span` — passa o lint, mas é drift de DS (mesma nota do Dashboard).

---

## 6. GAPS de sizing / ícones

| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | Convenção `h-N w-N` em todo ícone | `h-12 w-12`, `h-6 w-6`, `h-5 w-5`, `h-4 w-4`, `h-8 w-8` — consistente, porém verboso; Seven/Tailwind usa `size-N`, e `Button` resolve via `leftIcon`/`icon`+`size="icon"` | 🔵 |
| **SZ2** | Botão icon-only mal tipado | logout por sessão usa `size="sm"` + `text-destructive` manual em vez de `size="icon"` + `icon={<Icons.logout/>}` | 🟡 |
| **SZ3** | Tile de logo bespoke | `h-12 w-12 rounded-lg bg-muted` à mão; `Avatar` (ou slot de mídia do `Card`) cobre isso com tokens | 🔵 |

> `-rotate-45` no ícone de "Export" gira uma seta pra simular "sair/upload" — hack decorativo; o ideal é um ícone dedicado (`Download`/`ArrowUpRight`). Marca pede "sem decoração". 🔵

---

## 7. GAPS de estados

| Estado | Tela | Seven oferece | Sev. |
|---|---|---|---|
| loading (submit) | 🟡 presente, porém à mão | `Button loading` / `loadingText` | 🟡 **ST1** (= E7) |
| "not connected" como placeholder | `border-dashed` p/ insinuar estado inativo | `Card variant="outlined"`/`ghost` + badge `muted` (não há token tracejado) | 🟡 **ST2** |
| botões que parecem ativos mas são inertes | E1–E6 | sem disabled/empty/erro; viram CTA morta | 🟡 **ST3** |
| badge "Not connected" | `type="badge-outline"` default `color="primary"` (mint) | semanticamente deveria ser `color="muted"`/`secondary` | 🔵 **ST4** |
| badges encolhem texto | `text-xs` manual | `size="sm"` (o `Badge` já controla o text-size por token) | 🔵 **ST5** |
| skeleton de listas (sessões/keys) | ❌ ausente (dados estáticos) | `SkeletonLoader` | 🔵 |

---

## 8. Consolidado — backlog priorizado

| Prioridade | IDs | Resumo |
|---|---|---|
| 🔴 **Must-fix** | E1–E6, CL1, CL2 | 6 botões de ação mortos; cor **amber** hardcoded (→ `warning`); `border-dashed` off-system |
| 🟡 **Should-fix** | C1, C2, C3·ST? , C4·TY1·TY2·TY3·TY4, C5, E7·ST1, E8, E9, SP1, SZ2, ST2, ST3 | `SessionCard`→`Card`; compor interior dos cards; `EmptyState`; tipografia→`Heading`/`Text`; danger/warning→`Alert`; loading nativo do `Button`; `p-4` interno; icon-only |
| 🔵 **Nice-to-have** | C6, C7, SP2, TY5, SZ1, SZ3, ST4, ST5 | `ConfirmModal`; `List`; ritmo via `Section`; `text-base` no `CardTitle`; `size-*`; `Avatar`; badge muted/`size="sm"` |

**Pontos corretos (não mexer):** `Dialog`+`Form`+`FormField`+`TextInput` com validação zod (fluxo real e a11y-linkado) · `Button`/`Badge`/`Divider` com props válidas · cores `muted`/`destructive` (com opacity) corretas · spacing/radius value-aligned · `font-mono` de marca · guard-rail limpo.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

> Inventário do que o Seven oferece e a tela **não** aproveita — props, variants, sub-componentes, estados e **componentes alternativos**. `[u]` = não usado.

### 9.1 — Cards de provider/segurança (hoje `Card` casca + `<div>` cru)
| Categoria | Disponível no Seven | Usado? |
|---|---|---|
| Sub-componentes `[u]` | `CardHeader` · `CardTitle` · `CardDescription` · `CardAction` · `CardContent` · `CardFooter` · `CardMedia` | ❌ (interior é `<div>` cru) |
| Variants `[u]` | `elevated` · `outlined` · `ghost` · `selectable` (usa `default`) | ❌ |
| Estados `[u]` (`selectable`) | `data-active` · `data-selected` · `onToggleSelect`/`onTogglePin` · hover-lift/ring | ❌ |

### 9.2 — `SessionCard` (hoje `<div>` cru)
| Categoria | Disponível | Usado? |
|---|---|---|
| **Componente base `[u]`** | **`Card`** (+ sub-componentes, shadow, variants) | ❌ (replicado à mão) |
| **Alternativos `[u]`** | **`List`/`ListItem`** · **`Avatar`** (no tile) | ❌ |

### 9.3 — Botões (hoje `Button` só com `variant`/`size`/`disabled`)
| Categoria | Disponível | Usado? |
|---|---|---|
| Props `[u]` | `leftIcon` · `rightIcon` · `icon` · `loading` · `loadingText` · `fullWidth` · `badge`/`badgeColor`/`badgeSize` · `tone` · `tooltip` · `asChild` · `shape` | ❌ |
| Emitters `[u]` | `onClick`/`onFocus`/`onBlur`/`onKeyDown` com `ButtonEventPayload` (`id`/`isLoading`/`timestamp`) | ❌ (só Cancel/submit ligados) |
| Sizes `[u]` | `icon` (p/ o logout icon-only), `lg` | ❌ |
| Variants `[u]` | `primary` · `secondary` · `dashed` · `link` · `success` · `warning` · `tertiary` (usa `outline`/`ghost`/`destructive`/default) | ❌ |

### 9.4 — Badges (hoje `Badge color`/`type`)
| Categoria | Disponível | Usado? |
|---|---|---|
| Props `[u]` | `size` (usa `text-xs` cru) · `dot` · `leadingIcon`/`trailingIcon`/`icon` · `iconOnly` · `interactive` · `avatar` · `country` · `onDismiss`/`dismissLabel` · `tooltip` · `asChild` | ❌ |
| Types `[u]` | `pill-color` · `pill-outline` · `badge-color` · `badge-modern` (usa `badge-outline` + default) | parcial |
| Colors `[u]` | `muted`/`secondary`/`info`/`tip`/`primary`/`destructive` (usa `success`/`warning`) | parcial |

### 9.5 — Dialog / Form (hoje `Dialog`+`Form` manuais)
| Categoria | Disponível | Usado? |
|---|---|---|
| Dialog sub `[u]` | `DialogPortal` · `DialogOverlay` · `DialogClose` · `showCloseButton` (prop) | ❌ (X vem do default) |
| Form sub `[u]` | `FormDescription` (helper text linkado) | ❌ |
| Form alt `[u]` | `Field` · `HelpText` · `Label` · `FormValidation` | ❌ |
| TextInput `[u]` | `leadingIcon`/`trailingIcon`(+`interactive`) · `size` (xs–xl) · `variant` (`filled`/`flushed`/`unstyled`) | ❌ (só `default`) |
| **Componente alternativo `[u]`** | **`ConfirmModal`** (`variant="destructive"`, `trigger`, `onConfirm` async, `loading`, `icon`, `title`/`description`, `children`) | ❌ |

### 9.6 — Empty-state / avisos (hoje `<div>` + `<ul>` crus)
| Categoria | Disponível | Usado? |
|---|---|---|
| Empty | **`EmptyState`** (+ `EmptyMedia`/`EmptyTitle`/`EmptyDescription`/`EmptyContent`) | ❌ |
| Avisos | **`Alert`** (`default`/`destructive`/`warning`/`success`/`info`) · **`Callout`** · `AlertTitle`/`AlertDescription` | ❌ |
| Lista | **`List`/`ListItem`** | ❌ |

### 9.7 — Título / textos / layout (hoje `<h1>/<h2>/<p>` + `<div>` grid crus)
| Elemento | Componente Seven `[u]` | Eixos não aproveitados |
|---|---|---|
| `<h1>`/`<h2>` | **`Heading`** | `level(1-6)` · `size` · `weight` · `align` · `color` · `gradient` |
| `<p>`/`<span>` | **`Text`** / **`Paragraph`** | `variant(p1-3/caption1-2/display)` · `weight` · `color` |
| `<div>` grid/seções | `Section` · `Container` · `Grid` · `Stack` · `Flex` | tokens de espaçamento em vez de `space-y-*`/`grid` crus |
| `Divider` | `type`(text/heading/button…) · `visualStyle` · `lineType` · `labelPosition` · `children` | só usa `line` simples |

---

## 10. Ações possíveis do usuário (mapa completo)

> Toda ação que o usuário **poderia** executar, o gatilho, o status atual e o primitivo Seven que a ligaria.
> **Resultado: 5 de 12 ligadas — só o fluxo de Delete Account funciona; 6 botões são CTA morta e 1 está desabilitado por design.**

| # | Ação possível | Gatilho (elemento) | Status | Como ligar (Seven) |
|---|---|---|---|---|
| A1 | Vincular conta GitHub | `Button` "Connect" | 🔴 não-ligada | `Button onClick` → OAuth link |
| A2 | Ativar 2FA | `Button` "Enable" | 🔴 não-ligada | `Button onClick` → setup |
| A3 | Trocar senha | `Button` "Change" (`disabled`) | ⚪ N/A (desabilitado por design) | — (sem senha em login OAuth) |
| A4 | Encerrar todas as sessões | `Button` "Sign out all" | 🔴 não-ligada | `Button onClick` → revogar |
| A5 | Encerrar uma sessão | `SessionCard` `Button ghost` (ícone) | 🔴 não-ligada | `Button icon size="icon" onClick(payload)` |
| A6 | Criar API key | `Button` "Create Key" | 🔴 não-ligada | `Button onClick` → modal/criação |
| A7 | Exportar dados | `Button` "Export" | 🔴 não-ligada | `Button onClick` → export |
| A8 | Abrir modal de exclusão | `DialogTrigger`+`Button destructive` | 🟢 **ligada** | `Dialog open/onOpenChange` (ok) |
| A9 | Digitar e-mail de confirmação | `TextInput` (no modal) | 🟢 **ligada** | RHF `field` + `zodResolver` (ok) |
| A10 | Cancelar exclusão | `Button` "Cancel" | 🟢 **ligada** | `onClick` → `setIsOpen(false)` (ok) |
| A11 | Confirmar exclusão | `Button type="submit"` | 🟢 **ligada** | `form.handleSubmit(onSubmit)` (ok, mas API simulada — E9) |
| A12 | Fechar modal (X/Esc/overlay) | `DialogContent` (default) | 🟢 **ligada** | `onOpenChange` reseta o form (ok) |

**Emitters do `Button` disponíveis nas ações a ligar:** `onClick` · `onFocus` · `onBlur` · `onKeyDown` (payload `ButtonEventPayload`: `id`, `isLoading`, `timestamp`).

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)

> **Toda** classe literal da tela, classificada contra os tokens do Seven. Legenda:
> ✅ **token-backed** (resolve num token Seven) · 🟢 **value-aligned** (utilitário Tailwind cujo valor == token Seven) · 🟡 **drift** (cru onde um componente/token Seven deveria mandar) · 🔴 **off-system** (sem token equivalente) · ⚪ layout (estrutural, sem token de design)
>
> Nota-chave: a escala de spacing do Seven **espelha a do Tailwind** (`--spacing-8`=32px=`space-y-8`; `--spacing-4`=16px=`gap-4`/`p-4`), `--font-tracking-tight`=`tracking-tight`=-0.025em, e os `rounded-*` resolvem nos `--radius-*` do Seven via `@theme` (`--radius-lg`=12px, `--radius-md`=8px, `--radius-full`). Por isso muito "cru" é 🟢/✅, não violação.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `text-muted-foreground` (×muitos) | `--muted-foreground` | ✅ |
| `bg-muted` (×4) | `--muted` | ✅ |
| `text-destructive` / `hover:text-destructive` | `--destructive` | ✅ |
| `border-destructive/30` · `bg-destructive/5` · `bg-destructive/10` | `--destructive` + opacity | ✅ (alt: `--destructive-subtle`) |
| `text-muted-foreground/50` | `--muted-foreground` + opacity | 🟢 |
| **`bg-amber-100` · `dark:bg-amber-900/30` · `text-amber-600` · `dark:text-amber-400`** | — (paleta Tailwind; existe `--warning`) | 🔴 **off-system** (CL1) |

### 11.2 — Espaçamento
| Classe | Valor | Token Seven equiv. | Veredito |
|---|---|---|---|
| `space-y-8` | 32px | `--spacing-8` | 🟢 |
| `space-y-4` (×5) | 16px | `--spacing-4` | 🟢 |
| `space-y-2` (×2) · `space-y-1` | 8 / 4px | `--spacing-2`/`-1` | 🟢 |
| `gap-4` · `gap-2` | 16 / 8px | `--spacing-4`/`-2` | 🟢 |
| `p-4` · `p-8` · `py-4` · `pb-3` | 16/32/16/12px | `--spacing-4`/`-8`/`-3` | 🟢 (valor) — mas `p-4` dentro de `Card` = SP1 🟡 (lugar errado) |
| `mr-2` · `mt-2` | 8px | `--spacing-2` | 🟢 |
| padding/gap internos de Card/Input/Button | — | `--card-*`/`--input-*`/`--button-*` | ✅ |

### 11.3 — Bordas & radius
| Classe | Resolve em | Veredito |
|---|---|---|
| `border` | `--border` (cor) | ✅ |
| `rounded-lg` | `--radius-lg` (12px, Seven) | ✅ |
| `rounded-full` | `--radius-full` | ✅ |
| **`border-dashed`** (×2: GitHub Card, empty-state) | — (tracejado; Seven não tem token nem padrão) | 🔴 **off-system** (CL2) |

### 11.4 — Tipografia
| Classe | Valor | Veredito | Observação |
|---|---|---|---|
| `text-2xl` | 1.5rem | 🟡 | título → `Heading` |
| `text-lg` (×5) | 1.125rem | 🟡 | h2 → `Heading level={2}` |
| `text-base` | 1rem | 🟡 | sobre `CardTitle` (já tem weight token) |
| `text-sm` (×muitos) | 0.875rem | 🟡 | corpo → `Text`/`Paragraph` |
| `text-xs` (×muitos) | 0.75rem | 🟡 | caption → `Text caption`; em badge → `size="sm"` |
| `font-semibold` / `font-medium` | 600 / 500 | 🟡 | peso deveria vir do `Heading`/`Text` |
| `tracking-tight` | -0.025em | 🟢 | == `--font-tracking-tight` |
| `font-mono` (×2) | JetBrains Mono | ✅ | `--font-mono` (mono de marca) |

### 11.5 — Sizing (ícones / dimensões)
| Classe | Valor | Veredito |
|---|---|---|
| `h-12 w-12` (×3) · `h-10 w-10` · `h-8 w-8` · `h-6 w-6` (×4) · `h-5 w-5` · `h-4 w-4` (×muitos) | 48/40/32/24/20/16px | 🟢 valores alinhados (`--spacing-*`); convenção `h-/w-` em vez de `size-*` (SZ1) |
| `min-w-0` · `flex-1` | — | ⚪ layout |

### 11.6 — Layout & decoração (⚪ sem token de design)
`flex` · `grid` · `items-center` · `items-start` · `justify-center` · `justify-between` · `flex-1` · `min-w-0` · `overflow-hidden` · `truncate` · `text-center` · `mx-auto` · `hidden sm:block` · `sm:grid-cols-2` · `list-inside list-disc` (→ `List`, C7) · `animate-spin` (→ `Button loading`, E7) · **`-rotate-45`** (hack decorativo no ícone de Export, SZ/§6)

### 11.7 — Veredito do estilo
| Classificação | Qtde (classes únicas) | Itens |
|---|---|---|
| ✅ token-backed | ~7 famílias | `muted`/`muted-foreground`/`destructive`(+opacity) · `border` · `rounded-lg`/`rounded-full` · `font-mono` · paddings internos |
| 🟢 value-aligned | ~12 | `space-y-8/4/2/1` · `gap-4/2` · `p-4/8` · `py-4` · `pb-3` · `mr-2`/`mt-2` · `tracking-tight` · `text-muted-foreground/50` · família `h-N w-N` |
| 🟡 drift (tipografia/sizing/lugar) | ~9 | `text-2xl` · `text-lg` · `text-base` · `text-sm` · `text-xs` · `font-semibold` · `font-medium` · `p-4` interno · `size="sm"` no icon-button |
| 🔴 off-system | **5 literais** | `bg-amber-100` · `dark:bg-amber-900/30` · `text-amber-600` · `dark:text-amber-400` (CL1) · `border-dashed` (CL2) |

> **Conclusão de estilo:** ao contrário do Dashboard (zero cor hardcoded), esta tela tem **um foco real de cor fora do sistema** — o bloco **amber** do 2FA (4 literais), que tem equivalente semântico (`warning`). O outro off-system é `border-dashed` (×2, resolve com `EmptyState`/variant de `Card`). O grosso do "cru" é spacing/radius value-aligned e drift de tipografia (resolve com `Heading`/`Text`). O diferencial positivo vs. Dashboard é o **fluxo de exclusão realmente ligado e validado** (Dialog+Form+TextInput+zod).

---

### Linha do coverage-matrix (índice)
```yaml
account:
  route: src/client/routes/_authenticated/account.tsx
  fidelity: 0.64
  components_used: [Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Divider, Badge, Button, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, TextInput]
  components_missing: [Heading, Text, Paragraph, EmptyState, EmptyMedia, EmptyTitle, EmptyDescription, Alert, AlertTitle, AlertDescription, Callout, ConfirmModal, CardAction, CardFooter, List, ListItem, Field, HelpText, FormDescription, Avatar, Section, Stack]
  gaps:
    components: [C1, C2, C3, C4, C5, C6, C7]
    emitters:   [E1, E2, E3, E4, E5, E6, E7, E8, E9]
    colors:     [CL1, CL2]
    spacing:    [SP1, SP2]
    typography: [TY1, TY2, TY3, TY4, TY5]
    sizing:     [SZ1, SZ2, SZ3]
    states:     [ST1, ST2, ST3, ST4, ST5]
  severity: { high: 8, medium: 17, low: 8 }
  unused_seven:                      # superfície do DS não aproveitada (seção 9)
    alternative_components: [Heading, Text, Paragraph, EmptyState, Alert, Callout, ConfirmModal, List, Avatar, Section, Stack, Field, HelpText]
    unused_props:
      Button: [leftIcon, rightIcon, icon, loading, loadingText, fullWidth, badge, tone, tooltip, asChild, shape]
      Badge:  [size, dot, leadingIcon, trailingIcon, iconOnly, interactive, avatar, country, onDismiss, tooltip, asChild]
      TextInput: [leadingIcon, trailingIcon, size, variant]
      Dialog: [showCloseButton, DialogOverlay, DialogClose, DialogPortal]
    unused_variants:
      Card: [elevated, outlined, ghost, selectable]
      Button: [primary, secondary, dashed, link, success, warning, tertiary]
      Badge: [pill-color, pill-outline, badge-color, badge-modern]
    unused_subcomponents:
      Card: [CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter, CardMedia]
      Form: [FormDescription]
  user_actions:                      # seção 10
    total: 12
    wired: 5                         # A8, A9, A10, A11, A12 (fluxo Delete Account)
    unwired: [A1, A2, A4, A5, A6, A7]   # A3 = N/A (disabled por design)
  style_audit:                       # seção 11 (classe-a-classe)
    token_backed: [muted, muted-foreground, destructive, border, rounded-lg, rounded-full, font-mono]
    value_aligned: [space-y-8, space-y-4, space-y-2, space-y-1, gap-4, gap-2, p-4, p-8, py-4, pb-3, mr-2, mt-2, tracking-tight]
    drift: [text-2xl, text-lg, text-base, text-sm, text-xs, font-semibold, font-medium]
    off_system: [bg-amber-100, "dark:bg-amber-900/30", text-amber-600, "dark:text-amber-400", border-dashed]
    hardcoded_colors: 4              # família amber (sem token Seven; existe --warning)
```
