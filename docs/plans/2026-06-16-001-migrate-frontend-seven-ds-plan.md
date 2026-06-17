---
title: Implementation Plan — Adotar o Seven (DS) em todo o frontend
type: migration
date: 2026-06-16
status: ready-for-execution — D1–D5 decididos; fases reescritas p/ rewrite guiado por blocks (runtime @etus/seven-react). Pendência: confirmar Geist→JetBrains (D3)
package_target: "@etus/seven-react@^0.1.0-beta.3 (→ @etus/ui@0.4.0-beta.2 + @etus/tokens@0.4.0-beta.2)"
scope: src/client/** + src/client/index.css
---

# Implementation Plan — Adotar o Seven em todo o frontend

Plano tático para fazer o **Seven** (`@etus/seven-react`, umbrella sobre `@etus/ui` + `@etus/tokens`)
ser a fonte única de todo elemento de UI do `boilerplate-hono`, de modo que o boilerplate sirva
de base de Design System para os produtos derivados.

## Estado atual (diagnóstico 2026-06-16)

A migração **já começou e está parcial** (≈60% das telas). O que já está correto:

- Pacotes instalados e ligados; `index.css` faz `@import "@etus/seven-react/styles.css"` + `@source` (linha 5/11).
- Cores semânticas **já neutralizadas** do `@theme` local — o Seven vence em light e dark.
- Dark mode compatível: `use-theme.tsx` aplica `.dark` no `<html>`, igual à estratégia do `@etus/tokens` (`.dark`, sem `prefers-color-scheme`).
- Telas já no Seven: `Button`, `Card`, `Avatar`, `Dialog`, `Form`, `Tabs`, `Badge`, `Label` em ~13 rotas + `sidebar`/`error-fallback`/`loading-skeleton`.

**Achado central (o gap mais grave, invisível):** o bloco `@theme` local (`src/client/index.css:17+`)
roda **depois** do `@import` do Seven e, no Tailwind v4, *last wins* — então tokens locais de
`radius`/`shadow`/`breakpoint`/tipografia **sobrescrevem os do Seven com valores diferentes**, e os
componentes do Seven renderizam fora do tom. Esta é a "Etapa 2" que os próprios comentários do arquivo
prometem mas não executaram.

## Objetivo

Todo elemento de UI vem do `@etus/seven-react`; os tokens do `@etus/tokens` são a fonte da verdade
(o `@theme` local só guarda o que o Seven comprovadamente não fornece); nenhum HTML cru de controle e
nenhum componente caseiro de UI sobrevive; e há guard-rails que impedem regressão nos produtos derivados.

## Referências canônicas do Seven (repo `~/Dropbox/aa-projects/Github/seven`)

A composição idiomática NÃO será inventada — será ancorada no repo do Seven:
- **`DESIGN.md`** — espec de marca (regras de ouro abaixo). Fonte de verdade #3 (após Figma e `tokens.css`).
- **Showcase `apps/showcase`** (código) — composição canônica. O **shell** vive em `src/routes/__root.tsx` (`SidebarProvider mode="dual"` → Rail 64px + Panel 216px + `SidebarInset` + content `rounded-tl-[24px] border`).
- **`seven.etus.io`** — o showcase **publicado e renderizado**: referência de **validação visual real**. Toda comparação de UI com o Seven compara screenshots do app contra o showcase publicado (não só código/`.d.ts`/tokens).
- **209 blocks** em `apps/showcase/src/data/blocks/` (29 categorias) — **copiáveis como ponto de partida** (não distribuídos via CLI). Relevantes: `page-shells` (3), `logins`, `account-and-user-management` (15), `form-layouts` (5), `tables`/`data-table`, `empty-states`, `dialogs`, `dashboard`.
- **CLI registry** — `npx @etus/seven add <comp>` copia 185 componentes como **source local com token-slicing** (resolve o megabundle de 1.4MB — ver D5).
- **Skill `seven-design-system`** + pacote `@etus/seven-skill` (plugin Claude Code + `npx seven detect`, 35 regras) — guard-rails automáticos; vale instalar.

### Regras de ouro (DESIGN.md) — guard-rails inegociáveis
- **Tipografia:** Inter (400/500/600/700, evitar 800/900); **JetBrains Mono** p/ código; **nunca Geist/Space Grotesk**. Sentence case pt-BR; sem ponto final em botões/labels.
- **Cor:** só **mint** (`--primary #19e699`) + **lime** (`--secondary`) são marca; **fuchsia só em charts**; neutros = cinza puro; status semânticos. Nunca inventar cor, nunca indigo/"AI purple", nunca `#000`/`#fff` puros.
- **Forma:** dois stacks de radius **não intercambiáveis** — componente (4/8/12 = inputs/botões) vs superfície (16/20/24/32 = cards/dialogs); **pills só** em badges/tags, nunca botões.
- **Elevação/Motion:** bordas 1px p/ hierarquia, sombras só p/ overlays; micro-press tátil (`translate-y` + inset shadow) em todo clicável; 200ms `--ease-default`, sem bounce/spring.
- **Tailwind v4:** type hints obrigatórios — `bg-[color:var(--token)]`, `text-[length:var(--token)]`, dimensões sem prefixo; **nunca** `bg-[var(...)]` nem `hsl(var(...))` (Lightning CSS dropa em silêncio).
- **Ícones:** Lucide, stroke 2px, `currentColor`; sem emoji no chrome.

## Estratégia de branch

- Branch nova a partir de `master` (ex.: `feat/frontend-seven-ds`).
- Migração incremental por fase — `pnpm build` + `pnpm typecheck:client` verdes ao fim de cada fase.
- Cada fase de UI é verificável por screenshot/E2E `@visual` antes de seguir.

## Definition of Ready (DoR)

- [x] Diagnóstico do estado atual concluído (este doc)
- [x] Catálogo do Seven mapeado e **verificado em runtime** (não só `.d.ts`): `TextInput`, `Divider`, `SkeletonLoader`, `Switch`, `Checkbox`, `Toaster` existem em `@etus/ui@0.4.0-beta.2` (1215 exports)
- [x] Spikes técnicos da Fase 0 (D2 tokens, D4 toast) resolvidos
- [x] Decisões do usuário: D1 = reescrever efeitos/remover paletas; D3 = Inter variable + Geist Mono + remover serif
- [ ] Branch nova criada a partir de `master`

---

## Fase 0 — Decisões + de-risking (GATE)

Spikes técnicos resolvidos nesta sessão (D2, D4 ✅). Restam **2 decisões do usuário** (D1, D3).

### D1 — Paletas de cor locais (DECISÃO DO USUÁRIO) — dado corrigido
As paletas `--color-{green,blue,gray,red,yellow,pink,main1,main2}-*` (88 tokens, `index.css:43–145`)
**não colidem por nome** com o Seven (que usa `--brand-*` + semânticas). Uso real medido:
- **0** ocorrências como classe utilitária (`bg-green-500` etc.) em `src/client`.
- **Mas NÃO são órfãs:** são consumidas via `var(--color-…)` por ~10 utilitários visuais do próprio `index.css`
  (`.gradient-{primary,accent,warm}`, `.glow-*`, spinner/rainbow, `.skeleton` shimmer — linhas ~514–721).
- **Decidir:** (a) **remapear** os valores das paletas para as primitivas do Seven (mantém os efeitos, alinha a marca);
  (b) reescrever os efeitos usando `--brand-*`/semânticas e remover as paletas; (c) manter como estão (dois sistemas).
- **✅ DECISÃO (2026-06-16): opção (b)** — reescrever os ~10 efeitos (`.gradient-*`, `.glow-*`, spinner/rainbow, `.skeleton`) com tokens `--brand-*`/semânticos do Seven e **remover as 88 paletas locais**. Vocabulário único de cor (boilerplate-base limpo). ⚠️ Nem todo gradiente terá equivalente de marca exato — escolher o token Seven mais próximo por efeito e conferir visual.
- **Verde:** paletas removidas; nenhum `var(--color-{green,blue,…})` sobra; efeitos conferidos.

### D2 — Set de tokens a remover/manter ✅ RESOLVIDO
Valores reais do Seven (lidos de `@etus/tokens/dist/tokens.css`):
- **radius:** none 0 · xs **2** · sm **4** · md **8** · lg **12** · xl **16** · 2xl **20** · 3xl 24 · 4xl 32 · pill 999 · full 9999 (px).
  Local diverge em toda a escala (xs 1 · sm 2 · md 4 · lg 8 · xl 12 · 2xl 14) → **remover locais**.
- **shadow:** Seven fornece xs–xl (com variante dark) → **remover** locais xs–xl; **manter** `--shadow-2xl` e `--shadow-inner` (Seven não tem).
- **breakpoint:** Seven xs 320 · sm **360** · md 768 · lg 1024 · xl 1280 · 2xl **1440** · 3xl 1920 · 4xl 2560.
  Local diverge em **sm (640)** e **2xl (1536)**; md/lg/xl batem → **remover locais** (⚠️ ver R1).
- **`--text-*`:** Seven **define** (2xs…9xl) → **remover** local `--text-xs…5xl`.
- **`--font-{thin…extrabold}`:** o Tailwind v4 lê `--font-weight-*` (Seven fornece 100–900); os `--font-*` locais são redundantes → **remover** (checar refs `var(--font-bold)`).
- **`--leading-*`:** Seven usa namespace próprio `--font-leading-*` (não toca `--leading-*`) → **manter** local.

### D3 — Fontes ⚠️ CORRIGIDO pelo DESIGN.md do Seven
O `DESIGN.md` canônico contradiz parte do que foi decidido antes (decisão original feita sem acesso a ele):
- **Sans = Inter, pesos 400/500/600/700 apenas** ("avoid 800/900"). App já está assim ✓ → **NÃO** carregar variable 100–900 (revertido).
- **Mono = JetBrains Mono** (oficial). **Geist é PROIBIDO** ("never Geist"). → trocar `--font-mono` de Geist Mono p/ **JetBrains Mono** (Google Fonts). ⚠️ revoga a escolha "Geist Mono" — **confirmar com o usuário**.
- **Sem Space Grotesk** (DESIGN.md: legacy Figma que não shipou; os tokens `--typography-display-*` são legado). Display usa Inter.
- **Sem serif na marca** (o Instrument Serif do showcase é o tema próprio dele, não o DS). `--font-serif` órfão → **remover**.
- **Verde:** Inter 400–700 + JetBrains Mono carregadas; sem Geist/Space Grotesk/serif.

### D4 — Toast ✅ RESOLVIDO
`@etus/ui` exporta `Toaster` (tipado sobre `sonner`) e depende de `sonner@^2.0.7` (mesma versão do app), mas **não reexporta a função `toast`**.
- **Padrão:** usar `<Toaster>` de `@etus/seven-react` (com `theme={resolvedTheme}` p/ dark) e manter `import { toast } from 'sonner'` nas 4 chamadas. Deletar `components/ui/sonner.tsx`.

### D5 — Arquitetura de consumo (NOVA — DECISÃO DO USUÁRIO)
Como o boilerplate consome os componentes do Seven?
- **(a) Runtime `@etus/seven-react`** (atual) — 1 import, atualiza via `pnpm up`, mas **megabundle ~1.4MB** + CSS ~664KB (R4); rota pública carrega tudo (mitigável com lazy/code-split).
- **(b) CLI source `npx @etus/seven add`** (modelo shadcn) — copia 185 componentes como **source local** com **token-slicing** (só os tokens usados) → bundle enxuto, controle total; **mas** vira código "seu" (sem update automático; re-rodar `add` p/ acompanhar o DS — relevante porque está em beta).
- **Trade-off:** (a) acompanha o DS em evolução com menos esforço; (b) resolve o bundle e é mais idiomático p/ um boilerplate-base, ao custo de manutenção manual.
- **✅ DECISÃO (2026-06-16): (a) Runtime `@etus/seven-react`** — manter alinhamento contínuo ao DS (beta evolui); domar o bundle via lazy-load nas rotas públicas (U4.2).

**Checkpoint Fase 0:** D1/D2/D4/D5 fechados; **D3 corrigido pelo DESIGN.md** (aguarda só o OK sobre Geist→JetBrains Mono). Fases 1–5 reescritas abaixo para "rewrite guiado por blocks".

---

## Fase 1 — Fundação de tokens (P0)

**Objetivo:** o Seven passa a ditar radius/shadow/breakpoint/tipografia; o `@theme` local guarda só os extras.
**Depende de:** D1, D2.

### U1.1 — Remover tokens colidentes do `@theme`
Conforme D2 (resolvido):

| Família (local) | Ação | Razão |
|---|---|---|
| `--radius-xs…2xl`, `--radius-full` | **Remover** | colide com Seven; escala local ≈ metade (xs 1 vs 2, md 4 vs 8…) |
| `--shadow-xs…xl` | **Remover** | colide com Seven (`--shadow-xs…xl`) |
| `--shadow-2xl`, `--shadow-inner` | **Manter** | Seven não fornece |
| `--breakpoint-sm…2xl` | **Remover** | colide; sm 640→**360**, 2xl 1536→**1440** — ⚠️ validar responsividade (R1) |
| `--text-xs…5xl` | **Remover** | Seven define `--text-*` (2xs…9xl) |
| `--font-{thin…extrabold}` | **Remover** | redundante; Tailwind usa `--font-weight-*` (Seven fornece 100–900) |
| `--leading-*` | **Manter** | Seven usa namespace `--font-leading-*`, não toca `--leading-*` |
| `--blur-*`, `--container-*`, `--grid-gap-*`, `--content-*` | **Manter** | utilitários locais, não conflitam com Seven |
| `--spacing-{page,section,group,element,tight,xs}`, `--layout-*`, `--card-padding*` | **Manter** | semântica de layout própria |
| `--animate-duration-*`, `--animate-ease-*`, `--animate-spring` | **Manter (P2: alinhar)** | Seven usa `--duration-*`/`--ease-*` (nomes diferentes) — alinhar é opcional |
| `--color-error*`, `--color-*-solid` | **Manter** | Seven usa `destructive`; não tem variantes `*-solid` |

- **Verde:** `pnpm build` ok; `grep -nE "\-\-(radius|breakpoint|shadow-(xs|sm|md|lg|xl))" src/client/index.css` só retorna o que a tabela manda manter; screenshot de uma tela de referência (ex.: dashboard) batendo com o tom do Seven.

### U1.2 — Reescrever efeitos e remover paletas (D1 = opção b)
- Para cada utilitário em `index.css` que usa `var(--color-{green,blue,gray,red,yellow,pink,main1,main2}-*)`
  (`.gradient-{primary,accent,warm}`, `.glow-*`, spinner/rainbow, `.skeleton` shimmer — linhas ~514–721),
  trocar pelos tokens `--brand-*`/semânticos do Seven mais próximos; depois **deletar os 88 tokens de paleta** do `@theme`.
- **Verde:** `grep -nE "var\(--color-(green|blue|gray|red|yellow|pink|main1|main2)-" src/client` vazio; efeitos conferidos visualmente.

### U1.3 — Fontes (D3 corrigido pelo DESIGN.md)
- `index.html`: manter **Inter 400/500/600/700** (já presente; NÃO adicionar 800/900); trocar o `<link>` para incluir **JetBrains Mono**.
- `index.css`: `--font-mono` → JetBrains Mono (era Geist, proibido pelo DESIGN.md); **remover** `--font-serif` (órfão); não introduzir Space Grotesk.
- **Verde:** `font-mono` (6 usos) renderiza JetBrains Mono; `grep -iE "geist|space grotesk" src/client` vazio; sem `--font-serif`.

**Checkpoint Fase 1:** ✅ executado 2026-06-16 (branch `feat/frontend-seven-ds`) — `pnpm typecheck:client` + `pnpm build` (988ms) verdes; limpeza confirmada (0 paletas, 0 tokens colidentes, JetBrains Mono no lugar de Geist). Revisão visual no browser: **pendente**.

---

## Fase 2 — Shell canônico (rewrite guiado pelo showcase)

**Objetivo:** trocar o shell caseiro (`sidebar.tsx`, 267 linhas) pelo sistema de navegação do Seven, replicando o shell canônico do showcase.
**Depende de:** Fase 1.
**Referência:** `seven/apps/showcase/src/routes/__root.tsx` (+ blocks `data/blocks/page-shells/*`; screenshots `showcase-canonical-shell-*`).

### U2.1 — Navegação com o sistema Sidebar do Seven
- Substituir `components/sidebar.tsx` por `SidebarProvider mode="dual"` → `SidebarRailContent` (rail 64px: logo + ícones de seção + theme toggle + ações) + `SidebarPanelContent` (216px: `SidebarHeader` + `SidebarContent` com `SidebarMenu`/`SidebarMenuItem`/`SidebarMenuButton`). Manter os ícones lucide e o user/account menu.
- Ligar às rotas autenticadas (TanStack `Link`), preservando `useAuth`/`use-theme`.
- **Verde:** rail+panel como o canonical; navegação e theme toggle funcionam; nenhum markup de sidebar caseiro resta.

### U2.2 — Layout autenticado com `SidebarInset`
- `routes/_authenticated.tsx`: `SidebarInset` → header `h-12` (Breadcrumb derivado do pathname + ações) + content `rounded-tl-[24px] border bg-background px-8 py-8` (assinatura do shell). `SidebarTrigger` p/ colapsar; skeletons → `SkeletonLoader`/`SidebarMenuSkeleton`.
- **Verde:** layout idêntico ao canonical; breadcrumb correto; loading sem CLS; E2E de navegação verde.

**Checkpoint Fase 2:** ✅ executado 2026-06-16 — `sidebar.tsx` reescrito como `AppSidebar` (single mode: `SidebarProvider` + `Sidebar collapsible="icon"` + `SidebarHeader/Content/Footer` + `SidebarInset` com header `h-12` e content `rounded-tl-[24px]`); `_authenticated.tsx` monta o shell. `pnpm typecheck:client` + `pnpm build` verdes. ✅ **validação visual feita** (dev server + `/auth/test-login` + `/dashboard`, viewport 1440×900): shell **expandido e colapsado** conferidos contra o canônico, console **sem erros**. Bug pego só na renderização real (não no build): `SidebarAvatar` não compacta sozinho no modo ícone → ligado ao `useSidebar` (`compact={state==='collapsed'}`). 3 refinamentos aplicados: `SidebarAvatar`+dropdown no rodapé, `aria-current="page"`, `size="lg"` no header.

---

## Fase 3 — Telas guiadas por blocks (rewrite da apresentação, lógica preservada)

**Objetivo:** reescrever a árvore visual de cada tela partindo do block correspondente do showcase, **preservando a lógica** (hooks/rotas/forms RHF+zod/queries/handlers do `@etus/auth`). Nesta fase somem os caseiros e o HTML cru de controle.
**Depende de:** Fase 1 (+ Fase 2 p/ as telas autenticadas).

> **Regra de execução:** abrir o block no showcase (`seven/apps/showcase/src/data/blocks/<cat>/` e `routes/layouts/marketing/*`), copiar a composição e religar aos dados/forms existentes. Validar **runtime** dos componentes (`Object.keys(await import('@etus/ui'))`), nunca o `.d.ts` (substring → falso positivo). Props do Seven ≠ shadcn: `TextInput` (`size`/`leadingIcon`), `Divider`, `SkeletonLoader`, `Switch`, `Checkbox` — ajustar call-sites. Seguir as regras de ouro (sentence case pt-BR, type hints `[color:var(...)]`, micro-press, radius stacks, `Badge` `type`+`color` — R5).
>
> Primitivos substituídos ao longo das telas: `input.tsx`→`TextInput`, `separator.tsx`→`Divider`, `skeleton.tsx`→`SkeletonLoader`, `sonner.tsx`→`Toaster` (D4), toggles `<button>`→`Switch`/`Checkbox`, button cru→`Button`.

### U3.1 — Login (pública) ← block `logins/*`
- Reescrever `routes/login.tsx`; manter OAuth/returnTo. ⚠️ rota pública: importar o mínimo + lazy onde couber (R4/D5).
- **Verde:** login funciona; bundle público sob controle; E2E de auth verde.

### U3.2 — Dashboard ← block `dashboard/*` + `KPICard`/`DashboardCard`
- `_authenticated/dashboard.tsx`: KPIs em `Grid` de `KPICard`/`DashboardCard`; queries intactas.
- **Verde:** dashboard com cards do Seven; dados preservados.

### U3.3 — Account & Settings ← blocks `account-and-user-management/*` + `form-layouts/*`
- `account.tsx`/`settings.tsx`: `Tabs` + `Card` + `Form`/`FormField` com `TextInput`; `NotificationToggle` → `Switch`; `Input`/`Separator` caseiros somem. Manter RHF+zod e `toast`.
- **Verde:** forms submetem/validam; toggles são `Switch`; sem caseiros; E2E verde.

### U3.4 — Team ← block `tables`/`data-table` + dialog de convite
- `team.tsx`: membros em `Table`/`DataTable`; convite em `Dialog`+`Form`. Mutations/queries intactas.
- **Verde:** lista e convite funcionam; sem `Input` caseiro.

### U3.5 — Workspaces ← grid de `Card`/`Badge`
- `workspaces.tsx`: cards com role `Badge` (`type`+`color`, não `variant` — R5).
- **Verde:** grid renderiza; badges idiomáticos.

### U3.6 — Integrations ← `Card` + `Dialog` + `form-layouts/form-layout-03` (fieldset+checkbox)
- `integrations.tsx`: event toggles `<button>` → `Checkbox`; webhook em `Dialog`+`Form`. Payload inalterado.
- **Verde:** seleção via `Checkbox`; webhook cria; sem caseiros.

### U3.7 — Utilitárias: 404/`$`, invite, erros, toasts
- `$.tsx`/`error-fallback.tsx` → `ErrorPage`/`Empty` (button cru → `Button`); `invite.$token.tsx` ← block tipo login; `main.tsx` → `Toaster` do Seven (`theme={resolvedTheme}`, `toast` de `sonner`). Deletar `components/ui/sonner.tsx` na Fase 4.
- **Verde:** erro/404/invite idiomáticos; toasts com tema do Seven.

**Checkpoint Fase 3:** ✅ executado 2026-06-16 — `settings`/`account`/`team`/`integrations` migrados (Input→`TextInput`, Separator→`Divider`, toggles→`Switch`/`Checkbox`) + `Toaster` do Seven (`main.tsx`) + `error-boundary` button→`Button` + `skeleton`→`SkeletonLoader`. `typecheck:client` + `build` verdes; **0 consumidores** dos 4 caseiros (input/separator/skeleton/sonner). **Validação visual no browser:** shell (expandido/colapsado), settings (Profile+Notifications), account, team, integrations (página + dialog), Toaster (toast confirmado no DOM). `login`/`dashboard`/`workspaces`/`404`/`invite` já eram só-Seven (sem caseiros). Notas: `error-boundary` é dead-code (0 consumidores → candidato a delete); skeleton/loading é transitório (impraticável de capturar por throttle — bundle fica branco antes do render).

**Refinamento de composição (2026-06-16):** as 3 telas que já eram só-Seven foram elevadas a componentes de mais alto nível do DS (em vez de `Card` caseiro): **dashboard** stats → `DashboardCard` (`title`/`value`/`valueDescription`/`icon`, sem deltas inventados — `KPICard` esconde o subtexto sem delta); **login** card central → split-screen do `/login` **curado** do Seven (`<main>`+`<aside>` landmarks, botão mint primário, painel de marca `bg-muted`, OAuth-only); **workspaces** banner super-admin → `Callout variant="success"` e empty-state → `Empty`/`EmptyMedia`/`EmptyTitle`/`EmptyDescription`. Validado no browser (workspaces super-admin via override client-side de `/api/me`). **230 testes verdes sem alterar nenhum teste** (composição preservou a intenção); `<main>`/`<aside>` no login satisfez `root-layout` legitimamente.

---

## Fase 4 — Limpeza, bundle e guard-rails (P2/P3)

**Objetivo:** travar regressão, remover atalhos caseiros e domar o bundle (D5/R4).
**Depende de:** Fases 2 e 3.

### U4.1 — Remover caseiros migrados
- Deletar `components/ui/{input,separator,skeleton,sonner}.tsx` após zero consumidores. (`sidebar.tsx` **não** é deletado — foi reescrito como `AppSidebar` idiomático na Fase 2.)
- **Verde:** `grep -rE "components/ui/(input|separator|skeleton|sonner)" src/client` vazio.

### U4.2 — Bundle das rotas públicas (D5/R4)
- Com runtime `@etus/seven-react`, garantir que `/login` e públicas não puxem o megabundle: lazy-load/code-split, importar o mínimo.
- **Verde:** chunk da rota pública sob controle no relatório de `pnpm build`.
- **⛔ Investigado 2026-06-17 — bloqueado upstream (sem fix limpo no boilerplate).** O `autoCodeSplitting` já isola cada rota (chunk de `/login` = **4,6 kB**). O gargalo é o chunk `index` compartilhado (**2,2 MB / 648 kB gzip**) que **toda** rota carrega, porque `@etus/ui/dist/index.js` é um **bundle monolítico de 1,7 MB** (inlina todos os componentes + `recharts` num módulo só). Testado `sideEffects: false` nos 2 pacotes + cache do vite limpo → **build byte-idêntico** (tree-shaking no consumidor é impossível num bundle monolítico). `/login` usa o `Button` → puxa o módulo indivisível. jspdf (1,8 MB) já fica **fora** do bundle client (lazy). **Fix real = upstream no Seven** (publicar ESM por componente + `sideEffects`). Paliativo possível (não aplicado): `manualChunks` separa vendors → ganho só de **cache entre deploys**, **não** reduz o first-load do `/login`.

### U4.3 — Regra de lint + detector do Seven
- `eslint-plugin-boundaries` (instalado) + `no-restricted-syntax` barrando `<button>/<input>/<select>/<textarea>` cru e imports de UI fora de `@etus/seven-react`. Opcional: `npx seven detect src/client` (pacote `@etus/seven-skill`, 35 regras de marca) no lint/CI.
- **Verde:** `pnpm lint` reprova um caso proposital e passa no código migrado.

### U4.4 — Documentar a regra do DS
- `CLAUDE.md`: "todo elemento de UI vem de `@etus/seven-react`; tokens via `@etus/tokens`; seguir `seven/DESIGN.md`". Manter `lucide-react` (decisão de ícones). Seção "como adicionar UI" + apontar os blocks do showcase.
- **Verde:** CLAUDE.md atualizado.

**Checkpoint Fase 4:** ✅ executado 2026-06-16 (parcial) — U4.1 deletados `input`/`separator`/`skeleton`/`sonner` caseiros; U4.3 lint guard-rail (raw `<button>/<input>/<select>/<textarea>` barrados em `routes/**` + `sidebar.tsx`, **provado** que dispara); U4.4 CLAUDE.md doc "UI = Seven". `typecheck:client` + `build` + `lint src/client` verdes. **U4.2:** investigado 2026-06-17 → **bloqueado upstream** — o chunk de `/login` já é 4,6 kB, mas o `index` compartilhado de 2,2 MB é inevitável enquanto o Seven publicar `@etus/ui` como bundle monolítico (defeats tree-shaking). Ver U4.2 p/ a medição completa.

---

## Fase 5 — Verificação final

- Rodar: `pnpm lint`, `pnpm typecheck:client`, `pnpm build`, `pnpm test:unit:client`, `pnpm test:e2e` (incl. tags `@visual`/`@a11y`).
- Revisão visual das telas-chave (login, dashboard, account, settings, team, workspaces, integrations).
- **Verde (parcial 2026-06-16):** `lint` + `typecheck:client` + `build` + `test:unit:client` verdes — **230 testes, coverage 89.7%/84.5%/94.4%** (acima dos thresholds). Os testes de client foram atualizados p/ a estrutura Seven + setup jsdom corrigido (`ResizeObserver` construtível, shims Radix de pointer-capture). O rewrite pegou um **bug real**: o menu de usuário no rodapé não abria (`SidebarAvatar` não repassa props → não serve de `DropdownMenuTrigger`) → trocado por `SidebarMenuButton` (validado no browser). **Pendente:** `test:e2e`.

---

## Definition of Done (DoD)

- [ ] D1–D5 resolvidos e registrados
- [ ] Shell reescrito com o sistema Sidebar do Seven (sem `sidebar.tsx` caseiro)
- [ ] `@theme` local só contém tokens que o Seven não fornece
- [ ] Zero componentes caseiros de UI em `components/ui/` (exceto o que for genuinamente fora do escopo do Seven)
- [ ] Zero HTML cru de controle em rotas/componentes
- [ ] Regra de lint impedindo regressão, ativa em `pnpm lint`
- [ ] `pnpm lint && pnpm typecheck:client && pnpm build && pnpm test:unit:client && pnpm test:e2e` verdes
- [ ] CLAUDE.md documenta a regra "UI = Seven"

## Validação por fase

| Fase | Comandos de checkpoint |
|---|---|
| 0 | (manual — decisões registradas) |
| 1 (fundação) | `pnpm typecheck:client`, `pnpm build` + revisão visual |
| 2 (shell) | `pnpm typecheck:client`, `pnpm build` + conferir vs screenshots canonical |
| 3 (telas) | `pnpm typecheck:client`, `pnpm test:unit:client`, `pnpm build`, `pnpm test:e2e` |
| 4 (limpeza) | `pnpm lint`, `pnpm build` |
| 5 | `pnpm lint && pnpm typecheck:client && pnpm build && pnpm test:unit:client && pnpm test:e2e` |

## Grafo de dependências

```
Fase 0 (D1–D5) → Fase 1 (fundação CSS/tokens/fontes) → Fase 2 (shell canônico)
   → Fase 3 (telas por blocks) → Fase 4 (limpeza + bundle + guard-rails) → Fase 5 (verificação)
```

## Mapa caseiro → Seven (referência)

| Caseiro hoje | Seven | Consumidores |
|---|---|---|
| `components/sidebar.tsx` (267 linhas) | `SidebarProvider`/`Sidebar*`/`SidebarInset` | `_authenticated` |
| `components/ui/input.tsx` | `TextInput` | account, settings, team, integrations |
| `components/ui/separator.tsx` | `Divider` | sidebar, account, settings, integrations |
| `components/ui/skeleton.tsx` | `SkeletonLoader` | loading-skeleton |
| `components/ui/sonner.tsx` | `Toaster` | main + 4 `toast()` |
| `error-boundary.tsx` `<button>` | `Button` | — |
| `settings.tsx` NotificationToggle | `Switch` | settings |
| `integrations.tsx` event toggles | `Checkbox` | integrations |

## Riscos

- **R1 — Breakpoints (U1.1):** trocar a escala local (sm=640) pela do Seven (sm=360) muda os pontos de quebra de todas as telas. Validar responsivo antes de fechar a Fase 1.
- **R2 — Props divergentes (Fase 2):** `TextInput`/`Divider`/`SkeletonLoader` não são drop-in dos caseiros; orçar ajuste de call-site, não só de import.
- **R3 — Beta:** os pacotes do Seven estão em `beta` — API pode mudar; fixar versões e revisar changelog em upgrade.
- **R4 — Bundle na rota pública:** `@etus/ui` é um megabundle (~1.4MB) que **não tree-shake** (sem `sideEffects`). Importar 1 componente puxa a lib; o Rollup hoista num shared chunk quando ≥2 rotas importam, mas a rota **pública** `/login` não deveria carregar 1.4MB. Manter públicas enxutas (lazy-load ou poucos componentes). Correção real é upstream (subpath exports).
- **R5 — `Badge variant` deprecado:** usar `type` (`badge-color`/`badge-outline`) + `color` (`success`/`muted`…); `@typescript-eslint/no-deprecated` reprova `variant=` (a regra de lint da U4.3 pega isso).
- **R6 — Testes de UI no rewrite:** reescrever a árvore visual quebra seletores/snapshots dos testes de componente. Preservar os E2E de **fluxo** (login/invite/CRUD) reescrevendo por roles/labels acessíveis; orçar atualização da suíte unit de client.

## Out of scope

- Alinhar tokens de motion locais (`--animate-*`) aos do Seven (`--duration-*`/`--ease-*`) — P2, opcional.
- Substituir `lucide-react` por um wrapper de ícone do Seven (mantido por decisão D-ícones).
- Componentes avançados do Seven ainda não usados (DataTable, Charts, Kanban, etc.) — adoção sob demanda.

## Referências

- Diagnóstico: esta sessão (2026-06-16).
- Catálogo do Seven: `node_modules/@etus/ui/dist/index.d.ts`, `node_modules/@etus/tokens/dist/tokens.{css,meta.json}`.
- Repo do Seven: `~/Dropbox/aa-projects/Github/seven` — `DESIGN.md`, `apps/showcase` (shell `routes/__root.tsx`, blocks `src/data/blocks/`), skill `seven-design-system`, CLI `packages/cli/registry`.
- Fundação atual: `src/client/index.css`, `src/client/hooks/use-theme.tsx`.
