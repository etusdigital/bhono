---
title: Custom builds · Cloudflare Workers docs
description: Customize how your code is compiled, before being processed by Wrangler.
lastUpdated: 2025-04-07T23:45:28.000Z
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/workers/wrangler/custom-builds/
  md: https://developers.cloudflare.com/workers/wrangler/custom-builds/index.md
---

Custom builds are a way for you to customize how your code is compiled, before being processed by Wrangler.

Note

Wrangler runs [esbuild](https://esbuild.github.io/) by default as part of the `dev` and `deploy` commands, and bundles your Worker project into a single Worker script. Refer to [Bundling](https://developers.cloudflare.com/workers/wrangler/bundling/).

## Configure custom builds

Custom builds are configured by adding a `[build]` section in your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/), and using the following options for configuring your custom build.

- `command` string optional

  - The command used to build your Worker. On Linux and macOS, the command is executed in the `sh` shell and the `cmd` shell for Windows. The `&&` and `||` shell operators may be used. This command will be run as part of `wrangler dev` and `npx wrangler deploy`.

- `cwd` string optional

  - The directory in which the command is executed.

- `watch_dir` string | string\\\[] optional

  - The directory to watch for changes while using `wrangler dev`. Defaults to the current working directory.

Example:

- wrangler.jsonc

  ```jsonc
  {
  	"$schema": "./node_modules/wrangler/config-schema.json",
  	"build": {
  		"command": "npm run build",
  		"cwd": "build_cwd",
  		"watch_dir": "build_watch_dir"
  	}
  }
  ```

- wrangler.toml

  ```toml
  [build]
  command = "npm run build"
  cwd = "build_cwd"
  watch_dir = "build_watch_dir"
  ```
