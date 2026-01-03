// src/server/__tests__/mocks/kv.ts
import { vi } from 'vitest'

/**
 * Stored KV value with metadata and expiration
 */
interface StoredValue {
  value: string
  metadata?: unknown
  expirationTtl?: number
  expiration?: number
  storedAt: number
}

/**
 * Mock KV Namespace interface
 */
export interface MockKVNamespace {
  get: ReturnType<typeof vi.fn>
  getWithMetadata: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  _store: Map<string, StoredValue>
}

/**
 * Check if a stored value has expired
 */
function isExpired(stored: StoredValue): boolean {
  const now = Date.now()

  // Check absolute expiration
  if (stored.expiration && stored.expiration * 1000 < now) {
    return true
  }

  // Check TTL-based expiration
  if (stored.expirationTtl) {
    const expiresAt = stored.storedAt + stored.expirationTtl * 1000
    if (expiresAt < now) {
      return true
    }
  }

  return false
}

/**
 * Creates a mock KV namespace with in-memory Map store
 */
export function createMockKV(): MockKVNamespace {
  const store = new Map<string, StoredValue>()

  const kv: MockKVNamespace = {
    _store: store,

    get: vi.fn(
      async (
        key: string,
        options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }
      ) => {
        const stored = store.get(key)
        if (!stored) return null

        // Check expiration
        if (isExpired(stored)) {
          store.delete(key)
          return null
        }

        const type = options?.type ?? 'text'

        switch (type) {
          case 'json':
            try {
              return JSON.parse(stored.value)
            } catch {
              return null
            }
          case 'arrayBuffer':
            return new TextEncoder().encode(stored.value).buffer
          case 'stream':
            return new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(stored.value))
                controller.close()
              },
            })
          case 'text':
          default:
            return stored.value
        }
      }
    ),

    getWithMetadata: vi.fn(
      async (
        key: string,
        options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream'; cacheTtl?: number }
      ) => {
        const stored = store.get(key)
        if (!stored) return { value: null, metadata: null }

        // Check expiration
        if (isExpired(stored)) {
          store.delete(key)
          return { value: null, metadata: null }
        }

        const type = options?.type ?? 'text'
        let value: unknown

        switch (type) {
          case 'json':
            try {
              value = JSON.parse(stored.value)
            } catch {
              value = null
            }
            break
          case 'arrayBuffer':
            value = new TextEncoder().encode(stored.value).buffer
            break
          case 'stream':
            value = new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(stored.value))
                controller.close()
              },
            })
            break
          case 'text':
          default:
            value = stored.value
        }

        return {
          value,
          metadata: stored.metadata ?? null,
        }
      }
    ),

    put: vi.fn(
      async (
        key: string,
        value: string | ReadableStream | ArrayBuffer,
        options?: {
          expiration?: number
          expirationTtl?: number
          metadata?: unknown
        }
      ) => {
        let stringValue: string

        if (value instanceof ArrayBuffer) {
          stringValue = new TextDecoder().decode(value)
        } else if (value instanceof ReadableStream) {
          const reader = value.getReader()
          const chunks: Uint8Array[] = []
          let done = false
          while (!done) {
            const result = await reader.read()
            done = result.done
            if (result.value) {
              chunks.push(result.value)
            }
          }
          const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
          let offset = 0
          for (const chunk of chunks) {
            combined.set(chunk, offset)
            offset += chunk.length
          }
          stringValue = new TextDecoder().decode(combined)
        } else {
          stringValue = value
        }

        store.set(key, {
          value: stringValue,
          metadata: options?.metadata,
          expiration: options?.expiration,
          expirationTtl: options?.expirationTtl,
          storedAt: Date.now(),
        })
      }
    ),

    delete: vi.fn(async (key: string) => {
      store.delete(key)
    }),

    list: vi.fn(
      async (options?: { prefix?: string; limit?: number; cursor?: string }) => {
        const prefix = options?.prefix ?? ''
        const limit = options?.limit ?? 1000

        const keys: { name: string; expiration?: number; metadata?: unknown }[] = []

        for (const [key, stored] of store.entries()) {
          // Check expiration
          if (isExpired(stored)) {
            store.delete(key)
            continue
          }

          if (key.startsWith(prefix)) {
            keys.push({
              name: key,
              expiration: stored.expiration,
              metadata: stored.metadata,
            })

            if (keys.length >= limit) {
              break
            }
          }
        }

        // Sort keys alphabetically
        keys.sort((a, b) => a.name.localeCompare(b.name))

        return {
          keys,
          list_complete: keys.length < limit,
          cursor: undefined,
        }
      }
    ),
  }

  return kv
}

/**
 * Seeds mock KV with data
 * @param kv The mock KV namespace
 * @param data Object mapping keys to values (string or { value, metadata, ttl })
 */
export function seedMockKV(
  kv: MockKVNamespace,
  data: Record<
    string,
    | string
    | {
        value: string
        metadata?: unknown
        expirationTtl?: number
        expiration?: number
      }
  >
): void {
  for (const [key, entry] of Object.entries(data)) {
    if (typeof entry === 'string') {
      kv._store.set(key, {
        value: entry,
        storedAt: Date.now(),
      })
    } else {
      kv._store.set(key, {
        value: entry.value,
        metadata: entry.metadata,
        expirationTtl: entry.expirationTtl,
        expiration: entry.expiration,
        storedAt: Date.now(),
      })
    }
  }
}

/**
 * Clears all data from the mock KV
 * @param kv The mock KV namespace
 */
export function clearMockKV(kv: MockKVNamespace): void {
  kv._store.clear()
}

/**
 * Creates a mock KV that conforms to the Cloudflare KVNamespace type
 */
export function createMockKVAsKVNamespace(): KVNamespace {
  return createMockKV() as unknown as KVNamespace
}
