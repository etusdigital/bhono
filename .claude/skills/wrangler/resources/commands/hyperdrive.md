# `hyperdrive`

Manage [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) database configurations.

## `hyperdrive create`

Create a Hyperdrive config

- npm

  ```sh
  npx wrangler hyperdrive create [NAME]
  ```

- pnpm

  ```sh
  pnpm wrangler hyperdrive create [NAME]
  ```

- yarn

  ```sh
  yarn wrangler hyperdrive create [NAME]
  ```

* `[NAME]` string required

  The name of the Hyperdrive config

* `--connection-string` string

  The connection string for the database you want Hyperdrive to connect to - ex: protocol://user:password\@host:port/database

* `--origin-host` string alias: --host

  The host of the origin database

* `--origin-port` number alias: --port

  The port number of the origin database

* `--origin-scheme` string alias: --scheme default: postgresql

  The scheme used to connect to the origin database

* `--database` string

  The name of the database within the origin database

* `--origin-user` string alias: --user

  The username used to connect to the origin database

* `--origin-password` string alias: --password

  The password used to connect to the origin database

* `--access-client-id` string

  The Client ID of the Access token to use when connecting to the origin database

* `--access-client-secret` string

  The Client Secret of the Access token to use when connecting to the origin database

* `--caching-disabled` boolean

  Disables the caching of SQL responses

* `--max-age` number

  Specifies max duration for which items should persist in the cache, cannot be set when caching is disabled

* `--swr` number

  Indicates the number of seconds cache may serve the response after it becomes stale, cannot be set when caching is disabled

* `--ca-certificate-id` string alias: --ca-certificate-uuid

  Sets custom CA certificate when connecting to origin database. Must be valid UUID of already uploaded CA certificate.

* `--mtls-certificate-id` string alias: --mtls-certificate-uuid

  Sets custom mTLS client certificates when connecting to origin database. Must be valid UUID of already uploaded public/private key certificates.

* `--sslmode` string

  Sets CA sslmode for connecting to database.

* `--origin-connection-limit` number

  The (soft) maximum number of connections that Hyperdrive may establish to the origin database

* `--binding` string

  The binding name of this resource in your Worker

* `--use-remote` boolean

  Use a remote binding when adding the newly created resource to your config

* `--update-config` boolean

  Automatically update your config file with the newly added resource

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

## `hyperdrive delete`

Delete a Hyperdrive config

- npm

  ```sh
  npx wrangler hyperdrive delete [ID]
  ```

- pnpm

  ```sh
  pnpm wrangler hyperdrive delete [ID]
  ```

- yarn

  ```sh
  yarn wrangler hyperdrive delete [ID]
  ```

* `[ID]` string required

  The ID of the Hyperdrive config

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

## `hyperdrive get`

Get a Hyperdrive config

- npm

  ```sh
  npx wrangler hyperdrive get [ID]
  ```

- pnpm

  ```sh
  pnpm wrangler hyperdrive get [ID]
  ```

- yarn

  ```sh
  yarn wrangler hyperdrive get [ID]
  ```

* `[ID]` string required

  The ID of the Hyperdrive config

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

## `hyperdrive list`

List Hyperdrive configs

- npm

  ```sh
  npx wrangler hyperdrive list
  ```

- pnpm

  ```sh
  pnpm wrangler hyperdrive list
  ```

- yarn

  ```sh
  yarn wrangler hyperdrive list
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

## `hyperdrive update`

Update a Hyperdrive config

- npm

  ```sh
  npx wrangler hyperdrive update [ID]
  ```

- pnpm

  ```sh
  pnpm wrangler hyperdrive update [ID]
  ```

- yarn

  ```sh
  yarn wrangler hyperdrive update [ID]
  ```

* `[ID]` string required

  The ID of the Hyperdrive config

* `--name` string

  Give your config a new name

* `--connection-string` string

  The connection string for the database you want Hyperdrive to connect to - ex: protocol://user:password\@host:port/database

* `--origin-host` string alias: --host

  The host of the origin database

* `--origin-port` number alias: --port

  The port number of the origin database

* `--origin-scheme` string alias: --scheme

  The scheme used to connect to the origin database

* `--database` string

  The name of the database within the origin database

* `--origin-user` string alias: --user

  The username used to connect to the origin database

* `--origin-password` string alias: --password

  The password used to connect to the origin database

* `--access-client-id` string

  The Client ID of the Access token to use when connecting to the origin database

* `--access-client-secret` string

  The Client Secret of the Access token to use when connecting to the origin database

* `--caching-disabled` boolean

  Disables the caching of SQL responses

* `--max-age` number

  Specifies max duration for which items should persist in the cache, cannot be set when caching is disabled

* `--swr` number

  Indicates the number of seconds cache may serve the response after it becomes stale, cannot be set when caching is disabled

* `--ca-certificate-id` string alias: --ca-certificate-uuid

  Sets custom CA certificate when connecting to origin database. Must be valid UUID of already uploaded CA certificate.

* `--mtls-certificate-id` string alias: --mtls-certificate-uuid

  Sets custom mTLS client certificates when connecting to origin database. Must be valid UUID of already uploaded public/private key certificates.

* `--sslmode` string

  Sets CA sslmode for connecting to database.

* `--origin-connection-limit` number

  The (soft) maximum number of connections that Hyperdrive may establish to the origin database

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


