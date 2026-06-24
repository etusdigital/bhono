# Auditoria de tela — Team

> **Rota:** `src/client/routes/_authenticated/team.tsx`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código** (source: exports, `*.variants.ts`, `*.types.ts`, tokens). Sem render/Figma.
> **Data:** 2026-06-24
> **Fidelidade:** 🟡 **76%** — usa os componentes certos e está quase tudo ligado (9/13 ações), mas reimplementa à mão peças que o Seven já entrega (`SearchInput`, `AvatarLabelGroup`, `Spinner`, `DropdownMenu`) e tem tipografia crua + 1 ação morta (⋯).
>
> Severidade: 🔴 alta (quebra DS ou UX) · 🟡 média (foge do DS, funciona) · 🔵 baixa (polish)

---

## 0. Elementos da tela (o que está renderizado)

| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | título "Team Members" + subtítulo | raw `<h1>` / `<p>` | — |
| 2 | botão "Invite Member" (abre diálogo) | `@etus/seven-react` | `Button` (+ `DialogTrigger asChild`) |
| 3 | diálogo de convite | `@etus/seven-react` | `Dialog` (+ `DialogContent/Header/Title/Description/Footer`) |
| 4 | form de convite (email + papel) | `@etus/seven-react` | `Form` (+ `FormField/Item/Label/Control/Description/Message`) + `TextInput` |
| 5 | seletor de papel (guest/member/admin) | `@etus/seven-react` | 3× `Button` manuais (toggle por `variant`) |
| 6 | campo de busca de membros | raw `<div>` + `@etus/seven-react` | `TextInput` + ícone `absolute` à mão |
| 7 | card "Active Members" | `@etus/seven-react` | `Card` (+ `CardHeader/Title/Description/Content`) |
| 8 | linha de membro (avatar+nome+email+badge+⋯) | `@etus/seven-react` | `Avatar`/`AvatarImage`/`AvatarFallback` + `Badge` + `Button` |
| 9 | card "Pending Invitations" (condicional) | `@etus/seven-react` | `Card` + linhas de convite |
| 10 | linha de convite (ícone+email+expiry+badge+revoke) | raw `<div>` + `@etus/seven-react` | círculo `rounded-full` à mão + `Badge` + `Button` |
| 11 | estados de loading / vazio | raw `<div>` | — (reproduz `emptyStateStyles`) |
| 12 | ícones | `@/components/icons` (lucide) | — (convenção do projeto, ok) |
| 13 | toasts de feedback | `sonner` | `Toaster`/`toast` (ok) |

---

## 1. GAPS de componentes & sub-componentes

| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | Search reimplementado à mão | `<div className="relative max-w-sm"><Icons.search className="absolute left-3 …"/><TextInput className="pl-9"/></div>` — o Seven exporta `SearchInput` (com `searchIcon`, `onClear`, `showClearButton`) **e** `TextInput` tem `leadingIcon` | 🟡 | `<SearchInput value onChange onClear/>` (ou `TextInput leadingIcon`) |
| **C2** | Linha de membro montada à mão | `Avatar` + `<p font-medium>{name}</p>` + `<p text-sm>{email}</p>` reproduz exatamente o `AvatarLabelGroup` (`name`, `description`, `src`, `status`, `size`) | 🟡 | `<AvatarLabelGroup name={name} description={email} src={picture} status=…/>` |
| **C3** | Tipografia em HTML cru | `<h1>`, `<p>`, `<span>` em vez de `Heading` / `Text`·`Paragraph` (todos exportados) | 🟡 | `Heading` no título, `Text` nos corpos |
| **C4** | Listas com `divide-y` cru | `<div className="divide-y">` para separar linhas — existe `List` (data-display) e `Divider`; tabela de pessoas caberia em `Table`/`DataTable` | 🟡 | `List`/`Divider` (ou `Table` p/ colunas papel/status/ações) |
| **C5** | Seletor de papel com Button manual | 3× `Button` alternando `variant` default/outline = single-select reimplementado; o DS tem `ToggleGroup`, `RadioCardGroup` (com `description` por card!), `Select`/`NativeSelect`, `ButtonGroup` | 🟡 | `RadioCardGroup columns={3}` (cada papel já tem descrição) ou `ToggleGroup` |
| **C6** | Avatar do convite à mão | `<div className="flex h-10 w-10 … rounded-full bg-muted"><Icons.mail/></div>` é um avatar hand-rolled | 🔵 | `<Avatar><AvatarFallback>…</AvatarFallback></Avatar>` (ícone no fallback) |
| **C7** | Loading cru | linha "Loading members…" em texto; existe `Spinner`, `SkeletonLoader`, `AvatarSkeleton` | 🟡 | `SkeletonLoader`/`AvatarSkeleton` (linhas-fantasma) ou `Spinner` |
| **C8** | Sub-componentes do `Card` não usados | `CardAction`/`CardFooter`/`CardMedia` ausentes — ex.: o "Invite Member" caberia num `CardAction` no header do card de membros | 🔵 | mover CTA p/ `CardAction`/`CardFooter` |

