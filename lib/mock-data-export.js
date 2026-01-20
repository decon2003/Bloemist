const { florists, staffProfiles, orders, tasks, staffCheckins, workspaceSettings } = require('./mock-data.ts');

// Create users from florists and staffProfiles
// Since staffProfiles seems to be the superset often, let's merge them.
const usersMap = new Map();

// Helper to create basic user data
const makeUser = (id, name, role = 'user', email = '', phone = '') => ({
    id,
    name,
    email: email || `${name.toLowerCase().replace(/\s/g, '.')}@bloemist.com`,
    phone: phone || '+1 555-0000',
    role: 'florist', // default
    status: 'active',
    avatar: null,
    createdAt: new Date().toISOString()
});

// Seed from florists array
florists.forEach(f => {
    if (!usersMap.has(f.id)) {
        usersMap.set(f.id, makeUser(f.id, f.name));
    }
});

// Seed from staffProfiles array
staffProfiles.forEach(sp => {
    let user = usersMap.get(sp.id);
    if (!user) {
        user = makeUser(sp.id, sp.name);
    }
    user.role = sp.specialty === 'sales' ? 'sales' : 'florist'; // Map specialty to role roughly
    user.avatar = sp.avatar;
    // Adjust specific known users
    if (sp.title.includes('Sales')) user.role = 'sales';
    usersMap.set(sp.id, user);
});

// Add admin user explicitly if not present
if (!usersMap.has('user-1')) {
    usersMap.set('user-1', {
        id: 'user-1',
        name: 'Admin User',
        email: 'admin@bloemist.com',
        phone: '+1 555-1234',
        role: 'admin',
        status: 'active',
        avatar: null,
        createdAt: new Date().toISOString()
    });
}
// Add boss user
if (!usersMap.has('boss-1')) {
    usersMap.set('boss-1', {
        id: 'boss-1',
        name: 'The Boss',
        email: 'boss@bloemist.com',
        phone: '+1 555-9999',
        role: 'boss',
        status: 'active',
        avatar: '🕴️',
        createdAt: new Date().toISOString()
    });
}

// Convert map to array
const users = Array.from(usersMap.values());

module.exports = {
    users,
    orders,
    tasks,
    staffCheckins,
    workspaceSettings
};
