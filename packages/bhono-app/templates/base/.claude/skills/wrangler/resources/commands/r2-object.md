# `r2 object`

Interact with R2 objects.

> **Note:** The `r2 object` commands allow you to manage application data in the Cloudflare network to be accessed from Workers using [the R2 API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

## `r2 object get`

Fetch an object from an R2 bucket

- npm

  ```sh
  npx wrangler r2 object get [OBJECTPATH]
  ```

- pnpm

  ```sh
  pnpm wrangler r2 object get [OBJECTPATH]
  ```

- yarn

  ```sh
  yarn wrangler r2 object get [OBJECTPATH]
  ```

* `[OBJECTPATH]` string required

  The source object path in the form of {bucket}/{key}

* `--file` string alias: --f

  The destination file to create

* `--pipe` boolean alias: --p

  Enables the file to be piped to a destination, rather than specified with the --file option

* `--local` boolean

  Interact with local storage

* `--remote` boolean

  Interact with remote storage

* `--persist-to` string

  Directory for local persistence

* `--jurisdiction` string alias: --J

  The jurisdiction where the object exists

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

## `r2 object put`

Create an object in an R2 bucket

- npm

  ```sh
  npx wrangler r2 object put [OBJECTPATH]
  ```

- pnpm

  ```sh
  pnpm wrangler r2 object put [OBJECTPATH]
  ```

- yarn

  ```sh
  yarn wrangler r2 object put [OBJECTPATH]
  ```

* `[OBJECTPATH]` string required

  The destination object path in the form of {bucket}/{key}

* `--content-type` string alias: --ct

  A standard MIME type describing the format of the object data

* `--content-disposition` string alias: --cd

  Specifies presentational information for the object

* `--content-encoding` string alias: --ce

  Specifies what content encodings have been applied to the object

* `--content-language` string alias: --cl

  The language the content is in

* `--cache-control` string alias: --cc

  Specifies caching behavior along the request/reply chain

* `--expires` string

  The date and time at which the object is no longer cacheable

* `--local` boolean

  Interact with local storage

* `--remote` boolean

  Interact with remote storage

* `--persist-to` string

  Directory for local persistence

* `--jurisdiction` string alias: --J

  The jurisdiction where the object will be created

* `--storage-class` string alias: --s

  The storage class of the object to be created

* `--file` string alias: --f

  The path of the file to upload

* `--pipe` boolean alias: --p

  Enables the file to be piped in, rather than specified with the --file option

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

## `r2 object delete`

Delete an object in an R2 bucket

- npm

  ```sh
  npx wrangler r2 object delete [OBJECTPATH]
  ```

- pnpm

  ```sh
  pnpm wrangler r2 object delete [OBJECTPATH]
  ```

- yarn

  ```sh
  yarn wrangler r2 object delete [OBJECTPATH]
  ```

* `[OBJECTPATH]` string required

  The destination object path in the form of {bucket}/{key}

* `--local` boolean

  Interact with local storage

* `--remote` boolean

  Interact with remote storage

* `--persist-to` string

  Directory for local persistence

* `--jurisdiction` string alias: --J

  The jurisdiction where the object exists

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


