# `types`

Generate TypeScript types from bindings and module rules in your Wrangler configuration file.

```sh
npx wrangler types [PATH]
```

* `[PATH]` string - Path to the output file (defaults to `worker-configuration.d.ts`)
* `--experimental-include-runtime` boolean alias: --x-include-runtime - Experimental: Include types for the Workers runtime

## Usage

When you run `wrangler types`, it reads your `wrangler.toml` configuration and generates TypeScript type definitions for all your bindings.

Example:

```sh
# Generate types to default location
npx wrangler types

# Generate types to custom location
npx wrangler types ./src/types/env.d.ts
```

## Generated Types

The command generates type definitions for:
- KV namespaces
- R2 buckets
- D1 databases
- Durable Objects
- Queues
- Service bindings
- Secret variables
- Environment variables
- AI bindings
- Vectorize indexes
- Hyperdrive configurations

## Example Output

```typescript
interface Env {
  // KV Namespace
  MY_KV: KVNamespace;
  
  // R2 Bucket
  MY_BUCKET: R2Bucket;
  
  // D1 Database
  DB: D1Database;
  
  // Durable Object
  MY_DO: DurableObjectNamespace;
  
  // Queue
  MY_QUEUE: Queue;
  
  // Secret
  API_KEY: string;
}
```

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


