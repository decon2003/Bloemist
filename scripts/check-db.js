const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    console.log('Total users in database:', users.length);
    users.forEach(u => {
        console.log(`- ${u.name} | ${u.email} | ${u.role} | ${u.status}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
