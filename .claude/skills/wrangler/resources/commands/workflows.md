# `workflows`

> **Note:** The `wrangler workflows` command requires Wrangler version `3.83.0` or greater. Use `npx wrangler@latest` to always use the latest Wrangler version when invoking commands.

Manage and configure [Workflows](https://developers.cloudflare.com/workflows/).

## `workflows list`

List Workflows associated to account

```sh
npx wrangler workflows list
```

* `--page` number default: 1 - Show a specific page from the listing
* `--per-page` number - Configure the maximum number of workflows to show per page

## `workflows describe`

Describe Workflow resource

```sh
npx wrangler workflows describe [NAME]
```

* `[NAME]` string required - Name of the workflow

## `workflows delete`

Delete workflow - when deleting a workflow, it will also delete its own instances

```sh
npx wrangler workflows delete [NAME]
```

* `[NAME]` string required - Name of the workflow

## `workflows trigger`

Trigger a workflow, creating a new instance. Can optionally take a JSON string to pass a parameter into the workflow instance

```sh
npx wrangler workflows trigger [NAME] [PARAMS]
```

* `[NAME]` string required - Name of the workflow
* `[PARAMS]` string default: "" - Params for the workflow instance, encoded as a JSON string
* `--id` string - Custom instance ID, if not provided it will default to a random UUIDv4

## `workflows instances list`

List workflow instances

```sh
npx wrangler workflows instances list [NAME]
```

* `[NAME]` string required - Name of the workflow
* `--reverse` boolean default: false - Reverse order of the instances table
* `--status` string - Filters list by instance status (queued, running, paused, errored, terminated, complete)
* `--page` number default: 1 - Show a specific page from the listing
* `--per-page` number - Configure the maximum number of instances to show per page

## `workflows instances describe`

Describe a workflow instance - see its logs, retries and errors

```sh
npx wrangler workflows instances describe [NAME] [ID]
```

* `[NAME]` string required - Name of the workflow
* `[ID]` string default: latest - ID of the instance (or 'latest')
* `--step-output` boolean default: true - Output the step output
* `--truncate-output-limit` number default: 5000 - Truncate step output after x characters

## `workflows instances terminate`

Terminate a workflow instance

```sh
npx wrangler workflows instances terminate [NAME] [ID]
```

## `workflows instances restart`

Restart a workflow instance

```sh
npx wrangler workflows instances restart [NAME] [ID]
```

## `workflows instances pause`

Pause a workflow instance

```sh
npx wrangler workflows instances pause [NAME] [ID]
```

## `workflows instances resume`

Resume a workflow instance

```sh
npx wrangler workflows instances resume [NAME] [ID]
```

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


