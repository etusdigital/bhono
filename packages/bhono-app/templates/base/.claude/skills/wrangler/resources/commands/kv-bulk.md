# `kv bulk`

Manage multiple key-value pairs within a Workers KV namespace in batches.

> **Note:** The `kv ...` commands allow you to manage your Workers KV resources in the Cloudflare network. Learn more about using Workers KV with Wrangler in the [Workers KV guide](https://developers.cloudflare.com/kv/get-started/).

> **Warning:** Since version 3.60.0, Wrangler supports the `kv ...` syntax. If you are using versions below 3.60.0, the command follows the `kv:...` syntax. Learn more about the deprecation of the `kv:...` syntax in the [Wrangler commands](https://developers.cloudflare.com/kv/reference/kv-commands/) for KV page.

## `kv bulk get`

Gets multiple key-value pairs from a namespace

- npm

  ```sh
  npx wrangler kv bulk get [FILENAME]
  ```

- pnpm

  ```sh
  pnpm wrangler kv bulk get [FILENAME]
  ```

- yarn

  ```sh
  yarn wrangler kv bulk get [FILENAME]
  ```

* `[FILENAME]` string required

  The file containing the keys to get

* `--binding` string

  The binding name to the namespace to get from

* `--namespace-id` string

  The id of the namespace to get from

* `--preview` boolean default: false

  Interact with a preview namespace

* `--local` boolean

  Interact with local storage

* `--remote` boolean

  Interact with remote storage

* `--persist-to` string

  Directory for local persistence

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

## `kv bulk put`

Upload multiple key-value pairs to a namespace

- npm

  ```sh
  npx wrangler kv bulk put [FILENAME]
  ```

- pnpm

  ```sh
  pnpm wrangler kv bulk put [FILENAME]
  ```

- yarn

  ```sh
  yarn wrangler kv bulk put [FILENAME]
  ```

* `[FILENAME]` string required

  The file containing the key/value pairs to write

* `--binding` string

  The binding name to the namespace to write to

* `--namespace-id` string

  The id of the namespace to write to

* `--preview` boolean

  Interact with a preview namespace

* `--ttl` number

  Time for which the entries should be visible

* `--expiration` number

  Time since the UNIX epoch after which the entry expires

* `--metadata` string

  Arbitrary JSON that is associated with a key

* `--local` boolean

  Interact with local storage

* `--remote` boolean

  Interact with remote storage

* `--persist-to` string

  Directory for local persistence

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

## `kv bulk delete`

Delete multiple key-value pairs from a namespace

- npm

  ```sh
  npx wrangler kv bulk delete [FILENAME]
  ```

- pnpm

  ```sh
  pnpm wrangler kv bulk delete [FILENAME]
  ```

- yarn

  ```sh
  yarn wrangler kv bulk delete [FILENAME]
  ```

* `[FILENAME]` string required

  The file containing the keys to delete

* `--force` boolean alias: --f

  Do not ask for confirmation before deleting

* `--binding` string

  The binding name to the namespace to delete from

* `--namespace-id` string

  The id of the namespace to delete from

* `--preview` boolean

  Interact with a preview namespace

* `--local` boolean

  Interact with local storage

* `--remote` boolean

  Interact with remote storage

* `--persist-to` string

  Directory for local persistence

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


