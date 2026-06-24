# Auditoria de tela — Settings

> **Rota:** `src/client/routes/_authenticated/settings.tsx`
> **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` — **só código** (source: exports, `*.variants.ts`, `*.types.ts`, tokens). Sem render/Figma.
> **Data:** 2026-06-24
> **Fidelidade:** 🟡 **72%** — adota o stack de `Form`/`Tabs`/`Card`/`Switch` corretamente e liga o núcleo (form + abas + toggles), mas tem **cor hardcoded** (`text-emerald-600`), CTAs mortos (foto/excluir/desconectar/revogar) e tipografia/status crus.
>
> Severidade: 🔴 alta (quebra DS ou UX) · 🟡 média (foge do DS, funciona) · 🔵 baixa (polish)

---

## 0. Elementos da tela (o que está renderizado)

| # | Elemento | Origem | Componente Seven |
|---|---|---|---|
| 1 | título "Settings" | raw `<h1>` | — |
| 2 | subtítulo da página | raw `<p>` | — |
| 3 | abas Profile/Account/Notifications | `@etus/seven-react` | `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` |
| 4 | card "Profile Picture" | `@etus/seven-react` | `Card` + `CardHeader/CardTitle/CardDescription/CardContent` |
| 5 | avatar do usuário | `@etus/seven-react` | `Avatar` + `AvatarImage` + `AvatarFallback` |
| 6 | botão "Change Photo" | `@etus/seven-react` | `Button` (`variant="outline" size="sm"`) |
| 7 | helper "JPG, PNG…" | raw `<p>` | — |
| 8 | card "Personal Information" | `@etus/seven-react` | `Card` + `Form` |
| 9 | form de perfil | `@etus/seven-react` | `Form` + `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage` |
| 10 | input "Full Name" | `@etus/seven-react` | `TextInput` (via `FormControl`) |
| 11 | input "Email" (read-only) | `@etus/seven-react` | `Label` + `TextInput` (`disabled`) |
| 12 | botão "Save Changes" (submit) | `@etus/seven-react` | `Button` + spinner manual (`Icons.spinner animate-spin`) |
| 13 | card "Connected Accounts" + linha Google | `@etus/seven-react` + raw | `Card` + `<div>` cru (círculo `bg-muted` + `Icons.google` + status) |
| 14 | card "Sessions" + linha sessão atual | `@etus/seven-react` + raw | `Card` + `<div>` cru + status |
| 15 | card "Danger Zone" | `@etus/seven-react` | `Card className="border-destructive/50"` + `Button variant="destructive"` |
| 16 | card "Email Notifications" | `@etus/seven-react` | `Card` + 3× `NotificationToggle` + 2× `Divider` |
| 17 | `NotificationToggle` (local) | raw + `@etus/seven-react` | `<div>`/`<p>` cru + `Switch` |
| 18 | status "Connected"/"Active" | raw `<span>` | — (deveria ser `Badge`/`Tag`) |
| 19 | ícones | `@/components/icons` (lucide) | — (convenção do projeto, ok) |
| 20 | feedback de salvar | `sonner` (`toast`) | — (Seven exporta `Toaster`) |

---

## 1. GAPS de componentes & sub-componentes

| ID | Gap | Detalhe | Sev. | Correção |
|---|---|---|---|---|
| **C1** | Status à mão | `Connected`/`Active` são `<span … text-emerald-600>` em vez de `Badge color="success"` / `Tag` (ambos no beta.4) | 🟡 | `<Badge color="success">Connected</Badge>` |
| **C2** | Tipografia em HTML cru | `<h1>` e ~10 `<p>`/`<span>` em vez de `Heading` / `Text`·`Paragraph` (todos exportados) | 🟡 | `Heading` no título, `Text` no corpo |
| **C3** | Avatar reinventado | linhas Google/Sessão usam `<div className="h-10 w-10 … rounded-full bg-muted">` + ícone, em vez de `Avatar`/`AvatarFallback` | 🔵 | `Avatar size="default"` + `AvatarFallback` |
| **C4** | `NotificationToggle` reimplementa o `Switch` | o próprio `Switch` tem `switchText`/`descriptionText`/`type="box"` — a tela recria isso com `<div>`/`<p>` crus | 🟡 | usar a composição nativa do `Switch` ou `Text` no rótulo |
| **C5** | Exclusão sem confirmação | "Delete Account" não abre `AlertDialog`/`Dialog` (ambos exportados) — ação destrutiva sem guarda | 🔴 | envolver em `AlertDialog` (ver E2) |
| **C6** | Upload de foto inexistente | "Change Photo" não tem `<input type=file>` nem `FileUpload`/`Dropzone` (exportados) | 🟡 | `FileUpload` + handler (ver E1) |
| **C7** | `FormDescription` exportado e não usado | helpers ("Email cannot be changed.", "JPG, PNG…") são `<p className="text-xs …">` em vez de `FormDescription` | 🔵 | `FormDescription` dentro do `FormItem` |
| **C8** | Campo Email fora do `FormField` | email usa `Label`+`TextInput`+`<p>` soltos, divergindo do padrão `FormField` ao lado | 🔵 | uniformizar via `FormField`/`FormItem` |

**Sub-componentes do `Card` disponíveis e NÃO usados:** `CardMedia`, `CardAction`, `CardFooter`.
**Sub-componentes do `Avatar` disponíveis e NÃO usados:** `AvatarStatus`, `AvatarBadge`, `AvatarGroup`, `AvatarLabelGroup`, `AvatarSkeleton`.

---

## 2. GAPS de emitters / interações (callbacks, CTA, handlers)

> O núcleo funcional **está ligado** (abas via Radix, form via RHF, toggles via `onCheckedChange`). Os buracos são **CTAs mortos** e **persistência ausente**.

| ID | Emitter/ação ausente | Onde | Sev. | Correção |
|---|---|---|---|---|
| **E1** | "Change Photo" sem ação | `Button variant="outline"` **sem `onClick`** e sem mecanismo de arquivo | 🔴 | `FileUpload`/`Dropzone` + handler de upload |
| **E2** | "Delete Account" sem ação | `Button variant="destructive"` **sem `onClick`** e **sem confirmação** | 🔴 | `AlertDialog` → `onClick` que chama a API de exclusão |
| **E3** | Conta conectada sem gerência | card diz *"Manage your connected OAuth providers"* mas só mostra "Connected" — **sem botão** desconectar | 🔴 | `Button` ("Desconectar") + `AlertDialog` |
| **E4** | Sessão sem gerência | card diz *"Manage your active sessions"* mas só mostra "Active" — **sem botão** revogar | 🔴 | `Button` ("Revogar") por sessão |
| **E5** | Preferências de notificação não persistem | 3 `Switch` mudam `useState` local; **não há botão salvar nem mutation** — perde no reload | 🟡 | `onCheckedChange` → mutation (Regra 6) |
| **E6** | Salvar perfil é mock | `onSubmit` faz `setTimeout(1000)` + `console.log`, não chama API real | 🟡 | ligar à mutation real (Regra 6) |
| **E7** | Spinner manual em vez de `Button.loading` | submit usa `Icons.spinner animate-spin` + `disabled={isSubmitting}`; o `Button` tem `loading`/`loadingText` nativos | 🟡 | `<Button loading={form.formState.isSubmitting}>` |
| **E8** | `ButtonEventPayload` ignorado | nenhum botão usa `onClick/onFocus/onBlur/onKeyDown` (payload `id`,`isLoading`,`timestamp`) | 🔵 | usar quando os CTAs forem ligados |

> **Positivo:** `Switch onCheckedChange={setChecked}`, `TabsTrigger value`, `form.handleSubmit(onSubmit)` estão corretamente conectados — diferente da Dashboard (0 emitters).

---

## 3. GAPS de cores / tokens

| Elemento | Usa | Token Seven? | Veredito |
|---|---|---|---|
| `Card` bg/borda/sombra | tokens internos `--card-root-*`, `--border` | ✅ | ✅ |
| texto secundário (×6) | `text-muted-foreground` | ✅ `--muted-foreground` | ✅ |
| círculos de ícone | `bg-muted` | ✅ `--muted` | ✅ |
| Danger Zone | `text-destructive` / `border-destructive/50` | ✅ `--destructive` (+ alpha) | ✅ |
| `AvatarFallback` bg | `--avatar-fallback-bg-default` (interno) | ✅ | ✅ |
| **status "Connected"/"Active"** | `text-emerald-600` (×2) | ❌ **`emerald` não existe no Seven** | 🔴 **CL1** — usar `--success`/`text-success` ou `Badge color="success"` |

→ Cores quase todas corretas (herdadas/semânticas). O **único** ponto cru é `text-emerald-600` — token de paleta Tailwind sem equivalente no DS; o semântico de sucesso é `--success` (e `--success-subtle`).

---

## 4. GAPS de espaçamento

| Onde | Usa | Tipo | Veredito |
|---|---|---|---|
| wrapper da página | `space-y-8` (32px) | layout (raw) → `--spacing-8` | 🟢 |
| conteúdo de abas/cards | `space-y-4` (16px), `gap-4`, `p-4` | → `--spacing-4` | 🟢 |
| pares menores | `space-y-2`/`gap-2`/`mr-2` (8px), `gap-1` (4px) | → `--spacing-2`/`--spacing-1` | 🟢 |
| **ritmo das abas/seções** | `space-y-6` (×4) / `gap-6` (×1) = **24px** | **fora da escala Seven** (não há `--spacing-6`; a escala pula 16→32) | 🟡 **SP1** — usar `--spacing-4`/`--spacing-8` ou o `gap` próprio do `Tabs` |
| micro-gap do toggle | `space-y-0.5` (2px) | sem token (`--spacing-1`=4px é o menor) | 🟡 **SP2** — some ao adotar a composição do `Switch` |
| interno de card/form/tabs | `--card-*`, `--form-*`, `--tabs-*` | tokens Seven (não sobrescritos) | ✅ |

> Honestidade: a escala Seven = passo Tailwind × 4px, mas é **curada** — só {1,2,4,8,12,16,20,24,32,40,48,56,64}. Por isso `space-y-8/4/2`, `gap-4/2/1` são 🟢, mas **`space-y-6`/`gap-6` (24px) não têm token** → drift real, não value-aligned.

---

## 5. GAPS de tipografia

| Elemento | Tela | Seven esperado | Sev. |
|---|---|---|---|
| título h1 | `text-2xl font-semibold tracking-tight` | `Heading` (tokens de tipografia) | 🟡 **TY1** (= C2) |
| subtítulo da página | `<p className="text-muted-foreground">` | `Text`/`Paragraph` | 🟡 **TY2** (= C2) |
| pseudo-títulos | `<p className="font-medium">` (Google, Current Session, Delete Account, título do toggle) | `Text weight` / `Heading level` | 🟡 **TY3** (= C2) |
| corpo/helpers | `text-sm`/`text-xs` em `<p>`/`<span>` | `Text`/`Paragraph`/`FormDescription` | 🟡 **TY4** (= C2/C7) |
| `AvatarFallback` | `text-lg` sobrescreve o tamanho da fallback | o `size` do `Avatar` já define `text-[length:var(--avatar-text-*)]` | 🟡 **TY5** (= SZ2) |
| `CardTitle` Danger Zone | override `text-destructive` (aditivo) | `cardTitleVariants` + cor; override ok | 🔵 |
| `tracking-tight` | -0.025em | = `--font-tracking-tight` (via var Tailwind) | 🟢 |

> Nota: o guard-rail do ESLint **não** bane `h1/p/span` (só `button/input/select/textarea`) — passa o lint, mas é drift de DS. **Nenhuma** tag banida foi encontrada na tela.

---

## 6. GAPS de sizing / ícones

| ID | Gap | Detalhe | Sev. |
|---|---|---|---|
| **SZ1** | Convenção de ícone mista | `mr-2 h-4 w-4` (16px) vs `h-5 w-5` (20px) vs `size-4` (interno dos componentes) | 🟡 |
| **SZ2** | `Avatar` sem `size` prop | usa `className="h-20 w-20"` (80px) + `AvatarFallback text-lg` em vez de `size="xl"`/`"3xl"` (que já trazem `--avatar-size-*`/`--avatar-text-*`) | 🟡 |
| **SZ3** | Círculos de ícone à mão | `h-10 w-10 rounded-full bg-muted` recriam o que `Avatar size="default"` entrega tokenizado | 🔵 |

---

## 7. GAPS de estados

| Estado | Tela | Seven oferece | Sev. |
|---|---|---|---|
| loading (submit) | 🟡 spinner manual | `Button.loading` / `Button.loadingText` | 🟡 **ST1** (= E7) |
| confirmação destrutiva | ❌ ausente | `AlertDialog` / `Dialog` | 🔴 **ST2** (= C5/E2) |
| erro de validação | ✅ `FormMessage` + `toast.error` | `FormMessage` (`state="error"`) | ✅ |
| disabled | ✅ email + "Security Alerts" toggle | nativo dos componentes | ✅ |
| sucesso | 🔵 `sonner` `toast.success` | Seven exporta `Toaster` (consistência) | 🔵 **ST3** |
| hover/focus/active | ✅ vêm de `Button`/`Tabs`/`Switch` | tokens internos | ✅ |
| empty | n/a nesta tela | `EmptyState` | — |

---

## 8. Consolidado — backlog priorizado

| Prioridade | IDs | Resumo |
|---|---|---|
| 🔴 **Must-fix** | CL1, E2·C5·ST2, E1·C6, E3, E4 | cor hardcoded `text-emerald-600`; excluir conta sem confirmação/handler; trocar foto morto; conta/sessão prometem "Manage" sem botão |
| 🟡 **Should-fix** | C1, C2·TY1-4, C4, E5, E6, E7·ST1, SP1, SZ2 | status→`Badge`/`Tag`; tipografia→`Heading`/`Text`; toggle→composição do `Switch`; persistir prefs; salvar real; `Button.loading`; ritmo 24px; `Avatar size` |
| 🔵 **Nice-to-have** | C3·SZ3, C7, C8, SP2, SZ1, TY5, ST3, E8 | avatar à mão; `FormDescription`; email no `FormField`; micro-gap 2px; convenção de ícone; `Toaster`; payload de eventos |

**Pontos corretos (não mexer):** stack completo de `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` · `Tabs` composto · `Card` + sub-componentes · `Switch` com `onCheckedChange` · `Divider` · tokens `--muted`/`--destructive`/`--border`/radius · spacing 8/16/32 alinhado.

---

## 9. Superfície do Seven AINDA NÃO USADA (por elemento)

> Inventário do que o Seven oferece e a tela **não** aproveita — props, variants, sub-componentes, estados e **componentes alternativos**. `[u]` = não usado.

### 9.1 — Abas (hoje `Tabs` `solid`)
| Categoria | Disponível no Seven | Usado? |
|---|---|---|
| Variant `[u]` | `line` (underline) — usa `solid` | ❌ |
| `TabsTrigger` props `[u]` | **`icon`** (slot antes do label) · **`badge`** (slot depois) | ❌ (ícone inline `mr-2 h-4 w-4`) |
| Tokens internos | `--tabs-root-gap` `--tabs-list-*` `--tabs-trigger-*` | ✅ (mas `space-y-6` sobrepõe o gap) |

### 9.2 — Cards (hoje `Card` `default`)
| Categoria | Disponível | Usado? |
|---|---|---|
| Sub-componentes usados | `CardHeader/CardTitle/CardDescription/CardContent` | ✅ |
| Sub-componentes `[u]` | `CardMedia` · `CardAction` · `CardFooter` | ❌ |
| Variants `[u]` | `elevated` · `outlined` · `ghost` · `selectable` (usa `default`) | ❌ |
| Estados `[u]` (selectable) | `data-active`/`data-selected` · pin/checkbox overlays · `onToggleSelect`/`onTogglePin` | ❌ |

### 9.3 — Avatar (hoje `Avatar` + override)
| Categoria | Disponível | Usado? |
|---|---|---|
| Props `[u]` | **`size`** (`xs`→`4xl`) · `shape` · `bordered` · `interactive` · `tooltip` · `contrastBorder` | ❌ (override `h-20 w-20`) |
| `AvatarFallback` `[u]` | `colorScheme` (`primary/secondary/success/warning/destructive`) | ❌ (override `text-lg`) |
| Sub-componentes `[u]` | `AvatarStatus` (presença) · `AvatarBadge` · `AvatarGroup` · `AvatarLabelGroup` · `AvatarSkeleton` | ❌ |

### 9.4 — Button (hoje `outline`/`destructive`/`default`)
| Categoria | Disponível | Usado? |
|---|---|---|
| Estados `[u]` | **`loading`** · `loadingText` | ❌ (spinner manual) |
| Slots `[u]` | `leftIcon` · `rightIcon` · `icon` · `badge`/`badgeColor`/`badgeSize` | ❌ (ícones inline) |
| Props `[u]` | `asChild` · `tooltip` · `fullWidth` · `tone` · `shape` | ❌ |
| Emitters `[u]` | `onClick/onFocus/onBlur/onKeyDown` + `ButtonEventPayload` | ❌ |

### 9.5 — TextInput (hoje `default`/`md`)
| Categoria | Disponível | Usado? |
|---|---|---|
| Sizes `[u]` | `xs` · `sm` · `lg` · `xl` (usa `md`) | ❌ |
| Variants `[u]` | `filled` · `flushed` · `unstyled` | ❌ |
| Slots `[u]` | `leadingIcon` · `trailingIcon` (+ `*Interactive`) | ❌ |

### 9.6 — Switch (hoje bare + wrapper à mão)
| Categoria | Disponível | Usado? |
|---|---|---|
| Composição `[u]` | **`switchText`** · **`descriptionText`** · `showText`/`showDescription` · **`type="box"`** | ❌ (recriado em `NotificationToggle`) |
| Sizes `[u]` | `sm` · `lg` (usa `md`) | ❌ |

### 9.7 — Divider (hoje `line` default)
| Categoria | Disponível | Usado? |
|---|---|---|
| Tipos `[u]` | `text` · `heading` · `button*` · `button-group*` | ❌ |
| Estilo/linha `[u]` | `visualStyle` (`dual-line`/`background-fill`) · `lineType` (`dashed`/`dotted`) · `labelPosition` · `orientation="vertical"` | ❌ |

### 9.8 — Form (hoje sem helper/description)
| Categoria | Disponível | Usado? |
|---|---|---|
| Sub-componente `[u]` | **`FormDescription`** (helper acessível ligado por `aria-describedby`) | ❌ (helpers em `<p>`) |
| `FormItem` `[u]` | `spacing` (`tight`/`loose`) | ❌ |
| `FormMessage` `[u]` | `state` (`success`/`info`, além de `error`) | ❌ |
| `Label` `[u]` | `required` · `optional`/`optionalText` · `size` | ❌ |

### 9.9 — Componentes alternativos nunca considerados
| Necessidade da tela | Componente Seven `[u]` |
|---|---|
| título / textos crus | **`Heading`** (`level/size/weight/align/color/gradient`) · **`Text`**/**`Paragraph`** |
| status "Connected"/"Active" | **`Badge`** (`color="success"`) · **`Tag`** |
| confirmar exclusão | **`AlertDialog`** (+`Action/Cancel/Title/Description`) · **`Dialog`** |
| trocar foto | **`FileUpload`** · **`Dropzone`** |
| layout da página | **`Section`** · **`Stack`** · **`Grid`** · **`Container`** (vs `space-y`/`grid` crus) |
| loading de dados | **`SkeletonLoader`** |
| feedback | **`Toaster`** (Seven) vs `sonner` |

---

## 10. Ações possíveis do usuário (mapa completo)

> Toda ação que o usuário **poderia** executar, o gatilho, o status atual e o primitivo Seven que a ligaria.
> **Resultado: 5 de 10 ações acionáveis estão ligadas (A7 e A12 = n/a por design).**

| # | Ação possível | Gatilho (elemento) | Status | Como ligar (Seven) |
|---|---|---|---|---|
| A1 | Trocar de aba | `TabsTrigger` | ✅ ligada (Radix `value`/`defaultValue`) | — |
| A2 | Editar nome completo | `TextInput` via `FormField` | ✅ ligada (react-hook-form) | — |
| A3 | Salvar perfil | submit "Save Changes" | ✅ ligada (`onSubmit`) — **mas mock** (`setTimeout`+`console.log`) | mutation real (E6) |
| A4 | Trocar foto | `Button` "Change Photo" | 🔴 não-ligada (sem `onClick`, sem input) | `FileUpload`/`Dropzone` + handler |
| A5 | Alternar "Team Invitations" | `Switch` | ✅ ligada (`onCheckedChange`) — **só estado local** | persistir (E5) |
| A6 | Alternar "Product Updates" | `Switch` | ✅ ligada — **só estado local** | persistir (E5) |
| A7 | Alternar "Security Alerts" | `Switch disabled` | ⚪ n/a (desabilitado por design) | — |
| A8 | Salvar preferências de notificação | — (sem botão) | 🔴 não-ligada (sem emitter/persistência) | `Button` + mutation |
| A9 | Desconectar/gerenciar Google | — (só status "Connected") | 🔴 não-ligada (card promete "Manage") | `Button` ("Desconectar") + `AlertDialog` |
| A10 | Revogar/gerenciar sessão atual | — (só status "Active") | 🔴 não-ligada (card promete "Manage") | `Button` ("Revogar") |
| A11 | Excluir conta | `Button variant="destructive"` | 🔴 não-ligada (sem `onClick`, sem confirmação) | `AlertDialog` → `onClick` |
| A12 | Editar e-mail | `TextInput disabled` | ⚪ n/a (read-only por design) | — |

**Contagem:** acionáveis = 10 · **ligadas = 5** (A1, A2, A3, A5, A6) · não-ligadas = 5 (A4, A8, A9, A10, A11) · n/a = 2 (A7, A12).
**Emitters do `Button` disponíveis quando A4/A8–A11 forem ligadas:** `onClick`·`onFocus`·`onBlur`·`onKeyDown` (payload `ButtonEventPayload`: `id`, `isLoading`, `timestamp`).

---

## 11. Auditoria de estilo CLASSE-A-CLASSE (exaustiva)

> **Toda** classe literal da tela, classificada contra os tokens do Seven. Legenda:
> ✅ **token-backed** (resolve num token Seven) · 🟢 **value-aligned** (utilitário Tailwind cujo valor == token Seven) · 🟡 **drift** (cru onde um componente/token Seven deveria mandar) · 🔴 **off-system** (sem token equivalente) · ⚪ layout (estrutural, sem token de design)
>
> Nota-chave: a escala de spacing do Seven **espelha a do Tailwind** (passo × 4px), mas é **curada** — falta `--spacing-6` (24px). Por isso `space-y-6`/`gap-6` são 🟡, não 🟢.

### 11.1 — Cores
| Classe | Resolve em | Veredito |
|---|---|---|
| `text-muted-foreground` (×6) | `--muted-foreground` | ✅ |
| `bg-muted` (×2) | `--muted` | ✅ |
| `text-destructive` (×1) | `--destructive` | ✅ |
| `border-destructive/50` (×1) | `--destructive` + alpha | ✅ |
| bg/borda/sombra dos cards | tokens internos (`--card-root-*`, `--border`) | ✅ |
| **`text-emerald-600`** (×2) | — (paleta Tailwind; Seven não tem `emerald`) | 🔴 **único off-system real** |

### 11.2 — Espaçamento
| Classe | Valor | Token Seven equiv. | Veredito |
|---|---|---|---|
| `space-y-8` | 32px | `--spacing-8` | 🟢 |
| `space-y-4` (×4) | 16px | `--spacing-4` | 🟢 |
| `space-y-2` (×2) | 8px | `--spacing-2` | 🟢 |
| `gap-4` | 16px | `--spacing-4` | 🟢 |
| `gap-2` | 8px | `--spacing-2` | 🟢 |
| `gap-1` | 4px | `--spacing-1` | 🟢 |
| `mr-2` (×4) | 8px | `--spacing-2` | 🟢 |
| `p-4` (×2) | 16px | `--spacing-4` | 🟢 |
| **`space-y-6` (×4) / `gap-6`** | 24px | **sem token** (escala pula 16→32) | 🟡 |
| **`space-y-0.5`** | 2px | sem token (mín. `--spacing-1`=4px) | 🟡 |
| padding/gap internos (card/form/tabs) | — | `--card-*`/`--form-*`/`--tabs-*` | ✅ |

### 11.3 — Bordas & radius
| Classe | Resolve em | Veredito |
|---|---|---|
| `border` (×2) | `--border` (cor) | ✅ |
| `rounded-lg` (×2) | `--radius-lg` (12px) | ✅ |
| `rounded-full` (×2) | `--radius-full` (9999px) | ✅ |

### 11.4 — Tipografia
| Classe | Valor | Veredito | Observação |
|---|---|---|---|
| `text-2xl` | 1.5rem | 🟡 | título deveria vir do `Heading` |
| `font-semibold` | 600 | 🟡 | idem (peso do `Heading`) |
| `font-medium` (×4) | 500 | 🟡 | pseudo-títulos deveriam vir do `Text`/`Heading` |
| `text-sm` (×6) | 0.875rem | 🟡 | corpo deveria vir do `Text`/`Paragraph` |
| `text-xs` (×2) | 0.75rem | 🟡 | helper deveria vir do `FormDescription`/`Text` |
| `text-lg` (×1) | 1.125rem | 🟡 | override do `AvatarFallback` (vem do `size`) |
| `tracking-tight` | -0.025em | 🟢 | valor == `--font-tracking-tight` |

### 11.5 — Sizing (ícones / dimensões)
| Classe | Valor | Veredito |
|---|---|---|
| `h-4 w-4` (×5, em `mr-2 h-4 w-4`) | 16px | 🟡 convenção `h/w` vs `size-4` interno |
| `h-5 w-5` (×2) | 20px | 🟡 inconsistente com `h-4 w-4` |
| `h-10 w-10` (×2) | 40px | 🟡 círculo à mão (→ `Avatar`) |
| `h-20 w-20` (×1) | 80px | 🟡 deveria ser `Avatar size="xl"/"3xl"` |

### 11.6 — Layout (⚪ sem token de design — ok)
`flex` · `grid` · `items-center` · `justify-between` · `justify-center` · `justify-end` · `sm:grid-cols-2` · `animate-spin` (animação — o `Button.loading` já fornece o spinner nativamente)

### 11.7 — Veredito do estilo
| Classificação | Qtde | Itens |
|---|---|---|
| ✅ token-backed | 6 famílias | `muted-foreground`, `bg-muted`, `destructive`(+/50), `border`, `rounded-lg`, `rounded-full` |
| 🟢 value-aligned | 8 | `space-y-8/4/2`, `gap-4/2/1`, `mr-2`, `p-4`, `tracking-tight` |
| 🟡 drift | 13 | `space-y-6`/`gap-6`, `space-y-0.5`, `text-2xl`, `font-semibold`, `font-medium`, `text-sm`, `text-xs`, `text-lg`, `h-4 w-4`, `h-5 w-5`, `h-10 w-10`, `h-20 w-20` |
| 🔴 off-system | **1 classe / 2 ocorrências** | **`text-emerald-600`** |

> **Conclusão de estilo:** a tela é **quase token-limpa** — `muted`/`destructive`/`border`/radius corretos, spacing 8/16/32 alinhado. O **único** estilo genuinamente fora do sistema é `text-emerald-600` (×2) → resolve com `text-success` ou `Badge color="success"` (C1). O resto é drift de tipografia (resolve com `Heading`/`Text`), spacing 24px fora da escala curada, e convenção de sizing de ícone — todos de baixa-média severidade.

---

### Linha do coverage-matrix (índice)
```yaml
settings:
  route: src/client/routes/_authenticated/settings.tsx
  fidelity: 0.72
  components_used: [Tabs, TabsList, TabsTrigger, TabsContent, Card, CardHeader, CardTitle, CardDescription, CardContent, Avatar, AvatarImage, AvatarFallback, Form, FormField, FormItem, FormLabel, FormControl, FormMessage, TextInput, Label, Switch, Divider, Button]
  components_missing: [Heading, Text, Paragraph, Badge, Tag, AlertDialog, FileUpload, Dropzone, FormDescription, AvatarStatus, Section, Stack, SkeletonLoader, Toaster]
  gaps:
    components: [C1, C2, C3, C4, C5, C6, C7, C8]
    emitters:   [E1, E2, E3, E4, E5, E6, E7, E8]
    colors:     [CL1]
    spacing:    [SP1, SP2]
    typography: [TY1, TY2, TY3, TY4, TY5]
    sizing:     [SZ1, SZ2, SZ3]
    states:     [ST1, ST2, ST3]
  severity: { high: 5, medium: 11, low: 7 }
  unused_seven:                      # superfície do DS não aproveitada (seção 9)
    alternative_components: [Heading, Text, Paragraph, Badge, Tag, AlertDialog, Dialog, FileUpload, Dropzone, Section, Stack, Grid, Container, SkeletonLoader, Toaster]
    unused_props:
      Avatar: [size, shape, bordered, interactive, tooltip, contrastBorder]
      AvatarFallback: [colorScheme]
      Button: [loading, loadingText, leftIcon, rightIcon, icon, badge, asChild, tooltip, fullWidth, tone, shape]
      TabsTrigger: [icon, badge]
      Switch: [switchText, descriptionText, showText, showDescription, type, size]
      TextInput: [size, variant, leadingIcon, trailingIcon]
      Label: [required, optional, size]
    unused_variants:
      Tabs: [line]
      Card: [elevated, outlined, ghost, selectable]
      TextInput: [filled, flushed, unstyled]
      Divider: [text, heading, button, dual-line, background-fill, dashed, dotted]
    unused_subcomponents:
      Card: [CardMedia, CardAction, CardFooter]
      Avatar: [AvatarStatus, AvatarBadge, AvatarGroup, AvatarLabelGroup, AvatarSkeleton]
      Form: [FormDescription]
  user_actions:                      # seção 10
    total: 10                        # acionáveis (exclui A7, A12 = n/a)
    wired: 5                         # A1, A2, A3, A5, A6
    unwired: [A4, A8, A9, A10, A11]
    na: [A7, A12]
  style_audit:                       # seção 11 (classe-a-classe)
    token_backed: [muted-foreground, bg-muted, destructive, border, rounded-lg, rounded-full]
    value_aligned: [space-y-8, space-y-4, space-y-2, gap-4, gap-2, gap-1, mr-2, p-4, tracking-tight]
    drift: [space-y-6, gap-6, space-y-0.5, text-2xl, font-semibold, font-medium, text-sm, text-xs, text-lg, h-4 w-4, h-5 w-5, h-10 w-10, h-20 w-20]
    off_system: [text-emerald-600]   # único estilo sem token Seven (×2 ocorrências)
    hardcoded_colors: 2
```
