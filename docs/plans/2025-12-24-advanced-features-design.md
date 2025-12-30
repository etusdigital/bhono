# Design: Advanced Features from NestJS

**Date:** 2025-12-24
**Status:** Approved

## Overview

Port 7 valuable features from the NestJS boilerplate to enhance the Hono boilerplate with production-ready capabilities.

## Feature Summary

| Feature | Priority | Complexity |
|---------|----------|------------|
| Health Checks | High | Low |
| Soft Delete Recovery | High | Low |
| Bulk Operations | Medium | Medium |
| Advanced Search/Filtering | High | Medium |
| Data Export | Medium | Medium |
| API Versioning | Low | Low |
| File Upload Handler | Medium | High |

---

## 1. Health Checks

### Endpoints

```typescript
GET /health       → Overall system status
GET /health/ready → Ready to receive traffic (DB connected, R2 accessible)
GET /health/live  → Process is alive (basic heartbeat)
```

### Response Format

```typescript
interface HealthResponse {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  checks: {
    database: 'up' | 'down'
    storage: 'up' | 'down'
  }
  uptime: number  // seconds
}
```

### Example Responses

**Healthy:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-24T10:00:00Z",
  "checks": {
    "database": "up",
    "storage": "up"
  },
  "uptime": 3600
}
```

**Unhealthy:**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-12-24T10:00:00Z",
  "checks": {
    "database": "down",
    "storage": "up"
  },
  "uptime": 3600
}
```

### Implementation Details

**File:** `src/server/routes/health/routes.ts`

```typescript
// /health - Overall status
app.get('/health', async (c) => {
  const checks = await Promise.allSettled([
    checkDatabase(c.env.DB),
    checkStorage(c.env.R2)
  ])

  const status = checks.every(r => r.status === 'fulfilled') ? 'healthy' : 'unhealthy'

  return c.json({
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database: checks[0].status === 'fulfilled' ? 'up' : 'down',
      storage: checks[1].status === 'fulfilled' ? 'up' : 'down'
    },
    uptime: process.uptime()
  })
})

// /health/ready - Kubernetes readiness probe
app.get('/health/ready', async (c) => {
  try {
    await checkDatabase(c.env.DB)
    return c.json({ ready: true })
  } catch {
    return c.json({ ready: false }, 503)
  }
})

// /health/live - Kubernetes liveness probe
app.get('/health/live', (c) => {
  return c.json({ alive: true })
})
```

### Characteristics

- No authentication required (public endpoints)
- Timeout on checks (5s max)
- Non-blocking
- Suitable for Kubernetes/orchestrators
- Returns 503 when unhealthy (for load balancers)

---

## 2. Soft Delete Recovery

### Endpoints

```typescript
POST /users/:id/restore
POST /accounts/:id/restore
POST /invitations/:id/restore
```

### Request

No body required, just the ID in the path.

### Response

```typescript
{
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "user@example.com",
  name: "John Doe",
  deletedAt: null,  // Restored
  deletedById: null
}
```

### Service Method

```typescript
// services/users.ts
async restore(ctx: ServiceContext, id: string) {
  // 1. Find deleted record
  const [record] = await db
    .select()
    .from(users)
    .where(and(
      eq(users.id, id),
      eq(users.accountId, ctx.accountId),
      isNotNull(users.deletedAt)
    ))
    .limit(1)

  if (!record) {
    throw new NotFoundError('User not found or not deleted')
  }

  // 2. Restore
  const [restored] = await auditedUpdate(db, ctx, users,
    {
      deletedAt: null,
      deletedById: null,
      updatedAt: new Date().toISOString(),
      updatedById: ctx.user.id
    },
    eq(users.id, id)
  )

  return restored
}
```

### Route Definition

```typescript
// routes/users/routes.ts
export const restoreUser = createRoute({
  method: 'post',
  path: '/users/{id}/restore',
  tags: ['Users'],
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.string().uuid()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserSchema } },
      description: 'User restored successfully'
    },
    404: { description: 'User not found or not deleted' },
    403: { description: 'Forbidden - insufficient role' }
  }
})
```

