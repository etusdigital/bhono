// src/server/routes/storage/schemas.ts
import { z } from '@hono/zod-openapi'

export const GenerateUploadUrlSchema = z
  .object({
    filename: z.string().min(1).openapi({
      example: 'images/my-photo.jpg',
      description: 'The filename with optional folder path',
    }),
    contentType: z.string().min(1).openapi({
      example: 'image/jpeg',
      description: 'The MIME type of the file',
    }),
  })
  .openapi('GenerateUploadUrlInput')

export const UploadUrlResponseSchema = z
  .object({
    url: z.string().openapi({
      example: '/api/storage/upload/images%2F1703123456789-my-photo.jpg',
      description: 'The URL to upload the file to',
    }),
    name: z.string().openapi({
      example: 'images/1703123456789-my-photo.jpg',
      description: 'The unique filename with timestamp',
    }),
    publicUrl: z.string().url().openapi({
      example: 'https://pub-xxx.r2.dev/images/1703123456789-my-photo.jpg',
      description: 'The public URL to access the file after upload',
    }),
  })
  .openapi('UploadUrlResponse')

export const UploadFileParamSchema = z.object({
  key: z.string().min(1).openapi({
    example: 'images%2F1703123456789-my-photo.jpg',
    description: 'The encoded file key to upload',
  }),
})

export const UploadSuccessSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    key: z.string().openapi({ example: 'images/1703123456789-my-photo.jpg' }),
    publicUrl: z.string().url().openapi({
      example: 'https://pub-xxx.r2.dev/images/1703123456789-my-photo.jpg',
    }),
  })
  .openapi('UploadSuccess')

export const DeleteFileParamSchema = z.object({
  key: z.string().min(1).openapi({
    example: 'images%2F1703123456789-my-photo.jpg',
    description: 'The encoded file key to delete',
  }),
})
