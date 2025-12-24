# `whoami`

Retrieve your user information and test your authentication configuration.

```sh
npx wrangler whoami
```

* `--account` string - The account identifier (id) or name to show

Example output:

```sh
$ npx wrangler whoami

👋 You are logged in with an OAuth Token, associated with the email 'user@example.com'.
┌─────────────────────────────────┬──────────────────────────────────┐
│ Account Name                    │ Account ID                       │
├─────────────────────────────────┼──────────────────────────────────┤
│ Your Account                    │ ******************************** │
└─────────────────────────────────┴──────────────────────────────────┘
🔓 Token Permissions:
Scope (Access)
- account (read)
- user (read)
- workers (write)
- workers_kv (write)
- workers_routes (write)
- workers_scripts (write)
- workers_tail (read)
- d1 (write)
- pages (write)
- zone (read)
- ssl_certs (write)
- constellation (write)
- ai (write)
- queues (write)
- offline_access
```

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


