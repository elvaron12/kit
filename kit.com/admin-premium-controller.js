// admin-premium-controller.js

// ========== GLOBAL STATE ==========
let currentUser = null;
let orders = [];
let products = [];
let riders = [];
let clubs = [];
let activityLog = [];

// Helper to get stored data or initialize with defaults
function getStoredData(key, defaultData) {
    const stored = localStorage.getItem(key);
    if (stored) {
        return JSON.parse(stored);
    } else {
        localStorage.setItem(key, JSON.stringify(defaultData));
        return defaultData;
    }
}

// Initialize default data if not present
function initializeData() {
    const defaultClubs = [
        { id: "club1", name: "Real Madrid", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/1200px-Real_Madrid_CF.svg.png" },
        { id: "club2", name: "FC Barcelona", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/1200px-FC_Barcelona_%28crest%29.svg.png" },
        { id: "club3", name: "Paris Saint-Germain", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/1200px-Paris_Saint-Germain_F.C..svg.png" },
        { id: "club4", name: "Bayern Munich", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/1200px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png" },
        { id: "club5", name: "Manchester City", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/1200px-Manchester_City_FC_badge.svg.png" }
    ];
    clubs = getStoredData('clubs', defaultClubs);

    const defaultProducts = [
        { id: "prod1", name: "Real Madrid Home 2024", clubId: "club1", category: "home", price: 45000, stock: 120, stockBySize: { S: 10, M: 50, L: 40, XL: 15, XXL: 5 }, sold: 68, featured: true, images: [] },
        { id: "prod2", name: "FC Barcelona Away 2024", clubId: "club2", category: "away", price: 45000, stock: 95, stockBySize: { S: 5, M: 40, L: 35, XL: 10, XXL: 5 }, sold: 42, featured: false, images: [] },
        { id: "prod3", name: "PSG Retro 90s", clubId: "club3", category: "retro", price: 55000, stock: 45, stockBySize: { S: 2, M: 15, L: 18, XL: 8, XXL: 2 }, sold: 33, featured: true, images: [] },
        { id: "prod4", name: "Bayern Munich Home 2024", clubId: "club4", category: "home", price: 42000, stock: 210, stockBySize: { S: 20, M: 70, L: 65, XL: 35, XXL: 20 }, sold: 55, featured: false, images: [] },
        { id: "prod5", name: "Man City Special Edition", clubId: "club5", category: "special", price: 60000, stock: 28, stockBySize: { S: 1, M: 10, L: 10, XL: 5, XXL: 2 }, sold: 20, featured: false, images: [] }
    ];
    products = getStoredData('products', defaultProducts);

    const defaultRiders = [
        { id: "r1", name: "John Doe", phone: "+250 788 123 456", vehicle: "moto", plate: "RAJ-001A", platePhoto: "", profilePhoto: "", active: true, deliveries: 45, failed: 2, rating: 4.8 },
        { id: "r2", name: "Jane Smith", phone: "+250 788 654 321", vehicle: "bicycle", plate: "RAJ-002B", platePhoto: "", profilePhoto: "", active: true, deliveries: 38, failed: 1, rating: 4.9 },
        { id: "r3", name: "Peter Mutoni", phone: "+250 788 789 012", vehicle: "moto", plate: "RAJ-003C", platePhoto: "", profilePhoto: "", active: false, deliveries: 12, failed: 3, rating: 4.2 }
    ];
    riders = getStoredData('riders', defaultRiders);

    const defaultOrders = [
        { id: "ORD-1001", customerName: "Alice Niyomugabo", phone: "+250 788 111 222", address: "Kigali, Kimihurura", notes: "", productId: "prod1", size: "M", quantity: 2, paymentMethod: "momo", amount: 90000, status: "delivered", riderId: "r1", createdAt: new Date(Date.now() - 2*24*60*60*1000).toISOString(), updatedAt: new Date(Date.now() - 1*24*60*60*1000).toISOString() },
        { id: "ORD-1002", customerName: "Bob Kagame", phone: "+250 788 333 444", address: "Kigali, Nyarutarama", notes: "Leave at gate", productId: "prod2", size: "L", quantity: 1, paymentMethod: "cash", amount: 45000, status: "preparing", riderId: null, createdAt: new Date(Date.now() - 1*24*60*60*1000).toISOString(), updatedAt: new Date().toISOString() },
        { id: "ORD-1003", customerName: "Clarisse Uwase", phone: "+250 788 555 666", address: "Kigali, Gikondo", notes: "", productId: "prod3", size: "S", quantity: 1, paymentMethod: "momo", amount: 55000, status: "pending", riderId: null, createdAt: new Date(Date.now() - 5*60*60*1000).toISOString(), updatedAt: new Date().toISOString() },
        { id: "ORD-1004", customerName: "David Habimana", phone: "+250 788 777 888", address: "Kigali, Kacyiru", notes: "Ring bell twice", productId: "prod1", size: "XL", quantity: 1, paymentMethod: "momo", amount: 45000, status: "delivered", riderId: "r2", createdAt: new Date(Date.now() - 3*24*60*60*1000).toISOString(), updatedAt: new Date(Date.now() - 2*24*60*60*1000).toISOString() },
        { id: "ORD-1005", customerName: "Eva Uwitonze", phone: "+250 788 999 000", address: "Kigali, Remera", notes: "", productId: "prod5", size: "M", quantity: 2, paymentMethod: "bank", amount: 120000, status: "cancelled", riderId: null, createdAt: new Date(Date.now() - 4*24*60*60*1000).toISOString(), updatedAt: new Date(Date.now() - 3*24*60*60*1000).toISOString() }
    ];
    orders = getStoredData('orders', defaultOrders);

    const defaultActivity = [
        { id: "act1", action: "Order Created", details: "New order ORD-1003 created by Clarisse Uwase", timestamp: new Date(Date.now() - 5*60*60*1000).toISOString(), icon: "fa-cart-plus" },
        { id: "act2", action: "Order Status Update", details: "Order ORD-1002 status changed to preparing", timestamp: new Date(Date.now() - 4*60*60*1000).toISOString(), icon: "fa-truck" },
        { id: "act3", action: "Rider Assigned", details: "Rider John Doe assigned to ORD-1001", timestamp: new Date(Date.now() - 1*24*60*60*1000).toISOString(), icon: "fa-user-check" }
    ];
    activityLog = getStoredData('activityLog', defaultActivity);
}

// Helper to save all data
function persistData() {
    localStorage.setItem('clubs', JSON.stringify(clubs));
    localStorage.setItem('products', JSON.stringify(products));
    localStorage.setItem('riders', JSON.stringify(riders));
    localStorage.setItem('orders', JSON.stringify(orders));
    localStorage.setItem('activityLog', JSON.stringify(activityLog));
}

// Helper to add activity log
function addActivityLog(action, details, icon = "fa-bell") {
    const newActivity = {
        id: "act" + Date.now(),
        action: action,
        details: details,
        timestamp: new Date().toISOString(),
        icon: icon
    };
    activityLog.unshift(newActivity);
    if (activityLog.length > 100) activityLog.pop();
    persistData();
    renderActivityFeed();
}

// Mock authentication
function login() {
    currentUser = { id: "admin1", name: "Admin User", role: "super_admin" };
    localStorage.setItem('auth', JSON.stringify(currentUser));
    document.body.classList.remove('auth-checking');
    checkAuthAndLoadData();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('auth');
    document.body.classList.add('auth-checking');
    window.location.reload();
}

function checkAuthAndLoadData() {
    const storedAuth = localStorage.getItem('auth');
    if (storedAuth) {
        currentUser = JSON.parse(storedAuth);
        document.body.classList.remove('auth-checking');
        updateUI(); // This will call render functions
    } else {
        login(); // Auto-login for demo, but doesn't cause loop
    }
}

// Main function to update all UI
function updateUI() {
    // Render all components
    renderStats();
    renderCharts();
    renderOrdersTable();
    renderRidersTable();
    renderProductsTable();
    renderLowStockAlerts();
    renderRecentActivity();
    renderInventoryStats();
    renderActivityFeed();
    renderLowStockTable();
    updateBadges();
    populateFilters();
    
    // For analytics page
    renderAnalyticsStats();
    renderSalesByDayChart();
    renderOrdersByWeekChart();
    renderRevenueByClubChart();
    renderStockByClubChart();
}

// Helper: Format currency
function formatRWF(amount) {
    return new Intl.NumberFormat('rw-RW', { style: 'currency', currency: 'RWF', minimumFractionDigits: 0 }).format(amount);
}

// Helper: Get product by ID
function getProductById(id) {
    return products.find(p => p.id === id);
}

// Helper: Get club by ID
function getClubById(id) {
    return clubs.find(c => c.id === id);
}

// Helper: Get rider by ID
function getRiderById(id) {
    return riders.find(r => r.id === id);
}

// ========== RENDER FUNCTIONS ==========
function renderStats() {
    const totalRevenue = orders.reduce((sum, order) => order.status !== 'cancelled' ? sum + (order.amount || 0) : sum, 0);
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const avgDeliveryTime = 2.4; // Mock
    const activeRiders = riders.filter(r => r.active).length;

    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card">
            <div class="stat-card-label"><span class="stat-icon"><i class="fas fa-chart-line"></i></span>Total Revenue</div>
            <div class="stat-card-value">${formatRWF(totalRevenue)}</div>
            <div class="stat-card-trend positive">↑ 15% from last month</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label"><span class="stat-icon"><i class="fas fa-shopping-cart"></i></span>Total Orders</div>
            <div class="stat-card-value">${totalOrders}</div>
            <div class="stat-card-trend positive">↑ 8% from last month</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label"><span class="stat-icon"><i class="fas fa-check-circle"></i></span>Completion Rate</div>
            <div class="stat-card-value">${totalOrders ? ((completedOrders/totalOrders)*100).toFixed(0) : 0}%</div>
            <div class="stat-card-trend positive">↑ 5% from last month</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label"><span class="stat-icon"><i class="fas fa-clock"></i></span>Avg Delivery</div>
            <div class="stat-card-value">${avgDeliveryTime} days</div>
            <div class="stat-card-trend positive">↓ 0.3 days faster</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-label"><span class="stat-icon"><i class="fas fa-motorcycle"></i></span>Active Riders</div>
            <div class="stat-card-value">${activeRiders}</div>
            <div class="stat-card-trend neutral">Steady</div>
        </div>
    `;
}

// --- Charts ---
let revenueChart, clubsChart, orderStatusChart, deliveryChart, jerseysChart, paymentChart;
let salesByDayChart, ordersByWeekChart, revenueByClubChart, stockByClubChart;

function renderCharts() {
    // Revenue Chart
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(revenueCtx, {
        type: 'line',
        data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ label: 'Revenue', data: [125000, 150000, 98000, 210000, 320000, 450000, 380000], borderColor: '#ff6b35', tension: 0.4, fill: true, backgroundColor: 'rgba(255,107,53,0.1)' }] },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#f0f4f9' } } }, scales: { y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });

    // Clubs Chart
    const clubsCtx = document.getElementById('clubsChart').getContext('2d');
    if (clubsChart) clubsChart.destroy();
    const clubSales = clubs.map(club => ({ club: club.name, revenue: orders.reduce((sum, order) => { const prod = getProductById(order.productId); if (prod && prod.clubId === club.id && order.status !== 'cancelled') return sum + (order.amount || 0); return sum; }, 0) }));
    clubsChart = new Chart(clubsCtx, { type: 'bar', data: { labels: clubSales.map(c => c.club), datasets: [{ label: 'Revenue', data: clubSales.map(c => c.revenue), backgroundColor: '#00d4ff' }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#f0f4f9' } } }, scales: { y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#9ca3af', rotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });

    // Order Status Chart
    const statusCtx = document.getElementById('orderStatusChart').getContext('2d');
    if (orderStatusChart) orderStatusChart.destroy();
    const statuses = ['pending', 'confirmed', 'preparing', 'out-for-delivery', 'delivered', 'cancelled'];
    const statusCounts = statuses.map(s => orders.filter(o => o.status === s).length);
    orderStatusChart = new Chart(statusCtx, { type: 'doughnut', data: { labels: statuses.map(s => s.toUpperCase()), datasets: [{ data: statusCounts, backgroundColor: ['#f59e0b', '#3b82f6', '#a855f7', '#06b6d4', '#10b981', '#6b7280'] }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#f0f4f9' } } } } });

    // Delivery Performance
    const deliveryCtx = document.getElementById('deliveryChart').getContext('2d');
    if (deliveryChart) deliveryChart.destroy();
    deliveryChart = new Chart(deliveryCtx, { type: 'line', data: { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], datasets: [{ label: 'On-Time Delivery %', data: [92, 94, 96, 95], borderColor: '#10b981', tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#f0f4f9' } } }, scales: { y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });

    // Top Jerseys
    const jerseysCtx = document.getElementById('jerseysChart').getContext('2d');
    if (jerseysChart) jerseysChart.destroy();
    const topJerseys = [...products].sort((a,b) => b.sold - a.sold).slice(0,5);
    jerseysChart = new Chart(jerseysCtx, { type: 'bar', data: { labels: topJerseys.map(p => p.name), datasets: [{ label: 'Units Sold', data: topJerseys.map(p => p.sold), backgroundColor: '#8b5cf6' }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#f0f4f9' } } }, scales: { y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#9ca3af', rotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });

    // Payment Methods
    const paymentCtx = document.getElementById('paymentChart').getContext('2d');
    if (paymentChart) paymentChart.destroy();
    const paymentMethods = ['momo', 'cash', 'bank'];
    const paymentCounts = paymentMethods.map(m => orders.filter(o => o.paymentMethod === m && o.status !== 'cancelled').length);
    paymentChart = new Chart(paymentCtx, { type: 'pie', data: { labels: ['Mobile Money', 'Cash', 'Bank Transfer'], datasets: [{ data: paymentCounts, backgroundColor: ['#00d4ff', '#ff6b35', '#8b5cf6'] }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#f0f4f9' } } } } });
}

function renderOrdersTable() {
    const searchTerm = document.getElementById('orderSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('orderStatusFilter')?.value || '';
    const clubFilter = document.getElementById('orderClubFilter')?.value || '';
    const riderFilter = document.getElementById('orderRiderFilter')?.value || '';

    let filteredOrders = [...orders];
    if (searchTerm) {
        filteredOrders = filteredOrders.filter(o => o.id.toLowerCase().includes(searchTerm) || o.customerName.toLowerCase().includes(searchTerm) || o.phone.includes(searchTerm));
    }
    if (statusFilter) filteredOrders = filteredOrders.filter(o => o.status === statusFilter);
    if (clubFilter) {
        filteredOrders = filteredOrders.filter(o => {
            const prod = getProductById(o.productId);
            return prod && prod.clubId === clubFilter;
        });
    }
    if (riderFilter) filteredOrders = filteredOrders.filter(o => o.riderId === riderFilter);

    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    filteredOrders.forEach(order => {
        const product = getProductById(order.productId);
        const club = product ? getClubById(product.clubId) : null;
        const rider = order.riderId ? getRiderById(order.riderId) : null;
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${order.id}</td>
            <td>${order.customerName}<br/><small>${order.phone}</small></td>
            <td>${product?.name || 'N/A'}<br/><small>${club?.name || ''} - ${order.size}</small></td>
            <td>${formatRWF(order.amount)}</td>
            <td>${order.paymentMethod === 'momo' ? 'Mobile Money' : order.paymentMethod === 'cash' ? 'Cash' : 'Bank'}</td>
            <td><span class="badge status-${order.status}">${order.status.replace('-',' ').toUpperCase()}</span></td>
            <td>${rider ? rider.name : 'Unassigned'}</td>
            <td><button class="btn btn-sm" onclick="openOrderDetail('${order.id}')"><i class="fas fa-edit"></i></button></td>
        `;
    });
}

function renderRidersTable() {
    const searchTerm = document.getElementById('riderSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('riderStatusFilter')?.value || '';

    let filteredRiders = [...riders];
    if (searchTerm) filteredRiders = filteredRiders.filter(r => r.name.toLowerCase().includes(searchTerm) || r.phone.includes(searchTerm) || r.plate.includes(searchTerm));
    if (statusFilter === 'active') filteredRiders = filteredRiders.filter(r => r.active === true);
    if (statusFilter === 'inactive') filteredRiders = filteredRiders.filter(r => r.active === false);

    const tbody = document.getElementById('ridersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    filteredRiders.forEach(rider => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${rider.name}</td>
            <td>${rider.phone}</td>
            <td>${rider.vehicle}</td>
            <td>${rider.plate}</td>
            <td>${rider.active ? '<span class="badge status-delivered">Active</span>' : '<span class="badge status-cancelled">Inactive</span>'}</td>
            <td>${rider.deliveries}</td>
            <td>${rider.failed}</td>
            <td>⭐ ${rider.rating}</td>
            <td><button class="btn btn-sm" onclick="editRider('${rider.id}')"><i class="fas fa-edit"></i></button></td>
            <td><button class="btn btn-sm ${rider.active ? 'danger' : 'success'}" onclick="toggleRiderStatus('${rider.id}')">${rider.active ? 'Deactivate' : 'Activate'}</button></td>
        `;
    });
}

function renderProductsTable() {
    const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
    const clubFilter = document.getElementById('productClubFilter')?.value || '';
    const stockFilter = document.getElementById('productStockFilter')?.value || '';

    let filteredProducts = [...products];
    if (searchTerm) filteredProducts = filteredProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
    if (clubFilter) filteredProducts = filteredProducts.filter(p => p.clubId === clubFilter);
    if (stockFilter === 'low') filteredProducts = filteredProducts.filter(p => p.stock < 15);
    if (stockFilter === 'out') filteredProducts = filteredProducts.filter(p => p.stock === 0);
    if (stockFilter === 'good') filteredProducts = filteredProducts.filter(p => p.stock >= 15);

    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    filteredProducts.forEach(product => {
        const club = getClubById(product.clubId);
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${club?.name || 'N/A'}</td>
            <td>${product.category.toUpperCase()}</td>
            <td>${formatRWF(product.price)}</td>
            <td>${product.stock}</td>
            <td>${product.sold}</td>
            <td>${product.stock < 5 ? '<span class="badge status-cancelled">Low Stock</span>' : '<span class="badge status-delivered">In Stock</span>'}</td>
            <td><button class="btn btn-sm" onclick="editProduct('${product.id}')"><i class="fas fa-edit"></i></button></td>
        `;
    });
}

function renderLowStockAlerts() {
    const lowStockDiv = document.getElementById('lowStockList');
    if (!lowStockDiv) return;
    const lowStockItems = products.filter(p => p.stock < 15);
    lowStockDiv.innerHTML = lowStockItems.length ? lowStockItems.map(p => `<div class="activity-item"><div class="activity-icon"><i class="fas fa-exclamation-triangle"></i></div><div class="activity-content"><div class="activity-title">${p.name}</div><div class="activity-time">Only ${p.stock} left in stock</div></div></div>`).join('') : '<div class="alert success"><i class="fas fa-check-circle"></i> All products have good stock levels!</div>';
}

function renderRecentActivity() {
    const recentDiv = document.getElementById('recentActivity');
    if (!recentDiv) return;
    const recentActivities = activityLog.slice(0, 5);
    recentDiv.innerHTML = recentActivities.map(act => `<div class="activity-item"><div class="activity-icon"><i class="fas ${act.icon}"></i></div><div class="activity-content"><div class="activity-title">${act.action}</div><div class="activity-time">${new Date(act.timestamp).toLocaleString()}</div><div class="timeline-desc">${act.details}</div></div></div>`).join('');
}

function renderInventoryStats() {
    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const lowStockCount = products.filter(p => p.stock < 15).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;
    if (document.getElementById('inventoryTotalUnits')) document.getElementById('inventoryTotalUnits').innerText = totalUnits;
    if (document.getElementById('inventoryValue')) document.getElementById('inventoryValue').innerText = formatRWF(totalValue);
    if (document.getElementById('inventoryLowStock')) document.getElementById('inventoryLowStock').innerText = lowStockCount;
    if (document.getElementById('inventoryOutOfStock')) document.getElementById('inventoryOutOfStock').innerText = outOfStockCount;
}

function renderLowStockTable() {
    const tbody = document.getElementById('lowStockTable');
    if (!tbody) return;
    const lowStockItems = products.filter(p => p.stock < 15);
    tbody.innerHTML = lowStockItems.map(p => {
        const club = getClubById(p.clubId);
        return `<tr><td>${p.name}</td><td>${club?.name || 'N/A'}</td><td>${p.stock}</td><td>15</td><td><button class="btn btn-sm success" onclick="openAddStock('${p.id}')"><i class="fas fa-plus"></i> Restock</button></td></tr>`;
    }).join('');
}

function renderActivityFeed() {
    const feedDiv = document.getElementById('activityFeed');
    if (!feedDiv) return;
    feedDiv.innerHTML = activityLog.map(act => `<div class="activity-item"><div class="activity-icon"><i class="fas ${act.icon}"></i></div><div class="activity-content"><div class="activity-title">${act.action}</div><div class="activity-time">${new Date(act.timestamp).toLocaleString()}</div><div class="timeline-desc">${act.details}</div></div></div>`).join('');
}

function renderAnalyticsStats() {
    const totalRevenue = orders.reduce((sum, order) => order.status !== 'cancelled' ? sum + (order.amount || 0) : sum, 0);
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const avgOrderValue = completedOrders ? totalRevenue / completedOrders : 0;
    const csat = 94;
    const conversion = 68;
    if (document.getElementById('analyticsTotalRevenue')) document.getElementById('analyticsTotalRevenue').innerText = formatRWF(totalRevenue);
    if (document.getElementById('analyticsAOV')) document.getElementById('analyticsAOV').innerText = formatRWF(avgOrderValue);
    if (document.getElementById('analyticsSatisfaction')) document.getElementById('analyticsSatisfaction').innerText = `${csat}%`;
    if (document.getElementById('analyticsConversion')) document.getElementById('analyticsConversion').innerText = `${conversion}%`;
}

function renderSalesByDayChart() {
    const ctx = document.getElementById('salesByDayChart')?.getContext('2d');
    if (!ctx) return;
    if (salesByDayChart) salesByDayChart.destroy();
    salesByDayChart = new Chart(ctx, { type: 'line', data: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], datasets: [{ label: 'Sales (RWF)', data: [250000, 300000, 280000, 410000, 520000, 780000, 650000], borderColor: '#8b5cf6', fill: true, backgroundColor: 'rgba(139,92,246,0.1)' }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#f0f4f9' } } }, scales: { y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });
}

function renderOrdersByWeekChart() {
    const ctx = document.getElementById('ordersByWeekChart')?.getContext('2d');
    if (!ctx) return;
    if (ordersByWeekChart) ordersByWeekChart.destroy();
    ordersByWeekChart = new Chart(ctx, { type: 'bar', data: { labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'], datasets: [{ label: 'Orders', data: [12, 18, 22, 27], backgroundColor: '#00d4ff' }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#f0f4f9' } } }, scales: { y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });
}

function renderRevenueByClubChart() {
    const ctx = document.getElementById('revenueByClubChart')?.getContext('2d');
    if (!ctx) return;
    if (revenueByClubChart) revenueByClubChart.destroy();
    const clubData = clubs.map(club => ({ club: club.name, revenue: orders.reduce((sum, order) => { const prod = getProductById(order.productId); if (prod && prod.clubId === club.id && order.status !== 'cancelled') return sum + (order.amount || 0); return sum; }, 0) }));
    revenueByClubChart = new Chart(ctx, { type: 'bar', data: { labels: clubData.map(c => c.club), datasets: [{ label: 'Revenue', data: clubData.map(c => c.revenue), backgroundColor: '#ff6b35' }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#f0f4f9' } } }, scales: { y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#9ca3af', rotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });
}

function renderStockByClubChart() {
    const ctx = document.getElementById('stockByClubChart')?.getContext('2d');
    if (!ctx) return;
    if (stockByClubChart) stockByClubChart.destroy();
    const clubStock = clubs.map(club => ({ club: club.name, stock: products.filter(p => p.clubId === club.id).reduce((sum, p) => sum + p.stock, 0) }));
    stockByClubChart = new Chart(ctx, { type: 'bar', data: { labels: clubStock.map(c => c.club), datasets: [{ label: 'Total Stock', data: clubStock.map(c => c.stock), backgroundColor: '#10b981' }] }, options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { labels: { color: '#f0f4f9' } } }, scales: { y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#9ca3af', rotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } } } } });
}

function updateBadges() {
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const activeRiders = riders.filter(r => r.active).length;
    const orderBadge = document.getElementById('orderBadge');
    const riderBadge = document.getElementById('riderBadge');
    if (orderBadge) orderBadge.innerText = pendingOrders;
    if (riderBadge) riderBadge.innerText = activeRiders;
}

function populateFilters() {
    const clubFilterSelects = ['orderClubFilter', 'productClubFilter', 'orderClubSelect'];
    clubFilterSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">All Clubs</option>' + clubs.map(club => `<option value="${club.id}">${club.name}</option>`).join('');
        }
    });
    const riderFilter = document.getElementById('orderRiderFilter');
    if (riderFilter) {
        riderFilter.innerHTML = '<option value="">All Riders</option>' + riders.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }
    const assignRiderSelect = document.getElementById('assignRider');
    if (assignRiderSelect) {
        assignRiderSelect.innerHTML = '<option value="">Assign Rider</option>' + riders.filter(r => r.active).map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }
    const productClubSelect = document.getElementById('productClub');
    if (productClubSelect) {
        productClubSelect.innerHTML = clubs.map(club => `<option value="${club.id}">${club.name}</option>`).join('');
    }
}

// ========== ACTION FUNCTIONS ==========
function openOrderDetail(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const product = getProductById(order.productId);
    const club = product ? getClubById(product.clubId) : null;
    const rider = order.riderId ? getRiderById(order.riderId) : null;
    const content = `
        <div class="timeline">
            <div class="timeline-item">
                <div class="timeline-marker"><i class="fas fa-user"></i></div>
                <div class="timeline-content">
                    <div class="timeline-title">${order.customerName}</div>
                    <div class="timeline-desc">📞 ${order.phone}<br/>📍 ${order.address}</div>
                </div>
            </div>
            <div class="timeline-item">
                <div class="timeline-marker"><i class="fas fa-tshirt"></i></div>
                <div class="timeline-content">
                    <div class="timeline-title">${product?.name || 'N/A'}</div>
                    <div class="timeline-desc">Club: ${club?.name || 'N/A'} | Size: ${order.size} | Qty: ${order.quantity}</div>
                </div>
            </div>
            <div class="timeline-item">
                <div class="timeline-marker"><i class="fas fa-money-bill"></i></div>
                <div class="timeline-content">
                    <div class="timeline-title">Payment: ${order.paymentMethod === 'momo' ? 'Mobile Money' : order.paymentMethod === 'cash' ? 'Cash' : 'Bank'}</div>
                    <div class="timeline-desc">Amount: ${formatRWF(order.amount)}</div>
                </div>
            </div>
            ${order.notes ? `<div class="timeline-item"><div class="timeline-marker"><i class="fas fa-sticky-note"></i></div><div class="timeline-content"><div class="timeline-title">Notes</div><div class="timeline-desc">${order.notes}</div></div></div>` : ''}
        </div>
    `;
    document.getElementById('orderDetailContent').innerHTML = content;
    const statusSelect = document.getElementById('updateOrderStatus');
    if (statusSelect) statusSelect.value = order.status;
    const riderSelect = document.getElementById('assignRider');
    if (riderSelect) riderSelect.value = order.riderId || '';
    const dialog = document.getElementById('orderDetailDialog');
    dialog.showModal();
    window.currentOrderId = orderId;
}

function editRider(riderId) {
    const rider = riders.find(r => r.id === riderId);
    if (!rider) return;
    document.getElementById('riderDialogTitle').innerText = 'Edit Rider';
    document.getElementById('riderName').value = rider.name;
    document.getElementById('riderPhone').value = rider.phone;
    document.getElementById('riderVehicle').value = rider.vehicle;
    document.getElementById('riderPlate').value = rider.plate;
    const deleteBtn = document.getElementById('deleteRiderBtn');
    if (deleteBtn) deleteBtn.hidden = false;
    window.currentRiderId = riderId;
    const dialog = document.getElementById('riderDialog');
    dialog.showModal();
}

function toggleRiderStatus(riderId) {
    const rider = riders.find(r => r.id === riderId);
    if (rider) {
        rider.active = !rider.active;
        persistData();
        updateUI();
        addActivityLog('Rider Status Changed', `${rider.name} is now ${rider.active ? 'Active' : 'Inactive'}`, 'fa-user-check');
    }
}

function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    document.getElementById('productDialogTitle').innerText = 'Edit Product';
    document.getElementById('productName').value = product.name;
    document.getElementById('productClub').value = product.clubId;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productStock').value = product.stock;
    const sizes = product.stockBySize || { S:0, M:0, L:0, XL:0, XXL:0 };
    if (document.getElementById('stockS')) document.getElementById('stockS').value = sizes.S;
    if (document.getElementById('stockM')) document.getElementById('stockM').value = sizes.M;
    if (document.getElementById('stockL')) document.getElementById('stockL').value = sizes.L;
    if (document.getElementById('stockXL')) document.getElementById('stockXL').value = sizes.XL;
    if (document.getElementById('stockXXL')) document.getElementById('stockXXL').value = sizes.XXL;
    if (document.getElementById('productFeatured')) document.getElementById('productFeatured').checked = product.featured;
    const deleteBtn = document.getElementById('deleteProductBtn');
    if (deleteBtn) deleteBtn.hidden = false;
    window.currentProductId = productId;
    const dialog = document.getElementById('productDialog');
    dialog.showModal();
}

function openAddStock(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        const newStock = prompt(`Enter new stock quantity for ${product.name}:`, product.stock);
        if (newStock !== null && !isNaN(parseInt(newStock))) {
            product.stock = parseInt(newStock);
            persistData();
            updateUI();
            addActivityLog('Stock Updated', `${product.name} stock updated to ${product.stock}`, 'fa-boxes');
        }
    }
}

function filterJerseysByClub() {
    const clubId = document.getElementById('orderClubSelect')?.value;
    const jerseySelect = document.getElementById('orderJerseySelect');
    if (!jerseySelect) return;
    let filteredProducts = products;
    if (clubId) filteredProducts = products.filter(p => p.clubId === clubId);
    jerseySelect.innerHTML = filteredProducts.map(p => `<option value="${p.id}">${p.name} - ${formatRWF(p.price)}</option>`).join('');
}

function saveOrderFromDialog() {
    const customerName = document.getElementById('orderCustomerName')?.value;
    const phone = document.getElementById('orderCustomerPhone')?.value;
    const address = document.getElementById('orderDeliveryAddress')?.value;
    const notes = document.getElementById('orderNotes')?.value || '';
    const productId = document.getElementById('orderJerseySelect')?.value;
    const size = document.getElementById('orderSize')?.value;
    const quantity = parseInt(document.getElementById('orderQuantity')?.value || 1);
    const paymentMethod = document.getElementById('orderPaymentMethod')?.value;
    
    if (!customerName || !phone || !address || !productId || !size || !quantity || !paymentMethod) {
        alert('Please fill all required fields');
        return;
    }
    
    const product = getProductById(productId);
    if (!product) return;
    
    const amount = product.price * quantity;
    const newOrder = {
        id: `ORD-${Date.now()}`,
        customerName, phone, address, notes, productId, size, quantity,
        paymentMethod, amount, status: 'pending', riderId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    orders.unshift(newOrder);
    // Reduce stock
    product.stock -= quantity;
    if (product.stockBySize && product.stockBySize[size]) product.stockBySize[size] -= quantity;
    product.sold = (product.sold || 0) + quantity;
    
    persistData();
    updateUI();
    addActivityLog('Order Created', `New order ${newOrder.id} created by ${customerName}`, 'fa-cart-plus');
    document.getElementById('orderCreateDialog').close();
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeData();
    checkAuthAndLoadData();
    
    // Navigation
    document.querySelectorAll('.nav-btn[data-section]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = btn.getAttribute('data-section');
            document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(section).classList.add('active');
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => updateUI());
    
    // Quick actions
    const quickAddProduct = document.getElementById('quickAddProduct');
    if (quickAddProduct) quickAddProduct.addEventListener('click', () => document.getElementById('productDialog')?.showModal());
    
    const quickAddRider = document.getElementById('quickAddRider');
    if (quickAddRider) quickAddRider.addEventListener('click', () => {
        document.getElementById('riderDialogTitle').innerText = 'Add Rider';
        const deleteBtn = document.getElementById('deleteRiderBtn');
        if (deleteBtn) deleteBtn.hidden = true;
        document.getElementById('riderDialog')?.showModal();
    });
    
    const quickCreateOrder = document.getElementById('quickCreateOrder');
    if (quickCreateOrder) quickCreateOrder.addEventListener('click', () => {
        document.getElementById('orderCreateDialog')?.showModal();
        filterJerseysByClub();
    });
    
    const quickRestock = document.getElementById('quickRestock');
    if (quickRestock) quickRestock.addEventListener('click', () => {
        const lowStockItems = products.filter(p => p.stock < 15);
        if (lowStockItems.length) openAddStock(lowStockItems[0].id);
        else alert('All products have sufficient stock!');
    });
    
    const addRiderBtn = document.getElementById('addRiderBtn');
    if (addRiderBtn) addRiderBtn.addEventListener('click', () => {
        document.getElementById('riderDialogTitle').innerText = 'Add Rider';
        const deleteBtn = document.getElementById('deleteRiderBtn');
        if (deleteBtn) deleteBtn.hidden = true;
        document.getElementById('riderDialog')?.showModal();
    });
    
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) addProductBtn.addEventListener('click', () => {
        document.getElementById('productDialogTitle').innerText = 'Add Product';
        const deleteBtn = document.getElementById('deleteProductBtn');
        if (deleteBtn) deleteBtn.hidden = true;
        document.getElementById('productDialog')?.showModal();
    });
    
    const createOrderBtn = document.getElementById('createOrderBtn');
    if (createOrderBtn) createOrderBtn.addEventListener('click', () => {
        document.getElementById('orderCreateDialog')?.showModal();
        filterJerseysByClub();
    });
    
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    if (saveOrderBtn) saveOrderBtn.addEventListener('click', () => {
        const orderId = window.currentOrderId;
        if (orderId) {
            const order = orders.find(o => o.id === orderId);
            if (order) {
                const newStatus = document.getElementById('updateOrderStatus')?.value;
                const newRiderId = document.getElementById('assignRider')?.value;
                if (newStatus && newStatus !== order.status) {
                    order.status = newStatus;
                    addActivityLog('Order Status Update', `Order ${order.id} status changed to ${newStatus}`, 'fa-truck');
                }
                if (newRiderId !== order.riderId) {
                    order.riderId = newRiderId;
                    addActivityLog('Rider Assigned', `Rider ${getRiderById(newRiderId)?.name || 'N/A'} assigned to ${order.id}`, 'fa-user-check');
                }
                persistData();
                updateUI();
                document.getElementById('orderDetailDialog').close();
            }
        }
    });
    
    const cancelOrderBtn = document.getElementById('cancelOrderBtn');
    if (cancelOrderBtn) cancelOrderBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to cancel this order?')) {
            const order = orders.find(o => o.id === window.currentOrderId);
            if (order) {
                order.status = 'cancelled';
                persistData();
                updateUI();
                addActivityLog('Order Cancelled', `Order ${order.id} has been cancelled`, 'fa-times-circle');
                document.getElementById('orderDetailDialog').close();
            }
        }
    });
    
    const saveRiderBtn = document.getElementById('saveRiderBtn');
    if (saveRiderBtn) saveRiderBtn.addEventListener('click', () => {
        const name = document.getElementById('riderName')?.value;
        const phone = document.getElementById('riderPhone')?.value;
        const vehicle = document.getElementById('riderVehicle')?.value;
        const plate = document.getElementById('riderPlate')?.value;
        if (!name || !phone || !vehicle || !plate) {
            alert('Please fill all rider details');
            return;
        }
        if (window.currentRiderId) {
            const rider = riders.find(r => r.id === window.currentRiderId);
            if (rider) {
                rider.name = name;
                rider.phone = phone;
                rider.vehicle = vehicle;
                rider.plate = plate;
                addActivityLog('Rider Updated', `Rider ${rider.name} information updated`, 'fa-user-edit');
            }
        } else {
            const newRider = {
                id: `r${Date.now()}`,
                name, phone, vehicle, plate,
                platePhoto: '', profilePhoto: '',
                active: true, deliveries: 0, failed: 0, rating: 5.0
            };
            riders.push(newRider);
            addActivityLog('Rider Added', `New rider ${newRider.name} has been added`, 'fa-user-plus');
        }
        persistData();
        updateUI();
        document.getElementById('riderDialog').close();
        window.currentRiderId = null;
    });
    
    const saveProductBtn = document.getElementById('saveProductBtn');
    if (saveProductBtn) saveProductBtn.addEventListener('click', () => {
        const name = document.getElementById('productName')?.value;
        const clubId = document.getElementById('productClub')?.value;
        const category = document.getElementById('productCategory')?.value;
        const price = parseInt(document.getElementById('productPrice')?.value || 0);
        const stock = parseInt(document.getElementById('productStock')?.value || 0);
        const featured = document.getElementById('productFeatured')?.checked || false;
        const stockBySize = {
            S: parseInt(document.getElementById('stockS')?.value || 0),
            M: parseInt(document.getElementById('stockM')?.value || 0),
            L: parseInt(document.getElementById('stockL')?.value || 0),
            XL: parseInt(document.getElementById('stockXL')?.value || 0),
            XXL: parseInt(document.getElementById('stockXXL')?.value || 0)
        };
        if (!name || !clubId || !category || !price) {
            alert('Please fill all required fields');
            return;
        }
        if (window.currentProductId) {
            const product = products.find(p => p.id === window.currentProductId);
            if (product) {
                product.name = name;
                product.clubId = clubId;
                product.category = category;
                product.price = price;
                product.stock = stock;
                product.stockBySize = stockBySize;
                product.featured = featured;
                addActivityLog('Product Updated', `Product ${product.name} information updated`, 'fa-edit');
            }
        } else {
            const newProduct = {
                id: `prod${Date.now()}`,
                name, clubId, category, price, stock, stockBySize,
                sold: 0, featured, images: []
            };
            products.push(newProduct);
            addActivityLog('Product Added', `New product ${newProduct.name} has been added`, 'fa-plus-circle');
        }
        persistData();
        updateUI();
        document.getElementById('productDialog').close();
        window.currentProductId = null;
    });
    
    const deleteRiderBtn = document.getElementById('deleteRiderBtn');
    if (deleteRiderBtn) deleteRiderBtn.addEventListener('click', () => {
        if (window.currentRiderId && confirm('Delete this rider permanently?')) {
            riders = riders.filter(r => r.id !== window.currentRiderId);
            persistData();
            updateUI();
            addActivityLog('Rider Deleted', `Rider has been removed from system`, 'fa-user-minus');
            document.getElementById('riderDialog').close();
        }
    });
    
    const deleteProductBtn = document.getElementById('deleteProductBtn');
    if (deleteProductBtn) deleteProductBtn.addEventListener('click', () => {
        if (window.currentProductId && confirm('Delete this product permanently?')) {
            products = products.filter(p => p.id !== window.currentProductId);
            persistData();
            updateUI();
            addActivityLog('Product Deleted', `Product has been removed from catalog`, 'fa-trash');
            document.getElementById('productDialog').close();
        }
    });
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logout());
    
    // Filters
    const orderSearch = document.getElementById('orderSearch');
    if (orderSearch) orderSearch.addEventListener('input', () => renderOrdersTable());
    const orderStatusFilter = document.getElementById('orderStatusFilter');
    if (orderStatusFilter) orderStatusFilter.addEventListener('change', () => renderOrdersTable());
    const orderClubFilter = document.getElementById('orderClubFilter');
    if (orderClubFilter) orderClubFilter.addEventListener('change', () => renderOrdersTable());
    const orderRiderFilter = document.getElementById('orderRiderFilter');
    if (orderRiderFilter) orderRiderFilter.addEventListener('change', () => renderOrdersTable());
    
    const riderSearch = document.getElementById('riderSearch');
    if (riderSearch) riderSearch.addEventListener('input', () => renderRidersTable());
    const riderStatusFilter = document.getElementById('riderStatusFilter');
    if (riderStatusFilter) riderStatusFilter.addEventListener('change', () => renderRidersTable());
    
    const productSearch = document.getElementById('productSearch');
    if (productSearch) productSearch.addEventListener('input', () => renderProductsTable());
    const productClubFilter = document.getElementById('productClubFilter');
    if (productClubFilter) productClubFilter.addEventListener('change', () => renderProductsTable());
    const productStockFilter = document.getElementById('productStockFilter');
    if (productStockFilter) productStockFilter.addEventListener('change', () => renderProductsTable());
    
    // Export Report
    const exportReportBtn = document.getElementById('exportReportBtn');
    if (exportReportBtn) {
        exportReportBtn.addEventListener('click', () => {
            const reportData = { orders, products, riders, clubs };
            const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `jerseyhub-report-${new Date().toISOString().slice(0,19)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            addActivityLog('Report Exported', 'Business report has been exported', 'fa-download');
        });
    }
});