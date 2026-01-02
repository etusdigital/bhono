# Tailwind CSS v4 Features Implementation Plan

> **For Claude:** Use superpowers:subagent-driven-development para implementar este plano.

**Goal:** Modernizar o design system usando features avançadas do Tailwind CSS v4, melhorando DX, performance e manutenibilidade.

**Architecture:** Migração progressiva das custom utility classes para @utility directive, simplificação do dark mode com @variant, e adoção de novas features CSS como container queries e @starting-style.

**Tech Stack:** Tailwind CSS 4.0, CSS Container Queries, OKLCH Color Space, Modern CSS

---

## Arquivos Críticos

| Arquivo | Propósito |
|---------|-----------|
| `src/client/index.css` | Design tokens e utilities (main file) |
| `src/client/components/ui/dialog.tsx` | Candidato para @starting-style |
| `src/client/components/ui/input.tsx` | Candidato para field-sizing |
| `src/client/components/ui/card.tsx` | Candidato para container queries |
| `src/client/components/ui/button.tsx` | Candidato para not-* variant |

---

## Task 1: Converter Custom Utilities para @utility Directive

**Files:**
- Modify: `src/client/index.css:443-512`

**Context:** Classes como `.glass`, `.skeleton`, `.gradient-*`, `.transition-*`, `.animate-*` não suportam variants. Com @utility, ganham suporte automático a `hover:`, `dark:`, `md:`, etc.

**Step 1: Converter .glass para @utility**

Substituir (linhas 607-616):
```css
/* ANTES */
.glass {
  background: oklch(100% 0 0 / 0.7);
  backdrop-filter: blur(var(--blur-lg));
  border: 1px solid oklch(100% 0 0 / 0.2);
}

.dark .glass {
  background: oklch(12.94% 0.0219 264.7 / 0.7);
  border: 1px solid oklch(100% 0 0 / 0.1);
}
```

Por:
```css
/* DEPOIS */
@utility glass {
  background: oklch(100% 0 0 / 0.7);
  backdrop-filter: blur(var(--blur-lg));
  border: 1px solid oklch(100% 0 0 / 0.2);

  @variant dark {
    background: oklch(12.94% 0.0219 264.7 / 0.7);
    border: 1px solid oklch(100% 0 0 / 0.1);
  }
}
```

**Step 2: Converter .skeleton para @utility**

Substituir (linhas 581-601):
```css
/* ANTES */
.skeleton {
  background: linear-gradient(90deg, var(--color-muted) 25%, var(--color-gray-200) 50%, var(--color-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}

.dark .skeleton {
  background: linear-gradient(90deg, var(--color-muted) 25%, var(--color-gray-700) 50%, var(--color-muted) 75%);
  background-size: 200% 100%;
}
```

Por:
```css
/* DEPOIS */
@utility skeleton {
  background: linear-gradient(90deg, var(--color-muted) 25%, var(--color-gray-200) 50%, var(--color-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);

  @variant dark {
    background: linear-gradient(90deg, var(--color-muted) 25%, var(--color-gray-700) 50%, var(--color-muted) 75%);
    background-size: 200% 100%;
  }
}
```

**Step 3: Converter gradient utilities para @utility**

Substituir (linhas 622-658):
```css
/* ANTES */
.gradient-primary {
  background: linear-gradient(135deg, var(--color-green-400) 0%, var(--color-green-500) 50%, var(--color-green-600) 100%);
}

.gradient-accent {
  background: linear-gradient(135deg, var(--color-blue-400) 0%, var(--color-main2-500) 50%, var(--color-pink-500) 100%);
}

.gradient-warm {
  background: linear-gradient(135deg, var(--color-yellow-400) 0%, var(--color-red-400) 100%);
}

.text-gradient-primary {
  background: linear-gradient(135deg, var(--color-green-400) 0%, var(--color-green-600) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

Por:
```css
/* DEPOIS */
@utility gradient-primary {
  background: linear-gradient(135deg in oklch, var(--color-green-400) 0%, var(--color-green-500) 50%, var(--color-green-600) 100%);
}

@utility gradient-accent {
  background: linear-gradient(135deg in oklch, var(--color-blue-400) 0%, var(--color-main2-500) 50%, var(--color-pink-500) 100%);
}

