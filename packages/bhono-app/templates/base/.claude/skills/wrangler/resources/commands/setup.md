# `setup`

> **Experimental**

Setup a project to work on Cloudflare

- npm

  ```sh
  npx wrangler setup
  ```

- pnpm

  ```sh
  pnpm wrangler setup
  ```

- yarn

  ```sh
  yarn wrangler setup
  ```

* `--yes` boolean alias: --y default: false

  Answer "yes" to any prompts for configuring your project

* `--build` boolean default: false

  Run your project's build command once it has been configured

* `--dry-run` boolean

  Runs the command without applying any filesystem modifications

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


