const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Cleaning up database...');

    // Delete all check-ins first (foreign key constraint)
    await prisma.staffCheckIn.deleteMany({});
    console.log('- Deleted all check-ins');

    // Delete all tasks (foreign key constraint)
    await prisma.task.deleteMany({});
    console.log('- Deleted all tasks');

    // Delete all orders (foreign key constraint)
    await prisma.order.deleteMany({});
    console.log('- Deleted all orders');

    // Delete all messages
    await prisma.message.deleteMany({});
    console.log('- Deleted all messages');

    // Delete all users EXCEPT the main admin
    await prisma.user.deleteMany({
        where: {
            email: { not: 'admin@bloemist.com' }
        }
    });
    console.log('- Deleted all mock users (kept admin@bloemist.com)');

    // Verify
    const remaining = await prisma.user.findMany();
    console.log('\nRemaining users:', remaining.length);
    remaining.forEach(u => console.log(`  - ${u.name} | ${u.email} | ${u.role}`));

    console.log('\n✅ Database cleaned successfully!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
