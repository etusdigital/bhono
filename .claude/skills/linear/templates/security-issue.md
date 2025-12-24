# Security Issue Template

## Template Configuration

| Property | Value |
|----------|-------|
| **Name** | Security Issue |
| **Labels** | `security`, `vulnerability` |
| **Priority** | 1 (Urgent) or 2 (High) |
| **Default Status** | Triage |

## Description Template

```markdown
## Vulnerability Summary
<!-- Brief description of the security issue -->

## Severity
<!-- Critical / High / Medium / Low -->

## CVSS Score (if applicable)
<!-- e.g., 7.5 (High) -->

## Affected Components
<!-- Which systems/services are affected? -->

-
-

## Attack Vector
<!-- How could this be exploited? -->

## Impact
<!-- What's the potential damage? -->

- **Confidentiality**:
- **Integrity**:
- **Availability**:

## Steps to Reproduce
<!-- How to verify the vulnerability exists -->

1.
2.
3.

## Proof of Concept
<!-- Code or demonstration if safe to share -->

## Recommended Fix
<!-- Proposed remediation -->

## References
<!-- CVE IDs, security advisories, documentation -->

-

## Discovery
- **Discovered by**:
- **Discovered date**:
- **Disclosure deadline**:
```

## CLI Usage

```bash
# Create security issue (CONFIDENTIAL - be careful with details)
npx tsx scripts/issues/create.ts \
  --title "Security: SQL Injection in search endpoint" \
  --description "## Vulnerability Summary
SQL injection vulnerability in the /api/search endpoint allows unauthorized database access.

## Severity
High

## CVSS Score
8.6 (High)

## Affected Components
- \`/api/search\` endpoint
- \`src/services/search.ts\`

## Attack Vector
User-supplied search query is concatenated directly into SQL without parameterization.

## Impact
- **Confidentiality**: High - Attacker can read any database records
- **Integrity**: High - Attacker can modify database records
- **Availability**: Medium - Potential for data deletion

## Steps to Reproduce
1. Navigate to search page
2. Enter: \`'; DROP TABLE users; --\`
3. Observe SQL error in response

## Recommended Fix
Use parameterized queries:
\`\`\`typescript
// Before (vulnerable)
const query = \\\`SELECT * FROM items WHERE name = '\${searchTerm}'\\\`;

// After (safe)
const query = 'SELECT * FROM items WHERE name = $1';
const result = await db.query(query, [searchTerm]);
\`\`\`

## References
- OWASP SQL Injection: https://owasp.org/www-community/attacks/SQL_Injection
- CWE-89: https://cwe.mitre.org/data/definitions/89.html

## Discovery
- **Discovered by**: Security audit
- **Discovered date**: 2025-01-15
- **Disclosure deadline**: 2025-01-22" \
  --priority 1 \
  --json
```

## Best Practices

1. **Title Format**: `Security: Brief description (no exploit details)`
   - `Security: Authentication bypass in admin panel`
   - `Security: XSS vulnerability in comments`

2. **Handle Sensitively**:
   - Don't include full exploit code in public channels
   - Use private issues if available
   - Follow responsible disclosure practices

3. **Include Severity**: Use standard severity ratings (Critical/High/Medium/Low)

4. **Provide Remediation**: Security issues should include fix recommendations

5. **Set Deadline**: Security issues often have disclosure timelines

## Severity Guidelines

| Severity | CVSS | Response Time | Examples |
|----------|------|---------------|----------|
| **Critical** | 9.0-10.0 | Immediate | RCE, auth bypass, data breach |
| **High** | 7.0-8.9 | 24-48 hours | SQL injection, privilege escalation |
| **Medium** | 4.0-6.9 | 1 week | XSS, CSRF, info disclosure |
| **Low** | 0.1-3.9 | Next sprint | Missing headers, minor leaks |

## Common Vulnerability Types

| Type | Label | Example |
|------|-------|---------|
| Injection | `injection` | SQL, NoSQL, Command, LDAP |
| Authentication | `auth` | Broken auth, session issues |
| XSS | `xss` | Reflected, Stored, DOM-based |
| Access Control | `access-control` | IDOR, privilege escalation |
| Cryptography | `crypto` | Weak encryption, key exposure |
| Configuration | `misconfiguration` | Default creds, open ports |

## Responsible Disclosure

If external:
1. Acknowledge receipt within 24 hours
2. Provide timeline for fix
3. Credit reporter (if desired)
4. Coordinate disclosure date
