const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'florist.db');
const db = new Database(dbPath, { verbose: console.log });
console.log('DB Opened');

try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT
    );
  `);
    console.log('Table created');

    const stmt = db.prepare('INSERT INTO users (id, name) VALUES (?, ?)');
    stmt.run('user-1', 'Admin User');
    console.log('User inserted');

    const rows = db.prepare('SELECT * FROM users').all();
    console.log('Rows:', rows);

} catch (e) {
    console.error('Error:', e);
}