### Characteristics

- Only ADMIN+ can restore
- Automatic audit logging (action: "UPDATE", changes show restoration)
- Cannot restore already active records
- Account-scoped (can't restore other accounts' records)

---

## 3. Bulk Operations

### Endpoints

```typescript
POST /users/bulk        → Create multiple users
PATCH /users/bulk       → Update multiple users
DELETE /users/bulk      → Delete multiple users (soft delete)
```

### Request Formats

**Create (POST):**
```typescript
{
  items: [
    { email: "user1@example.com", name: "User 1" },
    { email: "user2@example.com", name: "User 2" },
    { email: "user3@example.com", name: "User 3" }
  ]
}
```

**Update (PATCH):**
```typescript
{
  ids: ["id-1", "id-2", "id-3"],
  data: { status: "inactive" }
}
```

**Delete (DELETE):**
```typescript
{
  ids: ["id-1", "id-2", "id-3"]
}
```

### Response Format

```typescript
{
  success: [
    { id: "id-1", email: "user1@example.com", ... },
    { id: "id-2", email: "user2@example.com", ... }
  ],
  failed: [
    {
      item: { email: "user3@example.com", name: "User 3" },
      error: "Email already exists"
    }
  ],
  summary: {
    total: 3,
    succeeded: 2,
    failed: 1
  }
}
```

### Schema Validation

```typescript
const BulkCreateSchema = z.object({
  items: z.array(CreateUserSchema).min(1).max(100)
})

const BulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  data: UpdateUserSchema
})

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100)
})
```

### Service Implementation

```typescript
async bulkCreate(ctx: ServiceContext, items: CreateUserInput[]) {
  const success = []
  const failed = []

  for (const item of items) {
    try {
      // Validate and create within transaction
      const result = await withTransaction(db, async (tx) => {
        const [user] = await tx.insert(users).values({
          ...item,
          accountId: ctx.accountId,
          createdById: ctx.user.id
        }).returning()

        // Audit log
        await logAudit(tx, ctx, 'User', user.id, 'INSERT', user)

        return user
      })

      success.push(result)
    } catch (error) {
      failed.push({
        item,
        error: error.message
      })
    }
  }

  return {
    success,
    failed,
    summary: {
      total: items.length,
      succeeded: success.length,
      failed: failed.length
    }
  }
}
```

### Characteristics

- Individual validation (partial success allowed)
- Transaction per item (isolation)
- Max 100 items per request
- Audit log for each successful operation
- Returns detailed errors for failed items
- ADMIN+ only

---

## 4. Advanced Search/Filtering

### Query Parameters

```typescript
GET /users?
  page=1&
  limit=50&
  sortBy=createdAt&
  sortOrder=DESC&
  search=john&                           // Full-text search
  filter[status]=active&                 // Simple equality
  filter[role]=ADMIN,MANAGER&            // Multiple values (OR)
  filter[createdAt][gte]=2025-01-01&     // Date range
  filter[createdAt][lte]=2025-12-31
```

### Supported Operators

```typescript
filter[field]=value           // Equality
filter[field][eq]=value       // Explicit equality
filter[field][ne]=value       // Not equal
filter[field][gt]=value       // Greater than
filter[field][gte]=value      // Greater than or equal
filter[field][lt]=value       // Less than
filter[field][lte]=value      // Less than or equal
filter[field][in]=val1,val2   // In array
filter[field][like]=text      // LIKE %text%
```

### Schema Validation

```typescript
const FilterOperatorSchema = z.object({
  eq: z.string().optional(),
  ne: z.string().optional(),
  gt: z.string().optional(),
  gte: z.string().optional(),
  lt: z.string().optional(),
  lte: z.string().optional(),
  in: z.string().optional(),    // Comma-separated
  like: z.string().optional()
})

const AdvancedQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  search: z.string().optional(),
  filter: z.record(z.union([
    z.string(),
    FilterOperatorSchema
  ])).optional()
})
```

