---
name: architecture-analyzer
description: Comprehensive architectural analysis and documentation generation for ANY software project using only repository access. Supports microservices, monoliths, serverless, SPAs, CLI tools, libraries, and data pipelines. Use when users need to (1) Analyze any codebase architecture, (2) Generate C4/ERD diagrams, (3) Create dependency maps, (4) Assess technical debt and security, (5) Document APIs, (6) Perform architecture reviews. Triggers on "analyze architecture", "document codebase", "create diagrams", "map dependencies", "generate ERD", "tech debt analysis", or "architecture report".
---

# Architecture Analyzer

## Overview

Performs deep architectural analysis of ANY software project by reading code repositories to reverse-engineer comprehensive documentation including architecture diagrams, ERDs, dependency maps, and technical assessments.

**Supports all project types:**
- Microservices & distributed systems
- Monolithic applications
- Modular monoliths
- Serverless/FaaS applications
- Frontend SPAs (React, Vue, Angular)
- **Next.js, Nuxt, Remix** (SSR/SSG/ISR)
- Full-stack applications
- CLI tools & libraries
- Data pipelines & ETL
- Event-driven architectures
- Mobile backends (React Native, Expo)

## Architecture Detection

First, identify the architecture type:

| Architecture | Indicators | Key Analysis Focus |
|-------------|------------|-------------------|
| **Microservices** | Multiple `Dockerfile`s, K8s manifests, service mesh configs, API gateways | Service boundaries, inter-service communication |
| **Monolith** | Single deployable, layered directories (`/controllers`, `/services`, `/models`) | Module coupling, layer violations |
| **Modular Monolith** | Single deploy + bounded contexts, internal modules with clear interfaces | Module boundaries, dependency rules |
| **Serverless** | `serverless.yml`, AWS SAM, `functions/` dir, Lambda/Azure Functions | Function triggers, cold start risks |
| **Frontend SPA** | React/Vue/Angular, `src/components`, state management, routing | Component hierarchy, state flow |
| **Next.js/Nuxt/Remix** | `next.config.js`, `nuxt.config.ts`, `app/` dir, API routes, SSR/SSG | Pages, API routes, data fetching |
| **Full-Stack** | Backend + frontend in one repo, `/api` + `/web` or `/client` + `/server` | API contracts, shared types |
| **CLI Tool** | `bin/`, commander/yargs/click, `--help` flags, arg parsing | Command structure, input validation |
| **Library/Package** | `exports` in package.json, `__init__.py`, public API surface | API design, breaking changes |
| **Data Pipeline** | Airflow DAGs, dbt models, Spark jobs, ETL patterns | Data lineage, transformation flow |
| **Event-Driven** | Kafka/RabbitMQ/SQS, event schemas, sagas, CQRS patterns | Event flow, eventual consistency |

## Analysis Workflow

### Phase 1: Discovery

1. **Detect architecture type** using indicators above
2. **Map repository structure** (monorepo vs multi-repo)
3. **Identify components** using build files and directories
4. **Create inventory** with confidence levels

### Phase 2: Deep Analysis

Analyze based on architecture type:

**For Backend Services (Microservices/Monolith/Modular):**
- Stack & frameworks
- API endpoints (REST/GraphQL/gRPC)
- Database models (ERD)
- Service dependencies
- Security patterns
- Observability setup

**For Frontend Applications:**
- Component hierarchy
- State management
- Routing structure
- API integrations
- Build configuration
- Asset pipeline

**For Serverless:**
- Function inventory
- Trigger types (HTTP, Queue, Schedule, Event)
- Cold start analysis
- Resource limits
- IAM permissions

**For Libraries:**
- Public API surface
- Export structure
- Peer dependencies
- Compatibility matrix
- Breaking change risk

**For Data Pipelines:**
- DAG/workflow structure
- Data sources & sinks
- Transformation steps
- Schedule/triggers
- Data quality checks

### Phase 3: Correlation

1. Build dependency graph
2. Identify boundaries (domains, modules, packages)
3. Trace critical flows
4. Detect patterns and anti-patterns

### Phase 4: Documentation

