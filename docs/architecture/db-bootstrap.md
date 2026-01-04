# Database Bootstrap (schema.sql)

## Objetivo
O boilerplate nao usa migrations. O schema do D1 e versionado em `schema.sql` e aplicado via `wrangler d1 execute`. O seed e gerado em `seed.sql` a partir de `src/server/db/seed.ts`.

## Arquivos
- `schema.sql` - fonte de verdade do schema
- `src/server/db/seed.ts` - gerador de seed
- `seed.sql` - output do seed (gerado)

## Fluxos recomendados
### Local
```bash
# aplicar schema
pnpm db:schema:local

# gerar e aplicar seed
pnpm db:seed:local

# reset completo (schema + seed)
pnpm db:reset:local
```

### Remoto (opcional)
```bash
# aplicar schema
pnpm db:schema:remote

# gerar e aplicar seed
pnpm db:seed:remote

# reset completo (schema + seed)
pnpm db:reset:remote
```

## Notas
- `schema.sql` deve ser atualizado a cada mudanca estrutural.
- `seed.sql` deve ser re-gerado apos alteracoes em `seed.ts`.
- As migrations nao sao usadas neste boilerplate para manter o fluxo simples.
