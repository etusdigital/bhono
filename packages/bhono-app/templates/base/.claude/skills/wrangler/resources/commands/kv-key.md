# `kv key`

Manage key-value pairs within a Workers KV namespace.

> **Note:** The `kv ...` commands allow you to manage your Workers KV resources in the Cloudflare network. Learn more about using Workers KV with Wrangler in the [Workers KV guide](https://developers.cloudflare.com/kv/get-started/).

> **Warning:** Since version 3.60.0, Wrangler supports the `kv ...` syntax. If you are using versions below 3.60.0, the command follows the `kv:...` syntax. Learn more about the deprecation of the `kv:...` syntax in the [Wrangler commands](https://developers.cloudflare.com/kv/reference/kv-commands/) for KV page.

## `kv key put`

Write a single key/value pair to the given namespace

- npm

  ```sh
  npx wrangler kv key put [KEY] [VALUE]
  ```

- pnpm

  ```sh
  pnpm wrangler kv key put [KEY] [VALUE]
  ```

- yarn

  ```sh
  yarn wrangler kv key put [KEY] [VALUE]
  ```

* `[KEY]` string required

  The key to write to

* `[VALUE]` string

  The value to write

* `--path` string

  Read value from the file at a given path

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

## `kv key list`

Output a list of all keys in a given namespace

- npm

  ```sh
  npx wrangler kv key list
  ```

- pnpm

  ```sh
  pnpm wrangler kv key list
  ```

- yarn

  ```sh
  yarn wrangler kv key list
  ```

* `--binding` string

  The binding name to the namespace to list

* `--namespace-id` string

  The id of the namespace to list

* `--preview` boolean default: false

  Interact with a preview namespace

* `--prefix` string

  A prefix to filter listed keys

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

## `kv key get`

Read a single value by key from the given namespace

- npm

  ```sh
  npx wrangler kv key get [KEY]
  ```

- pnpm

  ```sh
  pnpm wrangler kv key get [KEY]
  ```

- yarn

  ```sh
  yarn wrangler kv key get [KEY]
  ```

* `[KEY]` string required

  The key value to get.

* `--text` boolean default: false

  Decode the returned value as a utf8 string

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

## `kv key delete`

Remove a single key value pair from the given namespace

- npm

  ```sh
  npx wrangler kv key delete [KEY]
  ```

- pnpm

  ```sh
  pnpm wrangler kv key delete [KEY]
  ```

- yarn

  ```sh
  yarn wrangler kv key delete [KEY]
  ```

* `[KEY]` string required

  The key value to delete.

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


