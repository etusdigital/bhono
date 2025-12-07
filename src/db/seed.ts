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
      isSuperAdmin: true,
      status: 'active',
    })
    .returning()

  console.log('Created super admin:', superAdmin.email)

  // 3. Create test users with different roles
  const testUsers = [
    { email: 'manager@example.com', name: 'Manager User', role: 'MANAGER' as const },
    { email: 'editor@example.com', name: 'Editor User', role: 'EDITOR' as const },
    { email: 'author@example.com', name: 'Author User', role: 'AUTHOR' as const },
    { email: 'viewer@example.com', name: 'Viewer User', role: 'VIEWER' as const },
  ]

  for (const { email, name, role } of testUsers) {
    const [user] = await db
      .insert(users)
      .values({
        email,
        name,
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
