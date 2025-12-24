# `rollback`

Rollback to a specified Deployment by ID, or to the previous Deployment if no ID is provided.

```sh
npx wrangler rollback [DEPLOYMENT-ID]
```

* `[DEPLOYMENT-ID]` string - The ID of the deployment to rollback to
* `--name` string - Name of the Worker
* `--message` string - A message for this rollback

If a DEPLOYMENT-ID is not provided, the command will rollback to the previous successful deployment.

## Example

```sh
# Rollback to previous deployment
npx wrangler rollback

# Rollback to specific deployment
npx wrangler rollback 12345678-abcd-1234-efgh-123456789012
```

## Important Notes

- Rollback creates a new Deployment with the same Versions as the target Deployment
- All traffic will be immediately switched to the rollback Deployment
- The rollback is recorded with the optional message you provide
- Use `wrangler deployments list` to find available Deployment IDs

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


