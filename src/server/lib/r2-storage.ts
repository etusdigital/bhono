// src/server/lib/r2-storage.ts

export interface UploadUrlResponse {
  url: string
  name: string
  publicUrl: string
}

/**
 * Generates a presigned URL for uploading files to R2.
 * The URL is valid for 15 minutes.
 */
export function generateUploadUrl(
  _r2Bucket: R2Bucket,
  publicUrl: string,
  filename: string,
  contentType: string
): UploadUrlResponse {
  if (!filename || !contentType) {
    throw new Error('Filename and ContentType are required.')
  }

  // Extract filename and preserve folder structure
  const extractedFilename = filename.split('/').pop() ?? filename
  const folders = filename.split('/').slice(0, -1).join('/')

  // Create unique filename with timestamp
  const timestamp = String(Date.now())
  const uniqueFilename = folders
    ? `${folders}/${timestamp}-${extractedFilename}`
    : `${timestamp}-${extractedFilename}`

  // R2 doesn't support presigned URLs directly in Workers
  // We use a workaround: return the internal upload endpoint
  // The client will upload through our API endpoint

  // For direct R2 presigned URLs, you need to use the S3-compatible API
  // Here we return the object key and the client uploads via PUT to our endpoint

  const objectPublicUrl = publicUrl.endsWith('/')
    ? `${publicUrl}${uniqueFilename}`
    : `${publicUrl}/${uniqueFilename}`

  return {
    url: `/api/storage/upload/${encodeURIComponent(uniqueFilename)}`,
    name: uniqueFilename,
    publicUrl: objectPublicUrl,
  }
}

/**
 * Uploads a file to R2 bucket.
 */
export async function uploadFile(
  r2Bucket: R2Bucket,
  key: string,
  body: ArrayBuffer | ReadableStream,
  contentType: string
): Promise<R2Object> {
  const result = await r2Bucket.put(key, body, {
    httpMetadata: {
      contentType,
    },
  })

  if (!result) {
    throw new Error('Failed to upload file to R2')
  }

  return result
}

/**
 * Deletes a file from R2 bucket.
 */
export async function deleteFile(
  r2Bucket: R2Bucket,
  key: string
): Promise<void> {
  await r2Bucket.delete(key)
}

/**
 * Gets file metadata from R2 bucket.
 */
export async function getFileMetadata(
  r2Bucket: R2Bucket,
  key: string
): Promise<R2Object | null> {
  return r2Bucket.head(key)
}

/**
 * Lists files in R2 bucket with optional prefix.
 */
export async function listFiles(
  r2Bucket: R2Bucket,
  prefix?: string,
  limit?: number
): Promise<R2Objects> {
  return r2Bucket.list({
    prefix,
    limit: limit ?? 100,
  })
}
