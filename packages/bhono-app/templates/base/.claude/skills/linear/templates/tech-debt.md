# Technical Debt Template

## Template Configuration

| Property | Value |
|----------|-------|
| **Name** | Technical Debt |
| **Labels** | `tech-debt`, `refactor` |
| **Priority** | 4 (Low) or 3 (Medium) |
| **Default Status** | Backlog |

## Description Template

```markdown
## Summary
<!-- Brief description of the technical debt -->

## Current State
<!-- What's the problem with the current implementation? -->

## Impact
<!-- How does this affect development, performance, or maintainability? -->

- **Development velocity**:
- **Performance**:
- **Security risk**:
- **Test coverage**:

## Proposed Solution
<!-- How should this be refactored? -->

## Files/Components Affected
<!-- List the areas of code that need changes -->

- `src/components/...`
- `src/utils/...`

## Migration Strategy
<!-- If breaking changes, how will we migrate? -->

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests updated
- [ ] Documentation updated

## Effort Estimate
<!-- T-shirt size: XS, S, M, L, XL -->

## Risk Assessment
<!-- What could go wrong? -->
```

## CLI Usage

```bash
# Create tech debt issue
npx tsx scripts/issues/create.ts \
  --title "Tech Debt: Migrate from moment.js to date-fns" \
  --description "## Summary
Replace moment.js with date-fns to reduce bundle size and improve tree-shaking.

## Current State
We're using moment.js (300KB gzipped) for date formatting throughout the app. It's imported wholesale and doesn't tree-shake.

## Impact
- **Development velocity**: Neutral
- **Performance**: -300KB bundle size potential savings
- **Security risk**: moment.js is in maintenance mode
- **Test coverage**: Need to update date-related tests

## Proposed Solution
1. Install date-fns
2. Create adapter layer with same API
3. Migrate components incrementally
4. Remove moment.js when complete

## Files/Components Affected
- \`src/utils/date.ts\`
- \`src/components/DatePicker/\`
- \`src/components/Timeline/\`
- \`src/hooks/useFormatDate.ts\`

## Migration Strategy
1. Add date-fns alongside moment.js
2. Create \`src/utils/date-adapter.ts\` with unified API
3. Migrate one component at a time
4. Remove moment.js after all migrations complete

## Acceptance Criteria
- [ ] All date operations use date-fns
- [ ] Bundle size reduced by >200KB
- [ ] All existing tests pass
- [ ] No moment.js imports remain

## Effort Estimate
Medium (M) - 2-3 days

## Risk Assessment
- Date format inconsistencies during migration
- Timezone handling differences between libraries" \
  --priority 4 \
  --json
```

## Best Practices

1. **Title Format**: `Tech Debt: Brief description`
   - `Tech Debt: Remove deprecated API calls`
   - `Tech Debt: Add TypeScript to utils folder`

2. **Quantify Impact**: "Reduces build time by 30%" is better than "Makes build faster"

3. **Include Migration Path**: Especially for breaking changes

4. **List Affected Files**: Helps estimate scope

5. **Link to Related Issues**: Tech debt often blocks feature work

## Priority Guidelines

| Priority | When to Use |
|----------|-------------|
| **High (2)** | Blocks feature development, security risk |
| **Medium (3)** | Significant performance/DX improvement |
| **Low (4)** | Nice to have, long-term improvement |

## Common Tech Debt Categories

| Category | Examples |
|----------|----------|
| **Dependencies** | Outdated packages, deprecated libraries |
| **Code Quality** | Missing types, inconsistent patterns |
| **Performance** | Bundle size, slow queries, memory leaks |
| **Testing** | Missing tests, flaky tests, low coverage |
| **Documentation** | Outdated docs, missing API docs |
| **Infrastructure** | CI/CD improvements, build optimization |
