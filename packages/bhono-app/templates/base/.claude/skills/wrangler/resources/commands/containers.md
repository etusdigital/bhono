# `containers`

Interact with Cloudflare's Container Platform.

## `build`

Build a Container image from a Dockerfile.

```txt
wrangler containers build [PATH] [OPTIONS]
```

- `PATH` string optional

  - Path for the directory containing the Dockerfile to build.

- `-t, --tag` string required

  - Name and optionally a tag (format: "name:tag").

- `--path-to-docker` string optional

  - Path to your docker binary if it's not on `$PATH`.
  - Default: "docker"

- `-p, --push` boolean optional

  - Push the built image to Cloudflare's managed registry.
  - Default: false

## `delete`

Delete a Container (application).

```txt
wrangler containers delete <CONTAINER_ID> [OPTIONS]
```

- `CONTAINER_ID` string required
  - The ID of the Container to delete.

## `images`

Perform operations on images in your containers registry.

### `images list`

List images in your containers registry.

```txt
wrangler containers images list [OPTIONS]
```

- `--filter` string optional

  - Regex to filter results.

- `--json` boolean optional

  - Return output as clean JSON.
  - Default: false

### `images delete`

Remove an image from your containers registry.

```txt
wrangler containers images delete [IMAGE] [OPTIONS]
```

- `IMAGE` string required
  - Image to delete of the form `IMAGE:TAG`

## `registries`

Configure and view registries available to your container. [Read more](https://developers.cloudflare.com/containers/platform-details/image-management/#using-amazon-ecr-container-images) about our currently supported external registries.

### `registries list`

List registries your containers are able to use.

```txt
wrangler containers registries list [OPTIONS]
```

- `--json` boolean optional

  - Return output as clean JSON.
  - Default: false

### `registries configure`

Configure a new registry for your account.

```txt
wrangler containers registries configure [DOMAIN] [OPTIONS]
```

- `DOMAIN` string required
  - domain to configre for the registry
- `--public-credential` string required
  - The public part of the registry credentials, e.g. `AWS_ACCESS_KEY_ID` for ECR
- `--secret-store-id` string optional
  - The ID of the secret store to use to store the registry credentials
- `--secret-name` string optional
  - The name Wrangler should store the registry credentials under

When run interactively, wrangler will prompt you for your secret and store it in Secrets Store. To run non-interactively, you can send your secret value to wrangler through stdin to have the secret created for you.

### `registries delete`

Remove a registry configuration from your account.

```txt
wrangler containers registries delete [DOMAIN] [OPTIONS]
```

- `DOMAIN` string required
  - domain of the registry to delete

## `info`

Get information about a specific Container, including top-level details and a list of instances.

```txt
wrangler containers info <CONTAINER_ID> [OPTIONS]
```

- `CONTAINER_ID` string required
  - The ID of the Container to get information about.

## `list`

List the Containers in your account.

```txt
wrangler containers list [OPTIONS]
```

## `push`

Push a tagged image to a Cloudflare managed registry, which is automatically integrated with your account.

```txt
wrangler containers push [TAG] [OPTIONS]
```

- `TAG` string required

  - The name and tag of the container image to push.

- `--path-to-docker` string optional

  - Path to your docker binary if it's not on `$PATH`.
  - Default: "docker"


