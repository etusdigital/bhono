// src/server/__tests__/mocks/__tests__/r2.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockR2, seedMockR2, clearMockR2, type MockR2Bucket } from '../r2'

describe('MockR2Bucket', () => {
  let r2: MockR2Bucket

  beforeEach(() => {
    r2 = createMockR2()
    vi.clearAllMocks()
  })

  describe('createMockR2', () => {
    it('creates a mock R2 bucket with all required methods', () => {
      expect(r2.head).toBeDefined()
      expect(r2.get).toBeDefined()
      expect(r2.put).toBeDefined()
      expect(r2.delete).toBeDefined()
      expect(r2.list).toBeDefined()
      expect(r2.createMultipartUpload).toBeDefined()
      expect(r2.resumeMultipartUpload).toBeDefined()
      expect(r2._store).toBeInstanceOf(Map)
    })
  })

  describe('put', () => {
    it('stores a string value', async () => {
      const result = await r2.put('test.txt', 'Hello, World!')

      expect(result.key).toBe('test.txt')
      expect(result.size).toBe(13)
      expect(r2._store.has('test.txt')).toBe(true)
    })

    it('stores an ArrayBuffer value', async () => {
      const buffer = new TextEncoder().encode('Binary data').buffer
      const result = await r2.put('binary.bin', buffer)

      expect(result.key).toBe('binary.bin')
      expect(result.size).toBe(11)
    })

    it('stores an ArrayBufferView value', async () => {
      const view = new TextEncoder().encode('View data')
      const result = await r2.put('view.bin', view)

      expect(result.key).toBe('view.bin')
      expect(result.size).toBe(9)
    })

    it('stores a Blob value', async () => {
      const blob = new Blob(['Blob content'], { type: 'text/plain' })
      const result = await r2.put('blob.txt', blob)

      expect(result.key).toBe('blob.txt')
      expect(result.size).toBe(12)
    })

    it('stores with httpMetadata', async () => {
      const result = await r2.put('image.png', 'fake image', {
        httpMetadata: {
          contentType: 'image/png',
          cacheControl: 'max-age=3600',
        },
      })

      expect(result.httpMetadata?.contentType).toBe('image/png')
      expect(result.httpMetadata?.cacheControl).toBe('max-age=3600')
    })

    it('stores with customMetadata', async () => {
      const result = await r2.put('doc.pdf', 'fake pdf', {
        customMetadata: {
          author: 'Test Author',
          version: '1.0',
        },
      })

      expect(result.customMetadata?.author).toBe('Test Author')
      expect(result.customMetadata?.version).toBe('1.0')
    })

    it('handles null value', async () => {
      const result = await r2.put('empty.txt', null)

      expect(result.key).toBe('empty.txt')
      expect(result.size).toBe(0)
    })

    it('generates an etag', async () => {
      const result = await r2.put('test.txt', 'content')

      expect(result.etag).toBeDefined()
      expect(result.etag.startsWith('"')).toBe(true)
      expect(result.etag.endsWith('"')).toBe(true)
    })
  })

  describe('get', () => {
    it('returns null for non-existent keys', async () => {
      const result = await r2.get('nonexistent')
      expect(result).toBeNull()
    })

    it('returns the stored object with body', async () => {
      await r2.put('test.txt', 'Hello')
      const result = await r2.get('test.txt')

      expect(result).not.toBeNull()
      expect(result!.key).toBe('test.txt')
      expect(result!.body).toBeInstanceOf(ReadableStream)
    })

    it('allows reading body as text', async () => {
      await r2.put('test.txt', 'Hello, World!')
      const result = await r2.get('test.txt')

      const text = await result!.text()
      expect(text).toBe('Hello, World!')
    })

    it('allows reading body as arrayBuffer', async () => {
      await r2.put('test.txt', 'Buffer')
      const result = await r2.get('test.txt')

      const buffer = await result!.arrayBuffer()
      expect(buffer).toBeInstanceOf(ArrayBuffer)
      expect(new TextDecoder().decode(buffer)).toBe('Buffer')
    })

    it('allows reading body as json', async () => {
      const data = { name: 'Test', count: 42 }
      await r2.put('data.json', JSON.stringify(data))
      const result = await r2.get('data.json')

      const json = await result!.json()
      expect(json).toEqual(data)
    })

    it('allows reading body as blob', async () => {
      await r2.put('test.txt', 'Blob content', {
        httpMetadata: { contentType: 'text/plain' },
      })
      const result = await r2.get('test.txt')

      const blob = await result!.blob()
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('text/plain')
    })

    it('throws when body is read twice', async () => {
      await r2.put('test.txt', 'content')
      const result = await r2.get('test.txt')

      await result!.text()
      await expect(result!.text()).rejects.toThrow('Body already used')
    })
  })

  describe('head', () => {
    it('returns null for non-existent keys', async () => {
      const result = await r2.head('nonexistent')
      expect(result).toBeNull()
    })

    it('returns object metadata without body', async () => {
      await r2.put('test.txt', 'Hello')
      const result = await r2.head('test.txt')

      expect(result).not.toBeNull()
      expect(result!.key).toBe('test.txt')
      expect(result!.size).toBe(5)
    })

    it('includes httpMetadata in head response', async () => {
      await r2.put('image.png', 'fake image', {
        httpMetadata: { contentType: 'image/png' },
      })
      const result = await r2.head('image.png')

      expect(result!.httpMetadata?.contentType).toBe('image/png')
    })
  })

  describe('delete', () => {
    it('removes a single key', async () => {
      await r2.put('to-delete.txt', 'content')
      expect(r2._store.has('to-delete.txt')).toBe(true)

      await r2.delete('to-delete.txt')
      expect(r2._store.has('to-delete.txt')).toBe(false)
    })

    it('removes multiple keys', async () => {
      await r2.put('file1.txt', 'content1')
      await r2.put('file2.txt', 'content2')
      await r2.put('file3.txt', 'content3')

      await r2.delete(['file1.txt', 'file2.txt'])

      expect(r2._store.has('file1.txt')).toBe(false)
      expect(r2._store.has('file2.txt')).toBe(false)
      expect(r2._store.has('file3.txt')).toBe(true)
    })

    it('does not throw for non-existent keys', async () => {
      await expect(r2.delete('nonexistent')).resolves.not.toThrow()
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      await r2.put('images/photo1.jpg', 'photo1')
      await r2.put('images/photo2.jpg', 'photo2')
      await r2.put('images/nested/photo3.jpg', 'photo3')
      await r2.put('documents/doc1.pdf', 'doc1')
      await r2.put('documents/doc2.pdf', 'doc2')
    })

    it('lists all objects when no options provided', async () => {
      const result = await r2.list()
      expect(result.objects).toHaveLength(5)
      expect(result.truncated).toBe(false)
    })

    it('filters by prefix', async () => {
      const result = await r2.list({ prefix: 'images/' })
      expect(result.objects).toHaveLength(3)
      expect(result.objects.every((o) => o.key.startsWith('images/'))).toBe(true)
    })

    it('respects limit parameter', async () => {
      const result = await r2.list({ limit: 2 })
      expect(result.objects).toHaveLength(2)
      expect(result.truncated).toBe(true)
    })

    it('returns objects in alphabetical order', async () => {
      const result = await r2.list({ prefix: 'documents/' })
      const keys = result.objects.map((o) => o.key)
      expect(keys).toEqual(['documents/doc1.pdf', 'documents/doc2.pdf'])
    })

    it('supports delimiter for folder-like listing', async () => {
      const result = await r2.list({ prefix: 'images/', delimiter: '/' })

      // Should return objects directly under images/ and delimited prefixes
      expect(result.delimitedPrefixes).toContain('images/nested/')
    })
  })

  describe('writeHttpMetadata', () => {
    it('writes metadata to headers', async () => {
      await r2.put('test.txt', 'content', {
        httpMetadata: {
          contentType: 'text/plain',
          contentDisposition: 'attachment',
          cacheControl: 'max-age=3600',
        },
      })

      const obj = await r2.get('test.txt')
      const headers = new Headers()
      obj!.writeHttpMetadata(headers)

      expect(headers.get('content-type')).toBe('text/plain')
      expect(headers.get('content-disposition')).toBe('attachment')
      expect(headers.get('cache-control')).toBe('max-age=3600')
    })
  })

  describe('seedMockR2', () => {
    it('seeds with string values', async () => {
      await seedMockR2(r2, {
        'file1.txt': 'content1',
        'file2.txt': 'content2',
      })

      expect(r2._store.size).toBe(2)
      expect(r2._store.has('file1.txt')).toBe(true)
    })

    it('seeds with ArrayBuffer values', async () => {
      const buffer = new TextEncoder().encode('buffer').buffer
      await seedMockR2(r2, {
        'binary.bin': buffer,
      })

      const stored = r2._store.get('binary.bin')
      expect(stored).toBeDefined()
    })

    it('seeds with object values containing metadata', async () => {
      await seedMockR2(r2, {
        'image.png': {
          body: 'fake image',
          httpMetadata: { contentType: 'image/png' },
          customMetadata: { author: 'test' },
        },
      })

      const stored = r2._store.get('image.png')
      expect(stored?.httpMetadata?.contentType).toBe('image/png')
      expect(stored?.customMetadata?.author).toBe('test')
    })
  })

  describe('clearMockR2', () => {
    it('removes all data from the store', async () => {
      await r2.put('file1.txt', 'content1')
      await r2.put('file2.txt', 'content2')

      clearMockR2(r2)

      expect(r2._store.size).toBe(0)
    })
  })

  describe('multipart upload stubs', () => {
    it('createMultipartUpload returns upload object', async () => {
      const upload = await r2.createMultipartUpload('large-file.bin')

      expect(upload.key).toBe('large-file.bin')
      expect(upload.uploadId).toBeDefined()
      expect(upload.uploadPart).toBeDefined()
      expect(upload.abort).toBeDefined()
      expect(upload.complete).toBeDefined()
    })

    it('resumeMultipartUpload returns upload object', async () => {
      const upload = await r2.resumeMultipartUpload('large-file.bin', 'upload-123')

      expect(upload.key).toBe('large-file.bin')
      expect(upload.uploadId).toBe('upload-123')
    })
  })

  describe('vi.fn() tracking', () => {
    it('tracks method calls', async () => {
      await r2.put('test.txt', 'content')
      await r2.get('test.txt')
      await r2.head('test.txt')
      await r2.delete('test.txt')
      await r2.list()

      expect(r2.put).toHaveBeenCalledTimes(1)
      expect(r2.get).toHaveBeenCalledTimes(1)
      expect(r2.head).toHaveBeenCalledTimes(1)
      expect(r2.delete).toHaveBeenCalledTimes(1)
      expect(r2.list).toHaveBeenCalledTimes(1)
    })

    it('tracks call arguments', async () => {
      await r2.put('file.txt', 'content', {
        httpMetadata: { contentType: 'text/plain' },
      })

      expect(r2.put).toHaveBeenCalledWith('file.txt', 'content', {
        httpMetadata: { contentType: 'text/plain' },
      })
    })
  })
})
