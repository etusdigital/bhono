# `docs`

Open the Cloudflare developer documentation in your default browser.

- npm

  ```sh
  npx wrangler docs [SEARCH]
  ```

- pnpm

  ```sh
  pnpm wrangler docs [SEARCH]
  ```

- yarn

  ```sh
  yarn wrangler docs [SEARCH]
  ```

* `[SEARCH]` string

  Enter search terms (e.g. the wrangler command) you want to know more about

* `--yes` boolean alias: --y

  Takes you to the docs, even if search fails

Global flags

- `--v` boolean alias: --version

  Show version number

- `--cwd` string

  Run as if Wrangler was started in the specified directory instead of the current working directory

- `--config` string alias: --c

  Path to Wrangler configuration file

- `--env` string alias: --e

  Environment to use for operations, and for selecting .env and .dev.vars files

- `--env-file` string

  Path to an .env file to load - can be specified multiple times - values from earlier files are overridden by values in later files

- `--experimental-provision` boolean aliases: --x-provision default: true

  Experimental: Enable automatic resource provisioning

- `--experimental-auto-create` boolean alias: --x-auto-create default: true

  Automatically provision draft bindings with new resources


