const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'florist.db');
const db = new Database(dbPath);

console.log('Migrating database at', dbPath);

try {
    // Check if column exists
    const tableInfo = db.pragma('table_info(orders)');
    const hasColumn = tableInfo.some(col => col.name === 'delivery_address');

    if (!hasColumn) {
        console.log('Adding delivery_address column to orders table...');
        db.exec('ALTER TABLE orders ADD COLUMN delivery_address TEXT');
        console.log('Migration successful.');
    } else {
        console.log('Column delivery_address already exists. Skipping.');
    }
} catch (error) {
    console.error('Migration failed:', error);
}
