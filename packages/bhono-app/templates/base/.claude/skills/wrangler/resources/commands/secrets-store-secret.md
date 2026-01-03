# `secrets-store secret`

With the release of [Secrets Store](https://developers.cloudflare.com/secrets-store/) in open beta, you can use the following commands to manage your account secrets.

> **Note:** In order to interact with Secrets Store in production, you should append `--remote` to your command. Without it, your command will default to [local development mode](https://developers.cloudflare.com/workers/development-testing/).

## `secrets-store secret create`

Create a secret within a store

```sh
npx wrangler secrets-store secret create [STORE-ID]
```

* `[STORE-ID]` string required - ID of the store in which the secret resides
* `--name` string required - Name of the secret
* `--value` string - Value of the secret (Note: Only for testing. Not secure as this will leave secret value in plain-text in terminal history)
* `--scopes` string required - Scopes for the secret (comma-separated list e.g. "workers")
* `--comment` string - Comment for the secret
* `--remote` boolean default: false - Execute command against remote Secrets Store
* `--persist-to` string - Directory for local persistence

## `secrets-store secret update`

Update a secret within a store

```sh
npx wrangler secrets-store secret update [STORE-ID]
```

* `[STORE-ID]` string required - ID of the store in which the secret resides
* `--secret-id` string required - ID of the secret to update
* `--value` string - Updated value of the secret
* `--scopes` string - Updated scopes for the secret
* `--comment` string - Updated comment for the secret
* `--remote` boolean default: false - Execute command against remote Secrets Store
* `--persist-to` string - Directory for local persistence

## `secrets-store secret duplicate`

Duplicate a secret within a store

```sh
npx wrangler secrets-store secret duplicate [STORE-ID]
```

* `[STORE-ID]` string required - ID of the store in which the secret resides
* `--secret-id` string required - ID of the secret to duplicate the secret value of
* `--name` string required - Name of the new secret
* `--scopes` string required - Scopes for the new secret
* `--comment` string - Comment for the new secret
* `--remote` boolean default: false - Execute command against remote Secrets Store

## `secrets-store secret get`

Get a secret within a store

```sh
npx wrangler secrets-store secret get [STORE-ID]
```

* `[STORE-ID]` string required - ID of the store in which the secret resides
* `--secret-id` string required - ID of the secret to retrieve
* `--remote` boolean default: false - Execute command against remote Secrets Store
* `--persist-to` string - Directory for local persistence

## `secrets-store secret delete`

Delete a secret within a store

```sh
npx wrangler secrets-store secret delete [STORE-ID]
```

* `[STORE-ID]` string required - ID of the store in which the secret resides
* `--secret-id` string required - ID of the secret to delete
* `--remote` boolean default: false - Execute command against remote Secrets Store

## `secrets-store secret list`

List secrets within a store

```sh
npx wrangler secrets-store secret list [STORE-ID]
```

* `[STORE-ID]` string required - ID of the store in which to list secrets
* `--page` number default: 1 - Page number of secrets listing results
* `--per-page` number default: 10 - Number of secrets to show per page
* `--remote` boolean default: false - Execute command against remote Secrets Store

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


