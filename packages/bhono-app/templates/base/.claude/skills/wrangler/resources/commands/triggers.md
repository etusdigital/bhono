# `triggers`

Update the triggers of your current deployment.

## `triggers deploy`

Update the triggers of an existing Worker

```sh
npx wrangler triggers deploy
```

* `--name` string - Name of the Worker
* `--triggers` array - Cron schedules to attach
* `--routes` array - Routes to attach
* `--dry-run` boolean default: false - Don't actually deploy
* `--json` boolean default: false - Display output as clean JSON

This command updates the triggers for your currently deployed Worker. Use this when you need to modify cron schedules or routes without redeploying your Worker code.

Example:

```sh
# Add cron triggers
npx wrangler triggers deploy --triggers "*/5 * * * *" --triggers "0 12 * * MON"

# Update routes
npx wrangler triggers deploy --routes "example.com/*" --routes "api.example.com/*"
```

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


