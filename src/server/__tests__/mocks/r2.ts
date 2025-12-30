// src/server/__tests__/mocks/r2.ts
import { vi } from 'vitest'

/**
 * Stored R2 object data
 */
interface StoredR2Object {
  key: string
  body: ArrayBuffer
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  uploaded: Date
}

/**
 * Mock R2 Object interface
 */
export interface MockR2Object {
  key: string
  version: string
  size: number
  etag: string
  httpEtag: string
  checksums: R2Checksums
  uploaded: Date
  httpMetadata?: R2HTTPMetadata
  customMetadata?: Record<string, string>
  range?: R2Range
  storageClass: string
  body: ReadableStream
  bodyUsed: boolean
  arrayBuffer: () => Promise<ArrayBuffer>
  text: () => Promise<string>
  json: <T>() => Promise<T>
  blob: () => Promise<Blob>
  writeHttpMetadata: (headers: Headers) => void
}

/**
 * Mock R2 Object Body (for get operations)
 */
export interface MockR2ObjectBody extends MockR2Object {
  body: ReadableStream
  bodyUsed: boolean
}

/**
 * Mock R2 Objects list response
 */
export interface MockR2Objects {
  objects: MockR2Object[]
  truncated: boolean
  cursor?: string
  delimitedPrefixes: string[]
}

/**
 * Mock R2 Bucket interface
 */
export interface MockR2Bucket {
  head: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  createMultipartUpload: ReturnType<typeof vi.fn>
  resumeMultipartUpload: ReturnType<typeof vi.fn>
  _store: Map<string, StoredR2Object>
}

/**
 * Generate a simple etag from content
 */
function generateEtag(content: ArrayBuffer): string {
  // Simple hash for testing purposes
  const view = new Uint8Array(content)
  let hash = 0
  for (let i = 0; i < view.length; i++) {
    hash = ((hash << 5) - hash + view[i]) | 0
  }
  return `"${Math.abs(hash).toString(16)}"`
}

/**
 * Create a mock R2Object from stored data
 */
function createMockR2Object(stored: StoredR2Object, includeBody = false): MockR2Object {
  const etag = generateEtag(stored.body)
  let bodyUsed = false

  const obj: MockR2Object = {
    key: stored.key,
    version: crypto.randomUUID(),
    size: stored.body.byteLength,
    etag,
    httpEtag: etag,
    checksums: {
      toJSON: () => ({}),
    } as R2Checksums,
    uploaded: stored.uploaded,
    httpMetadata: stored.httpMetadata,
    customMetadata: stored.customMetadata,
    storageClass: 'Standard',
    body: new ReadableStream({
      start(controller) {
        if (includeBody) {
          controller.enqueue(new Uint8Array(stored.body))
        }
        controller.close()
      },
    }),
    bodyUsed,
    arrayBuffer: async () => {
      if (bodyUsed) throw new Error('Body already used')
      bodyUsed = true
      return stored.body
    },
    text: async () => {
      if (bodyUsed) throw new Error('Body already used')
      bodyUsed = true
      return new TextDecoder().decode(stored.body)
    },
    json: async <T>() => {
      if (bodyUsed) throw new Error('Body already used')
      bodyUsed = true
      return JSON.parse(new TextDecoder().decode(stored.body)) as T
    },
    blob: async () => {
      if (bodyUsed) throw new Error('Body already used')
      bodyUsed = true
      return new Blob([stored.body], { type: stored.httpMetadata?.contentType })
    },
    writeHttpMetadata: (headers: Headers) => {
      if (stored.httpMetadata?.contentType) {
        headers.set('content-type', stored.httpMetadata.contentType)
      }
      if (stored.httpMetadata?.contentDisposition) {
        headers.set('content-disposition', stored.httpMetadata.contentDisposition)
      }
      if (stored.httpMetadata?.contentEncoding) {
        headers.set('content-encoding', stored.httpMetadata.contentEncoding)
      }
      if (stored.httpMetadata?.contentLanguage) {
        headers.set('content-language', stored.httpMetadata.contentLanguage)
      }
      if (stored.httpMetadata?.cacheControl) {
        headers.set('cache-control', stored.httpMetadata.cacheControl)
      }
      if (stored.httpMetadata?.cacheExpiry) {
        headers.set('expires', stored.httpMetadata.cacheExpiry.toUTCString())
      }
    },
  }

  return obj
}

/**
 * Convert various input types to ArrayBuffer
 */
async function toArrayBuffer(
  body: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream | null
): Promise<ArrayBuffer> {
  if (body === null) {
    return new ArrayBuffer(0)
  }

  if (body instanceof ArrayBuffer) {
    return body
  }

  if (ArrayBuffer.isView(body)) {
    return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength)
  }

  if (typeof body === 'string') {
    return new TextEncoder().encode(body).buffer
  }

  if (body instanceof Blob) {
    return body.arrayBuffer()
  }

  if (body instanceof ReadableStream) {
    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
      if (result.value) {
        chunks.push(result.value)
      }
    }
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }
    return combined.buffer
  }

  throw new Error('Unsupported body type')
}

