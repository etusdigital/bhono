---
name: skill-master
description: Use when creating new skills, updating existing skills, or improving skill quality - provides complete workflow from concept to deployment including CSO optimization, skill-rules.json configuration, trigger patterns, automation scripts, and Anthropic best practices. Covers skill structure, YAML frontmatter, progressive disclosure, and 500-line rule.
license: Complete terms in LICENSE.txt
---

# Skill Master

This skill provides guidance for creating effective skills.

## About Skills

Skills are modular, self-contained packages that extend Claude's capabilities by providing
specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific
domains or tasks—they transform Claude from a general-purpose agent into a specialized agent
equipped with procedural knowledge that no model can fully possess.

### What Skills Provide

1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Scripts, references, and assets for complex and repetitive tasks

### Anatomy of a Skill

Every skill consists of a required SKILL.md file and optional bundled resources:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   └── description: (required)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation intended to be loaded into context as needed
    └── assets/           - Files used in output (templates, icons, fonts, etc.)
```

#### SKILL.md (required)

**Metadata Quality:** The `name` and `description` in YAML frontmatter determine when Claude will use the skill. Be specific about what the skill does and when to use it. Use the third-person (e.g. "This skill should be used when..." instead of "Use this skill when...").

**Restrict Tool Access (Optional):** Use the `allowed_tools` field in frontmatter to limit which tools Claude can use when the skill is active. This is useful for skills that should only read files or only execute specific operations.

```yaml
---
name: my-skill
description: This skill should be used when...
allowed_tools:
  - Read
  - Grep
  - Bash
