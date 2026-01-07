# Backend Development Guidelines - Code Examples

Ready-to-use code templates following the skill's best practices.

## Structure

```
examples/
├── feature-crud/           # Complete CRUD feature template
│   ├── schemas.ts          # Zod + OpenAPI validation
│   ├── routes.ts           # Route definitions
│   ├── handlers.ts         # Request handlers
│   ├── service.ts          # Business logic
│   ├── index.ts            # Router + guards
│   └── README.md
│
├── service-patterns/       # Service layer patterns
│   ├── batch-operations.ts # Transactional batch ops
│   ├── search-filters.ts   # Dynamic queries
│   ├── external-api.ts     # API integration
│   └── README.md
│
├── middleware-examples/    # Custom middleware
│   ├── rate-limiter.ts     # KV-based rate limiting
│   ├── request-logger.ts   # Structured logging
│   ├── header-validator.ts # Request validation
│   └── README.md
│
└── test-examples/          # Test patterns
    ├── service.test.ts     # Unit tests
    ├── integration.test.ts # API tests
    └── README.md
```

## Quick Start

### Create a New Feature

```bash
# Copy the CRUD template
cp -r examples/feature-crud src/server/routes/{your-feature}

# Rename files and references from "products" to your entity
```

### Add Custom Middleware

```bash
# Copy and adapt middleware examples
cp examples/middleware-examples/rate-limiter.ts src/server/middleware/
```

### Write Tests

```bash
# Copy test patterns
cp examples/test-examples/service.test.ts tests/unit/server/services/
```

## Usage Tips

1. **Read the README** in each example folder first
2. **Adapt, don't copy blindly** - Each example shows the pattern, customize for your needs
3. **Check existing code** - Real implementations in `src/server/` may be more current
4. **Update imports** - Adjust import paths after copying

## Example Hierarchy

| Example | Complexity | Best For |
|---------|------------|----------|
| `feature-crud` | Complete | New features from scratch |
| `service-patterns` | Focused | Specific service patterns |
| `middleware-examples` | Focused | Custom middleware needs |
| `test-examples` | Focused | Test setup and patterns |

## Contributing

When adding new examples:

1. Follow existing file naming conventions
2. Include comprehensive comments explaining patterns
3. Add a README.md in the folder
4. Update this main README
5. Reference in SKILL.md if significant
