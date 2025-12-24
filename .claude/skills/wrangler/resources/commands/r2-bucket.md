# `r2 bucket`

Interact with buckets in an R2 store.

> **Note:** The `r2 bucket` commands allow you to manage application data in the Cloudflare network to be accessed from Workers using [the R2 API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

## `r2 bucket create`

Create a new R2 bucket

```sh
npx wrangler r2 bucket create [NAME]
```

* `[NAME]` string required - The name of the new bucket
* `--location` string - The optional location hint that determines geographic placement
* `--storage-class` string alias: --s - The default storage class for objects
* `--jurisdiction` string alias: --J - The jurisdiction where the new bucket will be created
* `--use-remote` boolean - Use a remote binding when adding the newly created resource
* `--update-config` boolean - Automatically update your config file
* `--binding` string - The binding name of this resource in your Worker

## `r2 bucket info`

Get information about an R2 bucket

```sh
npx wrangler r2 bucket info [BUCKET]
```

* `[BUCKET]` string required - The name of the bucket to retrieve info for
* `--jurisdiction` string alias: --J - The jurisdiction where the bucket exists
* `--json` boolean default: false - Return the bucket information as JSON

## `r2 bucket delete`

Delete an R2 bucket

```sh
npx wrangler r2 bucket delete [BUCKET]
```

* `[BUCKET]` string required - The name of the bucket to delete
* `--jurisdiction` string alias: --J - The jurisdiction where the bucket exists

## `r2 bucket list`

List R2 buckets

```sh
npx wrangler r2 bucket list
```

* `--jurisdiction` string alias: --J - The jurisdiction to list

## `r2 bucket catalog enable`

Enable the data catalog on an R2 bucket

```sh
npx wrangler r2 bucket catalog enable [BUCKET]
```

## `r2 bucket catalog disable`

Disable the data catalog for an R2 bucket

```sh
npx wrangler r2 bucket catalog disable [BUCKET]
```

## `r2 bucket catalog get`

Get the status of the data catalog for an R2 bucket

```sh
npx wrangler r2 bucket catalog get [BUCKET]
```

## `r2 bucket catalog compaction enable`

Enable automatic file compaction for your R2 data catalog or a specific table

```sh
npx wrangler r2 bucket catalog compaction enable [BUCKET] [NAMESPACE] [TABLE]
```

* `--target-size` number default: 128 - The target size for compacted files in MB (64, 128, 256, 512)
* `--token` string - A cloudflare api token with access to R2

## `r2 bucket catalog compaction disable`

Disable automatic file compaction

```sh
npx wrangler r2 bucket catalog compaction disable [BUCKET] [NAMESPACE] [TABLE]
```

## `r2 bucket cors set`

Set the CORS configuration for an R2 bucket from a JSON file

```sh
npx wrangler r2 bucket cors set [BUCKET]
```

* `--file` string required - Path to the JSON file containing the CORS configuration
* `--jurisdiction` string alias: --J - The jurisdiction where the bucket exists
* `--force` boolean alias: --y default: false - Skip confirmation

## `r2 bucket cors delete`

Clear the CORS configuration for an R2 bucket

```sh
npx wrangler r2 bucket cors delete [BUCKET]
```

## `r2 bucket cors list`

List the CORS rules for an R2 bucket

```sh
npx wrangler r2 bucket cors list [BUCKET]
```

## `r2 bucket dev-url enable`

Enable public access via the r2.dev URL for an R2 bucket

```sh
npx wrangler r2 bucket dev-url enable [BUCKET]
```

## `r2 bucket dev-url disable`

Disable public access via the r2.dev URL for an R2 bucket

```sh
npx wrangler r2 bucket dev-url disable [BUCKET]
```

## `r2 bucket dev-url get`

Get the r2.dev URL and status for an R2 bucket

```sh
npx wrangler r2 bucket dev-url get [BUCKET]
```

## `r2 bucket domain add`

Connect a custom domain to an R2 bucket

```sh
npx wrangler r2 bucket domain add [BUCKET]
```

* `--domain` string required - The custom domain to connect
* `--zone-id` string required - The zone ID associated with the custom domain
* `--min-tls` string - Set the minimum TLS version for the custom domain

## `r2 bucket domain remove`

Remove a custom domain from an R2 bucket

```sh
npx wrangler r2 bucket domain remove [BUCKET]
```

## `r2 bucket domain update`

Update settings for a custom domain connected to an R2 bucket

```sh
npx wrangler r2 bucket domain update [BUCKET]
```

## `r2 bucket domain get`

Get custom domain connected to an R2 bucket

```sh
npx wrangler r2 bucket domain get [BUCKET]
```

## `r2 bucket domain list`

List custom domains for an R2 bucket

```sh
npx wrangler r2 bucket domain list [BUCKET]
```

## `r2 bucket lifecycle add`

Add a lifecycle rule to an R2 bucket

```sh
npx wrangler r2 bucket lifecycle add [BUCKET] [NAME] [PREFIX]
```

* `--expire-days` number - Number of days after which objects expire
* `--expire-date` string - Date after which objects expire (YYYY-MM-DD)
* `--ia-transition-days` number - Days after which objects transition to Infrequent Access
* `--abort-multipart-days` number - Days after which incomplete multipart uploads are aborted

## `r2 bucket lifecycle remove`

Remove a lifecycle rule from an R2 bucket

```sh
npx wrangler r2 bucket lifecycle remove [BUCKET]
```

## `r2 bucket lifecycle list`

List lifecycle rules for an R2 bucket

```sh
npx wrangler r2 bucket lifecycle list [BUCKET]
```

## `r2 bucket lifecycle set`

Set the lifecycle configuration from a JSON file

```sh
npx wrangler r2 bucket lifecycle set [BUCKET]
```

## `r2 bucket lock add`

Add a lock rule to an R2 bucket

```sh
npx wrangler r2 bucket lock add [BUCKET] [NAME] [PREFIX]
```

* `--retention-days` number - Number of days which objects will be retained for
* `--retention-date` string - Date after which objects will be retained until
* `--retention-indefinite` boolean - Retain objects indefinitely

## `r2 bucket lock remove`

Remove a bucket lock rule from an R2 bucket

```sh
npx wrangler r2 bucket lock remove [BUCKET]
```

## `r2 bucket lock list`

List lock rules for an R2 bucket

```sh
npx wrangler r2 bucket lock list [BUCKET]
```

## `r2 bucket lock set`

Set the lock configuration from a JSON file

```sh
npx wrangler r2 bucket lock set [BUCKET]
```

## `r2 bucket notification create`

Create an event notification rule for an R2 bucket

```sh
npx wrangler r2 bucket notification create [BUCKET]
```

* `--event-types` "object-create" | "object-delete" required - The type of event(s) that will emit
* `--prefix` string - The prefix that an object must match
* `--suffix` string - The suffix that an object must match
* `--queue` string required - The name of the queue that will receive event notification messages

## `r2 bucket notification delete`

Delete an event notification rule from an R2 bucket

```sh
npx wrangler r2 bucket notification delete [BUCKET]
```

## `r2 bucket notification list`

List event notification rules for an R2 bucket

```sh
npx wrangler r2 bucket notification list [BUCKET]
```

## `r2 bucket sippy enable`

Enable Sippy on an R2 bucket

```sh
npx wrangler r2 bucket sippy enable [NAME]
```

* `--provider` "AWS" | "GCS" - Cloud provider
* `--bucket` string - The name of the upstream bucket
* `--region` string - (AWS only) The region of the upstream bucket
* `--access-key-id` string - (AWS only) The secret access key id
* `--secret-access-key` string - (AWS only) The secret access key
* `--service-account-key-file` string - (GCS only) Path to Google Cloud service account key JSON
* `--r2-access-key-id` string - The secret access key id for this R2 bucket
* `--r2-secret-access-key` string - The secret access key for this R2 bucket

## `r2 bucket sippy disable`

Disable Sippy on an R2 bucket

```sh
npx wrangler r2 bucket sippy disable [NAME]
```

## `r2 bucket sippy get`

Check the status of Sippy on an R2 bucket

```sh
npx wrangler r2 bucket sippy get [NAME]
```

## Global flags

All commands support these global flags:

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load
- `--experimental-provision` boolean default: true - Enable automatic resource provisioning
- `--experimental-auto-create` boolean default: true - Automatically provision draft bindings