1. Executive summary with confidence levels
2. Architecture diagrams (C4, ERD, flow)
3. Component/service catalog
4. Technical assessments

## Confidence Marking

**Mark ALL findings:**
- **HIGH**: Directly in code/configs (`jwt in package.json:15`)
- **MEDIUM**: Strongly inferred (`axios calls suggest REST`)
- **LOW**: Educated guess (`~1000 users based on config`)
- **UNKNOWN**: Requires human input

## Output Rules

**MANDATORY:** All generated documentation MUST be saved to `docs/architecture/`

```bash
# Always create output directory first
mkdir -p docs/architecture
```

**Required output structure:**
```
docs/architecture/
├── README.md              # Executive summary & index
├── c4-context.md          # C4 Level 1 diagram
├── c4-container.md        # C4 Level 2 diagram
├── c4-component.md        # C4 Level 3 diagrams
├── erd.md                 # Entity Relationship Diagram
├── api-catalog.md         # API endpoints documentation
├── dependencies.md        # Service/module dependency map
└── tech-debt.md           # Technical debt register
```

## Quick Start

```bash
# 1. Create output directory (REQUIRED)
mkdir -p docs/architecture

# 2. Full analysis pipeline
python scripts/analyze_structure.py . -o docs/architecture/inventory.json
python scripts/map_dependencies.py -o docs/architecture/dependencies.md
python scripts/generate_c4.py --output-dir docs/architecture
python scripts/generate_erd.py -o docs/architecture/erd.md
python scripts/analyze_tech_debt.py -o docs/architecture/tech-debt.md
python scripts/extract_apis.py -o docs/architecture/api-catalog.md
```

## Architecture-Specific Patterns

### Microservices Detection

```yaml
Indicators:
  - Multiple Dockerfiles in subdirectories
  - Kubernetes manifests (deployment.yaml, service.yaml)
  - Service mesh (Istio, Linkerd configs)
  - API Gateway (Kong, Traefik, AWS API Gateway)
  - docker-compose with multiple services
  - /services or /apps directory structure

Analyze:
  - Service boundaries and responsibilities
  - Inter-service communication (sync vs async)
  - Data ownership per service
  - Shared libraries/contracts
  - Circuit breakers, retries, timeouts
```

### Monolith Detection

```yaml
Indicators:
  - Single Dockerfile at root
  - Layered architecture (/controllers, /services, /repositories)
  - Single database connection
  - No inter-process communication
  - Shared models across features

Analyze:
  - Layer violations (controller→repository skipping service)
  - Circular dependencies between modules
  - God classes and large files
  - Database coupling
  - Feature toggle patterns
```

### Modular Monolith Detection

```yaml
Indicators:
  - Single deployable with /modules or /domains directory
  - Internal module APIs/interfaces
  - Module-scoped database schemas
  - Event bus for cross-module communication
  - Explicit dependency rules

Analyze:
  - Module boundary integrity
  - Cross-module dependencies (should be minimal)
  - Shared kernel identification
  - Module public interfaces
  - Potential microservice extraction candidates
```

### Serverless Detection

```yaml
Indicators:
  - serverless.yml, sam.yaml, or terraform with Lambda
  - /functions or /lambdas directory
  - Event source mappings
  - API Gateway integration
  - Step Functions definitions

Analyze:
  - Function cold start risk (dependencies, init code)
  - Timeout and memory configurations
  - Event source types and volumes
  - Shared layers/dependencies
  - IAM permission scope
```

### Frontend SPA Detection

```yaml
Indicators:
  - React (jsx/tsx, react-dom), Vue (.vue), Angular (@angular)
  - /components, /pages, /views directories
  - State management (Redux, Zustand, Pinia, NgRx)
  - Router configuration
  - Build tools (Vite, Webpack, esbuild)

Analyze:
  - Component hierarchy and reusability
  - State management patterns
  - API integration layer
  - Bundle size and code splitting
  - Accessibility patterns
```

### Next.js / Nuxt / Remix Detection