**Sub-componentes do `Card` disponíveis e NÃO usados:** `CardAction`, `CardFooter`, `CardMedia`.
**Componentes do Avatar disponíveis e NÃO usados:** `AvatarLabelGroup`, `AvatarGroup`, `AvatarStatus`, `AvatarBadge`, `AvatarSkeleton`, `AvatarAddButton`.

> Nota: **não** existe `<EmptyState>` exportado no beta.4 — só `emptyStateVariants` (cva) e a const `emptyStateStyles = "text-center py-8 text-muted-foreground"`. As `<div>` de loading/vazio reproduzem essa string **literalmente** (ver §7/§11), então são value-aligned, não um componente "faltando".

---

## 2. GAPS de emitters / interações (callbacks, CTA, handlers)

> Ao contrário do dashboard, a tela é **fortemente ligada** (mutations, form, busca, toasts). Os gaps são pontuais — um botão morto e props nativas do `Button` ignoradas.

| ID | Emitter/ação ausente | Onde | Sev. | Correção |
|---|---|---|---|---|
| **E1** | Botão ⋯ (more) sem ação | `TeamMemberRow` tem `<Button variant="ghost" size="icon">` com `Icons.more` e **nenhum `onClick`** — botão morto que sugere ações de linha (mudar papel, remover) inexistentes | 🔴 | `DropdownMenu`(+`Trigger`/`Content`/`Item`) → mutations |
| **E2** | `Button.leftIcon` não usado | "Invite Member" monta ícone+margem à mão: `<Icons.userPlus className="mr-2 h-4 w-4"/>` | 🟡 | `<Button leftIcon={<Icons.userPlus/>}>` |
| **E3** | `Button.loading`/`loadingText` não usado | submit ("Send Invitation") e "Revoke" fazem swap manual de `<Icons.spinner className="animate-spin"/>` | 🟡 | `<Button loading={isPending}>` (spinner nativo) |
| **E4** | `Button.icon` + `size="icon-sm"` não usado | ⋯ usa `size="icon"` + `className="h-8 w-8"` p/ encolher | 🔵 | `<Button size="icon-sm" icon={<Icons.more/>}/>` |
| **E5** | Limpar busca ausente | sem affordance de clear no campo de busca | 🔵 | `SearchInput onClear`/`showClearButton` (C1) |
| **E6** | `ButtonEventPayload` ignorado | handlers usam `() => …`; o payload (`id`/`isLoading`/`timestamp`) está disponível mas não é necessário aqui | 🔵 | ok manter; ciente |
| **E7** | `Button.tooltip` não usado | ⋯ e Revoke são só-ícone (Revoke esconde label em `<sm`) sem rótulo acessível por tooltip | 🔵 | `tooltip="Revogar"` / `tooltip="Ações"` |

---

## 3. GAPS de cores / tokens

| Elemento | Usa | Token Seven? | Veredito |
|---|---|---|---|
| textos secundários (subtítulo, email, expiry, "(you)") | `text-muted-foreground` (×6) | ✅ `--muted-foreground` | ✅ |
| círculo do convite | `bg-muted` | ✅ `--muted` | ✅ |
| botão Revoke | `text-destructive hover:text-destructive` | ✅ `--destructive` | 🔵 **CL1** — aplicado à mão num `ghost` (não há variant *ghost-destructive*); token-backed, aceitável |
| Card / Dialog / Badge / Avatar bg·borda·sombra | tokens internos (`--card-root-*`, `--border`, `--badge-*`, `--avatar-*`) | ✅ | ✅ |
| títulos / nomes | herdam `--foreground` | parcial | 🔵 explícito via `Heading`/`Text` |

