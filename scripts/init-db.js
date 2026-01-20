const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'florist.db');
const db = new Database(dbPath);

console.log('Opened database at', dbPath);
db.pragma('journal_mode = WAL');

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

db.exec(schema);
console.log('Schema applied.');

// INLINE SEED DATA
const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth()
const dateForDay = (day, hour, minute = 15) =>
  new Date(currentYear, currentMonth, day, hour, minute, 0).toISOString()
const addHours = (iso, hours) => new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString()
const todayDemoCheckIn = new Date(currentYear, currentMonth, now.getDate(), 9, 5, 0).toISOString()
const todayDemoCheckOut = addHours(todayDemoCheckIn, 8.5)

console.log('Defining users...');
const users = [
  { id: 'user-1', name: 'Admin User', email: 'admin@bloemist.com', phone: '+1 555-1234', role: 'admin', status: 'active', createdAt: new Date().toISOString() },
  { id: 'user-2', name: 'Sarah Chen', email: 'florist@bloemist.com', phone: '+1 555-2222', role: 'florist', status: 'active', avatar: '🌸', createdAt: new Date().toISOString() },
  { id: 'user-4', name: 'Nina Patel', email: 'sales@bloemist.com', phone: '+1 555-4444', role: 'sales', status: 'active', avatar: '📞', createdAt: new Date().toISOString() },
  { id: 'user-5', name: 'Marco Ruiz', email: 'marco@bloemist.com', phone: '+1 555-5555', role: 'florist', status: 'active', avatar: '🎨', createdAt: new Date().toISOString() },
  { id: 'user-6', name: 'Jessie Dao', email: 'jessie@bloemist.com', phone: '+1 555-6666', role: 'sales', status: 'active', avatar: '⚡', createdAt: new Date().toISOString() },
  { id: 'boss-1', name: 'The Boss', email: 'boss@bloemist.com', phone: '+1 555-9999', role: 'boss', status: 'active', avatar: '🕴️', createdAt: new Date().toISOString() },
  { id: 'user-miguel', name: 'Miguel Santos', email: 'miguel@bloemist.com', phone: '+1 555-7777', role: 'florist', status: 'active', createdAt: new Date().toISOString() },
  { id: 'user-priya', name: 'Priya Kapoor', email: 'priya@bloemist.com', phone: '+1 555-8888', role: 'florist', status: 'active', createdAt: new Date().toISOString() },
  { id: 'user-olivia', name: 'Olivia Reyes', email: 'olivia@bloemist.com', phone: '+1 555-3333', role: 'florist', status: 'active', createdAt: new Date().toISOString() },
];
console.log('Users defined.');

try {
  console.log('Preparing insertUser...');
  const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, name, email, phone, role, status, avatar, created_at)
  VALUES (@id, @name, @email, @phone, @role, @status, @avatar, @createdAt)
`);

  console.log('Preparing insertOrder...');
  const insertOrder = db.prepare(`
  INSERT OR IGNORE INTO orders (
    id, code, customer_name, customer_phone, receiver_name, receiver_phone,
    bouquet_name, bouquet_image, receive_time, delivery_type, delivery_address, status,
    listed_price, discount, delivery_fee, delivery_covered_by_shop,
    vat_percent, deposit, selling_price, remaining_balance, total, notes,
    created_by_id, created_by_name, new_customer
  )
  VALUES (
    @id, @code, @customerName, @customerPhone, @receiverName, @receiverPhone,
    @bouquetName, @bouquetImage, @receiveTime, @deliveryType, @deliveryAddress, @status,
    @listedPrice, @discount, @deliveryFee, @deliveryCoveredByShop,
    @vatPercent, @deposit, @sellingPrice, @remainingBalance, @total, @notes,
    @createdById, @createdByName, @new_customer
  )
`);

  console.log('Preparing insertTask...');
  const insertTask = db.prepare(`
  INSERT OR IGNORE INTO tasks (
    id, order_id, order_code, bouquet_name, bouquet_image, task_title,
    sample_photo_urls, status, due_time, start_time, completed_at,
    completion_proof_url, notes, type, quantity, price, assignee_id,
    assignee_name, last_assignee_name, last_assigned_at, created_at
  )
  VALUES (
    @id, @orderId, @orderCode, @bouquetName, @bouquetImage, @taskTitle,
    @samplePhotoUrls, @status, @dueTime, @startTime, @completedAt,
    @completionProofUrl, @notes, @type, @quantity, @price, @assigneeId,
    @assigneeName, @lastAssigneeName, @lastAssignedAt, @createdAt
  )
`);

  console.log('Preparing insertCheckin...');
  const insertCheckin = db.prepare(`
  INSERT OR IGNORE INTO staff_checkins (
    id, staff_id, staff_name, discipline, timestamp, check_in_at, check_out_at,
    working_hours, location_label, location_type, lat, lng,
    distance_from_office_km, orders_touched, completed_tasks, notes,
    requires_review, verification_status, verification_note
  )
  VALUES (
    @id, @staffId, @staffName, @discipline, @timestamp, @checkInAt, @checkOutAt,
    @workingHours, @locationLabel, @locationType, @lat, @lng,
    @distanceFromOfficeKm, @ordersTouched, @completedTasks, @notes,
    @requiresReview, @verificationStatus, @verificationNote
  )
`);

  console.log('Preparing insertStoreLocation...');
  const insertStoreLocation = db.prepare(`
  INSERT OR IGNORE INTO store_locations (id, label, lat, lng, address)
  VALUES (@id, @label, @lat, @lng, @address)
`);

  console.log('Starting transaction...');
  const seed = db.transaction(() => {
    if (users) {
      console.log(`Seeding ${users.length} users...`);
      for (const user of users) {
        insertUser.run({ avatar: null, ...user });
      }
    }
    if (orders) {
      console.log(`Seeding ${orders.length} orders...`);
      for (const order of orders) {
        insertOrder.run({
          ...order,
          deliveryCoveredByShop: order.deliveryCoveredByShop ? 1 : 0,
          new_customer: order.new_customer ? 1 : 0
        });
      }
    }
    if (tasks) {
      console.log(`Seeding ${tasks.length} tasks...`);
      for (const task of tasks) {
        insertTask.run({
          ...task,
          samplePhotoUrls: JSON.stringify(task.samplePhotoUrls || [])
        });
      }
    }
    if (staffCheckins) {
      console.log(`Seeding ${staffCheckins.length} checkins...`);
      for (const ci of staffCheckins) {
        insertCheckin.run({
          ...ci,
          lat: ci.coordinates.lat,
          lng: ci.coordinates.lng,
          requiresReview: ci.requiresReview ? 1 : 0
        });
      }
    }
    if (workspaceSettings && workspaceSettings.storeLocations) {
      console.log(`Seeding ${workspaceSettings.storeLocations.length} locations...`);
      for (const loc of workspaceSettings.storeLocations) {
        insertStoreLocation.run({
          id: loc.id,
          label: loc.label,
          lat: loc.coordinates.lat,
          lng: loc.coordinates.lng,
          address: loc.address
        });
      }
    }
  });

  seed();
  console.log('Seed completed successfully.');
} catch (err) {
  console.error('Seeding failed:', err);
}
