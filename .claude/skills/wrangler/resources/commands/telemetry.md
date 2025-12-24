# `telemetry`

Manage Wrangler telemetry settings.

Wrangler collects anonymous usage data to improve the CLI experience. You can control this behavior using these commands.

## `telemetry status`

Check the current telemetry status

```sh
npx wrangler telemetry status
```

## `telemetry disable`

Disable telemetry collection

```sh
npx wrangler telemetry disable
```

## `telemetry enable`

Enable telemetry collection

```sh
npx wrangler telemetry enable
```

## What Data is Collected

When enabled, Wrangler collects:
- Command usage statistics
- Error rates and types
- Feature usage patterns
- Performance metrics

Data collected is:
- Fully anonymized
- Not linked to any personal information
- Used only to improve Wrangler

## Alternative Methods

You can also control telemetry via environment variables:

```sh
# Disable telemetry
export WRANGLER_SEND_METRICS=false

# Or in your shell profile
echo 'export WRANGLER_SEND_METRICS=false' >> ~/.zshrc
```

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


