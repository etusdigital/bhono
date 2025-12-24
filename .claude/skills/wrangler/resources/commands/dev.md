# `dev`

Start a local server for developing your Worker.

```txt
wrangler dev [<SCRIPT>] [OPTIONS]
```

> **Note:** None of the options for this command are required. Many of these options can be set in your Wrangler file. Refer to the [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration) documentation for more information.

- `SCRIPT` string

  - The path to an entry point for your Worker. Only required if your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) does not include a `main` key (for example, `main = "index.js"`).

- `--name` string optional

  - Name of the Worker.

- `--config`, `-c` string[] optional

  - Path(s) to [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/). If not provided, Wrangler will use the nearest config file based on your current working directory.
  - You can provide multiple configuration files to run multiple Workers in one dev session like this: `wrangler dev -c ./wrangler.toml -c ../other-worker/wrangler.toml`. The first config will be treated as the _primary_ Worker, which will be exposed over HTTP. The remaining config files will only be accessible via a service binding from the primary Worker.

- `--no-bundle` boolean (default: false) optional

  - Skip Wrangler's build steps. Particularly useful when using custom builds. Refer to [Bundling](https://developers.cloudflare.com/workers/wrangler/bundling/) for more information.

- `--env` string optional

  - Perform on a specific environment.

- `--compatibility-date` string optional

  - A date in the form yyyy-mm-dd, which will be used to determine which version of the Workers runtime is used.

- `--compatibility-flags`, `--compatibility-flag` string[] optional

  - Flags to use for compatibility checks.

- `--latest` boolean (default: true) optional

  - Use the latest version of the Workers runtime.

- `--ip` string optional

  - IP address to listen on, defaults to `localhost`.

- `--port` number optional

  - Port to listen on.

- `--inspector-port` number optional

  - Port for devtools to connect to.

- `--routes`, `--route` string[] optional

  - Routes to upload.
  - For example: `--route example.com/*`.

- `--host` string optional

  - Host to forward requests to, defaults to the zone of project.

- `--local-protocol` 'http'|'https' (default: http) optional

  - Protocol to listen to requests on.

- `--https-key-path` string optional

  - Path to a custom certificate key.

- `--https-cert-path` string optional

  - Path to a custom certificate.

- `--local-upstream` string optional

  - Host to act as origin in local mode, defaults to `dev.host` or route.

- `--assets` string optional (beta)

  - Folder of static assets to be served. Replaces [Workers Sites](https://developers.cloudflare.com/workers/configuration/sites/). Visit [assets](https://developers.cloudflare.com/workers/static-assets/) for more information.

- `--site` string optional (deprecated, use `--assets`)

  - Folder of static assets for Workers Sites.

  > **Warning:** Workers Sites is deprecated. Please use [Workers Assets](https://developers.cloudflare.com/workers/static-assets/) or [Pages](https://developers.cloudflare.com/pages/).

- `--site-include` string[] optional (deprecated)

  - Array of `.gitignore`-style patterns that match file or directory names from the sites directory. Only matched items will be uploaded.

- `--site-exclude` string[] optional (deprecated)

  - Array of `.gitignore`-style patterns that match file or directory names from the sites directory. Matched items will not be uploaded.

- `--upstream-protocol` 'http'|'https' (default: https) optional

  - Protocol to forward requests to host on.

- `--var` key:value[] optional

  - Array of `key:value` pairs to inject as variables into your code. The value will always be passed as a string to your Worker.
  - For example, `--var "git_hash:'$(git rev-parse HEAD)'" "test:123"` makes the `git_hash` and `test` variables available in your Worker's `env`.
  - This flag is an alternative to defining [`vars`](https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys) in your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/). If defined in both places, this flag's values will be used.

- `--define` key:value[] optional

  - Array of `key:value` pairs to replace global identifiers in your code.
  - For example, `--define "GIT_HASH:'$(git rev-parse HEAD)'"` will replace all uses of `GIT_HASH` with the actual value at build time.
  - This flag is an alternative to defining [`define`](https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys) in your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/). If defined in both places, this flag's values will be used.

- `--tsconfig` string optional

  - Path to a custom `tsconfig.json` file.

- `--minify` boolean optional

  - Minify the Worker.

- `--persist-to` string optional

  - Specify directory to use for local persistence.

- `--remote` boolean (default: false) optional

  - Develop against remote resources and data stored on Cloudflare's network.

- `--test-scheduled` boolean (default: false) optional

  - Exposes a `/__scheduled` fetch route which will trigger a scheduled event (Cron Trigger) for testing during development. To simulate different cron patterns, a `cron` query parameter can be passed in: `/__scheduled?cron=*+*+*+*+*` or `/cdn-cgi/handler/scheduled?cron=*+*+*+*+*`.

- `--log-level` 'debug'|'info'|'log'|'warn'|'error|'none' (default: log) optional

  - Specify Wrangler's logging level.

- `--show-interactive-dev-session` boolean (default: true if the terminal supports interactivity) optional

  - Show the interactive dev session.

- `--alias` Array<string>
  - Specify modules to alias using [module aliasing](https://developers.cloudflare.com/workers/wrangler/configuration/#module-aliasing).

The following global flags work on every command:

- `--help` boolean
  - Show help.
- `--config` string (not supported by Pages)
  - Path to your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/).
- `--cwd` string
  - Run as if Wrangler was started in the specified directory instead of the current working directory.

`wrangler dev` is a way to [locally test](https://developers.cloudflare.com/workers/development-testing/) your Worker while developing. With `wrangler dev` running, send HTTP requests to `localhost:8787` and your Worker should execute as expected. You will also see `console.log` messages and exceptions appearing in your terminal.


