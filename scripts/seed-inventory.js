const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'florist.db');
const db = new Database(dbPath);

console.log('Opened database at', dbPath);

const inventory = [
    {
        id: '1',
        name: 'Romance Bouquet',
        type: 'BOUQUET',
        image: '/red-roses-bouquet.png',
        unit: 'arrangement',
        on_hand: 12,
        reserved: 3,
        status: 'ok',
    },
    {
        id: '2',
        name: 'Sunset Arrangement',
        type: 'BOUQUET',
        image: '/sunset-orange-flowers.jpg',
        unit: 'arrangement',
        on_hand: 5,
        reserved: 2,
        status: 'low',
    },
    {
        id: '3',
        name: 'Spring Garden',
        type: 'BOUQUET',
        image: '/spring-flowers-mixed.jpg',
        unit: 'arrangement',
        on_hand: 0,
        reserved: 0,
        status: 'out',
    },
    {
        id: '4',
        name: 'Premium Roses',
        type: 'MATERIAL',
        image: null,
        unit: 'stem',
        on_hand: 150,
        reserved: 25,
        status: 'ok',
    },
    {
        id: '5',
        name: 'Pink Wrapper Paper',
        type: 'MATERIAL',
        image: null,
        unit: 'sheet',
        on_hand: 8,
        reserved: 2,
        status: 'low',
    },
];

const insertItem = db.prepare(`
  INSERT OR REPLACE INTO inventory (id, name, type, image, unit, on_hand, reserved, status)
  VALUES (@id, @name, @type, @image, @unit, @on_hand, @reserved, @status)
`);

db.transaction(() => {
    for (const item of inventory) {
        insertItem.run(item);
    }
})();

console.log('Inventory seeded.');
