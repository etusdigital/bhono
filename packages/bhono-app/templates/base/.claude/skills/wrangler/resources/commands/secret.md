# `secret`

Manage the secret variables for a Worker.

This action creates a new [version](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/#versions) of the Worker and [deploys](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/#deployments) it immediately. To only create a new version of the Worker, use the [`wrangler versions secret`](https://developers.cloudflare.com/workers/wrangler/commands/#versions-secret-put) commands.

## `secret put`

Create or update a secret variable for a Worker

- npm

  ```sh
  npx wrangler secret put [KEY]
  ```

- pnpm

  ```sh
  pnpm wrangler secret put [KEY]
  ```

- yarn

  ```sh
  yarn wrangler secret put [KEY]
  ```

* `[KEY]` string required

  The variable name to be accessible in the Worker

* `--name` string

  Name of the Worker

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

When running this command, you will be prompted to input the secret's value:

```sh
npx wrangler secret put FOO
```

```sh
? Enter a secret value: > ***
🌀 Creating the secret for script worker-app
✨ Success! Uploaded secret FOO
```

The `put` command can also receive piped input. For example:

```sh
echo "-----BEGIN PRIVATE KEY-----\nM...==\n-----END PRIVATE KEY-----\n" | wrangler secret put PRIVATE_KEY
```

## `secret delete`

Delete a secret variable from a Worker

- npm

  ```sh
  npx wrangler secret delete [KEY]
  ```

- pnpm

  ```sh
  pnpm wrangler secret delete [KEY]
  ```

- yarn

  ```sh
  yarn wrangler secret delete [KEY]
  ```

* `[KEY]` string required

  The variable name to be accessible in the Worker

* `--name` string

  Name of the Worker

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

## `secret list`

List all secrets for a Worker

- npm

  ```sh
  npx wrangler secret list
  ```

- pnpm

  ```sh
  pnpm wrangler secret list
  ```

- yarn

  ```sh
  yarn wrangler secret list
  ```

* `--name` string

  Name of the Worker

* `--format` "json" | "pretty" default: json

  The format to print the secrets in

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

The following is an example of listing the secrets for the current Worker.

```sh
npx wrangler secret list
```

```sh
[
  {
    "name": "FOO",
    "type": "secret_text"
  }
]
```

---

## `secret bulk`

Bulk upload secrets for a Worker

- npm

  ```sh
  npx wrangler secret bulk [FILE]
  ```

- pnpm

  ```sh
  pnpm wrangler secret bulk [FILE]
  ```

- yarn

  ```sh
  yarn wrangler secret bulk [FILE]
  ```

* `[FILE]` string

  The file of key-value pairs to upload, as JSON in form {"key": value, ...} or .dev.vars file in the form KEY=VALUE

* `--name` string

  Name of the Worker

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

The following is an example of uploading secrets from a JSON file redirected to `stdin`. When complete, the output summary will show the number of secrets uploaded and the number of secrets that failed to upload.

```json
{
	"secret-name-1": "secret-value-1",
	"secret-name-2": "secret-value-2"
}
```

```sh
npx wrangler secret bulk < secrets.json
```

```sh
🌀 Creating the secrets for the Worker "script-name"
✨ Successfully created secret for key: secret-name-1
...
🚨 Error uploading secret for key: secret-name-1
✨ Successfully created secret for key: secret-name-2


Finished processing secrets JSON file:
✨ 1 secrets successfully uploaded
🚨 1 secrets failed to upload
```


