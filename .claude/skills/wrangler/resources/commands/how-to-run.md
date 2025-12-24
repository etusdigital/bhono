# How to run Wrangler commands

This page provides a reference for Wrangler commands.

```txt
wrangler <COMMAND> <SUBCOMMAND> [PARAMETERS] [OPTIONS]
```

Since Cloudflare recommends [installing Wrangler locally](https://developers.cloudflare.com/workers/wrangler/install-and-update/) in your project(rather than globally), the way to run Wrangler will depend on your specific setup and package manager.

- npm

  ```sh
  npx wrangler <COMMAND> <SUBCOMMAND> [PARAMETERS] [OPTIONS]
  ```

- yarn

  ```sh
  yarn wrangler <COMMAND> <SUBCOMMAND> [PARAMETERS] [OPTIONS]
  ```

- pnpm

  ```sh
  pnpm wrangler <COMMAND> <SUBCOMMAND> [PARAMETERS] [OPTIONS]
  ```

You can add Wrangler commands that you use often as scripts in your project's `package.json` file:

```json
{
  ...
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev"
  }
  ...
}
```

You can then run them using your package manager of choice:

- npm

  ```sh
  npm run deploy
  ```

- yarn

  ```sh
  yarn run deploy
  ```

- pnpm

  ```sh
  pnpm run deploy
  ```


