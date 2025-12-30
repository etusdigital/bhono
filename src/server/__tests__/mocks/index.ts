// src/server/__tests__/mocks/index.ts

// D1 Database mock
export {
  createMockD1,
  createMockD1AsD1Database,
  setMockQueryResult,
  setMockDefaultResult,
  clearMockQueryResults,
  type MockD1Database,
  type MockPreparedStatement,
} from './db'

// KV Namespace mock
export {
  createMockKV,
  createMockKVAsKVNamespace,
  seedMockKV,
  clearMockKV,
  type MockKVNamespace,
} from './kv'

// R2 Bucket mock
export {
  createMockR2,
  createMockR2AsR2Bucket,
  seedMockR2,
  clearMockR2,
  type MockR2Bucket,
  type MockR2Object,
  type MockR2ObjectBody,
  type MockR2Objects,
} from './r2'
