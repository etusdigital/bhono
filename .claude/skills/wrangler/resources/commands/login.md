# `login`

Authorize Wrangler with your Cloudflare account using OAuth. Wrangler will attempt to automatically open your web browser to login with your Cloudflare account.

```sh
npx wrangler login
```

* `--browser` boolean default: true - Automatically open the OAuth link in a browser
* `--scopes-list` boolean - List all the available OAuth scopes with descriptions
* `--scopes` string - Pick the set of applicable OAuth scopes when logging in

If you prefer to use API tokens for authentication, such as in headless or continuous integration environments, refer to [Running Wrangler in CI/CD](https://developers.cloudflare.com/workers/wrangler/ci-cd/).

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


