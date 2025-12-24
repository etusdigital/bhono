# `vectorize`

Interact with a [Vectorize](https://developers.cloudflare.com/vectorize/) vector database.

## `vectorize create`

Create a Vectorize index

- npm

  ```sh
  npx wrangler vectorize create [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize create [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize create [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index to create (must be unique).

* `--dimensions` number

  The dimension size to configure this index for, based on the output dimensions of your ML model.

* `--metric` string

  The distance metric to use for searching within the index.

* `--preset` string

  The name of an preset representing an embeddings model: Vectorize will configure the dimensions and distance metric for you when provided.

* `--description` string

  An optional description for this index.

* `--json` boolean default: false

  Return output as clean JSON

* `--deprecated-v1` boolean default: false

  Create a deprecated Vectorize V1 index. This is not recommended and indexes created with this option need all other Vectorize operations to have this option enabled.

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

## `vectorize delete`

Delete a Vectorize index

- npm

  ```sh
  npx wrangler vectorize delete [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize delete [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize delete [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index

* `--force` boolean alias: --y default: false

  Skip confirmation

* `--deprecated-v1` boolean default: false

  Delete a deprecated Vectorize V1 index.

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

## `vectorize get`

Get a Vectorize index by name

- npm

  ```sh
  npx wrangler vectorize get [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize get [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize get [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index.

* `--json` boolean default: false

  Return output as clean JSON

* `--deprecated-v1` boolean default: false

  Fetch a deprecated V1 Vectorize index. This must be enabled if the index was created with V1 option.

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

## `vectorize list`

List your Vectorize indexes

- npm

  ```sh
  npx wrangler vectorize list
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize list
  ```

- yarn

  ```sh
  yarn wrangler vectorize list
  ```

* `--json` boolean default: false

  Return output as clean JSON

* `--deprecated-v1` boolean default: false

  List deprecated Vectorize V1 indexes for your account.

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

## `vectorize list-vectors`

List vector identifiers in a Vectorize index

- npm

  ```sh
  npx wrangler vectorize list-vectors [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize list-vectors [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize list-vectors [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index

* `--count` number

  Maximum number of vectors to return (1-1000)

* `--cursor` string

  Cursor for pagination to get the next page of results

* `--json` boolean default: false

  Return output as clean JSON

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

## `vectorize query`

Query a Vectorize index

- npm

  ```sh
  npx wrangler vectorize query [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize query [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize query [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index

* `--vector` number

  Vector to query the Vectorize Index

* `--vector-id` string

  Identifier for a vector in the index against which the index should be queried

* `--top-k` number default: 5

  The number of results (nearest neighbors) to return

* `--return-values` boolean default: false

  Specify if the vector values should be included in the results

* `--return-metadata` string default: none

  Specify if the vector metadata should be included in the results

* `--namespace` string

  Filter the query results based on this namespace

* `--filter` string

  Filter the query results based on this metadata filter.

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

## `vectorize insert`

Insert vectors into a Vectorize index

- npm

  ```sh
  npx wrangler vectorize insert [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize insert [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize insert [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index.

* `--file` string required

  A file containing line separated json (ndjson) vector objects.

* `--batch-size` number default: 1000

  Number of vector records to include when sending to the Cloudflare API.

* `--json` boolean default: false

  return output as clean JSON

* `--deprecated-v1` boolean default: false

  Insert into a deprecated V1 Vectorize index. This must be enabled if the index was created with the V1 option.

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

## `vectorize upsert`

Upsert vectors into a Vectorize index

- npm

  ```sh
  npx wrangler vectorize upsert [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize upsert [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize upsert [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index.

* `--file` string required

  A file containing line separated json (ndjson) vector objects.

* `--batch-size` number default: 5000

  Number of vector records to include in a single upsert batch when sending to the Cloudflare API.

* `--json` boolean default: false

  return output as clean JSON

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

## `vectorize get-vectors`

Get vectors from a Vectorize index

- npm

  ```sh
  npx wrangler vectorize get-vectors [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize get-vectors [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize get-vectors [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index.

* `--ids` string required

  Vector identifiers to be fetched from the Vectorize Index. Example: `--ids a 'b' 1 '2'`

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

## `vectorize delete-vectors`

Delete vectors in a Vectorize index

- npm

  ```sh
  npx wrangler vectorize delete-vectors [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize delete-vectors [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize delete-vectors [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index.

* `--ids` string required

  Vector identifiers to be deleted from the Vectorize Index. Example: `--ids a 'b' 1 '2'`

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

## `vectorize info`

Get additional details about the index

- npm

  ```sh
  npx wrangler vectorize info [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize info [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize info [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index.

* `--json` boolean default: false

  return output as clean JSON

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

## `vectorize create-metadata-index`

Enable metadata filtering on the specified property

- npm

  ```sh
  npx wrangler vectorize create-metadata-index [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize create-metadata-index [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize create-metadata-index [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index.

* `--propertyName` string required

  The name of the metadata property to index.

* `--type` string required

  The type of metadata property to index. Valid types are 'string', 'number' and 'boolean'.

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

## `vectorize list-metadata-index`

List metadata properties on which metadata filtering is enabled

- npm

  ```sh
  npx wrangler vectorize list-metadata-index [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize list-metadata-index [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize list-metadata-index [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index.

* `--json` boolean default: false

  return output as clean JSON

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

## `vectorize delete-metadata-index`

Delete metadata indexes

- npm

  ```sh
  npx wrangler vectorize delete-metadata-index [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler vectorize delete-metadata-index [NAME]
  ```

- yarn

  ```sh
  yarn wrangler vectorize delete-metadata-index [NAME]
  ```

* `[NAME]` string required

  The name of the Vectorize index.

* `--propertyName` string required

  The name of the metadata property to index.

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


