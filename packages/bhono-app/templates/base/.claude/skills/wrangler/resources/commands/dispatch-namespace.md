# `dispatch-namespace`

Manage [dispatch namespaces](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/how-workers-for-platforms-works/#dispatch-namespace) for Workers for Platforms.

## `dispatch-namespace list`

List dispatch namespaces

```sh
npx wrangler dispatch-namespace list
```

## `dispatch-namespace get`

Get a dispatch namespace

```sh
npx wrangler dispatch-namespace get [NAME]
```

* `[NAME]` string required - Name of the dispatch namespace

## `dispatch-namespace create`

Create a dispatch namespace

```sh
npx wrangler dispatch-namespace create [NAME]
```

* `[NAME]` string required - Name of the dispatch namespace

## `dispatch-namespace delete`

Delete a dispatch namespace

```sh
npx wrangler dispatch-namespace delete [NAME]
```

* `[NAME]` string required - Name of the dispatch namespace

## `dispatch-namespace rename`

Rename a dispatch namespace

```sh
npx wrangler dispatch-namespace rename [OLD-NAME] [NEW-NAME]
```

* `[OLD-NAME]` string required - Old name of the dispatch namespace
* `[NEW-NAME]` string required - New name of the dispatch namespace

## Workers for Platforms

Dispatch namespaces are part of Cloudflare's Workers for Platforms, enabling you to:
- Deploy customer Workers in isolated environments
- Route requests to customer Workers dynamically
- Manage multi-tenant Worker deployments

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


