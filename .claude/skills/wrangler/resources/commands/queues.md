# `queues`

Manage [Cloudflare Queues](https://developers.cloudflare.com/queues/).

## `queues create`

Create a Queue

```sh
npx wrangler queues create [NAME]
```

* `[NAME]` string required - The name of the queue
* `--delivery-delay-secs` number default: 0 - How long a published message should be delayed for in seconds
* `--message-retention-period-secs` number default: 345600 - The number of seconds a message will be retained on the queue
* `--paused` boolean default: false - Create the queue in a paused state

## `queues delete`

Delete a Queue

```sh
npx wrangler queues delete [NAME]
```

* `[NAME]` string required - The name of the queue

## `queues list`

List Queues

```sh
npx wrangler queues list
```

## `queues info`

Get a Queue

```sh
npx wrangler queues info [NAME]
```

* `[NAME]` string required - The name of the queue

## `queues pause`

Pause a Queue

```sh
npx wrangler queues pause [NAME]
```

## `queues resume`

Resume a Queue

```sh
npx wrangler queues resume [NAME]
```

## `queues update`

Update a Queue

```sh
npx wrangler queues update [NAME]
```

* `--delivery-delay-secs` number - How long a published message should be delayed for
* `--message-retention-period-secs` number - The number of seconds a message will be retained
* `--paused` boolean - Set whether the queue is paused

## `queues consumer add`

Add a Queue Worker Consumer

```sh
npx wrangler queues consumer add [QUEUE-NAME] [SCRIPT-NAME]
```

* `[QUEUE-NAME]` string required - Name of the queue
* `[SCRIPT-NAME]` string required - Name of the consumer Worker script
* `--batch-size` number - Maximum number of messages per batch
* `--batch-timeout` number - Maximum number of seconds to wait to fill a batch
* `--message-retries` number - Maximum number of retries for each message
* `--dead-letter-queue` string - Queue to send messages that failed to be consumed
* `--max-concurrency` number - Max number of concurrent consumers
* `--retry-delay-secs` number - The number of seconds to wait before retrying

## `queues consumer remove`

Remove a Queue Worker Consumer

```sh
npx wrangler queues consumer remove [QUEUE-NAME] [SCRIPT-NAME]
```

## `queues consumer http add`

Add a Queue HTTP Consumer

```sh
npx wrangler queues consumer http add [QUEUE-NAME]
```

* `--url` string required - URL to send batch of messages to
* `--batch-size` number - Maximum number of messages per batch
* `--batch-timeout` number - Maximum seconds to wait to fill a batch
* `--message-retries` number - Maximum retries for each message
* `--dead-letter-queue` string - Queue to send failed messages to
* `--max-concurrency` number - Max concurrent consumers
* `--retry-delay-secs` number - Seconds to wait before retrying
* `--visibility-timeout-secs` number - Visibility timeout for messages

## `queues consumer http remove`

Remove a Queue HTTP Consumer

```sh
npx wrangler queues consumer http remove [QUEUE-NAME]
```

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


