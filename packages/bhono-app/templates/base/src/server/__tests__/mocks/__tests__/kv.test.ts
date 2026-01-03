// src/server/__tests__/mocks/__tests__/kv.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockKV, seedMockKV, clearMockKV, type MockKVNamespace } from '../kv'

describe('MockKVNamespace', () => {
  let kv: MockKVNamespace

  beforeEach(() => {
    kv = createMockKV()
    vi.clearAllMocks()
  })

  describe('createMockKV', () => {
    it('creates a mock KV with all required methods', () => {
      expect(kv.get).toBeDefined()
      expect(kv.getWithMetadata).toBeDefined()
      expect(kv.put).toBeDefined()
      expect(kv.delete).toBeDefined()
      expect(kv.list).toBeDefined()
      expect(kv._store).toBeInstanceOf(Map)
    })
  })

  describe('put and get', () => {
    it('stores and retrieves string values', async () => {
      await kv.put('key1', 'value1')
      const result = await kv.get('key1')
      expect(result).toBe('value1')
    })

    it('returns null for non-existent keys', async () => {
      const result = await kv.get('nonexistent')
      expect(result).toBeNull()
    })

    it('retrieves as JSON when type is json', async () => {
      const data = { name: 'Test', count: 42 }
      await kv.put('json-key', JSON.stringify(data))

      const result = await kv.get('json-key', { type: 'json' })
      expect(result).toEqual(data)
    })

    it('retrieves as ArrayBuffer when type is arrayBuffer', async () => {
      await kv.put('buffer-key', 'hello')

      const result = await kv.get('buffer-key', { type: 'arrayBuffer' })
      expect(result).toBeInstanceOf(ArrayBuffer)
      expect(new TextDecoder().decode(result as ArrayBuffer)).toBe('hello')
    })

    it('retrieves as ReadableStream when type is stream', async () => {
      await kv.put('stream-key', 'stream data')

      const result = await kv.get('stream-key', { type: 'stream' })
      expect(result).toBeInstanceOf(ReadableStream)

      const reader = (result as ReadableStream).getReader()
      const { value } = await reader.read()
      expect(new TextDecoder().decode(value)).toBe('stream data')
    })
  })

  describe('put with options', () => {
    it('stores metadata with the value', async () => {
      const metadata = { version: 1, author: 'test' }
      await kv.put('meta-key', 'value', { metadata })

      const stored = kv._store.get('meta-key')
      expect(stored?.metadata).toEqual(metadata)
    })

    it('stores expiration TTL', async () => {
      await kv.put('ttl-key', 'value', { expirationTtl: 3600 })

      const stored = kv._store.get('ttl-key')
      expect(stored?.expirationTtl).toBe(3600)
    })

    it('stores absolute expiration', async () => {
      const expiration = Math.floor(Date.now() / 1000) + 3600
      await kv.put('exp-key', 'value', { expiration })

      const stored = kv._store.get('exp-key')
      expect(stored?.expiration).toBe(expiration)
    })

    it('accepts ArrayBuffer as value', async () => {
      const buffer = new TextEncoder().encode('buffer content').buffer
      await kv.put('buffer-value', buffer)

      const result = await kv.get('buffer-value')
      expect(result).toBe('buffer content')
    })
  })

  describe('getWithMetadata', () => {
    it('returns value and metadata together', async () => {
      const metadata = { version: 2 }
      await kv.put('meta-key', 'value', { metadata })

      const result = await kv.getWithMetadata('meta-key')
      expect(result.value).toBe('value')
      expect(result.metadata).toEqual(metadata)
    })

    it('returns null for non-existent keys', async () => {
      const result = await kv.getWithMetadata('nonexistent')
      expect(result.value).toBeNull()
      expect(result.metadata).toBeNull()
    })

    it('supports type option for value parsing', async () => {
      const data = { test: true }
      await kv.put('json-meta', JSON.stringify(data), { metadata: { type: 'json' } })

      const result = await kv.getWithMetadata('json-meta', { type: 'json' })
      expect(result.value).toEqual(data)
      expect(result.metadata).toEqual({ type: 'json' })
    })
  })

  describe('delete', () => {
    it('removes a key from storage', async () => {
      await kv.put('to-delete', 'value')
      expect(await kv.get('to-delete')).toBe('value')

      await kv.delete('to-delete')
      expect(await kv.get('to-delete')).toBeNull()
    })

    it('does not throw for non-existent keys', async () => {
      await expect(kv.delete('nonexistent')).resolves.not.toThrow()
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      await kv.put('users:1', 'user1')
      await kv.put('users:2', 'user2')
      await kv.put('users:3', 'user3')
      await kv.put('accounts:1', 'account1')
      await kv.put('accounts:2', 'account2')
    })

    it('lists all keys when no options provided', async () => {
      const result = await kv.list()
      expect(result.keys).toHaveLength(5)
      expect(result.list_complete).toBe(true)
    })

    it('filters by prefix', async () => {
      const result = await kv.list({ prefix: 'users:' })
      expect(result.keys).toHaveLength(3)
      expect(result.keys.every((k) => k.name.startsWith('users:'))).toBe(true)
    })

    it('respects limit parameter', async () => {
      const result = await kv.list({ limit: 2 })
      expect(result.keys).toHaveLength(2)
      expect(result.list_complete).toBe(false)
    })

    it('returns keys in alphabetical order', async () => {
      const result = await kv.list({ prefix: 'users:' })
      const names = result.keys.map((k) => k.name)
      expect(names).toEqual(['users:1', 'users:2', 'users:3'])
    })

    it('includes expiration in list results', async () => {
      const expiration = Math.floor(Date.now() / 1000) + 3600
      await kv.put('exp-key', 'value', { expiration })

      const result = await kv.list({ prefix: 'exp-' })
      expect(result.keys[0].expiration).toBe(expiration)
    })

    it('includes metadata in list results', async () => {
      const metadata = { version: 1 }
      await kv.put('meta-list', 'value', { metadata })

      const result = await kv.list({ prefix: 'meta-' })
      expect(result.keys[0].metadata).toEqual(metadata)
    })
  })

  describe('expiration handling', () => {
    it('returns null for expired TTL-based values', async () => {
      // Seed with already expired value
      kv._store.set('expired', {
        value: 'old value',
        expirationTtl: 1,
        storedAt: Date.now() - 2000, // Stored 2 seconds ago
      })

      const result = await kv.get('expired')
      expect(result).toBeNull()
    })

    it('returns null for expired absolute expiration values', async () => {
      kv._store.set('expired-abs', {
        value: 'old value',
        expiration: Math.floor(Date.now() / 1000) - 10, // Expired 10 seconds ago
        storedAt: Date.now() - 20000,
      })

      const result = await kv.get('expired-abs')
      expect(result).toBeNull()
    })

    it('removes expired keys from store on access', async () => {
      kv._store.set('expired', {
        value: 'old value',
        expirationTtl: 1,
        storedAt: Date.now() - 2000,
      })

      await kv.get('expired')
      expect(kv._store.has('expired')).toBe(false)
    })

    it('excludes expired keys from list results', async () => {
      await kv.put('valid', 'value')
      kv._store.set('expired', {
        value: 'old value',
        expirationTtl: 1,
        storedAt: Date.now() - 2000,
      })

      const result = await kv.list()
      expect(result.keys.map((k) => k.name)).not.toContain('expired')
    })
  })

  describe('seedMockKV', () => {
    it('seeds KV with string values', () => {
      seedMockKV(kv, {
        key1: 'value1',
        key2: 'value2',
      })

      expect(kv._store.size).toBe(2)
    })

    it('seeds KV with objects containing metadata', () => {
      seedMockKV(kv, {
        key1: { value: 'value1', metadata: { version: 1 } },
      })

      const stored = kv._store.get('key1')
      expect(stored?.value).toBe('value1')
      expect(stored?.metadata).toEqual({ version: 1 })
    })

    it('seeds KV with TTL options', () => {
      seedMockKV(kv, {
        key1: { value: 'value1', expirationTtl: 3600 },
      })

      const stored = kv._store.get('key1')
      expect(stored?.expirationTtl).toBe(3600)
    })
  })

  describe('clearMockKV', () => {
    it('removes all data from the store', async () => {
      await kv.put('key1', 'value1')
      await kv.put('key2', 'value2')

      clearMockKV(kv)

      expect(kv._store.size).toBe(0)
    })
  })

  describe('vi.fn() tracking', () => {
    it('tracks method calls', async () => {
      await kv.put('key', 'value')
      await kv.get('key')
      await kv.delete('key')

      expect(kv.put).toHaveBeenCalledTimes(1)
      expect(kv.get).toHaveBeenCalledTimes(1)
      expect(kv.delete).toHaveBeenCalledTimes(1)
    })

    it('tracks call arguments', async () => {
      await kv.put('key', 'value', { expirationTtl: 3600 })

      expect(kv.put).toHaveBeenCalledWith('key', 'value', { expirationTtl: 3600 })
    })
  })
})