### Helper Function

```typescript
// lib/query-builder.ts
function buildWhereClause(
  filters: Record<string, any>,
  table: Table,
  searchableFields?: string[]
) {
  const conditions = []

  // Apply filters
  for (const [field, value] of Object.entries(filters)) {
    if (typeof value === 'string') {
      // Simple equality or IN clause
      if (value.includes(',')) {
        const values = value.split(',').map(v => v.trim())
        conditions.push(inArray(table[field], values))
      } else {
        conditions.push(eq(table[field], value))
      }
    } else {
      // Operators
      if (value.eq) conditions.push(eq(table[field], value.eq))
      if (value.ne) conditions.push(ne(table[field], value.ne))
      if (value.gt) conditions.push(gt(table[field], value.gt))
      if (value.gte) conditions.push(gte(table[field], value.gte))
      if (value.lt) conditions.push(lt(table[field], value.lt))
      if (value.lte) conditions.push(lte(table[field], value.lte))
      if (value.in) {
        const values = value.in.split(',').map(v => v.trim())
        conditions.push(inArray(table[field], values))
      }
      if (value.like) {
        conditions.push(like(table[field], `%${value.like}%`))
      }
    }
  }

  return and(...conditions)
}

function buildSearchClause(
  search: string,
  fields: string[],
  table: Table
) {
  const conditions = fields.map(field =>
    like(table[field], `%${search}%`)
  )

  return or(...conditions)
}
```

### Usage in Service

```typescript
async findAll(ctx: ServiceContext, query: AdvancedQuery) {
  let baseQuery = db
    .select()
    .from(users)
    .where(and(
      eq(users.accountId, ctx.accountId),
      isNull(users.deletedAt)
    ))

  // Apply filters
  if (query.filter) {
    const filterClause = buildWhereClause(query.filter, users)
    baseQuery = baseQuery.where(filterClause)
  }

  // Apply search
  if (query.search) {
    const searchClause = buildSearchClause(
      query.search,
      ['name', 'email'],
      users
    )
    baseQuery = baseQuery.where(searchClause)
  }

  // Apply sorting
  if (query.sortBy) {
    const direction = query.sortOrder === 'ASC' ? asc : desc
    baseQuery = baseQuery.orderBy(direction(users[query.sortBy]))
  }

  // Pagination
  const offset = (query.page - 1) * query.limit
  const data = await baseQuery.limit(query.limit).offset(offset)

  return {
    data,
    meta: createPaginationMeta(totalCount, query.page, query.limit)
  }
}
```

### Characteristics

- Type-safe filtering
- Multiple operators per field
- Full-text search across multiple fields
- Compatible with existing pagination
- Validated via Zod
- Works with all entities

---

## 5. Data Export

### Endpoints

```typescript
GET /users/export?format=csv&filter[status]=active
GET /accounts/export?format=xlsx
GET /audits/export?format=json
```

### Supported Formats

```typescript
type ExportFormat = 'csv' | 'xlsx' | 'json'
```

### Query Parameters

Same as Advanced Search + format:
```typescript
format=csv              // Required
fields=id,email,name    // Optional - select specific fields
filter[status]=active   // Same filters as search
```

### Response Headers

**CSV:**
```typescript
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="users-2025-12-24.csv"
```

**XLSX:**
```typescript
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="users-2025-12-24.xlsx"
```

**JSON:**
```typescript
Content-Type: application/json
Content-Disposition: attachment; filename="users-2025-12-24.json"
```

### Schema Validation

```typescript
const ExportQuerySchema = AdvancedQuerySchema.extend({
  format: z.enum(['csv', 'xlsx', 'json']),
  fields: z.string().optional()  // Comma-separated
})
```

### Service Implementation