@utility gradient-warm {
  background: linear-gradient(135deg in oklch, var(--color-yellow-400) 0%, var(--color-red-400) 100%);
}

@utility text-gradient-primary {
  background: linear-gradient(135deg in oklch, var(--color-green-400) 0%, var(--color-green-600) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

**Step 4: Converter transition utilities para @utility**

Substituir (linhas 494-512):
```css
/* ANTES */
.transition-fast { ... }
.transition-normal { ... }
.transition-slow { ... }
.transition-spring { ... }
```

Por:
```css
/* DEPOIS */
@utility transition-fast {
  transition-duration: var(--animate-duration-fast);
  transition-timing-function: var(--animate-ease-out);
}

@utility transition-normal {
  transition-duration: var(--animate-duration-normal);
  transition-timing-function: var(--animate-ease-out);
}

@utility transition-slow {
  transition-duration: var(--animate-duration-slow);
  transition-timing-function: var(--animate-ease-out);
}

@utility transition-spring {
  transition-duration: var(--animate-duration-normal);
  transition-timing-function: var(--animate-spring);
}
```

**Step 5: Converter animation utilities para @utility**

Substituir (linhas 443-488):
```css
/* ANTES */
.animate-fade-in { ... }
.animate-fade-out { ... }
.animate-scale-in { ... }
.animate-scale-out { ... }
.animate-bounce-in { ... }
.animate-pulse-soft { ... }
.animate-shimmer { ... }
.animate-spin { ... }
.animate-accordion-down { ... }
.animate-accordion-up { ... }
```

Por:
```css
/* DEPOIS */
@utility animate-fade-in {
  animation: fade-in var(--animate-duration-normal) var(--animate-ease-out);
}

@utility animate-fade-out {
  animation: fade-out var(--animate-duration-normal) var(--animate-ease-out);
}

@utility animate-scale-in {
  animation: scale-in var(--animate-duration-normal) var(--animate-ease-out);
}

@utility animate-scale-out {
  animation: scale-out var(--animate-duration-normal) var(--animate-ease-out);
}

@utility animate-bounce-in {
  animation: bounce-in var(--animate-duration-slow) var(--animate-spring);
}

@utility animate-pulse-soft {
  animation: pulse-soft 2s ease-in-out infinite;
}

@utility animate-shimmer {
  background: linear-gradient(90deg, var(--color-muted) 25%, var(--color-accent) 50%, var(--color-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@utility animate-spin {
  animation: spin 1s linear infinite;
}

@utility animate-accordion-down {
  animation: accordion-down var(--animate-duration-normal) var(--animate-ease-out);
}

@utility animate-accordion-up {
  animation: accordion-up var(--animate-duration-normal) var(--animate-ease-out);
}
```

**Step 6: Verificar build**

Run: `npm run build`
Expected: Build success sem erros

**Step 7: Commit**

```bash
git add src/client/index.css
git commit -m "refactor(css): convert custom utilities to @utility directive

- .glass now supports hover:glass, dark:glass, md:glass etc
- .skeleton converted with @variant dark
- gradient utilities with oklch interpolation
- transition utilities as proper @utility
- animation utilities as proper @utility

Benefits: variant support, treeshaking, better DX"
```

---

## Task 2: Adicionar color-scheme para Scrollbars Nativas

**Files:**
- Modify: `src/client/index.css` (after @theme block)

**Context:** Scrollbars nativas ignoram dark mode. Com `color-scheme`, o browser ajusta automaticamente.

**Step 1: Adicionar color-scheme no :root**

Adicionar após o bloco `@theme` (após linha 283):
```css
/* ========================================
   Color Scheme for Native Elements
   ======================================== */

:root {
  color-scheme: light;
}

.dark {
  color-scheme: dark;
}
```

**Step 2: Simplificar scrollbar CSS**

Opcional: Agora podemos remover algumas regras de scrollbar que o browser cuida automaticamente.

**Step 3: Verificar visualmente**

Run: `npm run dev`
Expected: Scrollbars seguem o tema automaticamente

**Step 4: Commit**

```bash
git add src/client/index.css
git commit -m "feat(css): add color-scheme for native dark mode

Scrollbars, form controls, and selection now follow theme automatically"
```

---

## Task 3: Adicionar @starting-style para Enter Animations

**Files:**
- Modify: `src/client/index.css` (new section)

**Context:** Dialogs e tooltips aparecem abruptamente. Com @starting-style, CSS nativo cuida da animação de entrada.

**Step 1: Adicionar section para @starting-style**

Adicionar ao final do arquivo:
```css
/* ========================================
   Enter Animations (@starting-style)
   ======================================== */

/* Dialog/Modal Enter Animation */
@utility dialog-enter {
  opacity: 1;
  transform: scale(1) translateY(0);
  transition: opacity 200ms ease-out, transform 200ms ease-out;

  @starting-style {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
}

/* Popover Enter Animation */
@utility popover-enter {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 150ms ease-out, transform 150ms ease-out;

  @starting-style {
    opacity: 0;
    transform: translateY(-4px);
  }
}

/* Toast Enter Animation */
@utility toast-enter {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 200ms ease-out, transform 200ms ease-out;

  @starting-style {
    opacity: 0;
    transform: translateX(100%);
  }
}

/* Fade Enter Animation */
@utility fade-enter {
  opacity: 1;
  transition: opacity 150ms ease-out;

  @starting-style {
    opacity: 0;
  }
}
```

**Step 2: Verificar build**

Run: `npm run build`
Expected: Build success

**Step 3: Commit**

```bash
git add src/client/index.css
git commit -m "feat(css): add @starting-style for enter animations

- dialog-enter: scale + fade for modals
- popover-enter: slide up + fade for popovers
- toast-enter: slide from right for notifications
- fade-enter: simple opacity transition

Pure CSS enter animations, no JavaScript needed"
```

---

## Task 4: Adicionar Container Queries

**Files:**
- Modify: `src/client/index.css` (new section)

**Context:** Cards e componentes devem responder ao container, não à viewport. Container queries são perfeitas para componentes reutilizáveis.

**Step 1: Adicionar container query utilities**

Adicionar ao final do arquivo:
```css
/* ========================================
   Container Query Utilities
   ======================================== */

/* Define container contexts */
@utility container-query {
  container-type: inline-size;
}

@utility container-query-size {
  container-type: size;
}

/* Named containers */
@utility container-card {
  container-type: inline-size;
  container-name: card;
}

@utility container-sidebar {
  container-type: inline-size;
  container-name: sidebar;
}

@utility container-main {
  container-type: inline-size;
  container-name: main;
}
```

**Step 2: Verificar build**

Run: `npm run build`
Expected: Build success

**Step 3: Commit**

```bash
git add src/client/index.css
git commit -m "feat(css): add container query utilities

- container-query: basic inline-size container
- container-query-size: full size container
- Named containers for card, sidebar, main

Use with Tailwind @sm:, @md:, @lg: variants inside containers"
```

---

## Task 5: Adicionar Radial e Conic Gradient Utilities

**Files:**
- Modify: `src/client/index.css` (gradient section)

**Context:** Spinners precisam de gradientes cônicos, highlights usam gradientes radiais. Tailwind v4 tem suporte nativo.

**Step 1: Adicionar gradient utilities avançados**

Adicionar após os gradientes existentes:
```css
/* ========================================
   Advanced Gradient Utilities
   ======================================== */

/* Radial gradients for highlights */
@utility gradient-radial-primary {
  background: radial-gradient(circle at center, var(--color-green-400) 0%, transparent 70%);
}

@utility gradient-radial-accent {
  background: radial-gradient(circle at center, var(--color-blue-400) 0%, transparent 70%);
}

@utility gradient-radial-glow {
  background: radial-gradient(ellipse at top, var(--color-primary) 0%, transparent 50%);
}

/* Conic gradients for spinners/progress */
@utility gradient-conic-spinner {
  background: conic-gradient(from 0deg, transparent 0deg, var(--color-primary) 270deg, transparent 360deg);
}

@utility gradient-conic-progress {
  background: conic-gradient(var(--color-primary) var(--progress, 0%), var(--color-muted) 0%);
}

@utility gradient-conic-rainbow {
  background: conic-gradient(
    in oklch,
    var(--color-red-500) 0deg,
    var(--color-yellow-500) 60deg,
    var(--color-green-500) 120deg,
    var(--color-blue-500) 180deg,
    var(--color-main2-500) 240deg,
    var(--color-pink-500) 300deg,
    var(--color-red-500) 360deg
  );
}
```

**Step 2: Verificar build**

Run: `npm run build`
Expected: Build success

**Step 3: Commit**

```bash
git add src/client/index.css
git commit -m "feat(css): add radial and conic gradient utilities

- gradient-radial-primary/accent: highlight effects
- gradient-radial-glow: top glow effect
- gradient-conic-spinner: loading spinner
- gradient-conic-progress: progress indicator
- gradient-conic-rainbow: decorative rainbow

All using oklch color space for vibrant results"
```

---

## Task 6: Adicionar field-sizing Utility

**Files:**
- Modify: `src/client/index.css` (new section)

**Context:** Textareas que crescem automaticamente sem JavaScript.

**Step 1: Adicionar field-sizing utility**

Adicionar ao final do arquivo:
```css
/* ========================================
   Form Field Utilities
   ======================================== */

/* Auto-resize textarea */
@utility field-sizing-content {
  field-sizing: content;
  min-height: 2.5rem;
  max-height: 20rem;
  resize: none;
}

/* Fixed height (default behavior) */
@utility field-sizing-fixed {
  field-sizing: fixed;
}
```

**Step 2: Verificar build**

Run: `npm run build`
Expected: Build success

**Step 3: Commit**

```bash
git add src/client/index.css
git commit -m "feat(css): add field-sizing utility for auto-resize textareas

- field-sizing-content: textarea grows with content
- field-sizing-fixed: traditional fixed height

No JavaScript needed for auto-growing textareas"
```

---

## Task 7: Adicionar not-* Variant Examples

**Files:**
- Modify: `src/client/index.css` (new section)

**Context:** Demonstrar o uso do not-* variant para estados inversos.

**Step 1: Adicionar comentário explicativo**

Adicionar ao final do arquivo:
```css
/* ========================================
   not-* Variant Usage Examples
   ======================================== */

/*
Tailwind v4 includes the not-* variant natively.
Use directly in your components:

Examples:
- not-hover:opacity-100    → Full opacity when NOT hovering
- not-focus:border-muted   → Muted border when NOT focused
- not-disabled:cursor-pointer → Pointer cursor when NOT disabled
- not-first:border-t       → Top border on all except first
- not-last:border-b        → Bottom border on all except last
- not-empty:pb-4           → Padding when NOT empty

Combined:
- hover:not-disabled:bg-primary → Hover effect only when not disabled
- focus:not-invalid:ring-primary → Focus ring only when valid
*/
```

**Step 2: Commit**

```bash
git add src/client/index.css
git commit -m "docs(css): add not-* variant usage examples

Document native Tailwind v4 not-* variant patterns for inverse states"
```

---

## Task 8: Adicionar inert Variant Utility

**Files:**
- Modify: `src/client/index.css` (new section)

**Context:** Elementos com atributo `inert` devem ter estilo visual distintivo.

**Step 1: Adicionar inert styling**

Adicionar ao final do arquivo:
```css
/* ========================================
   Inert State Styling
   ======================================== */

/*
The [inert] attribute makes elements non-interactive.
Tailwind v4 includes the inert: variant natively.

Use directly:
- inert:opacity-50
- inert:pointer-events-none
- inert:grayscale

Below are pre-composed utilities:
*/

@utility inert-overlay {
  &[inert], [inert] & {
    opacity: 0.5;
    pointer-events: none;
    user-select: none;
    filter: grayscale(0.3);
  }
}

@utility inert-disabled {
  &[inert], [inert] & {
    opacity: 0.6;
    cursor: not-allowed;
  }
}
```

**Step 2: Verificar build**

Run: `npm run build`
Expected: Build success

**Step 3: Commit**

```bash
git add src/client/index.css
git commit -m "feat(css): add inert state utilities

- inert-overlay: dimmed, non-interactive overlay style
- inert-disabled: disabled-like appearance

For use with the HTML inert attribute"
```

---

## Task 9: Adicionar in-* Variant Examples

**Files:**
- Modify: `src/client/index.css` (new section)

**Context:** O in-* variant permite referenciar estados de ancestrais sem precisar de classe `group`.

**Step 1: Adicionar comentário explicativo**

Adicionar ao final do arquivo:
```css
/* ========================================
   in-* Variant Usage Examples
   ======================================== */

/*
Tailwind v4 includes the in-* variant for parent state matching.
Similar to group-* but without needing the group class.

Examples:
- in-hover:text-primary    → When ANY ancestor is hovered
- in-focus:ring-2          → When ANY ancestor is focused
- in-[.open]:block         → When ancestor has .open class
- in-data-[state=open]:opacity-100 → When ancestor has data-state="open"

Comparison with group-*:
- group-hover:text-primary → Needs <div class="group"> ancestor
- in-hover:text-primary    → Works with any hoverable ancestor

Use in-* when:
- You don't control the parent markup
- Parent is a third-party component
- You want implicit parent state detection
*/
```

**Step 2: Commit**

```bash
git add src/client/index.css
git commit -m "docs(css): add in-* variant usage examples

Document native Tailwind v4 in-* variant for parent state matching without group class"
```

---

## Task 10: Atualizar Gradientes Existentes com oklch Interpolation

**Files:**
- Modify: `src/client/index.css` (gradient section)

**Context:** OKLCH interpolation produz gradientes mais vibrantes e perceptualmente uniformes.

**Step 1: Verificar gradientes convertidos**

Os gradientes já foram atualizados na Task 1 com `in oklch`. Verificar que todos estão consistentes.

**Step 2: Atualizar .animate-shimmer se necessário**

Verificar que o shimmer também usa oklch:
```css
@utility animate-shimmer {
  background: linear-gradient(90deg in oklch, var(--color-muted) 25%, var(--color-accent) 50%, var(--color-muted) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

**Step 3: Commit se houve mudanças**

```bash
git add src/client/index.css
git commit -m "refactor(css): ensure all gradients use oklch interpolation

Consistent oklch color space across all gradient utilities"
```

---

## Task 11: Verificação Final e Limpeza

**Files:**
- Modify: `src/client/index.css`

**Step 1: Verificar build**

Run: `npm run build`
Expected: Build success, no warnings

**Step 2: Verificar lint**

Run: `npm run lint`
Expected: No errors

**Step 3: Verificar tipos**

Run: `npm run cf-typegen && tsc --noEmit`
Expected: No type errors

**Step 4: Verificar dev server**

Run: `npm run dev`
Expected: Server starts, no console errors

**Step 5: Visual check**

Verificar manualmente:
- [ ] Dark mode toggle funciona
- [ ] Scrollbars seguem o tema
- [ ] Gradientes aparecem corretamente
- [ ] Classes @utility funcionam com variants

**Step 6: Commit final**

```bash
git add -A
git commit -m "chore: tailwind v4 features implementation complete

Features added:
- @utility directive for variant support
- color-scheme for native dark mode
- @starting-style for enter animations
- Container query utilities
- Radial and conic gradients
- field-sizing for auto-resize textareas
- not-* and in-* variant documentation
- inert state utilities
- oklch gradient interpolation

All features verified working"
```

---

## Impacto

| Métrica | Valor |
|---------|-------|
| Novas features | 11 |
| Arquivos modificados | 1 (index.css) |
| Breaking changes | 0 |
| Bundle impact | ~0 (CSS puro) |

## Compatibilidade

| Feature | Chrome | Firefox | Safari |
|---------|--------|---------|--------|
| @utility | ✅ (Tailwind) | ✅ | ✅ |
| color-scheme | ✅ 81+ | ✅ 96+ | ✅ 15.4+ |
| @starting-style | ✅ 117+ | ✅ 129+ | ✅ 17.5+ |
| Container queries | ✅ 105+ | ✅ 110+ | ✅ 16+ |
| Conic gradients | ✅ 69+ | ✅ 83+ | ✅ 12.1+ |
| field-sizing | ✅ 123+ | ❌ | ✅ 18+ |
| inert | ✅ 102+ | ✅ 112+ | ✅ 15.5+ |

**Nota:** field-sizing não funciona no Firefox. Para suporte completo, manter fallback JavaScript ou aceitar comportamento degradado.
