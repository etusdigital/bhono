// src/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().default('db.sqlite'),

  // JWT (required for auth)
  JWT_SECRET: z.string().min(32).default('development-secret-key-min-32-chars'),
  JWT_EXPIRY_MINUTES: z.coerce.number().default(15),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:3000/auth/callback'),

  // Refresh Token
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(30),

  // SendGrid (for invitations)
  SENDGRID_API_KEY: z.string().min(1),
  SENDGRID_FROM_EMAIL: z.string().email(),

  // App URL (for invitation links)
  APP_URL: z.string().url().default('http://localhost:3000'),

  // Optional
  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export const env = envSchema.parse(process.env)
export type Env = z.infer<typeof envSchema>
