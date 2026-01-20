const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'florist.db');
const db = new Database(dbPath);

console.log('Opened database at', dbPath);

try {
    console.log('Adding assignee columns to orders table...');
    db.exec(`
    ALTER TABLE orders ADD COLUMN assignee_id TEXT REFERENCES users(id);
    ALTER TABLE orders ADD COLUMN assignee_name TEXT;
  `);
    console.log('Migration successful.');
} catch (err) {
    if (err.message.includes('duplicate column name')) {
        console.log('Columns already exist.');
    } else {
        console.error('Migration failed:', err);
    }
}
