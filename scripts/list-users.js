const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Fetching users from production database...');
    try {
        const users = await prisma.user.findMany();
        if (users.length === 0) {
            console.log('No users found in the database.');
        } else {
            console.log('\n--- Current System Accounts ---');
            users.forEach(user => {
                console.log(`- ${user.name} (${user.role})`);
                console.log(`  Email: ${user.email}`);
                console.log(`  ID: ${user.id}`);
                console.log('-------------------------------');
            });
        }
    } catch (e) {
        console.error('Error fetching users:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
