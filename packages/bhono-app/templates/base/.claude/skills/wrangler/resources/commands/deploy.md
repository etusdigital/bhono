# `deploy`

Deploy your Worker to Cloudflare.

```txt
wrangler deploy [<PATH>] [OPTIONS]
```

> **Note:** None of the options for this command are required. Also, many can be set in your Wrangler file. Refer to the [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) documentation for more information.

- `PATH` string

  - A path specific what needs to be deployed, this can either be:

    - The path to an entry point for your Worker.

      - Only required if your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/) does not include a `main` key (for example, `main = "index.js"`).

    - Or the path to an assets directory for the deployment of a static site.

      - Visit [assets](https://developers.cloudflare.com/workers/static-assets/) for more information.
      - This overrides the eventual `assets` configuration in your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/).
      - This is equivalent to the `--assets` option listed below.
      - Note: this option currently only works only in interactive mode (so not in CI systems).

- `--name` string optional

  - Name of the Worker.

- `--no-bundle` boolean (default: false) optional

  - Skip Wrangler's build steps. Particularly useful when using custom builds. Refer to [Bundling](https://developers.cloudflare.com/workers/wrangler/bundling/) for more information.

- `--env` string optional

  - Perform on a specific environment.

  > **Note:** If you're using the [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/), you select the environment at dev or build time via the `CLOUDFLARE_ENV` environment variable rather than the `--env` flag. Otherwise, environments are defined in your Worker config file as usual. For more detail on using environments with the Cloudflare Vite plugin, refer to the [plugin documentation](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/).

- `--outdir` string optional

  - Path to directory where Wrangler will write the bundled Worker files.

- `--compatibility-date` string optional

  - A date in the form yyyy-mm-dd, which will be used to determine which version of the Workers runtime is used.

- `--compatibility-flags`, `--compatibility-flag` string[] optional

  - Flags to use for compatibility checks.

- `--latest` boolean (default: true) optional

  - Use the latest version of the Workers runtime.

- `--assets` string optional (beta)

  - Folder of static assets to be served. Replaces [Workers Sites](https://developers.cloudflare.com/workers/configuration/sites/). Visit [assets](https://developers.cloudflare.com/workers/static-assets/) for more information.

- `--site` string optional (deprecated, use `--assets`)

  - Folder of static assets for Workers Sites.

  > **Warning:** Workers Sites is deprecated. Please use [Workers Assets](https://developers.cloudflare.com/workers/static-assets/) or [Pages](https://developers.cloudflare.com/pages/).

- `--site-include` string[] optional (deprecated)

  - Array of `.gitignore`-style patterns that match file or directory names from the sites directory. Only matched items will be uploaded.

- `--site-exclude` string[] optional (deprecated)

  - Array of `.gitignore`-style patterns that match file or directory names from the sites directory. Matched items will not be uploaded.

- `--var` key:value[] optional

  - Array of `key:value` pairs to inject as variables into your code. The value will always be passed as a string to your Worker.
  - For example, `--var git_hash:$(git rev-parse HEAD) test:123` makes the `git_hash` and `test` variables available in your Worker's `env`.
  - This flag is an alternative to defining [`vars`](https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys) in your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/). If defined in both places, this flag's values will be used.

- `--define` key:value[] optional

  - Array of `key:value` pairs to replace global identifiers in your code.
  - For example, `--define GIT_HASH:$(git rev-parse HEAD)` will replace all uses of `GIT_HASH` with the actual value at build time.
  - This flag is an alternative to defining [`define`](https://developers.cloudflare.com/workers/wrangler/configuration/#non-inheritable-keys) in your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/). If defined in both places, this flag's values will be used.

- `--triggers`, `--schedule`, `--schedules` string[] optional

  - Cron schedules to attach to the deployed Worker. Refer to [Cron Trigger Examples](https://developers.cloudflare.com/workers/configuration/cron-triggers/#examples).

- `--routes`, `--route` string[] optional

  - Routes where this Worker will be deployed.
  - For example: `--route example.com/*`.

- `--tsconfig` string optional

  - Path to a custom `tsconfig.json` file.

- `--minify` boolean optional

  - Minify the bundled Worker before deploying.

- `--dry-run` boolean (default: false) optional

  - Compile a project without actually deploying to live servers. Combined with `--outdir`, this is also useful for testing the output of `npx wrangler deploy`. It also gives developers a chance to upload our generated sourcemap to a service like Sentry, so that errors from the Worker can be mapped against source code, but before the service goes live.

- `--keep-vars` boolean (default: false) optional

  - It is recommended best practice to treat your Wrangler developer environment as a source of truth for your Worker configuration, and avoid making changes via the Cloudflare dashboard.
  - If you change your environment variables in the Cloudflare dashboard, Wrangler will override them the next time you deploy. If you want to disable this behaviour set `keep-vars` to `true`.
  - Secrets are never deleted by a deployment whether this flag is true or false.

- `--dispatch-namespace` string optional

  - Specify the [Workers for Platforms dispatch namespace](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/get-started/configuration/#2-create-a-dispatch-namespace) to upload this Worker to.

- `--metafile` string optional

  - Specify a file to write the build metadata from esbuild to. If flag is used without a path string, this defaults to `bundle-meta.json` inside the directory specified by `--outdir`. This can be useful for understanding the bundle size.

- `--containers-rollout` immediate | gradual optional

  - Specify the [rollout strategy](https://developers.cloudflare.com/containers/faq#how-do-container-updates-and-rollouts-work) for [Containers](https://developers.cloudflare.com/containers) associated with the Worker. If set to `immediate`, 100% of container instances will be updated in one rollout step, overriding any configuration in `rollout_step_percentage`. Note that `rollout_active_grace_period`, if configured, still applies.
  - Defaults to `gradual`, where the default rollout is 10% then 100% of instances.

- `--strict` boolean (default: false) optional

  - Turns on strict mode for the deployment command, meaning that the command will be more defensive and prevent deployments which could introduce potential issues. In particular, this mode prevents deployments if the deployment would potentially override remote settings in non-interactive environments.

The following global flags work on every command:

- `--help` boolean
  - Show help.
- `--config` string (not supported by Pages)
  - Path to your [Wrangler configuration file](https://developers.cloudflare.com/workers/wrangler/configuration/).
- `--cwd` string
  - Run as if Wrangler was started in the specified directory instead of the current working directory.