```yaml
Indicators:
  Next.js:
    - next.config.js or next.config.mjs
    - /app directory (App Router) or /pages directory (Pages Router)
    - /api routes in pages/api or app/api
    - next/image, next/link, next/router imports
    - "next" in package.json dependencies

  Nuxt:
    - nuxt.config.ts or nuxt.config.js
    - /pages, /components, /composables directories
    - "nuxt" or "nuxt3" in dependencies
    - Auto-imports pattern

  Remix:
    - remix.config.js
    - /routes directory with loader/action exports
    - "remix" or "@remix-run/*" in dependencies

Analyze:
  - Routing structure (file-based routing)
  - Data fetching patterns:
    - Next.js: getServerSideProps, getStaticProps, Server Components, use()
    - Nuxt: useFetch, useAsyncData, $fetch
    - Remix: loader, action functions
  - API routes (serverless functions)
  - Rendering strategy (SSR, SSG, ISR, CSR)
  - Middleware and edge functions
  - Image optimization usage
  - Environment variables handling
  - Authentication patterns (next-auth, nuxt-auth)
  - Database connections (Prisma, Drizzle in API routes)
  - Deployment target (Vercel, Netlify, self-hosted)
```

### CLI Tool Detection

```yaml
Indicators:
  - bin/ directory with entry points
  - CLI frameworks (commander, yargs, click, cobra)
  - Argument parsing patterns
  - --help and --version flags
  - Exit codes handling

Analyze:
  - Command structure and subcommands
  - Input validation
  - Output formatting (JSON, table, plain)
  - Configuration file handling
  - Error messaging quality
```

### Library/Package Detection

```yaml
Indicators:
  - "exports" or "main" in package.json
  - __init__.py with __all__
  - Public API surface in types/index.d.ts
  - Peer dependencies
  - Semantic versioning

Analyze:
  - Public API surface area
  - Breaking change risk
  - Dependency weight
  - Tree-shaking compatibility
  - Documentation coverage
```

### Data Pipeline Detection

```yaml
Indicators:
  - Airflow DAGs (dags/ directory)
  - dbt models (models/, dbt_project.yml)
  - Spark jobs, PySpark
  - ETL patterns, batch processing
  - Data warehouse connections

Analyze:
  - DAG/workflow dependencies
  - Data lineage
  - Transformation logic
  - Scheduling and triggers
  - Failure handling and retries
```

## API Extraction Patterns

### REST APIs

| Framework | Pattern | Example |
|-----------|---------|---------|
| Express | `app.METHOD(path)` | `app.get('/users', handler)` |
| FastAPI | `@app.METHOD(path)` | `@app.get("/users")` |
| Spring | `@METHODMapping` | `@GetMapping("/users")` |
| Gin | `router.METHOD(path)` | `router.GET("/users", handler)` |
| Django | `path()` in urls.py | `path('users/', views.list)` |
| Flask | `@app.route()` | `@app.route('/users')` |
| NestJS | `@METHOD()` | `@Get('users')` |
| Hono | `app.METHOD(path)` | `app.get('/users', handler)` |
| **Next.js** | File-based in `app/api/` | `app/api/users/route.ts` → `GET`, `POST` exports |
| **Next.js (Pages)** | File in `pages/api/` | `pages/api/users.ts` → `handler(req, res)` |
| **Nuxt** | File in `server/api/` | `server/api/users.ts` → `defineEventHandler` |
| **Remix** | `loader`/`action` exports | `routes/users.tsx` → `export async function loader()` |

### GraphQL

```graphql
# Look in: *.graphql, schema.graphql, typeDefs
type Query {
  users: [User]
  user(id: ID!): User
}
type Mutation {
  createUser(input: CreateUserInput!): User
}
```

### gRPC

```protobuf
# Look in: *.proto files
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);
}
```

### WebSocket/Real-time

```javascript
// Socket.io events
io.on('connection', socket => {
  socket.on('message', handler)
  socket.emit('update', data)
})
```

## ERD Generation

**Supported ORMs:**

| ORM | Files | Entity Pattern |
|-----|-------|----------------|
| Prisma | `*.prisma` | `model User { }` |
| SQLAlchemy | `models.py` | `class User(Base)` |
| Django | `models.py` | `class User(models.Model)` |
| TypeORM | `*.entity.ts` | `@Entity() class User` |
| Mongoose | `*.model.js` | `new Schema({ })` |
| JPA | `*Entity.java` | `@Entity class User` |
| Sequelize | `*.model.js` | `sequelize.define()` |
| Drizzle | `schema.ts` | `pgTable('users', {})` |