```typescript
// services/users.ts
async export(
  ctx: ServiceContext,
  format: ExportFormat,
  query: ExportQuery
) {
  // 1. Build filtered query (reuse search logic)
  const data = await this.findAll(ctx, {
    ...query,
    limit: 10000  // Max export limit
  })

  // 2. Select specific fields if requested
  const selectedData = query.fields
    ? data.data.map(item => pick(item, query.fields.split(',')))
    : data.data

  // 3. Convert to format
  let result: string | Buffer
  if (format === 'csv') {
    result = convertToCSV(selectedData)
  } else if (format === 'xlsx') {
    result = convertToXLSX(selectedData)
  } else {
    result = JSON.stringify(selectedData, null, 2)
  }

  // 4. Audit log
  await logAudit(db, ctx, 'User', 'EXPORT', 'EXPORT', {
    format,
    count: selectedData.length,
    filters: query.filter
  })

  return result
}
```

### Conversion Helpers

```typescript
// lib/export.ts
function convertToCSV(data: any[]): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const value = row[h]
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

function convertToXLSX(data: any[]): Buffer {
  const XLSX = require('xlsx')
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}
```

### Route Handler

```typescript
export const handleExport = async (c: Context<Env>) => {
  const query = c.req.valid('query')
  const ctx = getServiceContext(c)

  const data = await usersService.export(ctx, query.format, query)

  const filename = `users-${new Date().toISOString().split('T')[0]}.${query.format}`

  const contentType = {
    csv: 'text/csv; charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    json: 'application/json'
  }[query.format]

  c.header('Content-Type', contentType)
  c.header('Content-Disposition', `attachment; filename="${filename}"`)

  return c.body(data)
}
```

### Characteristics

- Reuses Advanced Search filters
- Max 10,000 records per export
- Field selection for custom exports
- Streaming for large datasets (optional enhancement)
- Audit logging for compliance
- MANAGER+ access required

### Dependencies

```json
{
  "xlsx": "^0.18.5"  // ~500KB, widely used
}
```

---

## 6. API Versioning

### URL Structure

```typescript
/v1/users        // Version 1
/v2/users        // Version 2
/users           // Alias to latest (v2)
```

### File Structure

```
src/server/routes/
├── v1/
│   ├── users/
│   │   ├── routes.ts
│   │   ├── handlers.ts
│   │   └── schemas.ts
│   ├── accounts/
│   │   └── ...
│   └── index.ts      // v1 router
├── v2/
│   ├── users/        // Breaking changes
│   │   ├── routes.ts
│   │   ├── handlers.ts
│   │   └── schemas.ts
│   └── index.ts      // v2 router
└── index.ts          // Main router
```

### Main Router

```typescript
// routes/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { v1 } from './v1'
import { v2 } from './v2'
import type { Env } from '../app'

const api = new OpenAPIHono<Env>()

// Mount versioned routes
api.route('/v1', v1)
api.route('/v2', v2)

// Latest version (no prefix)
api.route('/', v2)

// Version-specific OpenAPI docs
api.doc('/v1/doc', {
  openapi: '3.1.0',
  info: { title: 'API v1', version: '1.0.0' }
})

api.doc('/v2/doc', {
  openapi: '3.1.0',
  info: { title: 'API v2', version: '2.0.0' }
})

export { api }
```

### Deprecation Warnings

```typescript
// v1/index.ts
import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../app'

const v1 = new OpenAPIHono<Env>()

// Deprecation middleware
v1.use('*', async (c, next) => {
  c.header('Warning', '299 - "API v1 is deprecated. Migrate to v2 by 2026-06-01"')
  c.header('Sunset', 'Sat, 01 Jun 2026 00:00:00 GMT')
  c.header('API-Version', 'v1')
  await next()
})

// Mount v1 routes
v1.route('/users', usersV1)
v1.route('/accounts', accountsV1)

export { v1 }
```

### Version 2 Example (Breaking Change)

