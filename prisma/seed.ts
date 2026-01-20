
import db from '@/lib/server/db'
import { orders, tasks, staffCheckins, workspaceSettings, staffProfiles } from '@/lib/mock-data'

async function main() {
    console.log('Seeding database with Prisma...')

    // Clear existing data? (Optional, maybe for dev)
    // await db.task.deleteMany()
    // await db.order.deleteMany()
    // await db.user.deleteMany()
    // await db.storeLocation.deleteMany()

    // Seed Users
    const usersList = [
        { id: 'user-1', name: 'Admin User', email: 'admin@bloemist.com', role: 'admin' },
        ...staffProfiles
    ]

    for (const u of usersList) {
        await db.user.upsert({
            where: { email: u.email || `${u.name.replace(' ', '')}@bloemist.com` },
            update: {},
            create: {
                id: u.id,
                name: u.name,
                email: u.email || `${u.name.toLowerCase().replace(' ', '.')}@bloemist.com`,
                phone: '+1 555-0000',
                role: u.role || (u.specialty === 'sales' ? 'sales' : 'florist'),
                status: 'active',
                avatar: u.avatar
            }
        })
    }
    console.log(`Seeded users.`)

    // Seed Orders
    for (const o of orders) {
        await db.order.upsert({
            where: { code: o.code },
            update: {},
            create: {
                id: o.id,
                code: o.code,
                customerName: o.customerName,
                customerPhone: o.customerPhone,
                receiverName: o.receiverName,
                receiverPhone: o.receiverPhone,
                bouquetName: o.bouquetName,
                bouquetImage: o.bouquetImage,
                receiveTime: new Date(o.receiveTime),
                deliveryType: o.deliveryType,
                status: o.status,
                listedPrice: o.listedPrice,
                discount: o.discount,
                deliveryFee: o.deliveryFee,
                deliveryCoveredByShop: o.deliveryCoveredByShop,
                vatPercent: o.vatPercent,
                deposit: o.deposit,
                sellingPrice: o.sellingPrice,
                remainingBalance: o.remainingBalance,
                total: o.total,
                notes: o.notes,
                createdById: o.createdById,
                createdByName: o.createdByName,
                assigneeId: o.assigneeId,
                assigneeName: o.assigneeName,
                new_customer: o.new_customer
            }
        })
    }
    console.log(`Seeded orders.`)

    // Seed Tasks
    for (const t of tasks) {
        // Check if task exists to avoid error if ID matches
        const exists = await db.task.findUnique({ where: { id: t.id } })
        if (!exists) {
            await db.task.create({
                data: {
                    id: t.id,
                    orderId: t.orderId,
                    orderCode: t.orderCode,
                    bouquetName: t.bouquetName,
                    bouquetImage: t.bouquetImage,
                    taskTitle: t.taskTitle,
                    samplePhotoUrls: JSON.stringify(t.samplePhotoUrls || []),
                    status: t.status,
                    dueTime: new Date(t.dueTime),
                    startTime: t.startTime ? new Date(t.startTime) : null,
                    completedAt: t.completedAt ? new Date(t.completedAt) : null,
                    notes: t.notes,
                    type: t.type,
                    quantity: t.quantity,
                    price: t.price,
                    assigneeId: t.assigneeId,
                    assigneeName: t.assigneeName
                }
            })
        }
    }
    console.log(`Seeded tasks.`)

    // Seed Locations
    for (const l of workspaceSettings.storeLocations) {
        await db.storeLocation.upsert({
            where: { id: l.id },
            update: {},
            create: {
                id: l.id,
                label: l.label,
                address: l.address,
                lat: l.coordinates.lat,
                lng: l.coordinates.lng
            }
        })
    }
    console.log(`Seeded locations.`)

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