/**
 * Creates a mock R2 bucket with in-memory Map store
 */
export function createMockR2(): MockR2Bucket {
  const store = new Map<string, StoredR2Object>()

  const bucket: MockR2Bucket = {
    _store: store,

    head: vi.fn(async (key: string): Promise<MockR2Object | null> => {
      const stored = store.get(key)
      if (!stored) return null
      return createMockR2Object(stored, false)
    }),

    get: vi.fn(
      async (
        key: string,
        options?: R2GetOptions
      ): Promise<MockR2ObjectBody | MockR2Object | null> => {
        const stored = store.get(key)
        if (!stored) return null

        // Handle conditional requests
        if (options?.onlyIf) {
          const etag = generateEtag(stored.body)
          const cond = options.onlyIf

          if (cond.etagMatches && cond.etagMatches !== etag) {
            return createMockR2Object(stored, false) as MockR2Object
          }
          if (cond.etagDoesNotMatch && cond.etagDoesNotMatch === etag) {
            return createMockR2Object(stored, false) as MockR2Object
          }
        }

        return createMockR2Object(stored, true) as MockR2ObjectBody
      }
    ),

    put: vi.fn(
      async (
        key: string,
        value: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream | null,
        options?: R2PutOptions
      ): Promise<MockR2Object> => {
        const body = await toArrayBuffer(value)

        const stored: StoredR2Object = {
          key,
          body,
          httpMetadata: options?.httpMetadata,
          customMetadata: options?.customMetadata,
          uploaded: new Date(),
        }

        store.set(key, stored)
        return createMockR2Object(stored, false)
      }
    ),

    delete: vi.fn(async (keys: string | string[]): Promise<void> => {
      const keyArray = Array.isArray(keys) ? keys : [keys]
      for (const key of keyArray) {
        store.delete(key)
      }
    }),

    list: vi.fn(async (options?: R2ListOptions): Promise<MockR2Objects> => {
      const prefix = options?.prefix ?? ''
      const limit = options?.limit ?? 1000
      const delimiter = options?.delimiter

      const objects: MockR2Object[] = []
      const delimitedPrefixes = new Set<string>()

      for (const [key, stored] of store.entries()) {
        if (!key.startsWith(prefix)) continue

        if (delimiter) {
          const remainder = key.slice(prefix.length)
          const delimiterIndex = remainder.indexOf(delimiter)
          if (delimiterIndex !== -1) {
            delimitedPrefixes.add(prefix + remainder.slice(0, delimiterIndex + 1))
            continue
          }
        }

        objects.push(createMockR2Object(stored, false))

        if (objects.length >= limit) {
          break
        }
      }

      // Sort by key
      objects.sort((a, b) => a.key.localeCompare(b.key))

      return {
        objects,
        truncated: objects.length >= limit,
        delimitedPrefixes: Array.from(delimitedPrefixes).sort(),
      }
    }),

    createMultipartUpload: vi.fn(async (key: string, options?: R2MultipartOptions) => {
      // Basic multipart upload mock - not fully implemented
      return {
        key,
        uploadId: crypto.randomUUID(),
        uploadPart: vi.fn(),
        abort: vi.fn(),
        complete: vi.fn(),
      }
    }),

    resumeMultipartUpload: vi.fn(async (key: string, uploadId: string) => {
      return {
        key,
        uploadId,
        uploadPart: vi.fn(),
        abort: vi.fn(),
        complete: vi.fn(),
      }
    }),
  }

  return bucket
}

/**
 * Seeds mock R2 with data
 * @param r2 The mock R2 bucket
 * @param data Object mapping keys to values
 */
export async function seedMockR2(
  r2: MockR2Bucket,
  data: Record<
    string,
    | string
    | ArrayBuffer
    | {
        body: string | ArrayBuffer
        httpMetadata?: R2HTTPMetadata
        customMetadata?: Record<string, string>
      }
  >
): Promise<void> {
  for (const [key, entry] of Object.entries(data)) {
    if (typeof entry === 'string') {
      r2._store.set(key, {
        key,
        body: new TextEncoder().encode(entry).buffer,
        uploaded: new Date(),
      })
    } else if (entry instanceof ArrayBuffer) {
      r2._store.set(key, {
        key,
        body: entry,
        uploaded: new Date(),
      })
    } else {
      const body =
        typeof entry.body === 'string' ? new TextEncoder().encode(entry.body).buffer : entry.body

      r2._store.set(key, {
        key,
        body,
        httpMetadata: entry.httpMetadata,
        customMetadata: entry.customMetadata,
        uploaded: new Date(),
      })
    }
  }
}

/**
 * Clears all data from the mock R2
 * @param r2 The mock R2 bucket
 */
export function clearMockR2(r2: MockR2Bucket): void {
  r2._store.clear()
}

/**
 * Creates a mock R2 that conforms to the Cloudflare R2Bucket type
 */
export function createMockR2AsR2Bucket(): R2Bucket {
  return createMockR2() as unknown as R2Bucket
}
