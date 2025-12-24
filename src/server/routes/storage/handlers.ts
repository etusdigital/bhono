// src/server/routes/storage/handlers.ts
import { generateUploadUrl, uploadFile, deleteFile, getFileMetadata } from '../../lib/r2-storage'
import { NotFoundError, ValidationError } from '../../lib/errors'

export async function generateUploadUrlHandler(c: any) {
  const data = c.req.valid('json')
  const r2Bucket = c.env.R2_BUCKET
  const publicUrl = c.env.R2_PUBLIC_URL

  if (!r2Bucket) {
    throw new ValidationError('R2 storage is not configured')
  }

  const result = await generateUploadUrl(
    r2Bucket,
    publicUrl,
    data.filename,
    data.contentType
  )

  return c.json(result, 200)
}

export async function uploadFileHandler(c: any) {
  const { key } = c.req.valid('param')
  const r2Bucket = c.env.R2_BUCKET
  const publicUrl = c.env.R2_PUBLIC_URL

  if (!r2Bucket) {
    throw new ValidationError('R2 storage is not configured')
  }

  // Decode the key
  const decodedKey = decodeURIComponent(key)

  // Get the content type from the request header
  const contentType = c.req.header('content-type') || 'application/octet-stream'

  // Get the request body as ArrayBuffer
  const body = await c.req.arrayBuffer()

  if (!body || body.byteLength === 0) {
    throw new ValidationError('Request body is empty')
  }

  // Upload the file
  await uploadFile(r2Bucket, decodedKey, body, contentType)

  const objectPublicUrl = publicUrl.endsWith('/')
    ? `${publicUrl}${decodedKey}`
    : `${publicUrl}/${decodedKey}`

  return c.json(
    {
      success: true,
      key: decodedKey,
      publicUrl: objectPublicUrl,
    },
    200
  )
}

export async function deleteFileHandler(c: any) {
  const { key } = c.req.valid('param')
  const r2Bucket = c.env.R2_BUCKET

  if (!r2Bucket) {
    throw new ValidationError('R2 storage is not configured')
  }

  // Decode the key
  const decodedKey = decodeURIComponent(key)

  // Check if file exists
  const metadata = await getFileMetadata(r2Bucket, decodedKey)

  if (!metadata) {
    throw new NotFoundError('File')
  }

  // Delete the file
  await deleteFile(r2Bucket, decodedKey)

  return c.body(null, 204)
}
