# `pipelines`

Manage Worker Pipelines (Beta).

## `pipelines create`

Create a pipeline

```sh
npx wrangler pipelines create [PIPELINE]
```

* `[PIPELINE]` string required - The name of the new pipeline
* `--r2` string - R2 bucket to write results to
* `--batch-max-mb` number - The approximate maximum size (in megabytes) for each batch
* `--batch-max-rows` number - The maximum number of rows for each batch
* `--batch-max-seconds` number - The maximum duration (in seconds) to wait before flushing a batch
* `--transform` string - A Worker to transform the pipeline data
* `--compression` string default: gzip - Compression format for output
* `--prefix` string default: event_date=${date} - Add a key prefix for each written file

## `pipelines list`

List pipelines

```sh
npx wrangler pipelines list
```

## `pipelines show`

Show a pipeline configuration

```sh
npx wrangler pipelines show [PIPELINE]
```

* `[PIPELINE]` string required - The name of the pipeline to show

## `pipelines delete`

Delete a pipeline

```sh
npx wrangler pipelines delete [PIPELINE]
```

* `[PIPELINE]` string required - The name of the pipeline to delete
* `--yes` boolean - Skip confirmation

## `pipelines update`

Update a pipeline

```sh
npx wrangler pipelines update [PIPELINE]
```

* `[PIPELINE]` string required - The name of the pipeline to update
* `--r2` string - R2 bucket to write results to
* `--batch-max-mb` number - The approximate maximum size for each batch
* `--batch-max-rows` number - The maximum number of rows for each batch
* `--batch-max-seconds` number - The maximum duration to wait before flushing
* `--transform` string - A Worker to transform the pipeline data
* `--compression` string - Compression format for output
* `--prefix` string - Add a key prefix for each written file

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


