# `r2 sql`

> **Note:** R2 SQL is currently in open beta. Report R2 SQL bugs in [GitHub](https://github.com/cloudflare/workers-sdk/issues/new/choose). R2 SQL expects there to be a [`WRANGLER_R2_SQL_AUTH_TOKEN`](https://developers.cloudflare.com/r2-sql/query-data/#authentication) environment variable to be set.

## `r2 sql query`

Execute SQL query against R2 Data Catalog

- npm

  ```sh
  npx wrangler r2 sql query [WAREHOUSE] [QUERY]
  ```

- pnpm

  ```sh
  pnpm wrangler r2 sql query [WAREHOUSE] [QUERY]
  ```

- yarn

  ```sh
  yarn wrangler r2 sql query [WAREHOUSE] [QUERY]
  ```

* `[WAREHOUSE]` string required

  R2 Data Catalog warehouse name

* `[QUERY]` string required

  The SQL query to execute

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


