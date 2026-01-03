# `pages`

Configure Cloudflare Pages.

## `pages dev`

Develop your full-stack Pages application locally

```sh
npx wrangler pages dev [DIRECTORY] [COMMAND]
```

* `[DIRECTORY]` string - The directory of static assets to serve
* `[COMMAND]` string - The proxy command to run [deprecated]
* `--compatibility-date` string - Date to use for compatibility checks
* `--compatibility-flags` string - Flags to use for compatibility checks
* `--ip` string - The IP address to listen on
* `--port` number - The port to listen on
* `--inspector-port` number - Port for devtools to connect to
* `--proxy` number - The port to proxy
* `--script-path` string - Location of the single Worker script [default: _worker.js]
* `--no-bundle` boolean - Whether to run bundling on `_worker.js`
* `--binding` array - Bind variable/secret (KEY=VALUE)
* `--kv` array - KV namespace to bind
* `--d1` array - D1 database to bind
* `--do` array - Durable Object to bind
* `--r2` array - R2 bucket to bind
* `--ai` string - AI to bind
* `--service` array - Service to bind
* `--live-reload` boolean default: false - Auto reload HTML pages on change
* `--local-protocol` "http" | "https" - Protocol to listen to requests on
* `--persist-to` string - Directory for local persistence

## `pages functions build`

Compile a folder of Pages Functions into a single Worker

```sh
npx wrangler pages functions build [DIRECTORY]
```

* `[DIRECTORY]` string default: functions - The directory of Pages Functions
* `--outfile` string - The location of the output Worker script
* `--outdir` string - Output directory for the bundled Worker
* `--minify` boolean default: false - Minify the output Worker script
* `--sourcemap` boolean default: false - Generate a sourcemap
* `--watch` boolean default: false - Watch for changes and automatically rebuild

## `pages project list`

List your Cloudflare Pages projects

```sh
npx wrangler pages project list
```

## `pages project create`

Create a new Cloudflare Pages project

```sh
npx wrangler pages project create [PROJECT-NAME]
```

* `[PROJECT-NAME]` string required - The name of your Pages project
* `--production-branch` string - The name of the production branch

## `pages project delete`

Delete a Cloudflare Pages project

```sh
npx wrangler pages project delete [PROJECT-NAME]
```

* `[PROJECT-NAME]` string required - The name of your Pages project
* `--yes` boolean - Answer "yes" to confirm project deletion

## `pages deployment list`

List deployments in your Cloudflare Pages project

```sh
npx wrangler pages deployment list
```

* `--project-name` string - The name of the project
* `--environment` string - Environment type to list deployments for
* `--json` boolean default: false - Return output as clean JSON

## `pages deployment tail`

Start a tailing session for a project's deployment

```sh
npx wrangler pages deployment tail [DEPLOYMENT]
```

* `[DEPLOYMENT]` string - ID or URL of the deployment to tail
* `--project-name` string - The name of the project
* `--environment` string default: production - Environment (production or preview)
* `--format` string - The format of log entries
* `--status` string - Filter by invocation status

## `pages deploy`

Deploy a directory of static assets as a Pages deployment

```sh
npx wrangler pages deploy [DIRECTORY]
```

* `[DIRECTORY]` string - The directory of static files to upload
* `--project-name` string - The name of the project you want to deploy to
* `--branch` string - The name of the branch you want to deploy to
* `--commit-hash` string - The SHA to attach to this deployment
* `--commit-message` string - The commit message to attach to this deployment
* `--skip-caching` boolean - Skip asset caching which speeds up builds
* `--no-bundle` boolean - Whether to run bundling on `_worker.js`
* `--upload-source-maps` boolean default: false - Upload server-side sourcemaps

## `pages secret put`

Create or update a secret variable for a Pages project

```sh
npx wrangler pages secret put [KEY]
```

* `[KEY]` string required - The variable name
* `--project-name` string - The name of your Pages project

## `pages secret bulk`

Bulk upload secrets for a Pages project

```sh
npx wrangler pages secret bulk [FILE]
```

## `pages secret delete`

Delete a secret variable from a Pages project

```sh
npx wrangler pages secret delete [KEY]
```

## `pages secret list`

List all secrets for a Pages project

```sh
npx wrangler pages secret list
```

## `pages download config`

> Experimental

Download your Pages project config as a Wrangler configuration file

```sh
npx wrangler pages download config [PROJECTNAME]
```

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


