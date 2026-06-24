# Auditoria Seven DS — Sumário executivo (11 telas)

> **Escopo:** todas as telas de `src/client/routes` · **Referência:** Seven `@etus/ui@0.4.0-beta.4` / `@etus/tokens@0.4.0-beta.3` · **Método:** só-código · **Data:** 2026-06-24
> **Reports por tela:** `docs/ets/state/reports/screens/` · **Índice:** `docs/ets/state/coverage-matrix.yaml`

## Números gerais
- **Fidelidade média: ~70%**
- **Ações do usuário ligadas: 53 de 93 (~57%)** — 40 ações descritas na UI **não disparam nada**
- **Estilos off-system: ~22** — concentrados em **cores de status** e **decoração**
- **3 telas 100% token-limpas** (shell, team, workspaces); **0 cores hardcoded** em 7 das 11

## Ranking de fidelidade
| # | Tela | Fid. | Off-sys | Ações | Destaque |
|---|---|---|---|---|---|
| 1 | shell | 84% | 0 | 6/9 | mais fiel; chrome correto |
| 2 | workspaces | 82% | 0 | 0/5 | token-limpo, mas estático |
| 3 | team | 76% | 0 | 9/13 | token-limpo; menu ⋯ morto |
| 4 | invite | 72% | 4 | 7/8 | emerald hardcoded |
| 5 | settings | 72% | 1 | 5/10 | emerald ×2 |
| 6 | integrations | 71% | 7 | 10/12 | emerald/amber; botões mortos |
| 7 | dashboard | 68% | 1 | 0/8 | UI 100% estática |
| 8 | account | 64% | 5 | 5/12 | amber + 6 botões mortos |
| 9 | login | 62% | 1 | 2/5 | Terms/Privacy mortos |
| 10 | not-found | 62% | 3 | 4/5 | número 404 + blobs |
| 11 | landing | 52% | 5 | 5/6 | HTML marketing cru |

---

## Os 4 padrões sistêmicos (corrigir 1× resolve várias telas)

### 🔴 P1 — Cores de status hardcoded (`emerald`/`amber`)
**Telas:** invite, integrations, account, settings (4).
A família `emerald`/`amber` é cravada (`bg-emerald-100`, `text-amber-600`, `dark:*-900/30`…) em vez de **`--success`/`--warning`** ou **`StatusIndicator`/`Badge color`**. **Viola o DESIGN.md** (só mint/lime são brand). É o maior bloco de off-system.
→ **Fix:** substituir por tokens de status / `StatusIndicator`. Resolve ~16 dos ~22 off-system.

### 🔴 P2 — Ações "mortas" (UI que descreve, mas não faz)
**Telas:** dashboard (0/8), workspaces (0/5), account (5/12, 6 mortos), settings (5/10), login (2/5), team (menu ⋯), integrations (2 mortos).
Botões/links que parecem acionáveis mas **não têm `onClick`/`onSubmit`** ou usam `href="#"`. **40 ações não-ligadas no total.**
→ **Fix:** ligar handlers reais ou remover o controle. Muitos casos são mock/placeholder (também toca Regra 6 — valores/dados hardcoded).

### 🟡 P3 — Decoração arbitrária (proibida pelo DESIGN.md)
**Telas:** landing (`backdrop-blur`, `bg-background/95`), not-found (`text-[12rem]`, blobs `h-[500px] w-[500px]`).
→ **Fix:** remover efeitos decorativos; usar componentes/tokens.

### 🟡 P4 — HTML cru ignorando a camada de componentes
**Tela:** landing (52%, a mais baixa).
Nav, hero, feature cards, footer são marcação de marketing crua que ignora **`Navbar`/`Card`/`FeatureItem`/`FeaturedIcon`/`Heading`/`Text`**.
→ **Fix:** reescrever com componentes Seven (maior esforço, mas é a tela mais distante do DS).

---

## Backlog priorizado
| Prioridade | Ação | Telas | Impacto |
|---|---|---|---|
| 🔴 1 | Trocar cores de status → `--success`/`--warning`/`StatusIndicator` | invite, integrations, account, settings | mata ~16 off-system + conformidade DESIGN.md |
| 🔴 2 | Ligar ou remover ações mortas | 7 telas (40 ações) | UX real; menos UI enganosa |
| 🟡 3 | Remover decoração arbitrária | landing, not-found | conformidade DESIGN.md |
| 🟡 4 | Migrar landing p/ componentes Seven | landing | +30pts de fidelidade na pior tela |
| 🔵 5 | `EmptyState` nos empties à mão | dashboard, account | tira `border-dashed` |
| 🔵 6 | Tipografia `<h1>/<p>` → `Heading`/`Text` | quase todas | drift, baixo risco |

## Notas
- **Espaçamento/radius NÃO são problema:** a escala do Seven espelha a do Tailwind, então `gap-4`/`p-8`/`tracking-tight` são value-aligned (não inflamos como violação).
- **Pendência upstream:** o override da borda da sidebar (`index.css`) aguarda o `borderless` no Seven.