---
```

Common use cases:
- **Read-only skills**: `allowed_tools: [Read, Grep, Glob]` - For research or analysis
- **No file modifications**: Exclude `Write`, `Edit` to prevent changes
- **Specific workflow**: List only tools needed for the skill's purpose

When `allowed_tools` is not specified, all tools are available.

#### Bundled Resources (optional)

##### Scripts (`scripts/`)

Executable code (Python/Bash/etc.) for tasks that require deterministic reliability or are repeatedly rewritten.

- **When to include**: When the same code is being rewritten repeatedly or deterministic reliability is needed
- **Example**: `scripts/rotate_pdf.py` for PDF rotation tasks
- **Benefits**: Token efficient, deterministic, may be executed without loading into context
- **Dual Purpose**: Scripts serve both as executable tools AND as reference material. Clearly state in SKILL.md whether Claude should execute the script directly or read it as a pattern example
- **Note**: Scripts may still need to be read by Claude for patching or environment-specific adjustments

##### References (`references/`)

Documentation and reference material intended to be loaded as needed into context to inform Claude's process and thinking.

- **When to include**: For documentation that Claude should reference while working
- **Examples**: `references/finance.md` for financial schemas, `references/mnda.md` for company NDA template, `references/policies.md` for company policies, `references/api_docs.md` for API specifications
- **Use cases**: Database schemas, API documentation, domain knowledge, company policies, detailed workflow guides
- **Benefits**: Keeps SKILL.md lean, loaded only when Claude determines it's needed
- **Best practice**: If files are large (>10k words), include grep search patterns in SKILL.md
- **Mutually Exclusive Contexts**: Separate unrelated content into different files. If "PDF forms" and "PDF tables" are never needed together, keep them in separate reference files to avoid loading unnecessary context
- **Avoid duplication**: Information should live in either SKILL.md or references files, not both. Prefer references files for detailed information unless it's truly core to the skill—this keeps SKILL.md lean while making information discoverable without hogging the context window. Keep only essential procedural instructions and workflow guidance in SKILL.md; move detailed reference material, schemas, and examples to references files.

##### Assets (`assets/`)

Files not intended to be loaded into context, but rather used within the output Claude produces.

- **When to include**: When the skill needs files that will be used in the final output
- **Examples**: `assets/logo.png` for brand assets, `assets/slides.pptx` for PowerPoint templates, `assets/frontend-template/` for HTML/React boilerplate, `assets/font.ttf` for typography
- **Use cases**: Templates, images, icons, boilerplate code, fonts, sample documents that get copied or modified
- **Benefits**: Separates output resources from documentation, enables Claude to use files without loading them into context

### Progressive Disclosure Design Principle

Skills use a three-level loading system to manage context efficiently:

1. **Metadata (name + description)** - Always in context (~100 words)
2. **SKILL.md body** - When skill triggers (<5k words)
3. **Bundled resources** - As needed by Claude (Unlimited*)

*Unlimited because scripts can be executed without reading into context window.

## Skill Creation Process

To create a skill, follow the "Skill Creation Process" in order, skipping steps only if there is a clear reason why they are not applicable.

### Step 1: Understanding the Skill with Concrete Examples

Skip this step only when the skill's usage patterns are already clearly understood. It remains valuable even when working with an existing skill.

To create an effective skill, clearly understand concrete examples of how the skill will be used. This understanding can come from either direct user examples or generated examples that are validated with user feedback.

For example, when building an image-editor skill, relevant questions include:

- "What functionality should the image-editor skill support? Editing, rotating, anything else?"
- "Can you give some examples of how this skill would be used?"
- "I can imagine users asking for things like 'Remove the red-eye from this image' or 'Rotate this image'. Are there other ways you imagine this skill being used?"
- "What would a user say that should trigger this skill?"

To avoid overwhelming users, avoid asking too many questions in a single message. Start with the most important questions and follow up as needed for better effectiveness.

Conclude this step when there is a clear sense of the functionality the skill should support.

### Step 2: Planning the Reusable Skill Contents

To turn concrete examples into an effective skill, analyze each example by:

1. Considering how to execute on the example from scratch
2. Identifying what scripts, references, and assets would be helpful when executing these workflows repeatedly

Example: When building a `pdf-editor` skill to handle queries like "Help me rotate this PDF," the analysis shows:

1. Rotating a PDF requires re-writing the same code each time
2. A `scripts/rotate_pdf.py` script would be helpful to store in the skill

Example: When designing a `frontend-webapp-builder` skill for queries like "Build me a todo app" or "Build me a dashboard to track my steps," the analysis shows:

1. Writing a frontend webapp requires the same boilerplate HTML/React each time
2. An `assets/hello-world/` template containing the boilerplate HTML/React project files would be helpful to store in the skill

Example: When building a `big-query` skill to handle queries like "How many users have logged in today?" the analysis shows:

1. Querying BigQuery requires re-discovering the table schemas and relationships each time
2. A `references/schema.md` file documenting the table schemas would be helpful to store in the skill

To establish the skill's contents, analyze each concrete example to create a list of the reusable resources to include: scripts, references, and assets.

#### Real-World Examples

Study these production skills to see different patterns in action:

**Simple Self-Contained Pattern:**
- `examples/brainstorming/` - 55-line workflow skill with no bundled resources. Perfect example of minimalist approach.

**Complex Multi-Phase Pattern:**
- `examples/mcp-builder/` - Multi-phase workflow with WebFetch integration, multiple reference files, and helper scripts. Shows progressive disclosure in practice.

**Massive Template Library Pattern:**
- `examples/subagent-creator/` - 159 production templates across 24 domains in `assets/examples/`. Demonstrates template library with searchable catalog system.

**Template/Format Enforcement Pattern:**
- `examples/writing-plans/` - Shows exact format expectations and template-driven approach. Demonstrates format enforcement use case.

**Domain Knowledge Pattern:**
- `examples/fastapi-dev-guidelines/` - Framework best practices with resources directory. Shows domain-specific skill with technical depth.

Each demonstrates different complexity levels and bundled resource patterns. Read their SKILL.md files to understand structure and organization.

### Step 3: Initializing the Skill

At this point, it is time to actually create the skill.

Skip this step only if the skill being developed already exists, and iteration or packaging is needed. In this case, continue to the next step.

When creating a new skill from scratch, always run the `init_skill.py` script. The script conveniently generates a new template skill directory that automatically includes everything a skill requires, making the skill creation process much more efficient and reliable.

Usage:

```bash
scripts/init_skill.py <skill-name> --path <output-directory>
```

The script:

- Creates the skill directory at the specified path
- Generates a SKILL.md template with proper frontmatter and TODO placeholders
- Creates example resource directories: `scripts/`, `references/`, and `assets/`
- Adds example files in each directory that can be customized or deleted

After initialization, customize or remove the generated SKILL.md and example files as needed.

### Step 4: Edit the Skill

When editing the (newly-generated or existing) skill, remember that the skill is being created for another instance of Claude to use. Focus on including information that would be beneficial and non-obvious to Claude. Consider what procedural knowledge, domain-specific details, or reusable assets would help another Claude instance execute these tasks more effectively.

#### Start with Reusable Skill Contents

To begin implementation, start with the reusable resources identified above: `scripts/`, `references/`, and `assets/` files. Note that this step may require user input. For example, when implementing a `brand-guidelines` skill, the user may need to provide brand assets or templates to store in `assets/`, or documentation to store in `references/`.

Also, delete any example files and directories not needed for the skill. The initialization script creates example files in `scripts/`, `references/`, and `assets/` to demonstrate structure, but most skills won't need all of them.

#### Update SKILL.md

**Writing Style:** Write the entire skill using **imperative/infinitive form** (verb-first instructions), not second person. Use objective, instructional language (e.g., "To accomplish X, do Y" rather than "You should do X" or "If you need to do X"). This maintains consistency and clarity for AI consumption.

#### Claude Search Optimization (CSO)

Make skills discoverable by optimizing how Claude finds and selects them:

**Description Field Best Practices:**
- Start with "Use when..." to focus on triggering conditions first
- Include error messages, symptoms, and tool names that signal when this skill applies
- Technology-agnostic unless the skill itself is tech-specific
- Write in third person (e.g., "This skill should be used when..." not "Use this when...")
- Max 1024 characters total
- No XML tags (e.g., avoid `<tag>content</tag>`)

**Examples:**
```yaml
# ❌ BAD: Too vague, doesn't include when to use
description: Guide for creating skills