→ Cores **100% token**: zero hex, zero `text-*-500`, zero `bg-gray-*`. Único ponto de atenção é o `text-destructive` forçado no `ghost` (CL1), mas o valor é token.

---

## 4. GAPS de espaçamento

| Onde | Usa | Tipo | Veredito |
|---|---|---|---|
| wrapper da página | `space-y-8` (32px) | layout (raw Tailwind) | ✅ `--spacing-8` |
| grids / flex internos | `gap-4`/`gap-3`/`gap-2` (16/12/8) | layout (raw) | ✅ escala 4px (espelha tokens) |
| linhas de lista | `py-4` + `first:pt-0 last:pb-0` | ritmo de linha | ✅ `--spacing-4` + reset |
| loading/vazio | `py-8` | = `emptyStateStyles` | ✅ value-aligned |
| **search** | `pl-9` (36px) | **offset manual** p/ o ícone `absolute` | 🔵 **SP1** — some ao adotar `SearchInput`/`leadingIcon` (C1) |
| interno de Card/Dialog/Badge | `--card-*`, `--dialog-*`, `--badge-*` | tokens Seven | ✅ |

→ Espaçamento interno vem certo dos tokens; o ritmo de página é raw mas alinhado. Único cru de propósito é o `pl-9` (workaround do ícone).

---

## 5. GAPS de tipografia

| Elemento | Tela | Seven esperado | Sev. |
|---|---|---|---|
| título h1 | `text-2xl font-semibold tracking-tight` | `Heading` (tokens de tipografia) | 🟡 **TY1** (= C3) |
| subtítulo / email / expiry | `<p className="text-sm text-muted-foreground">` | `Text`/`Paragraph` | 🟡 **TY2** (= C3) |
| nome do membro / email do convite | `<p className="font-medium">` | `Text` (peso via prop) | 🟡 **TY3** (= C3) |
| marcador "(you)" | `<span className="text-xs text-muted-foreground">` | `Text size="xs"` ou `Badge` | 🔵 **TY4** |
| `CardTitle` | sobrescrito com `text-lg` | `CardTitle` já traz `[font-weight:var(--card-title-weight)]`; o `text-lg` reescala a fonte do componente | 🔵 **TY5** |
| valores de Badge | herdam `--badge-size-*-text` | — | ✅ |

> O guard-rail do ESLint **não** bane `h1/p/span` (só `button/input/select/textarea`) — passa o lint, mas é drift de DS.

---

## 6. GAPS de sizing / ícones

| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | Convenção de ícone `h-4 w-4` | 6× `h-4 w-4` (16px) em vez de `size-4`; `Button`/`SearchInput` forneceriam o sizing do ícone automaticamente | 🔵 |
| **SZ2** | `h-8 w-8` sobrescreve size token | ⋯ força `size="icon"` a 32px à mão; o `Button` tem `size="icon-sm"` pronto | 🔵 (= E4) |
| **SZ3** | `h-10 w-10` dimensão à mão | círculo do convite é um avatar hand-rolled; `Avatar size` cobre isso | 🔵 (= C6) |

---

## 7. GAPS de estados

| Estado | Tela | Seven oferece | Sev. |
|---|---|---|---|
| loading | 🟡 texto "Loading members…" cru | `Spinner` · `SkeletonLoader` · `AvatarSkeleton` | 🟡 **ST1** (= C7) |
| vazio (busca s/ resultado) | usa `py-8 text-center text-muted-foreground` = **exatamente** `emptyStateStyles` | sem `<EmptyState>` no beta.4; só `emptyStateVariants`/`emptyStateStyles` | 🔵 **ST2** value-aligned |
| vazio real ("0 membros") | reusa a msg de busca; sem ação no vazio | `EmptyState` não existe; usar `emptyStateVariants` + `Button` (convidar) | 🔵 **ST3** |
| hover/menu de linha | ⋯ implica menu que não existe | `DropdownMenu` | 🔴 **ST4** (= E1) |
| disabled | ✅ Invite (sem account), submit (isPending), Revoke (isRevoking) | nativo do `Button` | ✅ correto |
| erro | tratado via `toast.error` | `toast`/`Toaster` | ✅ |

---

## 8. Consolidado — backlog priorizado

