# Wrangler Commands Reference

This is an index of all Wrangler CLI commands. Each command has its own dedicated documentation file with detailed usage, options, and examples.

> **Wrangler Version:** These commands require Wrangler 3.x or later. Always use `npx wrangler@latest` to ensure you have the latest version.

## Getting Started

| Command | Description |
|---------|-------------|
| [How to Run](./commands/how-to-run.md) | How to run Wrangler commands (npx, pnpm, yarn) |
| [docs](./commands/docs.md) | Open Wrangler's command documentation in your browser |
| [init](./commands/init.md) | Initialize a Worker project |
| [login](./commands/login.md) | Authorize Wrangler with your Cloudflare account |
| [logout](./commands/logout.md) | Remove Wrangler's authorization |
| [whoami](./commands/whoami.md) | Retrieve your user information |

## Development & Deployment

| Command | Description |
|---------|-------------|
| [dev](./commands/dev.md) | Start a local development server |
| [deploy](./commands/deploy.md) | Deploy your Worker to Cloudflare |
| [delete](./commands/delete.md) | Delete your Worker from Cloudflare |
| [tail](./commands/tail.md) | Start a log tailing session |
| [check](./commands/check.md) | Validate your Worker and configuration |

## Containers (Beta)

| Command | Description |
|---------|-------------|
| [containers](./commands/containers.md) | Manage containerized Workers |

## Versioning & Deployments

| Command | Description |
|---------|-------------|
| [versions](./commands/versions.md) | Manage Worker Versions for Gradual Deployments |
| [deployments](./commands/deployments.md) | Manage Deployments for your Worker |
| [rollback](./commands/rollback.md) | Rollback to a previous Deployment |
| [triggers](./commands/triggers.md) | Update triggers (cron/routes) of your deployment |

## Storage: D1 (SQL Database)

| Command | Description |
|---------|-------------|
| [d1](./commands/d1.md) | Manage Cloudflare D1 databases |

## Storage: KV (Key-Value)

| Command | Description |
|---------|-------------|
| [kv namespace](./commands/kv-namespace.md) | Manage KV namespaces |
| [kv key](./commands/kv-key.md) | Manage KV keys and values |
| [kv bulk](./commands/kv-bulk.md) | Bulk operations for KV |

## Storage: R2 (Object Storage)

| Command | Description |
|---------|-------------|
| [r2 bucket](./commands/r2-bucket.md) | Manage R2 buckets |
| [r2 object](./commands/r2-object.md) | Manage R2 objects |
| [r2 sql](./commands/r2-sql.md) | Query R2 with SQL (Super Slurper) |

## AI & Vector Search

| Command | Description |
|---------|-------------|
| [vectorize](./commands/vectorize.md) | Manage Vectorize indexes |

## Database Acceleration

| Command | Description |
|---------|-------------|
| [hyperdrive](./commands/hyperdrive.md) | Manage Hyperdrive configurations |

## Secrets & Configuration

| Command | Description |
|---------|-------------|
| [secret](./commands/secret.md) | Manage Worker secrets |
| [secrets-store secret](./commands/secrets-store-secret.md) | Manage secrets within a Secrets Store |
| [secrets-store store](./commands/secrets-store-store.md) | Manage Secrets Store stores |

## Cloudflare Pages

| Command | Description |
|---------|-------------|
| [pages](./commands/pages.md) | Configure Cloudflare Pages |

## Queues & Workflows

| Command | Description |
|---------|-------------|
| [queues](./commands/queues.md) | Manage Cloudflare Queues |
| [workflows](./commands/workflows.md) | Manage Workflows |
| [pipelines](./commands/pipelines.md) | Manage Worker Pipelines (Beta) |

## Workers for Platforms

| Command | Description |
|---------|-------------|
| [dispatch-namespace](./commands/dispatch-namespace.md) | Manage dispatch namespaces |

## Certificates

| Command | Description |
|---------|-------------|
| [mtls-certificate](./commands/mtls-certificate.md) | Manage mTLS certificates |
| [cert](./commands/cert.md) | Manage TLS certificates for custom domains |

## Utilities

| Command | Description |
|---------|-------------|
| [setup](./commands/setup.md) | Configure project interactively |
| [types](./commands/types.md) | Generate TypeScript types from bindings |
| [telemetry](./commands/telemetry.md) | Manage Wrangler telemetry settings |

## Global Flags

All Wrangler commands support these global flags:

| Flag | Description |
|------|-------------|
| `--v, --version` | Show version number |
| `--cwd` | Run as if Wrangler was started in the specified directory |
| `--config, -c` | Path to Wrangler configuration file |
| `--env, -e` | Environment to use for operations |
| `--env-file` | Path to an .env file to load |
| `--experimental-provision, --x-provision` | Enable automatic resource provisioning |
| `--experimental-auto-create, --x-auto-create` | Automatically provision draft bindings |

## Resources

- [Official Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Wrangler CI/CD](https://developers.cloudflare.com/workers/wrangler/ci-cd/)
