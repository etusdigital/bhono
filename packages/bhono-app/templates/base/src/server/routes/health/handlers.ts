import type { Context } from 'hono'
import type { HonoEnv } from '../../types'
import { queryOne } from '../../db/sql'

async function checkDatabase(c: Context<HonoEnv>): Promise<'up' | 'down'> {
  try {
    const db = c.env.DB
    if (!db) {
      return 'down'
    }

    // Simple connectivity check using D1
    await queryOne(db, 'SELECT 1 AS ok')
    return 'up'
  } catch {
    return 'down'
  }
}

async function checkStorage(c: Context<HonoEnv>): Promise<'up' | 'down'> {
  try {
    const r2Bucket = c.env.R2_BUCKET
    if (!r2Bucket) {
      return 'down'
    }

    // Test R2 access with minimal operation
    await r2Bucket.list({ limit: 1 })
    return 'up'
  } catch {
    return 'down'
  }
}

export const handleHealth = async (c: Context<HonoEnv>) => {
  // Run checks with 5 second timeout for each
  const checkPromises = [
    Promise.race([
      checkDatabase(c),
      new Promise<'down'>((resolve) => setTimeout(() => { resolve('down'); }, 5000))
    ]),
    Promise.race([
      checkStorage(c),
      new Promise<'down'>((resolve) => setTimeout(() => { resolve('down'); }, 5000))
    ])
  ]

  const [database, storage] = await Promise.all(checkPromises)

  const status: 'healthy' | 'unhealthy' = database === 'up' && storage === 'up' ? 'healthy' : 'unhealthy'
  const statusCode = status === 'healthy' ? 200 : 503

  return c.json({
    status,
    timestamp: new Date().toISOString(),
    checks: {
      database,
      storage
    },
    uptime: 0
  }, statusCode)
}

export const handleReady = async (c: Context<HonoEnv>) => {
  try {
    const dbStatus = await Promise.race([
      checkDatabase(c),
      new Promise<'down'>((resolve) => setTimeout(() => { resolve('down'); }, 5000))
    ])

    if (dbStatus === 'up') {
      return c.json({ ready: true }, 200)
    } else {
      return c.json({ ready: false }, 503)
    }
  } catch {
    return c.json({ ready: false }, 503)
  }
}

export const handleLive = (c: Context<HonoEnv>) => {
  return c.json({ alive: true }, 200)
}
