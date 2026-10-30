import db from '@/lib/server/db'

async function main() {
    console.log('Seeding database...')

    // Create Admin User (random id: a fixed one would be guessable)
    const adminUser = {
        name: 'Admin',
        email: 'admin@bloemist.com',
        role: 'admin',
        phone: '0000000000',
        status: 'active'
    }

    // The shop has one admin account, the owner's: never make a second one
    // (the owner may have changed its e-mail since).
    const owner = await db.user.findFirst({ where: { role: 'admin' } })
    if (owner) {
        console.log(`Admin account already exists: ${owner.email}`)
    } else {
        await db.user.create({ data: adminUser })
        console.log(`Admin user created: ${adminUser.email}`)
    }

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
