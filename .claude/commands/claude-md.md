---
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task
argument-hint: create | review | optimize | all
description: Create or manage CLAUDE.md files following best practices (WHY-WHAT-HOW framework) with full directory mapping
---

# Purpose

Helping the user create or manage their CLAUDE.md file following proven best practices

## Action: $ARGUMENTS

## Instructions

MANDATORY FOR CLAUDE CODE: always run this command using the claude-code-specialist sub-agent.

### Analyze the project thoroughly

- Run the /prime command to prime the context

### Root Directory Contents

Run `ls -la`

### Full Directory Structure (All Depths)

Run `find . -type d \( -name node_modules -o -name .git -o -name dist -o -name build -o -name __pycache__ -o -name .next -o -name .nuxt -o -name coverage -o -name .turbo -o -name .cache -o -name .venv -o -name venv -o -name env -o -name .env -o -name target -o -name vendor -o -name .idea -o -name .vscode \) -prune -o -type d -print 2>/dev/null | head -200 | sed 's|^\./||' | sort`

## Write or Update CLAUDE.md

Write or update the CLAUDE.md file with the following the "Best Practices" section below according to the action and arguments provided.

---

## Best Practices

### Core Principles

1. **LLMs are stateless** - CLAUDE.md is the ONLY file auto-included in every session
2. **Minimize instructions** - Claude Code has ~50 built-in instructions; add only ~100-150 more
3. **Target length**: Under 300 lines
4. **Only universally applicable guidance** - skip task-specific details

### The WHY-WHAT-HOW Framework

Structure CLAUDE.md around three dimensions:

#### WHAT (Tech Stack & Structure)

- Project type and main technologies
- Key directories and their purposes
- Important file locations
- Monorepo structure (if applicable)

#### WHY (Purpose & Context)

- What the project does
- Why different components exist
- Business logic that affects code decisions

#### HOW (Development Workflow)

- Build/run commands
- Testing procedures
- Verification methods
- Deployment process

### Anti-Patterns to AVOID

- **Code style guidelines** - Use linters/formatters instead (ESLint, Prettier, Black)
- **Code snippets** - They become outdated; use file:line references
- **Auto-generated content** - This is high-leverage, write it manually
- **Task-specific hotfixes** - Only broadly applicable guidance
- **Database schemas** - Too detailed, distracts the model
- **Duplicated code** - Reference files instead

### Progressive Disclosure

Instead of stuffing everything into CLAUDE.md:

1. Keep CLAUDE.md minimal and universal
2. Use a separate docs folder in `/docs/` to store all the documentation about the project
3. Reference the documentation with file folders or file paths when needed

---

## Instructions Based on Arguments

### If action is "create"

1. **Analyze the project thoroughly**:

   - Read package.json, pyproject.toml, or equivalent for dependencies
   - Check existing README.md for context
   - Use the Full Directory Structure above to understand ALL folders
   - Look for existing linter/formatter configs
   - Identify entry points and key source files

2. **Map every important directory** using the structure captured above:

   - For EACH directory shown, determine its purpose
   - Group related directories logically
   - Note depth relationships (parent → child)
   - Identify patterns (features/, components/, utils/, etc.)

3. **Generate CLAUDE.md** with this structure:

   ```markdown
   # Project Name

   Brief one-line description of what this project does.

   ## Tech Stack

   - Primary language/framework
   - Key dependencies (only critical ones)

   ## Project Structure

   ### Root Level
   ```

   src/ # Main source code
   tests/ # Test files
   docs/ # Documentation

   ```

   ### Source Code (`src/`)
   ```

   src/
   ├── components/ # React/UI components
   │ ├── common/ # Shared components
   │ ├── features/ # Feature-specific components
   │ └── layouts/ # Layout wrappers
   ├── hooks/ # Custom React hooks
   ├── services/ # API/business logic
   │ ├── api/ # API clients
   │ └── auth/ # Authentication
   ├── utils/ # Helper functions
   └── types/ # TypeScript types

   ```

   ### [Other Major Directories as needed]
   ```

   directory/
   ├── subdirectory/ # Purpose
   │ └── nested/ # Purpose
   └── another/ # Purpose

   ```

   ## Development

   ### Commands
   - `npm run dev` - Start development
   - `npm test` - Run tests
   - `npm run build` - Build for production

   ### Workflow
   1. Make changes
   2. Run tests
   3. Verify build succeeds

   ## Key Files
   - `src/index.ts` - Application entry point
   - `src/config.ts` - Configuration
   - [other critical files]

   ## Key Decisions
   - Why we chose X over Y (if relevant)
   ```

4. **Verify the result**:
   - All significant directories documented with purpose
   - Nested structures clearly shown
   - No code snippets (file:line references instead)
   - No style guidelines
   - Only universal guidance

### If action is "all"

1. **Generate comprehensive directory documentation**:

   - Ultrathink about all the directories and subdirectories at the minimum level of navigation that would benefit from having a CLAUDE.md file on it
   - Use the "best practices" section above to guide the creation of the CLAUDE.md files

2. **Create CLAUDE.md files for each folder and subfolder you think are relevant to the project**

   - Think about the main reason to create a CLAUDE.md file inside a sub directory
   - Plan what should be included in the CLAUDE.md file based on the folder's purpose and the files on it
   - Create the CLAUDE.md file with the plan
   - Review the CLAUDE.md file to make sure it is correct and it will help as complementary context to the Agent that will read it

3. **Verify the result**:
   - All significant directories documented with purpose
   - Nested structures clearly shown
   - No code snippets (file:line references instead)
   - No style guidelines
   - Only universal guidance

### If action is "review"

1. Read all the existing CLAUDE.md in the codebase
2. Analyze against best practices checklist:

   - [ ] Under 300 lines
   - [ ] Uses WHY-WHAT-HOW framework?
   - [ ] No code style guidelines (that's for linters)?
   - [ ] No code snippets that could become outdated?
   - [ ] Only universally applicable guidance?
   - [ ] References other docs instead of embedding?
   - [ ] Clear project purpose stated?
   - [ ] Key commands documented?

3. Report findings with specific improvement suggestions

### If action is "optimize"

1. Read all the existing CLAUDE.md in the codebase
2. Identify what to:

   - **Remove**: Code snippets, style guides, task-specific hotfixes
   - **Condense**: Verbose sections, redundant info
   - **Extract**: Detailed docs to `/docs/` folder
   - **Add**: Missing WHY-WHAT-HOW elements

3. Create optimized version maintaining:

   - Under 300 lines target
   - WHY-WHAT-HOW structure
   - Only universal guidance

4. Show before/after line count comparison

---

## Output Format

After completing the action, provide:

1. **Summary of changes** (if any)
2. **Line count** (before → after if applicable)
3. **Checklist status** against best practices
4. **Recommendations** for further improvements

Remember: A good CLAUDE.md is like a good README for AI - concise, structural, and focused on enabling effective collaboration.
