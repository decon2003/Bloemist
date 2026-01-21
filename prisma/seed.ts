import db from '@/lib/server/db'

async function main() {
    console.log('Seeding database...')

    // Create Admin User
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

    console.log(`Admin user created: ${adminUser.email}`)

    // Create default store location
    await db.storeLocation.upsert({
        where: { id: 'store-main' },
        update: {},
        create: {
            id: 'store-main',
            label: 'Bloemist Studio — Main',
            address: '123 Flower Street',
            lat: 10.762622,
            lng: 106.660172
        }
    })

    console.log('Store location created.')
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
