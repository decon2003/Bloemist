const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Creating test user...');

    const user = await prisma.user.create({
        data: {
            name: 'Test Florist',
            email: 'florist1@bloemist.com',
            phone: '0901234567',
            role: 'florist',
            status: 'active'
        }
    });

    console.log('Created:', user.name, user.email);

    const allUsers = await prisma.user.findMany();
    console.log('\nTotal users now:', allUsers.length);
    allUsers.forEach(u => console.log('-', u.name, '|', u.email, '|', u.role));
}

main()
    .catch(e => console.error('Error:', e.message))
    .finally(() => prisma.$disconnect());
