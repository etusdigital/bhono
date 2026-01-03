# `cert`

Manage TLS certificates for Workers custom domains.

## `cert upload`

Upload a TLS certificate for a custom domain

```sh
npx wrangler cert upload
```

* `--cert` string required - Path to the certificate file (.pem)
* `--key` string required - Path to the certificate's private key (.pem)
* `--bundle` string - Path to an optional CA bundle file (.pem)
* `--name` string - A name for this certificate

## `cert list`

List all uploaded TLS certificates

```sh
npx wrangler cert list
```

## `cert delete`

Delete a TLS certificate

```sh
npx wrangler cert delete [ID]
```

* `[ID]` string required - The ID of the certificate to delete

## Certificate Requirements

- Certificates must be in PEM format
- The private key must match the certificate
- For production use, certificates should be signed by a trusted CA
- Self-signed certificates can be used for development/testing

## Example

```sh
# Upload a certificate
npx wrangler cert upload --cert ./cert.pem --key ./key.pem --name "my-domain-cert"

# List certificates
npx wrangler cert list

# Delete a certificate
npx wrangler cert delete abc123
```

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


