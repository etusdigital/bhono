// src/server/lib/r2-storage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateUploadUrl,
  uploadFile,
  deleteFile,
  getFileMetadata,
  listFiles,
} from '@server/lib/r2-storage'
import { createMockR2, type MockR2Bucket } from '@tests/mocks/r2'

describe('r2-storage', () => {
  let mockR2: MockR2Bucket

  beforeEach(() => {
    mockR2 = createMockR2()
    vi.clearAllMocks()
  })

  describe('generateUploadUrl', () => {
    const accountId = 'acc_test123'

    it('should generate URL with account prefix and timestamp', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const publicUrl = 'https://cdn.example.com'
      const filename = 'test-image.png'
      const contentType = 'image/png'

      const result = await generateUploadUrl(r2Bucket, publicUrl, filename, contentType, accountId)

      // Should have account prefix followed by timestamp prefix in the name
      expect(result.name).toMatch(/^acc_test123\/\d+-test-image\.png$/)
      // URL should be the internal upload endpoint
      expect(result.url).toContain('/api/storage/upload/')
      // Public URL should be constructed correctly with account prefix
      expect(result.publicUrl).toMatch(/^https:\/\/cdn\.example\.com\/acc_test123\/\d+-test-image\.png$/)
    })

    it('should throw error when filename is missing', () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const publicUrl = 'https://cdn.example.com'
      const contentType = 'image/png'

      expect(() => generateUploadUrl(r2Bucket, publicUrl, '', contentType, accountId)).toThrow(
        'Filename and ContentType are required.'
      )
    })

    it('should throw error when contentType is missing', () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const publicUrl = 'https://cdn.example.com'
      const filename = 'test-image.png'

      expect(() => generateUploadUrl(r2Bucket, publicUrl, filename, '', accountId)).toThrow(
        'Filename and ContentType are required.'
      )
    })

    it('should throw error when accountId is missing', () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const publicUrl = 'https://cdn.example.com'
      const filename = 'test-image.png'
      const contentType = 'image/png'

      expect(() => generateUploadUrl(r2Bucket, publicUrl, filename, contentType, '')).toThrow(
        'Account ID is required for storage operations.'
      )
    })

    it('should preserve folder structure in the filename with account prefix', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const publicUrl = 'https://cdn.example.com'
      const filename = 'images/avatars/user-photo.jpg'
      const contentType = 'image/jpeg'

      const result = await generateUploadUrl(r2Bucket, publicUrl, filename, contentType, accountId)

      // Should have account prefix followed by folder structure with timestamp on the file part
      expect(result.name).toMatch(/^acc_test123\/images\/avatars\/\d+-user-photo\.jpg$/)
    })

    it('should handle publicUrl with trailing slash', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const publicUrl = 'https://cdn.example.com/'
      const filename = 'test.txt'
      const contentType = 'text/plain'

      const result = await generateUploadUrl(r2Bucket, publicUrl, filename, contentType, accountId)

      // Should not have double slashes (except in https://)
      expect(result.publicUrl.replace('https://', '')).not.toContain('//')
      expect(result.publicUrl).toMatch(/^https:\/\/cdn\.example\.com\/acc_test123\/\d+-test\.txt$/)
    })
  })

  describe('uploadFile', () => {
    it('should upload file to R2', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const key = 'test-file.txt'
      const body = new TextEncoder().encode('Hello, World!').buffer
      const contentType = 'text/plain'

      const result = await uploadFile(r2Bucket, key, body, contentType)

      expect(result).toBeDefined()
      expect(result.key).toBe(key)
      expect(mockR2.put).toHaveBeenCalledWith(key, body, {
        httpMetadata: {
          contentType,
        },
      })
    })

    it('should throw error when upload fails', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const key = 'test-file.txt'
      const body = new TextEncoder().encode('Hello, World!').buffer
      const contentType = 'text/plain'

      // Mock put to return null (upload failure)
      mockR2.put.mockResolvedValueOnce(null)

      await expect(uploadFile(r2Bucket, key, body, contentType)).rejects.toThrow(
        'Failed to upload file to R2'
      )
    })
  })

  describe('deleteFile', () => {
    it('should delete file from R2', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const key = 'test-file.txt'

      // First upload a file
      await mockR2.put(key, 'content')
      expect(mockR2._store.has(key)).toBe(true)

      // Then delete it
      await deleteFile(r2Bucket, key)

      expect(mockR2.delete).toHaveBeenCalledWith(key)
      expect(mockR2._store.has(key)).toBe(false)
    })
  })

  describe('getFileMetadata', () => {
    it('should return metadata for existing file', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const key = 'existing-file.txt'

      // Upload a file first
      await mockR2.put(key, 'Test content', {
        httpMetadata: { contentType: 'text/plain' },
      })

      const result = await getFileMetadata(r2Bucket, key)

      expect(result).not.toBeNull()
      expect(result!.key).toBe(key)
      expect(mockR2.head).toHaveBeenCalledWith(key)
    })

    it('should return null for non-existent file', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket
      const key = 'non-existent-file.txt'

      const result = await getFileMetadata(r2Bucket, key)

      expect(result).toBeNull()
      expect(mockR2.head).toHaveBeenCalledWith(key)
    })
  })

  describe('listFiles', () => {
    it('should list files with prefix', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket

      // Seed some files
      await mockR2.put('images/photo1.jpg', 'photo1')
      await mockR2.put('images/photo2.jpg', 'photo2')
      await mockR2.put('documents/doc1.pdf', 'doc1')

      const result = await listFiles(r2Bucket, 'images/')

      expect(mockR2.list).toHaveBeenCalledWith({
        prefix: 'images/',
        limit: 100,
      })
      expect(result.objects.length).toBeGreaterThan(0)
      expect(result.objects.every((obj) => obj.key.startsWith('images/'))).toBe(true)
    })

    it('should use default limit of 100 when not specified', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket

      await listFiles(r2Bucket)

      expect(mockR2.list).toHaveBeenCalledWith({
        prefix: undefined,
        limit: 100,
      })
    })

    it('should use custom limit when specified', async () => {
      const r2Bucket = mockR2 as unknown as R2Bucket

      await listFiles(r2Bucket, 'prefix/', 50)

      expect(mockR2.list).toHaveBeenCalledWith({
        prefix: 'prefix/',
        limit: 50,
      })
    })
  })
})
