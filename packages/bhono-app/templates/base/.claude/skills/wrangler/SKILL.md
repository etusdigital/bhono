---
name: wrangler
description: Get the context of the Wrangler CLI tool. Use this skill whenever users will run any wrangler commands to any related Cloudflare services.
---

# Purpose

Provide the context and all the information about the Wrangler CLI tool to the agent never miss or run an outdated command.

## Variables

SOME_VAR: "some-value"

## Instructions

Run `wrangler --help` to get the context of the Wrangler CLI tool and information about the commands and options.

## Workflow

1. Run the "Instructions" section
2. Identify if the wrangler is outdated or not and if it is, run the `npm i -G wrangler@latest` command to update it.
3. Return the options and commands of the wrangler CLI tool to the agent related to task he is working on.

## Context

Wrangler, the Cloudflare Developer Platform command-line interface (CLI), allows you to manage Worker projects.

## Resources

### Core Documentation

| Resource                                                        | Description                                              |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| [API](./resources/api.md)                                       | Programmatic APIs for local Cloudflare Workers workflows |
| [Bundling](./resources/bundling.md)                             | Wrangler's default bundling behavior                     |
| [Configuration](./resources/configuration.md)                   | Configuration file customization for Workers             |
| [Custom Builds](./resources/custom-builds.md)                   | Customize code compilation before Wrangler processing    |
| [Deprecations](./resources/deprecations.md)                     | Wrangler version differences and breaking changes        |
| [Environments](./resources/enviroments.md)                      | Create different configurations for the same Worker      |
| [System Variables](./resources/system-enviroments-variables.md) | Environment variables that change Wrangler behavior      |

### Commands Reference

| Resource                                  | Description                             |
| ----------------------------------------- | --------------------------------------- |
| [Commands Index](./resources/commands.md) | Complete index of all Wrangler commands |

#### Getting Started Commands

| Command                                          | Description                   |
| ------------------------------------------------ | ----------------------------- |
| [how-to-run](./resources/commands/how-to-run.md) | How to run Wrangler commands  |
| [docs](./resources/commands/docs.md)             | Open documentation in browser |
| [init](./resources/commands/init.md)             | Initialize a Worker project   |
| [login](./resources/commands/login.md)           | Authorize with Cloudflare     |
| [logout](./resources/commands/logout.md)         | Remove authorization          |
| [whoami](./resources/commands/whoami.md)         | Show user information         |

#### Development & Deployment Commands

| Command                                  | Description              |
| ---------------------------------------- | ------------------------ |
| [dev](./resources/commands/dev.md)       | Local development server |
| [deploy](./resources/commands/deploy.md) | Deploy to Cloudflare     |
| [delete](./resources/commands/delete.md) | Delete Worker            |
| [tail](./resources/commands/tail.md)     | Log tailing session      |
| [check](./resources/commands/check.md)   | Validate Worker          |

#### Versioning & Deployments Commands

| Command                                            | Description                     |
| -------------------------------------------------- | ------------------------------- |
| [versions](./resources/commands/versions.md)       | Manage Worker Versions          |
| [deployments](./resources/commands/deployments.md) | Manage Deployments              |
| [rollback](./resources/commands/rollback.md)       | Rollback to previous Deployment |
| [triggers](./resources/commands/triggers.md)       | Update cron/routes              |

#### Storage Commands

| Command                                              | Description        |
| ---------------------------------------------------- | ------------------ |
| [d1](./resources/commands/d1.md)                     | D1 SQL databases   |
| [kv-namespace](./resources/commands/kv-namespace.md) | KV namespaces      |
| [kv-key](./resources/commands/kv-key.md)             | KV keys and values |
| [kv-bulk](./resources/commands/kv-bulk.md)           | KV bulk operations |
| [r2-bucket](./resources/commands/r2-bucket.md)       | R2 buckets         |
| [r2-object](./resources/commands/r2-object.md)       | R2 objects         |
| [r2-sql](./resources/commands/r2-sql.md)             | R2 SQL queries     |

