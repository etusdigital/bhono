# `check`

Validate your Worker and configuration for deployment readiness.

```sh
npx wrangler check
```

## What It Checks

The `check` command validates:

### Configuration
- `wrangler.toml` syntax and structure
- Binding configurations
- Environment settings
- Route configurations

### Worker Code
- JavaScript/TypeScript syntax
- Module resolution
- Import/export statements
- Compatibility flags usage

### Bindings
- KV namespace existence
- R2 bucket existence
- D1 database existence
- Durable Object configurations
- Queue configurations

### Limits
- Script size limits
- Binding count limits
- Memory limits

## Example Output

```sh
$ npx wrangler check

✓ wrangler.toml is valid
✓ Worker code compiles successfully
✓ All bindings are properly configured
✓ Route configuration is valid

Your Worker is ready for deployment!
```

## Common Issues Detected

- Missing required fields in wrangler.toml
- Invalid binding names
- Non-existent resources
- Compatibility flag conflicts
- Script size exceeds limits

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