# ✅ GOOD: Starts with "Use when", includes triggers
description: Use when creating new skills or updating existing skills - provides workflow including CSO optimization, trigger configuration, and best practices
```

**Naming Best Practices:**
- Use active voice, verb-first: "creating-skills" not "skill-creation"
- Gerunds (-ing) work well: "processing-pdfs", "debugging-apis"
- Use letters, numbers, and hyphens only
- Max 64 characters
- Don't include "anthropic" or "claude" in the name

**Token Efficiency:**
- Frequently-loaded skills: <200 words
- Other skills: <500 words
- Move details to reference files or tool --help output

#### Keep SKILL.md Under 500 Lines

**The 500-Line Rule:** Main SKILL.md should be under 500 lines (Anthropic best practice). Move heavy content to `references/` files. This skill demonstrates the pattern with technical references in separate files.

**To complete SKILL.md, answer the following questions:**

1. What is the purpose of the skill, in a few sentences?
2. When should the skill be used?
3. In practice, how should Claude use the skill? All reusable skill contents developed above should be referenced so that Claude knows how to use them.

### Step 5: Configure Triggers

Skills can be auto-activated by Claude Code based on user prompts. Configure this in `.claude/skills/skill-rules.json`.

#### Add to skill-rules.json

Add an entry for your skill with trigger configuration:

```json
{
  "your-skill-name": {
    "type": "domain",
    "enforcement": "suggest",
    "priority": "high",
    "promptTriggers": {
      "keywords": [
        "keyword1", "keyword2", "specific error message"
      ],
      "intentPatterns": [
        "(create|build|make).*?something",
        "how.*?do.*?task"
      ]
    }
  }
}
```

**Configuration Options:**
- `type`: "domain" (advisory) or "guardrail" (critical)
- `enforcement`: "suggest" (most common) or "block" (for critical guardrails)
- `priority`: "high", "medium", or "low"
- `keywords`: Explicit terms that trigger the skill
- `intentPatterns`: Regex patterns for implicit actions

#### Test Triggers

Verify your skill activates correctly:

```bash
echo '{"session_id":"test","prompt":"your test prompt here"}' | \
  npx tsx .claude/hooks/skill-activation-prompt.ts
