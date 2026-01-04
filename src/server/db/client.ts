// src/server/db/client.ts

export function createDb(d1: D1Database) {
  return d1
}

export type Database = D1Database

// For use in middleware - db instance per request
export type DbInstance = D1Database
