# `mtls-certificate`

Manage [mTLS certificates](https://developers.cloudflare.com/workers/runtime-apis/bindings/mtls/) used to communicate with origins requiring client authentication.

## `mtls-certificate upload`

Upload an mTLS certificate

```sh
npx wrangler mtls-certificate upload
```

* `--cert` string - The path to a certificate file (.pem)
* `--key` string - The path to the certificate's private key (.pem)
* `--name` string - The name for the certificate to be referred to in the binding

## `mtls-certificate list`

List uploaded mTLS certificates

```sh
npx wrangler mtls-certificate list
```

## `mtls-certificate delete`

Delete an mTLS certificate

```sh
npx wrangler mtls-certificate delete
```

* `--id` string - The ID of the certificate
* `--name` string - The name of the certificate

## Usage in Workers

After uploading an mTLS certificate, you can bind it to your Worker in `wrangler.toml`:

```toml
[[mtls_certificates]]
binding = "MY_CERT"
certificate_id = "<CERTIFICATE_ID>"
```

Then use it in your Worker:

```javascript
export default {
  async fetch(request, env) {
    const response = await fetch("https://origin-requiring-mtls.example.com", {
      cf: {
        clientCertificate: env.MY_CERT
      }
    });
    return response;
  }
}
```

## Global flags

- `--v` boolean alias: --version - Show version number
- `--cwd` string - Run as if Wrangler was started in the specified directory
- `--config` string alias: --c - Path to Wrangler configuration file
- `--env` string alias: --e - Environment to use for operations
- `--env-file` string - Path to an .env file to load