```typescript
// v2/users/schemas.ts
// Breaking change: email is now required, status removed
export const CreateUserSchemaV2 = z.object({
  email: z.string().email(),              // Required
  name: z.string().min(1),
  accountIds: z.array(z.string().uuid())  // Different from v1
}).openapi('CreateUserInputV2')

// v1/users/schemas.ts (legacy)
export const CreateUserSchemaV1 = z.object({
  email: z.string().email().optional(),  // Optional in v1
  name: z.string().min(1),
  status: z.enum(['active', 'inactive']) // Removed in v2
}).openapi('CreateUserInputV1')
```

### Header-Based Versioning (Optional)

```typescript
// Alternative: support API-Version header
app.use('*', async (c, next) => {
  const version = c.req.header('API-Version') || 'v2'

  if (version === 'v1') {
    return v1Handler(c)
  } else {
    return v2Handler(c)
  }
})
```

### Characteristics

- URL-based versioning (clear and cacheable)
- Deprecation warnings via headers
- Separate OpenAPI docs per version
- Shared services/DB when possible
- Breaking changes isolated to version
- Latest version accessible without prefix

---

## 7. File Upload Handler

### Endpoints

```typescript
POST /storage/upload              // Single upload
POST /storage/upload/multiple     // Multiple files
POST /storage/upload/avatar       // Upload with resize
DELETE /storage/:key              // Delete (exists)
GET /storage/:accountId           // List uploads (exists)
```

### New Features Beyond Current R2

1. **File validation**
2. **Image processing (resize/thumbnails)**
3. **Metadata tracking in DB**
4. **Multiple file upload**
5. **Virus scanning (optional)**

### File Validation

```typescript
interface UploadConfig {
  maxSize: number              // bytes
  allowedTypes: string[]       // MIME types
  allowedExtensions: string[]  // file extensions
}

const DEFAULT_CONFIG: UploadConfig = {
  maxSize: 10 * 1024 * 1024,  // 10MB
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.doc', '.docx']
}
```

### Schema Validation

```typescript
const UploadSchema = z.object({
  file: z.custom<File>(),
  folder: z.string().optional(),
  makePublic: z.boolean().default(false)
})

const AvatarUploadSchema = z.object({
  file: z.custom<File>(),
  sizes: z.object({
    thumb: z.object({ width: z.number(), height: z.number() }).optional(),
    medium: z.object({ width: z.number(), height: z.number() }).optional(),
    large: z.object({ width: z.number(), height: z.number() }).optional()
  }).optional()
})
```

### Database Schema

```typescript
// db/schema/uploads.ts
export const uploads = sqliteTable('uploads', {
  id: text('id').primaryKey().$defaultFn(() => uuidv7()),
  accountId: text('account_id').notNull().references(() => accounts.id),
  userId: text('user_id').notNull().references(() => users.id),

  // File info
  key: text('key').notNull().unique(),  // R2 key
  filename: text('filename').notNull(),  // Original filename
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),      // bytes
  url: text('url').notNull(),           // Public URL

  // Metadata
  metadata: text('metadata', { mode: 'json' }).$type<{
    width?: number
    height?: number
    variants?: {
      thumb?: string
      medium?: string
      large?: string
    }
  }>(),

  ...softDeleteFields
})
```

### Image Processing Implementation

```typescript
// lib/image-processor.ts
import sharp from 'sharp'

interface ResizeConfig {
  width: number
  height: number
}

async function resizeImage(
  buffer: ArrayBuffer,
  config: ResizeConfig
): Promise<Buffer> {
  return await sharp(buffer)
    .resize(config.width, config.height, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 85 })
    .toBuffer()
}

async function createVariants(
  file: File,
  sizes: Record<string, ResizeConfig>
): Promise<Record<string, Buffer>> {
  const buffer = await file.arrayBuffer()
  const variants: Record<string, Buffer> = {}

  for (const [name, config] of Object.entries(sizes)) {
    variants[name] = await resizeImage(buffer, config)
  }

  return variants
}
```

### Avatar Upload Handler