**Output formats:** Mermaid, PlantUML, DOT, JSON

## Dependency Detection

### HTTP Clients

```javascript
// JavaScript: axios, fetch, got
axios.get('http://user-service/api')
fetch(`${process.env.API_URL}/users`)

// Python: requests, httpx
requests.get(f"{settings.API_URL}/users")

// Go: net/http
http.Get("http://service/api")
```

### Message Queues

```javascript
// Kafka
producer.send('topic', message)
consumer.subscribe(['topic'])

// RabbitMQ
channel.publish(exchange, routingKey, message)
channel.consume(queue, handler)

// Redis Pub/Sub
client.publish('channel', message)
client.subscribe('channel')
```

### Database Connections

```yaml
PostgreSQL: postgresql://, postgres://, PG_*
MongoDB: mongodb://, mongodb+srv://, MONGO_*
MySQL: mysql://, MYSQL_*
Redis: redis://, REDIS_*
```

## Technical Debt Categories

| Category | Detection Method | Severity |
|----------|-----------------|----------|
| **Debt Comments** | TODO, FIXME, HACK, XXX | Medium-High |
| **Deprecated APIs** | Old patterns, legacy imports | Medium |
| **Security Issues** | Hardcoded secrets, eval(), injection risks | Critical |
| **Code Smells** | Large files, high complexity, empty catches | Medium |
| **Outdated Deps** | Major versions behind | Medium |
| **Missing Tests** | Low test file coverage | High |

## Output Templates

### Component Catalog Entry

```markdown
| Component | user-service |
|-----------|-------------|
| **Type** | Microservice / Module / Function |
| **Path** | `/services/user` |
| **Stack** | Node.js 20, Express 4.18 [HIGH] |
| **Purpose** | User management [HIGH] |
| **APIs** | REST: 12 endpoints [HIGH] |
| **Database** | PostgreSQL [HIGH] |
| **Dependencies** | auth-service, email-service [MEDIUM] |
| **Test Coverage** | 78% [HIGH] |
```

### Technical Debt Entry

```markdown
**TD-001**: Deprecated MongoDB driver
- Location: order-service/package.json:18
- Current: mongodb v2.2.36
- Impact: Security vulnerabilities [HIGH]
- Fix: Upgrade to v6.x
- Effort: 2-4h
```

## Pattern Detection

| Pattern | Indicators | Assessment |
|---------|------------|------------|
| **API Gateway** | Central routing, path rewriting | Good for microservices |
| **BFF** | Frontend-specific APIs | Reduces over-fetching |
| **CQRS** | Separate read/write models | Good for complex domains |
| **Event Sourcing** | Event store, replay capability | Audit trail, complexity |
| **Saga** | Distributed transactions | Eventually consistent |
| **Circuit Breaker** | Hystrix, Polly, resilience4j | Fault tolerance |
| **Strangler Fig** | Gradual migration proxies | Safe modernization |

## Security Assessment

```yaml
Authentication:
  HIGH: JWT middleware, OAuth2 flows, Passport.js
  MEDIUM: Session-based, API keys
  LOW: Basic auth, no auth detected

Authorization:
  HIGH: RBAC, ABAC, policy engines
  MEDIUM: Simple role checks
  LOW: No authorization layer

Secrets:
  GOOD: Vault, AWS Secrets Manager, env vars from CI
  BAD: Hardcoded, committed .env files
```

## Resources

### scripts/
- `analyze_structure.py` - Architecture detection and inventory
- `extract_apis.py` - API endpoint extraction
- `map_dependencies.py` - Dependency mapping and graphing
- `generate_c4.py` - C4 diagram generation
- `generate_erd.py` - ERD from ORM models
- `analyze_tech_debt.py` - Technical debt detection

### references/
- `c4-templates.md` - C4 diagram templates
- `confidence-levels.md` - Confidence marking guide

### assets/
- `report-template.md` - Full report structure
