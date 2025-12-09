// src/db/seed.ts
import { db } from './client'
import { users, accounts, userAccounts } from './schema'

async function seed() {
  console.log('Seeding database...')

  // 1. Create default account
  const [account] = await db
    .insert(accounts)
    .values({
      name: 'Default Account',
      domain: 'default.local',
      description: 'Default account for testing',
    })
    .returning()

  console.log('Created account:', account.name)

  // 2. Create super admin user
  const [superAdmin] = await db
    .insert(users)
    .values({
      email: 'admin@example.com',
      name: 'Super Admin',
      googleId: 'google-seed-admin-001',
      isSuperAdmin: true,
      status: 'active',
    })
    .returning()

  console.log('Created super admin:', superAdmin.email)

  // 3. Create test users with different roles
  const testUsers = [
    { email: 'manager@example.com', name: 'Manager User', role: 'MANAGER' as const, googleId: 'google-seed-manager-002' },
    { email: 'editor@example.com', name: 'Editor User', role: 'EDITOR' as const, googleId: 'google-seed-editor-003' },
    { email: 'author@example.com', name: 'Author User', role: 'AUTHOR' as const, googleId: 'google-seed-author-004' },
    { email: 'viewer@example.com', name: 'Viewer User', role: 'VIEWER' as const, googleId: 'google-seed-viewer-005' },
  ]

  for (const { email, name, role, googleId } of testUsers) {
    const [user] = await db
      .insert(users)
      .values({
        email,
        name,
        googleId,
        status: 'active',
      })
      .returning()

    await db.insert(userAccounts).values({
      userId: user.id,
      accountId: account.id,
      role,
    })

    console.log(`Created user: ${email} with role: ${role}`)
  }

  console.log('Seeding complete!')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