| Prioridade | IDs | Resumo |
|---|---|---|
| 🔴 **Must-fix** | E1·ST4 | botão ⋯ morto + ações de linha (mudar papel / remover) inexistentes → `DropdownMenu` |
| 🟡 **Should-fix** | C1, C2, C3·TY1·TY2·TY3, C4, C5, C7·ST1, E2, E3 | `SearchInput`; `AvatarLabelGroup`; `Heading`/`Text`; `List`/`Divider`; `ToggleGroup`/`RadioCardGroup`; loading via `Spinner`/`Skeleton`; `Button.leftIcon`/`loading` |
| 🔵 **Nice-to-have** | C6·SZ3, C8, E4·SZ2, E5, E7, CL1, SP1, TY4, TY5, SZ1, ST2, ST3 | `Avatar` no convite; `CardAction`/`CardFooter`; `size="icon-sm"`; clear na busca; tooltips; polish de tipografia/sizing |

**Pontos corretos (não mexer):** composição completa de `Dialog` · stack completo de `Form` (RHF + zod + a11y por contexto) · `Badge` semântico (`type`/`color`) · `Avatar` img+fallback · wiring de `useMutation`/`toast` · cores 100% token · disabled states corretos.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

> Inventário do que o Seven oferece e a tela **não** aproveita — props, variants, sub-componentes e **componentes alternativos**. `[u]` = não usado.

### 9.1 — Campo de busca (hoje `TextInput` + ícone `absolute`)
| Categoria | Disponível no Seven | Usado? |
|---|---|---|
| Props do `TextInput` `[u]` | `leadingIcon` · `trailingIcon` · `leadingIconInteractive` · `size` · `variant` | ❌ |
| **Componente alternativo `[u]`** | **`SearchInput`** — `searchIcon` `clearIcon` `onClear` `showClearButton` `size` `variant` | ❌ (reimplementado à mão) |
| **Componente alternativo `[u]`** | **`AdvancedSearchInput`** · **`InputGroup`** | ❌ |

### 9.2 — Botões (hoje `Button` com ícone/spinner manual)
| Categoria | Disponível | Usado? |
|---|---|---|
| Props `[u]` | `leftIcon` · `rightIcon` · `icon` · `loading` · `loadingText` · `badge` · `tooltip` · `fullWidth` · `asChild` · `tone` | ❌ |
| Variants `[u]` | `destructive` · `secondary`(+gray/color) · `link`(+gray/color) · `tertiary`(gray/color) (usa `default`/`outline`/`ghost`) | ❌ |
| Sizes `[u]` | `icon-sm` · `lg` (usa `default`/`sm`/`icon`) | ❌ |
| Emitters `[u]` | payload `ButtonEventPayload` em `onClick`/`onFocus`/`onBlur`/`onKeyDown` | ❌ |

### 9.3 — Lista de membros (hoje `Avatar` + `<p>` à mão dentro de `divide-y`)
| Categoria | Disponível | Usado? |
|---|---|---|
| **Componente alternativo `[u]`** | **`AvatarLabelGroup`** (`name` `description` `src` `status` `badge` `size` `subtitle`) | ❌ |
| Avatar — props `[u]` | `size` `shape` `tooltip` `contrastBorder` `interactive` `bordered`; `AvatarFallback.colorScheme` | ❌ |
| Avatar — sub-componentes `[u]` | `AvatarStatus` (active/pending) · `AvatarGroup` · `AvatarBadge` · `AvatarSkeleton` | ❌ |
| **Render de lista `[u]`** | **`List`** · **`Table`** · **`DataTable`** (colunas papel/status/ações) · **`Divider`** | ❌ |

### 9.4 — Menu de ações da linha (hoje botão ⋯ morto)
| Categoria | Disponível `[u]` | Uso |
|---|---|---|
| **`DropdownMenu`** (+`Trigger`/`Content`/`Item`) | menu de "mudar papel / remover" | ❌ |
| **`AlertDialog`** (+`Action`/`Cancel`/…) | confirmação de remoção destrutiva | ❌ |

