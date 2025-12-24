# `deployments`

Manage [Deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/) for your Worker.

## `deployments list`

List the 10 most recent Deployments of your Worker

```sh
npx wrangler deployments list
```

* `--name` string - Name of the Worker
* `--json` boolean default: false - Display output as clean JSON

## `deployments view`

View the details of a specific Deployment of your Worker

```sh
npx wrangler deployments view [DEPLOYMENT-ID]
```

* `[DEPLOYMENT-ID]` string - The ID of the Deployment to view (defaults to latest)
* `--name` string - Name of the Worker
* `--json` boolean default: false - Display output as clean JSON

## `deployments status`

Check the current Deployment status of your Worker

```sh
npx wrangler deployments status
```

* `--name` string - Name of the Worker
* `--json` boolean default: false - Display output as clean JSON

## Gradual Deployments

Use deployments to gradually roll out new versions of your Worker. Combined with the `versions` commands, you can:

1. Upload a new version: `wrangler versions upload`
2. View current deployment: `wrangler deployments view`
3. Create a new deployment with traffic split: `wrangler versions deploy`
4. Monitor and adjust: `wrangler deployments status`

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


