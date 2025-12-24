// src/server/routes/storage/routes.ts
import { createRoute } from '@hono/zod-openapi'
import {
  GenerateUploadUrlSchema,
  UploadUrlResponseSchema,
  UploadFileParamSchema,
  UploadSuccessSchema,
  DeleteFileParamSchema,
} from './schemas'
import { ErrorResponseSchema } from '../schemas'

export const generateUploadUrlRoute = createRoute({
  method: 'post',
  path: '/upload-url',
  tags: ['Storage'],
  summary: 'Generate a presigned URL for file upload',
  request: {
    body: {
      content: { 'application/json': { schema: GenerateUploadUrlSchema } },
    },
  },
  responses: {
    200: {
      description: 'Upload URL generated successfully',
      content: {
        'application/json': {
          schema: UploadUrlResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid input',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const uploadFileRoute = createRoute({
  method: 'put',
  path: '/upload/{key}',
  tags: ['Storage'],
  summary: 'Upload a file to storage',
  request: {
    params: UploadFileParamSchema,
  },
  responses: {
    200: {
      description: 'File uploaded successfully',
      content: {
        'application/json': {
          schema: UploadSuccessSchema,
        },
      },
    },
    400: {
      description: 'Invalid input or missing file',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})

export const deleteFileRoute = createRoute({
  method: 'delete',
  path: '/{key}',
  tags: ['Storage'],
  summary: 'Delete a file from storage',
  request: {
    params: DeleteFileParamSchema,
  },
  responses: {
    204: {
      description: 'File deleted successfully',
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'File not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
})