#### AI & Database Commands

| Command                                          | Description               |
| ------------------------------------------------ | ------------------------- |
| [vectorize](./resources/commands/vectorize.md)   | Vectorize indexes         |
| [hyperdrive](./resources/commands/hyperdrive.md) | Hyperdrive configurations |

#### Secrets & Configuration Commands

| Command                                                              | Description               |
| -------------------------------------------------------------------- | ------------------------- |
| [secret](./resources/commands/secret.md)                             | Worker secrets            |
| [secrets-store-secret](./resources/commands/secrets-store-secret.md) | Secrets Store secrets     |
| [secrets-store-store](./resources/commands/secrets-store-store.md)   | Secrets Store stores      |
| [setup](./resources/commands/setup.md)                               | Interactive setup         |
| [types](./resources/commands/types.md)                               | Generate TypeScript types |
| [telemetry](./resources/commands/telemetry.md)                       | Telemetry settings        |

#### Platform Commands

| Command                                                          | Description           |
| ---------------------------------------------------------------- | --------------------- |
| [pages](./resources/commands/pages.md)                           | Cloudflare Pages      |
| [containers](./resources/commands/containers.md)                 | Containerized Workers |
| [queues](./resources/commands/queues.md)                         | Cloudflare Queues     |
| [workflows](./resources/commands/workflows.md)                   | Workflows             |
| [pipelines](./resources/commands/pipelines.md)                   | Worker Pipelines      |
| [dispatch-namespace](./resources/commands/dispatch-namespace.md) | Dispatch namespaces   |

#### Certificate Commands

| Command                                                      | Description       |
| ------------------------------------------------------------ | ----------------- |
| [mtls-certificate](./resources/commands/mtls-certificate.md) | mTLS certificates |
| [cert](./resources/commands/cert.md)                         | TLS certificates  |

## Cookbook

<If: User needs to create a new Worker>

<Then: Use `wrangler init` to initialize the project, then `wrangler dev` for local development, and `wrangler deploy` to publish>

<Examples:>

```bash
# Create new Worker
npx wrangler init my-worker
cd my-worker

# Local development
npx wrangler dev

# Deploy to production
npx wrangler deploy
```

<If: User needs to manage secrets>

<Then: Use `wrangler secret put` for single secrets or `wrangler secret bulk` for multiple>

<Examples:>

```bash
# Add a single secret
npx wrangler secret put API_KEY

# Bulk upload secrets
echo '{"API_KEY":"value","DB_URL":"postgres://..."}' | npx wrangler secret bulk
```

<If: User needs to work with D1 database>

<Then: Create database with `wrangler d1 create`, execute SQL with `wrangler d1 execute`>

<Examples:>

```bash
# Create D1 database
npx wrangler d1 create my-database

# Execute SQL
npx wrangler d1 execute my-database --command "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)"

# Execute from file
npx wrangler d1 execute my-database --file ./schema.sql
```

<If: User needs to work with KV storage>

<Then: Create namespace with `wrangler kv namespace create`, manage keys with `kv key` commands>

<Examples:>

```bash
# Create KV namespace
npx wrangler kv namespace create MY_KV

# Put a value
npx wrangler kv key put --namespace-id <ID> "my-key" "my-value"

# Get a value
npx wrangler kv key get --namespace-id <ID> "my-key"
```

<If: User needs to work with R2 storage>

<Then: Create bucket with `wrangler r2 bucket create`, manage objects with `r2 object` commands>

<Examples:>

```bash
# Create R2 bucket
npx wrangler r2 bucket create my-bucket

# Upload file
npx wrangler r2 object put my-bucket/path/to/file.txt --file ./local-file.txt

# Download file
npx wrangler r2 object get my-bucket/path/to/file.txt --file ./downloaded.txt
```
