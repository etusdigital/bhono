import { describe, it, expect } from 'vitest'
import {
  generateUploadUrl,
  uploadFile,
  deleteFile,
  getFileMetadata,
  listFiles,
} from '@server/lib/r2-storage'
import { createMockR2AsR2Bucket } from '@tests/mocks/r2'

describe('generateUploadUrl', () => {
  it('builds a timestamped key and public URL for a plain filename', () => {
    const r2 = createMockR2AsR2Bucket()
    const res = generateUploadUrl(r2, 'https://cdn.example.com', 'photo.png', 'image/png')
    expect(res.name).toMatch(/^\d+-photo\.png$/)
    expect(res.url).toBe(`/api/storage/upload/${encodeURIComponent(res.name)}`)
    expect(res.publicUrl).toBe(`https://cdn.example.com/${res.name}`)
  })

  it('preserves folder structure in the key', () => {
    const r2 = createMockR2AsR2Bucket()
    const res = generateUploadUrl(r2, 'https://cdn.example.com', 'avatars/user/photo.png', 'image/png')
    expect(res.name).toMatch(/^avatars\/user\/\d+-photo\.png$/)
  })

  it('does not double the slash when publicUrl ends with /', () => {
    const r2 = createMockR2AsR2Bucket()
    const res = generateUploadUrl(r2, 'https://cdn.example.com/', 'photo.png', 'image/png')
    expect(res.publicUrl).not.toContain('//' + res.name)
    expect(res.publicUrl).toBe(`https://cdn.example.com/${res.name}`)
  })

  it('throws when filename is missing', () => {
    const r2 = createMockR2AsR2Bucket()
    expect(() => generateUploadUrl(r2, 'https://cdn.example.com', '', 'image/png')).toThrow()
  })

  it('throws when contentType is missing', () => {
    const r2 = createMockR2AsR2Bucket()
    expect(() => generateUploadUrl(r2, 'https://cdn.example.com', 'photo.png', '')).toThrow()
  })
})

describe('uploadFile / getFileMetadata / deleteFile / listFiles', () => {
  it('uploads a file and reads its metadata back', async () => {
    const r2 = createMockR2AsR2Bucket()
    const body = new TextEncoder().encode('hello').buffer
    const result = await uploadFile(r2, 'docs/a.txt', body, 'text/plain')
    expect(result).toBeTruthy()

    const meta = await getFileMetadata(r2, 'docs/a.txt')
    expect(meta).not.toBeNull()
  })

  it('returns null metadata for a missing key', async () => {
    const r2 = createMockR2AsR2Bucket()
    const meta = await getFileMetadata(r2, 'does/not/exist.txt')
    expect(meta).toBeNull()
  })

  it('deletes a file', async () => {
    const r2 = createMockR2AsR2Bucket()
    const body = new TextEncoder().encode('x').buffer
    await uploadFile(r2, 'gone.txt', body, 'text/plain')
    await deleteFile(r2, 'gone.txt')
    expect(await getFileMetadata(r2, 'gone.txt')).toBeNull()
  })

  it('lists uploaded files', async () => {
    const r2 = createMockR2AsR2Bucket()
    const body = new TextEncoder().encode('x').buffer
    await uploadFile(r2, 'list/one.txt', body, 'text/plain')
    await uploadFile(r2, 'list/two.txt', body, 'text/plain')
    const listed = await listFiles(r2, 'list/')
    expect(listed.objects.length).toBe(2)
  })
})
