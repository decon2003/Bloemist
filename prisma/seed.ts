
import db from '@/lib/server/db'
import { orders, tasks, staffCheckins, workspaceSettings, staffProfiles, florists } from '@/lib/mock-data'

async function main() {
    console.log('Seeding database with Prisma...')

    // Clear existing data? (Optional, maybe for dev)
    // await db.task.deleteMany()
    // await db.order.deleteMany()
    // await db.user.deleteMany()
    // await db.storeLocation.deleteMany()

    // Seed ONLY the initial Admin User for Production
    const adminUser = {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@bloemist.com',
        role: 'admin',
        phone: '0000000000',
        status: 'active'
    }

    await db.user.upsert({
        where: { email: adminUser.email },
        update: {
            name: adminUser.name,
            role: adminUser.role,
        },
        create: adminUser
    })

    console.log(`Initial Admin user created: ${adminUser.email}`)
    console.log('Seed completed.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await db.$disconnect()
    })
