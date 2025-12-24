# `init`

Create a new project via the [create-cloudflare-cli (C3) tool](https://developers.cloudflare.com/workers/get-started/guide/#1-create-a-new-worker-project). A variety of web frameworks are available to choose from as well as templates. Dependencies are installed by default, with the option to deploy your project immediately.

```txt
wrangler init [<NAME>] [OPTIONS]
```

- `NAME` string optional (default: name of working directory)

  - The name of the Workers project. This is both the directory name and `name` property in the generated [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/).

- `--yes` boolean optional

  - Answer yes to any prompts for new projects.

- `--from-dash` string optional

  - Fetch a Worker initialized from the dashboard. This is done by passing the flag and the Worker name. `wrangler init --from-dash <WORKER_NAME>`.
  - The `--from-dash` command will not automatically sync changes made to the dashboard after the command is used. Therefore, it is recommended that you continue using the CLI.

The following global flags work on every command:

- `--help` boolean
  - Show help.
- `--config` string (not supported by Pages)
  - Path to your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/).
- `--cwd` string
  - Run as if Wrangler was started in the specified directory instead of the current working directory.


