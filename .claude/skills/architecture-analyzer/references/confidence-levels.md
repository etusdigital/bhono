# Confidence Levels Guide

## Overview
Every finding in the architecture analysis must be marked with a confidence level to indicate how certain we are about the information based on what can be verified in the code.

## Confidence Levels

### HIGH Confidence
**Definition**: Information directly observable in code, configuration files, or explicit documentation within the repository.

**Examples**:
- Dependencies listed in package.json, pom.xml, requirements.txt
- Database connections with explicit connection strings
- API endpoints defined with decorators or route definitions
- Environment variables referenced in code
- Dockerfiles and deployment configurations
- Test files and coverage reports
- Explicit error messages or log statements

**How to mark**:
```markdown
**Authentication**: JWT-based [HIGH - jsonwebtoken in package.json:15]
**Database**: PostgreSQL 14 [HIGH - docker-compose.yml:23]
**API Endpoints**: 23 REST endpoints [HIGH - counted from routes/]
```

### MEDIUM Confidence
**Definition**: Information strongly inferred from patterns, naming conventions, or multiple corroborating pieces of evidence.

**Examples**:
- Service dependencies inferred from import statements
- Framework usage inferred from file structure
- Communication patterns inferred from client libraries
- Business logic inferred from method/class names
- Architectural patterns inferred from directory structure
- Security practices inferred from middleware usage

**How to mark**:
```markdown
**Service Communication**: REST over HTTP [MEDIUM - axios client found]
**Pattern**: Repository pattern [MEDIUM - repo/ directory structure]
**Caching**: Redis likely used [MEDIUM - redis client imported but no config]
```

### LOW Confidence
**Definition**: Educated guesses based on common patterns, incomplete evidence, or industry standards.

**Examples**:
- Performance capabilities without explicit configs
- Scaling assumptions based on technology stack
- Business rules inferred from minimal code
- Integration assumptions from partial evidence
- Team structure guessed from code ownership
- Deployment frequency from commit patterns

**How to mark**:
```markdown
**Scale**: ~1000 concurrent users [LOW - based on single instance config]
**Team Size**: 3-5 developers [LOW - based on commit authors]
**Deploy Frequency**: Weekly [LOW - based on version tags]
```

### UNKNOWN
**Definition**: Information that cannot be determined from the code alone and requires human input.

**Examples**:
- Business KPIs and metrics
- SLAs and SLOs not in code
- Organizational structure
- Cost constraints
- Compliance requirements
- Production infrastructure details
- User demographics
- Business strategy

**How to mark**:
```markdown
**Multi-tenancy Strategy**: Unknown (not derivable from code)
**Production Scale**: Unknown (no production configs found)
**Compliance**: Unknown (no explicit compliance markers)
```

## Decision Tree for Confidence Assignment

```
Is the information explicitly written in code/config?
├─ YES → HIGH confidence
└─ NO → Can it be strongly inferred from multiple sources?
    ├─ YES → MEDIUM confidence
    └─ NO → Is there partial evidence?
        ├─ YES → LOW confidence
        └─ NO → UNKNOWN
```

## Evidence Requirements by Confidence Level

### HIGH Confidence Evidence
Must provide:
- Exact file path
- Line number (when applicable)
- Exact text or configuration value

Example:
```markdown
Evidence: `/services/user/package.json:12` - "express": "^4.18.0"
```

### MEDIUM Confidence Evidence
Must provide:
- Multiple corroborating sources
- Pattern explanation
- File/directory references

Example:
```markdown
Evidence: Multiple HTTP client calls in `/services/order/api/`
Pattern: All external calls use axios with similar structure
```

### LOW Confidence Evidence
Must provide:
- Reasoning for the guess
- What evidence is missing
- Industry standard reference

Example:
```markdown
Evidence: No explicit scaling config found
Reasoning: Node.js single instance, no clustering setup
Missing: Production deployment configs
```

## Compound Confidence

When combining multiple pieces of information:

```markdown
**Service Architecture** [Confidence: Mixed]
- Microservices: HIGH (separate deployables found)
- Count: HIGH (12 services identified)
- Communication: MEDIUM (REST patterns inferred)
- Orchestration: LOW (possible K8s from yaml files)
- Production Setup: Unknown
```

## Confidence in Diagrams

### Visual Representations
- **Solid lines**: HIGH confidence relationships
- **Dashed lines**: MEDIUM confidence relationships
- **Dotted lines**: LOW confidence relationships
- **Question marks**: UNKNOWN elements

### Diagram Annotations
```mermaid
graph LR
    A[Service A] ==>|HIGH| B[Service B]
    B -.->|MEDIUM| C[Service C]
    C ...|LOW| D[Service D]
    D ---|UNKNOWN| E[External?]
```

## Confidence Aggregation

For summary sections:
```markdown
## Analysis Confidence Summary
- HIGH confidence findings: 67% (45/67 items)
- MEDIUM confidence findings: 24% (16/67 items)
- LOW confidence findings: 9% (6/67 items)
- UNKNOWN: 12 areas requiring stakeholder input

## Recommended Validation Priority
1. Validate LOW confidence items first
2. Confirm MEDIUM confidence patterns
3. Verify HIGH confidence critical items
4. Gather information for UNKNOWN areas
```

## Best Practices

1. **Be Conservative**: When in doubt, use lower confidence
2. **Show Your Work**: Always explain reasoning
3. **Accumulate Evidence**: Multiple weak signals can increase confidence
4. **Update Continuously**: Adjust confidence as more code is analyzed
5. **Highlight Uncertainty**: Make unknowns prominent
6. **Version Confidence**: Track how confidence changes over analysis

## Anti-Patterns to Avoid

❌ **Don't**:
- State something as fact without evidence
- Hide uncertainty in footnotes
- Average confidence across unrelated items
- Assume industry standards apply
- Guess at business requirements

✅ **Do**:
- Mark every technical claim
- Lead with confidence level
- Explain evidence gaps
- Separate facts from inferences
- Document what you cannot determine