```

The output should show your skill in the recommended list.

#### Refine Patterns

Based on testing:
- Add missing keywords that should trigger the skill
- Refine intent patterns to reduce false positives
- Test with various phrasings users might use

**See Reference Files:**
- `reference/TRIGGER_TYPES.md` - Complete guide to all trigger types
- `reference/SKILL_RULES_REFERENCE.md` - Full skill-rules.json schema
- `reference/PATTERNS_LIBRARY.md` - Copy-paste regex/glob patterns

### Step 6: Packaging a Skill

Once the skill is ready, it should be packaged into a distributable zip file that gets shared with the user. The packaging process automatically validates the skill first to ensure it meets all requirements:

```bash
scripts/package_skill.py <path/to/skill-folder>
```

Optional output directory specification:

```bash
scripts/package_skill.py <path/to/skill-folder> ./dist
```

The packaging script will:

1. **Validate** the skill automatically, checking:
   - YAML frontmatter format and required fields
   - Skill naming conventions and directory structure
   - Description completeness and quality
   - File organization and resource references

2. **Package** the skill if validation passes, creating a zip file named after the skill (e.g., `my-skill.zip`) that includes all files and maintains the proper directory structure for distribution.

If validation fails, the script will report the errors and exit without creating a package. Fix any validation errors and run the packaging command again.

### Step 7: Iterate

After testing the skill, users may request improvements. Often this happens right after using the skill, with fresh context of how the skill performed.

**Iteration workflow:**
1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Identify how SKILL.md or bundled resources should be updated
4. Implement changes and test again

## Skill Creation Checklist

Use this checklist to ensure all steps are completed:

**Planning Phase:**
- [ ] Understand concrete examples and use cases
- [ ] Identify reusable resources (scripts/references/assets)

**Creation Phase:**
- [ ] Run `scripts/init_skill.py` to initialize
- [ ] Name uses only letters, numbers, hyphens (max 64 chars, no "anthropic"/"claude")
- [ ] YAML frontmatter with name and description (max 1024 chars)
- [ ] Description starts with "Use when..." in third person, no XML tags
- [ ] Keywords included for CSO
- [ ] Consider `allowed_tools` if restricting tool access
- [ ] SKILL.md under 500 lines
- [ ] Create scripts, references, assets as needed
- [ ] Progressive disclosure if content heavy

**Configuration Phase:**
- [ ] Add entry to `.claude/skills/skill-rules.json`
- [ ] Configure triggers (keywords, intent patterns)
- [ ] Test triggers with `npx tsx` commands
- [ ] Refine patterns to reduce false positives
- [ ] JSON syntax validated: `jq . skill-rules.json`

**Quality Phase:**
- [ ] CSO optimization applied
- [ ] Token efficiency targets met
- [ ] Reference files have table of contents if > 100 lines
- [ ] Validate with `scripts/package_skill.py`

**Deployment Phase:**
- [ ] Test with real use cases
- [ ] Package with `scripts/package_skill.py`
- [ ] Distribute or commit to repository

## Reference Files

For detailed information on specific topics, see:

**Technical References:**
- `reference/TRIGGER_TYPES.md` - Complete guide to all trigger types
- `reference/SKILL_RULES_REFERENCE.md` - Full skill-rules.json schema
- `reference/PATTERNS_LIBRARY.md` - Ready-to-use regex/glob patterns
- `reference/TROUBLESHOOTING.md` - Comprehensive debugging guide

**Research & Foundation:**
- `research/anthropic-best-practices.md` - Anthropic's official skill authoring guide
- `research/graphviz-conventions.dot` - Flowchart style guide

**Scripts:**
- `scripts/init_skill.py` - Initialize new skill with template
- `scripts/package_skill.py` - Validate and package skill
- `scripts/quick_validate.py` - Quick YAML frontmatter validation

**Production Examples:**
- `examples/brainstorming/` - Simple self-contained workflow (55 lines)
- `examples/mcp-builder/` - Complex multi-phase with references and scripts
- `examples/subagent-creator/` - Massive template library (159 examples)
- `examples/writing-plans/` - Template/format enforcement pattern
- `examples/fastapi-dev-guidelines/` - Domain knowledge with resources