```typescript
// routes/storage/handlers.ts
export const handleAvatarUpload = async (c: Context<Env>) => {
  const { file, sizes } = c.req.valid('form')
  const ctx = getServiceContext(c)

  // Validate file
  validateFile(file, {
    maxSize: 5 * 1024 * 1024,  // 5MB for avatars
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  })

  const defaultSizes = {
    thumb: { width: 64, height: 64 },
    medium: { width: 256, height: 256 },
    large: { width: 512, height: 512 }
  }

  // Create variants
  const variants = await createVariants(file, sizes || defaultSizes)

  // Upload original + variants to R2
  const baseKey = `${ctx.accountId}/avatars/${uuidv7()}`

  const uploads = await Promise.all([
    // Original
    uploadToR2(c.env.R2, `${baseKey}-original.jpg`, await file.arrayBuffer()),

    // Variants
    ...Object.entries(variants).map(([name, buffer]) =>
      uploadToR2(c.env.R2, `${baseKey}-${name}.jpg`, buffer)
    )
  ])

  // Save metadata to DB
  const [record] = await db.insert(uploads).values({
    accountId: ctx.accountId,
    userId: ctx.user.id,
    key: `${baseKey}-original.jpg`,
    filename: file.name,
    mimeType: 'image/jpeg',
    size: file.size,
    url: getPublicUrl(c.env.R2, `${baseKey}-original.jpg`),
    metadata: {
      variants: {
        thumb: `${baseKey}-thumb.jpg`,
        medium: `${baseKey}-medium.jpg`,
        large: `${baseKey}-large.jpg`
      }
    }
  }).returning()

  return c.json({
    original: getPublicUrl(c.env.R2, `${baseKey}-original.jpg`),
    thumb: getPublicUrl(c.env.R2, `${baseKey}-thumb.jpg`),
    medium: getPublicUrl(c.env.R2, `${baseKey}-medium.jpg`),
    large: getPublicUrl(c.env.R2, `${baseKey}-large.jpg`)
  }, 201)
}
```

### Multiple File Upload

```typescript
export const handleMultipleUpload = async (c: Context<Env>) => {
  const formData = await c.req.formData()
  const files = formData.getAll('files') as File[]
  const ctx = getServiceContext(c)

  if (files.length > 10) {
    throw new ValidationError('Maximum 10 files per upload')
  }

  const uploaded = []
  const failed = []

  for (const file of files) {
    try {
      // Validate
      validateFile(file, DEFAULT_CONFIG)

      // Upload
      const key = `${ctx.accountId}/files/${uuidv7()}-${file.name}`
      await uploadToR2(c.env.R2, key, await file.arrayBuffer())

      // Save to DB
      const [record] = await db.insert(uploads).values({
        accountId: ctx.accountId,
        userId: ctx.user.id,
        key,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        url: getPublicUrl(c.env.R2, key)
      }).returning()

      uploaded.push(record)
    } catch (error) {
      failed.push({
        filename: file.name,
        error: error.message
      })
    }
  }

  return c.json({
    uploaded,
    failed,
    summary: {
      total: files.length,
      succeeded: uploaded.length,
      failed: failed.length
    }
  })
}
```

### File Validation Helper

```typescript
// lib/file-validator.ts
function validateFile(file: File, config: UploadConfig) {
  // Size check
  if (file.size > config.maxSize) {
    throw new ValidationError(
      `File too large. Max size: ${config.maxSize / 1024 / 1024}MB`
    )
  }

  // MIME type check
  if (!config.allowedTypes.includes(file.type)) {
    throw new ValidationError(
      `File type not allowed. Allowed: ${config.allowedTypes.join(', ')}`
    )
  }

  // Extension check
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!config.allowedExtensions.includes(ext)) {
    throw new ValidationError(
      `File extension not allowed. Allowed: ${config.allowedExtensions.join(', ')}`
    )
  }
}
```

### Delete with Variants

