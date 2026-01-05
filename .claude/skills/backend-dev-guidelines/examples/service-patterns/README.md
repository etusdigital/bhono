# Service Patterns

Examples of common service layer patterns.

## Files

| File | Pattern |
|------|---------|
| `batch-operations.ts` | Transactional batch operations with executeBatch |
| `search-filters.ts` | Dynamic query building with filters and pagination |
| `external-api.ts` | External API integration with retry logic |

## Key Patterns

### Batch Operations

Use `executeBatch` for atomic operations across multiple tables:

```typescript
const statements: BatchStatement[] = [
  { statement: 'INSERT INTO users ...', params: [...] },
  { statement: 'INSERT INTO user_accounts ...', params: [...] },
  { statement: 'INSERT INTO audit_logs ...', params: [...] },
]
await executeBatch(db, statements) // All succeed or all fail
```

### Dynamic WHERE Clauses

Build queries safely with parameterized clauses:

```typescript
const whereClauses: string[] = ['deleted_at IS NULL']
const params: SqlParams = []

if (filter.status) {
  whereClauses.push('status = ?')
  params.push(filter.status)
}

const whereSql = `WHERE ${whereClauses.join(' AND ')}`
```

### External API Calls

Always wrap external calls with error handling:

```typescript
try {
  const response = await fetch(url, options)
  if (!response.ok) {
    // Log and throw appropriate error
    throw new InternalError('External service failed')
  }
  return response.json()
} catch (error) {
  // Re-throw HTTPException, wrap others
  if (error instanceof HTTPException) throw error
  throw new InternalError('Service unavailable')
}
```

## Best Practices

1. **Always use parameterized queries** - Never concatenate values into SQL
2. **Check tenant access** - Filter by `account_id` for non-super-admins
3. **Log external failures** - Include `transactionId` for tracing
4. **Use audit logging** - Track state changes with `auditedUpdate`/`auditedDelete`
5. **Handle errors at boundaries** - Transform external errors to domain errors
