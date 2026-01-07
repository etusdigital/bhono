# Common Patterns Library

Ready-to-use regex and glob patterns for skill triggers. Copy and customize for your skills.

## Important: Placeholder Patterns

⚠️ **File path patterns below are PLACEHOLDERS** - you MUST customize them to match your actual project structure.

- `frontend/src/**/*.tsx` → Replace with YOUR frontend directory
- `form/src/**/*.ts` → Replace with YOUR service directory names
- `database/src/**/*.ts` → Replace with YOUR database directory

Intent patterns (regex) and content patterns are generally project-agnostic and can be used as-is.

---

## Intent Patterns (Regex)

**✅ These patterns are project-agnostic** - Use as-is or customize for your specific terminology:

### Feature/Endpoint Creation
```regex
(add|create|implement|build).*?(feature|endpoint|route|service|controller)
```

### Component Creation
```regex
(create|add|make|build).*?(component|UI|page|modal|dialog|form)
```

### Database Work
```regex
(add|create|modify|update).*?(user|table|column|field|schema|migration)
(database|prisma).*?(change|update|query)
```

### Error Handling
```regex
(fix|handle|catch|debug).*?(error|exception|bug)
(add|implement).*?(try|catch|error.*?handling)
```

### Explanation Requests
```regex
(how does|how do|explain|what is|describe|tell me about).*?
```

### Workflow Operations
```regex
(create|add|modify|update).*?(workflow|step|branch|condition)
(debug|troubleshoot|fix).*?workflow
```

### Testing
```regex
(write|create|add).*?(test|spec|unit.*?test)
```

---

## File Path Patterns (Glob)

**⚠️ PLACEHOLDERS - CUSTOMIZE FOR YOUR PROJECT:**

### Frontend
```glob
# REPLACE 'frontend/src' WITH YOUR ACTUAL FRONTEND PATH
frontend/src/**/*.tsx        # All React components (PLACEHOLDER)
frontend/src/**/*.ts         # All TypeScript files (PLACEHOLDER)
frontend/src/components/**   # Only components directory (PLACEHOLDER)

# Example customizations for different project structures:
# app/**/*.tsx              # Next.js app directory
# src/components/**/*.tsx   # Standard src structure
# client/src/**/*.tsx       # Client-server monorepo
```

### Backend Services
```glob
# REPLACE WITH YOUR ACTUAL SERVICE DIRECTORY NAMES
form/src/**/*.ts            # Form service (PLACEHOLDER EXAMPLE)
email/src/**/*.ts           # Email service (PLACEHOLDER EXAMPLE)
users/src/**/*.ts           # Users service (PLACEHOLDER EXAMPLE)
projects/src/**/*.ts        # Projects service (PLACEHOLDER EXAMPLE)

# Example customizations:
# api/services/**/*.ts      # Monolithic API structure
# packages/*/src/**/*.ts    # Monorepo packages
# server/modules/**/*.ts    # Module-based structure
```

### Database
```glob
**/schema.prisma            # Prisma schema (anywhere) - ✅ OK AS-IS
**/migrations/**/*.sql      # Migration files - ✅ OK AS-IS
database/src/**/*.ts        # Database scripts (PLACEHOLDER - customize path)

# Example customizations:
# prisma/**/*.ts            # If using prisma directory
# db/src/**/*.ts            # Alternative db directory name
```

### Workflows
```glob
# REPLACE WITH YOUR ACTUAL WORKFLOW DIRECTORY PATH
form/src/workflow/**/*.ts              # Workflow engine (PLACEHOLDER EXAMPLE)
form/src/workflow-definitions/**/*.json # Workflow definitions (PLACEHOLDER EXAMPLE)

# Example customizations:
# workflows/**/*.ts         # Top-level workflows directory
# src/automation/**/*.ts    # Alternative naming
```

### Test Exclusions
```glob
# USUALLY OK AS-IS FOR MOST PROJECTS ✅
**/*.test.ts                # TypeScript tests
**/*.test.tsx               # React component tests
**/*.spec.ts                # Spec files
```

---

## Content Patterns (Regex)

**✅ These patterns are project-agnostic** - Match technology usage regardless of project structure:

### Prisma/Database
```regex
import.*[Pp]risma                # Prisma imports
PrismaService                    # PrismaService usage
prisma\.                         # prisma.something
\.findMany\(                     # Prisma query methods
\.create\(
\.update\(
\.delete\(
```

### Controllers/Routes
```regex
export class.*Controller         # Controller classes
router\.                         # Express router
app\.(get|post|put|delete|patch) # Express app routes
```

### Error Handling
```regex
try\s*\{                        # Try blocks
catch\s*\(                      # Catch blocks
throw new                        # Throw statements
```

### React/Components
```regex
export.*React\.FC               # React functional components
export default function.*       # Default function exports
useState|useEffect              # React hooks
```

---

**Usage Example:**

```json
{
  "my-skill": {
    "promptTriggers": {
      "intentPatterns": [
        "(create|add|build).*?(component|UI|page)"  // ✅ Use as-is
      ]
    },
    "fileTriggers": {
      "pathPatterns": [
        "frontend/src/**/*.tsx"  // ⚠️ PLACEHOLDER - Replace with YOUR path
      ],
      "contentPatterns": [
        "export.*React\\.FC",    // ✅ Use as-is
        "useState|useEffect"     // ✅ Use as-is
      ]
    }
  }
}
```

**Customization Checklist:**
- ✅ **Intent Patterns** - Usually OK as-is (project-agnostic)
- ✅ **Content Patterns** - Usually OK as-is (match technology usage)
- ⚠️ **Path Patterns** - **MUST customize** to match YOUR project structure

---

**Related Files:**
- [SKILL.md](SKILL.md) - Main skill guide
- [TRIGGER_TYPES.md](TRIGGER_TYPES.md) - Detailed trigger documentation
- [SKILL_RULES_REFERENCE.md](SKILL_RULES_REFERENCE.md) - Complete schema
