const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

const databaseUrl = process.env.DATABASE_URL || '';

/** Redact credentials before printing a connection string. */
function describeTarget(url) {
    if (!url) return '(DATABASE_URL is not set)';
    try {
        const parsed = new URL(url);
        return `${parsed.hostname}${parsed.pathname}`;
    } catch {
        return '(unparseable DATABASE_URL)';
    }
}

/** This script issues deleteMany({}) against every table. It runs with whatever
 *  DATABASE_URL happens to be in the ambient environment - which, per DEPLOY.md,
 *  is routinely the production Neon database. Require an explicit, typed
 *  confirmation naming the target host before destroying anything. */
async function confirmDestruction() {
    const target = describeTarget(databaseUrl);

    if (!databaseUrl) {
        console.error('Refusing to run: DATABASE_URL is not set.');
        process.exit(1);
    }

    if (process.env.ALLOW_DESTRUCTIVE_RESET === 'yes') {
        console.log(`ALLOW_DESTRUCTIVE_RESET=yes - proceeding against ${target}`);
        return;
    }

    console.log('');
    console.log('  ⚠  THIS DELETES EVERY CHECK-IN, TASK, ORDER, MESSAGE AND NON-ADMIN USER.');
    console.log(`  ⚠  Target database: ${target}`);
    console.log('  ⚠  There is no undo and no backup taken by this script.');
    console.log('');

    if (!process.stdin.isTTY) {
        console.error('Refusing to run non-interactively. Set ALLOW_DESTRUCTIVE_RESET=yes if you are certain.');
        process.exit(1);
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) =>
        rl.question(`  Type the database host to confirm ("${describeTarget(databaseUrl)}"): `, resolve),
    );
    rl.close();

    if (answer.trim() !== target) {
        console.error('Confirmation did not match. Aborted - nothing was deleted.');
        process.exit(1);
    }
}

async function main() {
    await confirmDestruction();

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
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
