# `versions`

Manage Worker Versions for [Gradual Deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/).

## `versions upload`

Upload a new Version of your Worker

```sh
npx wrangler versions upload
```

* `--tag` string - A tag for this Worker Version
* `--message` string - A message for this Worker Version
* `--name` string - Name of the Worker
* `--dry-run` boolean default: false - Don't actually deploy
* `--experimental-auto-create` boolean default: true - Automatically provision bindings
* `--minify` boolean - Minify the Worker
* `--outdir` string - Output directory for the bundled Worker
* `--upload-source-maps` boolean default: false - Upload any server-side sourcemaps

## `versions list`

List the 10 most recent Versions of your Worker

```sh
npx wrangler versions list
```

* `--name` string - Name of the Worker
* `--json` boolean default: false - Display output as clean JSON

## `versions view`

View the details of a specific Version of your Worker

```sh
npx wrangler versions view [VERSION-ID]
```

* `[VERSION-ID]` string - The ID of the Worker Version (defaults to latest)
* `--name` string - Name of the Worker
* `--json` boolean default: false - Display output as clean JSON

## `versions secret put`

Create or update a secret variable for a specific Version of a Worker

```sh
npx wrangler versions secret put [KEY]
```

* `[KEY]` string required - The variable name to be accessible in the Worker
* `--name` string - Name of the Worker
* `--message` string - Description of this new Version
* `--tag` string - A tag for this Version

## `versions secret bulk`

Bulk upload secrets for a specific Version of a Worker

```sh
npx wrangler versions secret bulk [JSON]
```

* `[JSON]` string - The JSON file of key-value pairs to upload
* `--name` string - Name of the Worker
* `--message` string - Description of this new Version
* `--tag` string - A tag for this Version

## `versions secret delete`

Delete a secret variable from a specific Version of a Worker

```sh
npx wrangler versions secret delete [KEY]
```

## `versions secret list`

List all secrets for a Worker

```sh
npx wrangler versions secret list
```

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


