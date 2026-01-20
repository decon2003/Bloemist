
import db from '@/lib/server/db'
import { orders, tasks, florists, staffCheckins, workspaceSettings, staffProfiles } from '@/lib/mock-data'

const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    avatar TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS store_locations (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    receiver_name TEXT NOT NULL,
    receiver_phone TEXT NOT NULL,
    bouquet_name TEXT NOT NULL,
    bouquet_image TEXT,
    receive_time TEXT NOT NULL,
    delivery_type TEXT NOT NULL,
    delivery_address TEXT,
    status TEXT NOT NULL,
    listed_price TEXT NOT NULL,
    discount TEXT,
    delivery_fee TEXT,
    delivery_covered_by_shop INTEGER DEFAULT 0,
    vat_percent REAL,
    deposit TEXT,
    selling_price TEXT,
    remaining_balance TEXT,
    total TEXT NOT NULL,
    notes TEXT,
    created_by_id TEXT,
    created_by_name TEXT,
    assignee_id TEXT,
    assignee_name TEXT,
    new_customer INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by_id) REFERENCES users(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    order_code TEXT,
    bouquet_name TEXT NOT NULL,
    bouquet_image TEXT,
    task_title TEXT NOT NULL,
    sample_photo_urls TEXT,
    status TEXT NOT NULL,
    due_time TEXT NOT NULL,
    start_time TEXT,
    completed_at TEXT,
    completion_proof_url TEXT,
    notes TEXT,
    type TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    price TEXT,
    assignee_id TEXT,
    assignee_name TEXT,
    last_assignee_name TEXT,
    last_assigned_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS staff_checkins (
    id TEXT PRIMARY KEY,
    staff_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    discipline TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    check_in_at TEXT,
    check_out_at TEXT,
    working_hours REAL,
    location_label TEXT NOT NULL,
    location_type TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    distance_from_office_km REAL NOT NULL,
    orders_touched INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    notes TEXT,
    requires_review INTEGER DEFAULT 0,
    verification_status TEXT,
    verification_note TEXT,
    FOREIGN KEY (staff_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'BOUQUET' or 'MATERIAL'
    image TEXT,
    unit TEXT,
    on_hand INTEGER DEFAULT 0,
    reserved INTEGER DEFAULT 0,
    status TEXT NOT NULL,
    last_updated TEXT DEFAULT (datetime('now'))
  );
`;

const mapUser = (p: any) => ({
    id: p.id,
    name: p.name,
    email: p.email || `${p.name.toLowerCase().replace(' ', '.')}@bloemist.com`,
    phone: p.phone || '+1 555-0000',
    role: p.role || (p.specialty === 'sales' ? 'sales' : 'florist'),
    status: 'active',
    avatar: p.avatar,
    created_at: new Date().toISOString()
})

async function main() {
    console.log('Running schema migration...')
    // Split schema by semi-colon to run individually if needed, 
    // but execute multiple statements is supported by LibSQL batch usually.
    // However, simplest is to execute one by one or createClient({url}).batch()

    // Simple split
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0)
    for (const sql of statements) {
        await db.execute(sql)
    }
    console.log('Schema applied.')

    console.log('Seeding data...')

    // Users
    const usersList = [
        { id: 'user-1', name: 'Admin User', email: 'admin@bloemist.com', role: 'admin' },
        ...staffProfiles
    ].map(mapUser)

    for (const u of usersList) {
        await db.execute({
            sql: `INSERT OR REPLACE INTO users (id, name, email, phone, role, status, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [u.id, u.name, u.email, u.phone, u.role, u.status, u.avatar, u.created_at]
        })
    }
    console.log(`Seeded ${usersList.length} users.`)

    // Orders
    for (const o of orders) {
        await db.execute({
            sql: `INSERT OR REPLACE INTO orders (
                id, code, customer_name, customer_phone, receiver_name, receiver_phone,
                bouquet_name, bouquet_image, receive_time, delivery_type, delivery_address, status,
                listed_price, discount, delivery_fee, delivery_covered_by_shop,
                vat_percent, deposit, selling_price, remaining_balance, total, notes,
                created_by_id, created_by_name, assignee_id, assignee_name, new_customer
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                o.id, o.code, o.customerName, o.customerPhone, o.receiverName, o.receiverPhone,
                o.bouquetName, o.bouquetImage, o.receiveTime, o.deliveryType, o.deliveryAddress || null, o.status,
                o.listedPrice, o.discount, o.deliveryFee, o.deliveryCoveredByShop ? 1 : 0,
                o.vatPercent, o.deposit, o.sellingPrice, o.remainingBalance, o.total, o.notes,
                o.createdById, o.createdByName, o.assigneeId, o.assigneeName, o.new_customer ? 1 : 0
            ]
        })
    }
    console.log(`Seeded ${orders.length} orders.`)

    // Tasks
    for (const t of tasks) {
        await db.execute({
            sql: `INSERT OR REPLACE INTO tasks (
                id, order_id, order_code, bouquet_name, bouquet_image, task_title,
                sample_photo_urls, status, due_time, start_time, completed_at,
                completion_proof_url, notes, type, quantity, price, assignee_id,
                assignee_name, last_assignee_name, last_assigned_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                t.id, t.orderId, t.orderCode, t.bouquetName, t.bouquetImage, t.taskTitle,
                JSON.stringify(t.samplePhotoUrls || []), t.status, t.dueTime, t.startTime, t.completedAt,
                t.completionProofUrl, t.notes, t.type, t.quantity, t.price, t.assigneeId,
                t.assigneeName, t.lastAssigneeName, t.lastAssignedAt, t.createdAt
            ]
        })
    }
    console.log(`Seeded ${tasks.length} tasks.`)

    // Checkins
    for (const c of staffCheckins) {
        await db.execute({
            sql: `INSERT OR REPLACE INTO staff_checkins (
                id, staff_id, staff_name, discipline, timestamp, check_in_at, check_out_at,
                working_hours, location_label, location_type, lat, lng,
                distance_from_office_km, orders_touched, completed_tasks, notes,
                requires_review, verification_status, verification_note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                c.id, c.staffId, c.staffName, c.discipline, c.timestamp, c.checkInAt, c.checkOutAt,
                c.workingHours, c.locationLabel, c.locationType, c.coordinates.lat, c.coordinates.lng,
                c.distanceFromOfficeKm, c.ordersTouched, c.completedTasks, c.notes,
                c.requiresReview ? 1 : 0, c.verificationStatus, c.verificationNote
            ]
        })
    }
    console.log(`Seeded ${staffCheckins.length} checkins.`)

    // Locations
    for (const l of workspaceSettings.storeLocations) {
        await db.execute({
            sql: `INSERT OR REPLACE INTO store_locations (id, label, lat, lng, address) VALUES (?, ?, ?, ?, ?)`,
            args: [l.id, l.label, l.coordinates.lat, l.coordinates.lng, l.address]
        })
    }
    console.log(`Seeded ${workspaceSettings.storeLocations.length} locations.`)
    console.log('All done!')
}

main().catch(console.error)
