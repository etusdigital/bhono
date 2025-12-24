# `delete`

Delete your Worker and all associated Cloudflare developer platform resources.

```txt
wrangler delete [<SCRIPT>] [OPTIONS]
```

- `SCRIPT` string
  - The path to an entry point for your Worker. Only required if your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) does not include a `main` key (for example, `main = "index.js"`).
- `--name` string optional
  - Name of the Worker.
- `--env` string optional
  - Perform on a specific environment.
- `--dry-run` boolean (default: false) optional
  - Do not actually delete the Worker. This is useful for testing the output of `wrangler delete`.

The following global flags work on every command:

- `--help` boolean
  - Show help.
- `--config` string (not supported by Pages)
  - Path to your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/).
- `--cwd` string
  - Run as if Wrangler was started in the specified directory instead of the current working directory.