### 9.5 — Seletor de papel (hoje 3× `Button` manuais)
| Disponível `[u]` | Uso |
|---|---|
| **`RadioCardGroup`** (`columns` 1–4, `RadioCardGroupItem` com `title`+`description`) | ideal — cada papel já tem descrição |
| **`ToggleGroup`** (single, `size`, `variant`) · **`RadioGroup`** · **`Select`**/**`NativeSelect`** · **`ButtonGroup`** | single-select com a11y/teclado nativos |

### 9.6 — Badge (hoje `type`/`color` corretos)
| Categoria | Disponível | Usado? |
|---|---|---|
| Props usadas | `color` (`muted`/`warning`) · `type` (`badge-outline`) | ✅ |
| Props `[u]` | `size` · `dot` · `icon`/`leadingIcon`/`trailingIcon` · `interactive` · `onDismiss` · `avatar` · `country` · `tooltip` · `iconOnly` | ❌ |
| Colors `[u]` | `primary` · `secondary` · `destructive` · `success` · `info` · `tip` | ❌ |

### 9.7 — Loading / vazio (hoje `<div>` cru)
| Disponível `[u]` | Uso |
|---|---|
| `Spinner` · `SkeletonLoader` · `AvatarSkeleton` · `emptyStateVariants` | substituem o texto "Loading…" e a `<div>` de vazio |

### 9.8 — Título / textos / layout (hoje `<h1>`/`<p>`/`<span>` + `<div>` crus)
| Elemento | Componente Seven `[u]` | Eixos não aproveitados |
|---|---|---|
| `<h1>` | **`Heading`** | `level` · `size` · `weight` · `align` · `color` · `gradient` |
| `<p>`/`<span>` | **`Text`** / **`Paragraph`** | variants de tamanho/cor/peso |
| `<div>` + grid | `Section` · `Container` · `Grid` · `Stack` · `Flex` | estrutura com tokens em vez de `space-y`/`grid` crus |

---

## 10. Ações possíveis do usuário (mapa completo)

> Toda ação que o usuário **poderia** executar, o gatilho, o status e o primitivo Seven que a ligaria.
> **Resultado: 9 de 13 ações estão ligadas — contraste forte com o dashboard (0/8). As 4 não-ligadas concentram-se no menu de linha (⋯) morto + limpar busca.**

| # | Ação possível | Gatilho (elemento) | Status | Como ligar (Seven) |
|---|---|---|---|---|
| A1 | Abrir diálogo de convite | `DialogTrigger` + `Button` "Invite Member" | ✅ ligada | ok (`Dialog open`) |
| A2 | Digitar email do convidado | `TextInput` (`FormField` email) | ✅ ligada | ok (RHF + zod) |
| A3 | Escolher papel | 3× `Button` manuais | ✅ ligada (primitivo errado) | `RadioCardGroup`/`ToggleGroup` (C5) |
| A4 | Enviar convite | `Button` submit → `inviteMutation` | ✅ ligada | `Button loading` (E3) |
| A5 | Cancelar diálogo | `Button` "Cancel" `onClick` | ✅ ligada | ok |
| A6 | Fechar diálogo (X/esc/overlay) | `DialogContent showCloseButton` (default) | ✅ ligada (nativo) | ok |
| A7 | Buscar/filtrar membros | `TextInput` `onChange` → `setSearchQuery` | ✅ ligada | `SearchInput` (C1) |
| A8 | Limpar busca | — (sem botão) | 🔵 não-ligada | `SearchInput onClear`/`showClearButton` |
| A9 | Abrir ações da linha (⋯) | `Button` ghost icon (`more`) | 🔴 não-ligada (sem `onClick`) | `DropdownMenu` (Trigger/Content/Item) |
| A10 | Mudar papel de um membro | implícito no ⋯ | 🔴 não-ligada | `DropdownMenuItem` → mutation |
| A11 | Remover um membro | implícito no ⋯ | 🔴 não-ligada | `DropdownMenuItem` + `AlertDialog` confirm → mutation |
| A12 | Revogar convite pendente | `Button` "Revoke" `onClick` → `revokeMutation` | ✅ ligada | `Button loading` (E3) |
| A13 | Feedback (toast sucesso/erro) | `sonner` `toast` | ✅ ligada | ok |
| A14 | Foco/teclado nos controles | `Button`/`Dialog`/`TextInput` Seven | ⚪ herdado | a11y nativa do DS |

**Total acionável: 13 · Ligadas: 9 (A1–A7, A12, A13) · Não-ligadas: 4 (A8, A9, A10, A11)** · A14 = herdado.
**Emitters do `Button` disponíveis:** `onClick` · `onFocus` · `onBlur` · `onKeyDown` (payload `ButtonEventPayload`: `id`, `isLoading`, `timestamp`).

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)

> **Toda** classe literal da tela, classificada contra os tokens do Seven. Legenda:
> ✅ **token-backed** · 🟢 **value-aligned** (utilitário Tailwind cujo valor == token Seven) · 🟡 **drift** (cru onde um componente/token Seven deveria mandar) · 🔴 **off-system** (sem token equivalente) · ⚪ layout (estrutural).
>
> Nota-chave: a escala de spacing do Seven **espelha a do Tailwind** (`--spacing-2`=8px, `--spacing-4`=16px, `--spacing-8`=32px) e `--font-tracking-tight`=`tracking-tight`=-0.025em. Por isso muito "cru" é 🟢.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `text-muted-foreground` (×6) | `--muted-foreground` | ✅ |
| `bg-muted` | `--muted` | ✅ |
| `text-destructive` / `hover:text-destructive` | `--destructive` | ✅ (manual no `ghost` — CL1) |
| bg/borda/sombra de Card·Dialog·Badge·Avatar | tokens internos | ✅ |
| *(nenhuma cor hardcoded — hex, `text-*-500`, `bg-gray-*`)* | — | ✅ limpo |

### 11.2 — Espaçamento
| Classe | Valor | Token Seven equiv. | Veredito |
|---|---|---|---|
| `space-y-8` | 32px | `--spacing-8` | 🟢 |
| `gap-4` (×3) | 16px | `--spacing-4` | 🟢 |
| `gap-3` | 12px | escala 4px | 🟢 |
| `gap-2` (×3) | 8px | `--spacing-2` | 🟢 |
| `py-4` (×3) | 16px | `--spacing-4` | 🟢 |
| `py-8` (×2) | 32px | `--spacing-8` (= `emptyStateStyles`) | 🟢 |
| `mr-2` (×2) · `ml-2` | 8px | `--spacing-2` | 🟢 |
| `pl-9` | 36px | escala 4px | 🟢 (workaround do ícone — SP1) |
| `left-3` | 12px | escala 4px | 🟢 (posicionamento do ícone) |

### 11.3 — Bordas & radius
| Classe | Resolve em | Veredito |
|---|---|---|
| `rounded-full` | `--radius-full` (9999px) | ✅ |
| `divide-y` (×2) | separadores via cor `--border` | 🟢/⚪ (drift p/ `List`/`Divider` — C4) |
| *(sem `border-dashed`, sem radius arbitrário)* | — | ✅ |

### 11.4 — Tipografia
| Classe | Valor | Veredito | Observação |
|---|---|---|---|
| `text-2xl` | 1.5rem | 🟡 | título deveria vir do `Heading` |
| `font-semibold` | 600 | 🟡 | idem (peso do `Heading`) |
| `tracking-tight` | -0.025em | 🟢 | == `--font-tracking-tight` |
| `text-lg` (×2) | 1.125rem | 🟡 | reescala o `CardTitle` (TY5) |
| `font-medium` (×2) | 500 | 🟡 | corpo deveria vir do `Text` |
| `text-sm` (×2) | 0.875rem | 🟡 | idem (`Text`/`Paragraph`) |
| `text-xs` | 0.75rem | 🟡 | "(you)" → `Text size="xs"`/`Badge` |
| `capitalize` (×2) | — | ⚪ | text-transform (funcional, sem token) |
| `animate-spin` (×2) | — | ⚪ | animação (o `Spinner` forneceria) |

### 11.5 — Sizing (ícones / dimensões)
| Classe | Valor | Veredito |
|---|---|---|
| `h-4 w-4` (×6) | 16px | 🟢 valor ok; convenção `size-4` + sizing automático do `Button`/`SearchInput` (SZ1) |
| `h-8 w-8` | 32px | 🟡 sobrescreve size do `Button` (use `size="icon-sm"` — SZ2) |
| `h-10 w-10` | 40px | 🟡 avatar à mão (use `Avatar size` — SZ3) |
| `max-w-sm` | 24rem | ⚪ largura de layout |

### 11.6 — Layout (⚪ sem token de design — ok)
`flex` · `flex-col` · `items-center` · `justify-between` · `justify-center` · `sm:flex-row` · `sm:items-center` · `sm:justify-between` · `grid` · `grid-cols-3` · `relative` · `absolute` · `top-1/2` · `-translate-y-1/2` · `hidden` · `sm:inline` · `first:pt-0` · `last:pb-0`

> As utilidades de posicionamento (`absolute`/`top-1/2`/`-translate-y-1/2`/`left-3`/`pl-9`) existem **só** porque o ícone de busca foi posto à mão — somem ao adotar `SearchInput`/`leadingIcon` (C1).

### 11.7 — Veredito do estilo
| Classificação | Qtde | Itens |
|---|---|---|
| ✅ token-backed | 4 famílias | cores (`muted-foreground`, `destructive`, `muted`), `rounded-full` |
| 🟢 value-aligned | 12 | `space-y-8`, `gap-4/3/2`, `py-4`, `py-8`, `mr-2`, `ml-2`, `pl-9`, `left-3`, `tracking-tight`, `h-4 w-4` |
| 🟡 drift (tipografia/sizing) | 9 | `text-2xl`, `font-semibold`, `text-lg`, `font-medium`, `text-sm`, `text-xs`, `h-8 w-8`, `h-10 w-10`, `divide-y` |
| 🔴 off-system | **0** | — (nenhum `border-dashed` / hex / `gray-*`) |

> **Conclusão de estilo:** a tela é **token-limpa** — zero cor hardcoded, zero off-system (mais limpa que o dashboard, que tinha `border-dashed`). Todo o "débito" é **componente-misuse** (search, avatar+label, ícones/spinner manuais, ⋯ morto) e **drift de tipografia** (`h1`/`p`/`span` → `Heading`/`Text`), não violação de estilo cru.

---

### Linha do coverage-matrix (índice)
```yaml
team:
  route: src/client/routes/_authenticated/team.tsx
  fidelity: 0.76
  components_used: [Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, TextInput]
  components_missing: [SearchInput, AvatarLabelGroup, Spinner, SkeletonLoader, DropdownMenu, AlertDialog, ToggleGroup, RadioCardGroup, Heading, Text, List, Divider, CardAction, CardFooter]
  gaps:
    components: [C1, C2, C3, C4, C5, C6, C7, C8]
    emitters:   [E1, E2, E3, E4, E5, E6, E7]
    colors:     [CL1]
    spacing:    [SP1]
    typography: [TY1, TY2, TY3, TY4, TY5]
    sizing:     [SZ1, SZ2, SZ3]
    states:     [ST1, ST2, ST3, ST4, ST5]
  severity: { high: 1, medium: 8, low: 12 }
  unused_seven:                      # superfície do DS não aproveitada (seção 9)
    alternative_components: [SearchInput, AdvancedSearchInput, InputGroup, AvatarLabelGroup, AvatarGroup, AvatarStatus, AvatarSkeleton, Spinner, SkeletonLoader, DropdownMenu, AlertDialog, ToggleGroup, RadioCardGroup, RadioGroup, Select, NativeSelect, ButtonGroup, List, Table, DataTable, Divider, Heading, Text, Paragraph, Section, Container, Grid, Stack, Tooltip]
    unused_props:
      Button: [leftIcon, rightIcon, icon, loading, loadingText, badge, tooltip, fullWidth, asChild, tone]
      TextInput: [leadingIcon, trailingIcon, leadingIconInteractive, size, variant]
      Avatar: [size, shape, tooltip, contrastBorder, interactive, bordered]
      Badge: [size, dot, icon, leadingIcon, trailingIcon, interactive, onDismiss, tooltip, iconOnly]
    unused_variants:
      Button: [destructive, secondary, link, tertiary]
      Card: [elevated, outlined, ghost, selectable]
    unused_subcomponents:
      Card: [CardAction, CardFooter, CardMedia]
      Avatar: [AvatarLabelGroup, AvatarGroup, AvatarStatus, AvatarBadge, AvatarSkeleton]
  user_actions:                      # seção 10
    total: 13
    wired: 9
    unwired: [A8, A9, A10, A11]      # A14 = herdado
  style_audit:                       # seção 11 (classe-a-classe)
    token_backed: [text-muted-foreground, text-destructive, bg-muted, rounded-full]
    value_aligned: [space-y-8, gap-4, gap-3, gap-2, py-4, py-8, mr-2, ml-2, pl-9, left-3, tracking-tight, h-4 w-4]
    drift: [text-2xl, font-semibold, text-lg, font-medium, text-sm, text-xs, h-8 w-8, h-10 w-10, divide-y]
    off_system: []                   # nenhum estilo sem token Seven
    hardcoded_colors: 0
```
