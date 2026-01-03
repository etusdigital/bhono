# `kv namespace`

Manage Workers KV namespaces.

> **Note:** The `kv ...` commands allow you to manage your Workers KV resources in the Cloudflare network. Learn more about using Workers KV with Wrangler in the [Workers KV guide](https://developers.cloudflare.com/kv/get-started/).

> **Warning:** Since version 3.60.0, Wrangler supports the `kv ...` syntax. If you are using versions below 3.60.0, the command follows the `kv:...` syntax. Learn more about the deprecation of the `kv:...` syntax in the [Wrangler commands](https://developers.cloudflare.com/kv/reference/kv-commands/#deprecations) for KV page.

## `kv namespace create`

Create a new namespace

- npm

  ```sh
  npx wrangler kv namespace create [NAMESPACE]
  ```

- pnpm

  ```sh
  pnpm wrangler kv namespace create [NAMESPACE]
  ```

- yarn

  ```sh
  yarn wrangler kv namespace create [NAMESPACE]
  ```

* `[NAMESPACE]` string required

  The name of the new namespace

* `--preview` boolean

  Interact with a preview namespace

* `--use-remote` boolean

  Use a remote binding when adding the newly created resource to your config

* `--update-config` boolean

  Automatically update your config file with the newly added resource

* `--binding` string

  The binding name of this resource in your Worker

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

## `kv namespace list`

Output a list of all KV namespaces associated with your account id

- npm

  ```sh
  npx wrangler kv namespace list
  ```

- pnpm

  ```sh
  pnpm wrangler kv namespace list
  ```

- yarn

  ```sh
  yarn wrangler kv namespace list
  ```

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

## `kv namespace delete`

Delete a given namespace.

- npm

  ```sh
  npx wrangler kv namespace delete
  ```

- pnpm

  ```sh
  pnpm wrangler kv namespace delete
  ```

- yarn

  ```sh
  yarn wrangler kv namespace delete
  ```

* `--binding` string

  The binding name to the namespace to delete from

* `--namespace-id` string

  The id of the namespace to delete

* `--preview` boolean

  Interact with a preview namespace

* `--skip-confirmation` boolean alias: --y default: false

  Skip confirmation

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

## `kv namespace rename`

Rename a KV namespace

- npm

  ```sh
  npx wrangler kv namespace rename [OLD-NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler kv namespace rename [OLD-NAME]
  ```

- yarn

  ```sh
  yarn wrangler kv namespace rename [OLD-NAME]
  ```

* `[OLD-NAME]` string

  The current name (title) of the namespace to rename

* `--namespace-id` string

  The id of the namespace to rename

* `--new-name` string required

  The new name for the namespace

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


