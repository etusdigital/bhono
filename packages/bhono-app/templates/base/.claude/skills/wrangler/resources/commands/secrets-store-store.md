# `secrets-store store`

Use the following commands to manage your store.

> **Note:** [Secrets Store](https://developers.cloudflare.com/secrets-store/) is in open beta. Currently, you can only have one store per Cloudflare account.

## `secrets-store store create`

Create a store within an account

```sh
npx wrangler secrets-store store create [NAME]
```

* `[NAME]` string required - Name of the store
* `--remote` boolean default: false - Execute command against remote Secrets Store

Example:

```sh
npx wrangler secrets-store store create default --remote
```

```sh
🔐 Creating store... (Name: default)
✅ Created store! (Name: default, ID: 2e2a82d317134506b58defbe16982d54)
```

## `secrets-store store delete`

Delete a store within an account

```sh
npx wrangler secrets-store store delete [STORE-ID]
```

* `[STORE-ID]` string required - ID of the store
* `--remote` boolean default: false - Execute command against remote Secrets Store

## `secrets-store store list`

List stores within an account

```sh
npx wrangler secrets-store store list
```

* `--page` number default: 1 - Page number of stores listing results
* `--per-page` number default: 10 - Number of stores to show per page
* `--remote` boolean default: false - Execute command against remote Secrets Store

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


