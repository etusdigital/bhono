# `logout`

Remove Wrangler's authorization for accessing your account. This command will invalidate your current OAuth token.

```sh
npx wrangler logout
```

If you're using `CLOUDFLARE_API_TOKEN` instead of OAuth, and you want to remove your API token from your local machine, you must delete it manually.

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


