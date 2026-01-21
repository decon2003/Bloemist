const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const usersToAdd = [
    { name: 'Nguyen Van A', email: 'nguyenvana@bloemist.com', phone: '0901111111', role: 'sales' },
    { name: 'Tran Thi B', email: 'tranthib@bloemist.com', phone: '0902222222', role: 'florist' },
];

async function main() {
    console.log('Adding users...');

    for (const userData of usersToAdd) {
        try {
            const user = await prisma.user.create({
                data: { ...userData, status: 'active' }
            });
            console.log('Created:', user.name, '-', user.email);
        } catch (e) {
            console.log('Skipped (exists?):', userData.email);
        }
    }

    console.log('\n--- All Users ---');
    const allUsers = await prisma.user.findMany();
    allUsers.forEach(u => console.log(`- ${u.name} | ${u.email} | ${u.role}`));
    console.log(`\nTotal: ${allUsers.length} users`);
}

main()
    .catch(e => console.error('Error:', e.message))
    .finally(() => prisma.$disconnect());