```typescript
// Enhanced delete to remove variants
export const handleDelete = async (c: Context<Env>) => {
  const { key } = c.req.valid('param')
  const ctx = getServiceContext(c)

  // Get upload record
  const [record] = await db
    .select()
    .from(uploads)
    .where(and(
      eq(uploads.key, key),
      eq(uploads.accountId, ctx.accountId)
    ))
    .limit(1)

  if (!record) {
    throw new NotFoundError('Upload not found')
  }

  // Delete from R2 (original + variants)
  const keysToDelete = [record.key]

  if (record.metadata?.variants) {
    keysToDelete.push(...Object.values(record.metadata.variants))
  }

  await Promise.all(
    keysToDelete.map(k => c.env.R2.delete(k))
  )

  // Soft delete from DB
  await auditedDelete(db, ctx, uploads, eq(uploads.id, record.id))

  return c.json({ success: true })
}
```

### Characteristics

- File validation (size, type, extension)
- Image resize with Sharp
- Multiple variants (thumb, medium, large)
- Metadata tracking in DB
- Multiple file upload
- Delete cascades to variants
- Account-scoped
- Audit logging

### Dependencies

```json
{
  "sharp": "^0.33.0"  // Image processing (works in Workers)
}
```

### Optional Enhancements

- Virus scanning via Cloudflare (available in R2)
- Upload progress tracking
- Chunked uploads for large files
- Direct upload URLs (presigned)
- Image optimization (auto WebP conversion)

---

## Implementation Priority

### Phase 1 - Foundation (Week 1)
1. Health Checks
2. Soft Delete Recovery

### Phase 2 - Data Operations (Week 2)
3. Advanced Search/Filtering
4. Bulk Operations

### Phase 3 - Export & Uploads (Week 3)
5. Data Export
6. File Upload Handler

### Phase 4 - Versioning (Optional)
7. API Versioning (implement when needed)

---

## File Structure

```
src/server/
├── routes/
│   ├── health/
│   │   ├── routes.ts           # NEW
│   │   └── index.ts            # NEW
│   ├── storage/
│   │   ├── routes.ts           # EXPAND
│   │   ├── handlers.ts         # EXPAND
│   │   └── schemas.ts          # EXPAND
│   ├── users/
│   │   ├── routes.ts           # EXPAND (restore, bulk, export)
│   │   ├── handlers.ts         # EXPAND
│   │   └── schemas.ts          # EXPAND
│   ├── v1/                     # NEW (optional)
│   └── v2/                     # NEW (optional)
├── lib/
│   ├── query-builder.ts        # NEW
│   ├── export.ts               # NEW
│   ├── image-processor.ts      # NEW
│   └── file-validator.ts       # NEW
├── db/
│   └── schema/
│       └── uploads.ts          # NEW
└── services/
    ├── users.ts                # EXPAND
    └── accounts.ts             # EXPAND
```

---

## Testing Strategy

### Unit Tests
- Query builder logic
- File validation
- Export converters
- Image processing

### Integration Tests
- Bulk operations (partial success)
- Search with complex filters
- Export with filters
- Multi-file upload

### E2E Tests
- Health check responses
- Restore deleted records
- Avatar upload with variants
- Export large datasets

---

## Dependencies

```json
{
  "dependencies": {
    "sharp": "^0.33.0",      // Image processing
    "xlsx": "^0.18.5"        // Excel export
  }
}
```

---

## Migration Notes

- All features are **additive** (no breaking changes)
- Existing routes continue working
- New endpoints are opt-in
- Database migrations required for `uploads` table
- Gradual rollout recommended

---

## Success Metrics

- Health checks: < 100ms response time
- Bulk operations: Handle 100 items in < 5s
- Search: Support 10+ filter combinations
- Export: Generate 10k records in < 10s
- Upload: Process images in < 2s

---

## Future Enhancements

- GraphQL API layer
- Real-time subscriptions (WebSockets)
- Background job processing
- Caching layer (Redis)
- Feature flags system
- Webhooks (deferred)
