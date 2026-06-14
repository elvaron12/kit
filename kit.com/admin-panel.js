// Redirect if not authenticated
if (!window.JerseyHubData?.isAdminAuthenticated()) {
  window.location.replace("admin-login.html");
}

const { loadProducts, saveProducts, loadOrders, saveOrders, clearAdminSession, migrateProductToV2 } = window.JerseyHubData;

let products = loadProducts();
let orders = loadOrders();

// DOM Elements
const adminContainer = document.getElementById("adminContainer");
const sidebarToggle = document.getElementById("sidebarToggle");
const navItems = document.querySelectorAll(".nav-item");
const logoutBtn = document.getElementById("logoutBtn");
const sectionTitle = document.getElementById("sectionTitle");
const adminSearch = document.getElementById("adminSearch");

// Sidebar toggle
sidebarToggle.addEventListener("click", () => {
  adminContainer.classList.toggle("sidebar-expanded");
});

// Nav item click
navItems.forEach(item => {
  item.addEventListener("click", () => {
    const sectionId = item.dataset.section;
    switchSection(sectionId);
  });
});

// Logout
logoutBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to logout?")) {
    clearAdminSession();
    window.location.href = "index.html";
  }
});

function switchSection(sectionId) {
  // Hide all sections
  document.querySelectorAll(".admin-section").forEach(s => s.classList.remove("active"));
  // Show selected section
  document.getElementById(sectionId)?.classList.add("active");

  // Update nav items
  navItems.forEach(item => {
    item.classList.toggle("active", item.dataset.section === sectionId);
  });

  // Update breadcrumb
  const titles = {
    dashboard: "Dashboard",
    orders: "Orders",
    products: "Products",
    inventory: "Inventory",
    analytics: "Analytics",
    settings: "Settings"
  };
  sectionTitle.textContent = titles[sectionId] || "Dashboard";

  // Render section
  if (sectionId === "dashboard") renderDashboard();
  else if (sectionId === "orders") renderOrders();
  else if (sectionId === "products") renderProducts();
  else if (sectionId === "inventory") renderInventory();
  else if (sectionId === "analytics") renderAnalytics();
}

function formatRwf(amount) {
  return `${Number(amount).toLocaleString("en-RW")} RWF`;
}

function renderDashboard() {
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;
  const totalStock = products.reduce((sum, p) => {
    if (!p.sizes) return sum;
    return sum + Object.values(p.sizes).reduce((a, b) => a + b, 0);
  }, 0);

  document.getElementById("totalOrders").textContent = orders.length;
  document.getElementById("totalRevenue").textContent = formatRwf(totalRevenue);
  document.getElementById("avgOrder").textContent = formatRwf(avgOrder);
  document.getElementById("totalProducts").textContent = products.length;
}

function renderOrders() {
  const tbody = document.getElementById("ordersTableBody");
  const searchTerm = document.getElementById("ordersSearch")?.value.toLowerCase() || "";
  const statusFilter = document.getElementById("statusFilter")?.value || "";

  const filtered = orders.filter(order => {
    const matchesSearch = !searchTerm ||
      order.code.toLowerCase().includes(searchTerm) ||
      order.customer.name.toLowerCase().includes(searchTerm);
    const matchesStatus = !statusFilter || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  tbody.innerHTML = filtered.map(order => `
    <tr>
      <td><strong>${order.code}</strong></td>
      <td>${order.customer.name}</td>
      <td>${order.customer.phone}</td>
      <td>${order.items.length}</td>
      <td>${formatRwf(order.total)}</td>
      <td><span class="status-badge status-${order.status.toLowerCase().replace(/ /g, '-')}">${order.status}</span></td>
      <td>${new Date(order.createdAt).toLocaleDateString()}</td>
      <td>
        <button class="btn-sm" onclick="editOrder('${order.code}')">Edit</button>
      </td>
    </tr>
  `).join("");
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");

  grid.innerHTML = products.map(product => `
    <div style="background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-sm);">
      <div style="width: 100%; height: 120px; background: #f5f7fb; display: grid; place-items: center;">
        <img src="${product.images?.[0]?.url || product.img}" alt="${product.name}" style="width: 80%; height: 80%; object-fit: contain;">
      </div>
      <div style="padding: 12px;">
        <h4 style="margin: 0 0 4px; font-size: 0.9rem;">${product.name}</h4>
        <p style="margin: 0 0 8px; font-size: 0.8rem; color: var(--muted);">${formatRwf(product.price)}</p>
        <div style="display: flex; gap: 6px;">
          <button class="btn-sm" onclick="editProduct('${product.id}')">Edit</button>
          <button class="btn-sm" style="background: rgba(180, 35, 24, 0.1); color: var(--status-error);" onclick="deleteProduct('${product.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join("");
}

function renderInventory() {
  const tbody = document.getElementById("inventoryTableBody");

  tbody.innerHTML = products.map(product => {
    const sizes = product.sizes || {};
    const total = Object.values(sizes).reduce((a, b) => a + b, 0);

    return `
      <tr>
        <td><strong>${product.name}</strong></td>
        <td>${sizes.XS || 0}</td>
        <td>${sizes.S || 0}</td>
        <td>${sizes.M || 0}</td>
        <td>${sizes.L || 0}</td>
        <td>${sizes.XL || 0}</td>
        <td>${sizes["2XL"] || 0}</td>
        <td>${sizes["3XL"] || 0}</td>
        <td><strong>${total}</strong></td>
      </tr>
    `;
  }).join("");
}

function renderAnalytics() {
  // Find top product
  const productSales = {};
  orders.forEach(order => {
    order.items?.forEach(item => {
      productSales[item.id] = (productSales[item.id] || 0) + item.qty;
    });
  });

  let topProduct = "-";
  let maxSales = 0;
  for (const [id, sales] of Object.entries(productSales)) {
    if (sales > maxSales) {
      maxSales = sales;
      const product = products.find(p => p.id === id);
      topProduct = product?.name || "-";
    }
  }

  // Calculate weekly stats
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weekOrders = orders.filter(o => new Date(o.createdAt) >= weekAgo);
  const weekRevenue = weekOrders.reduce((sum, o) => sum + o.total, 0);

  // Count low stock
  let lowStock = 0;
  products.forEach(p => {
    const total = Object.values(p.sizes || {}).reduce((a, b) => a + b, 0);
    if (total < 5) lowStock++;
  });

  document.getElementById("topProduct").textContent = topProduct;
  document.getElementById("weekOrders").textContent = weekOrders.length;
  document.getElementById("weekRevenue").textContent = formatRwf(weekRevenue);
  document.getElementById("lowStock").textContent = lowStock;
}

// Product Modal
document.getElementById("addProductBtn")?.addEventListener("click", () => {
  document.getElementById("productModalTitle").textContent = "Add Product";
  document.getElementById("productForm").reset();
  document.getElementById("productForm").dataset.id = "";
  document.getElementById("productModal").classList.add("show");
});

document.getElementById("productForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const id = e.target.dataset.id;

  const productData = {
    name: form.get("name"),
    league: form.get("league"),
    price: Number(form.get("price")),
    img: form.get("img")
  };

  if (id) {
    // Edit
    const product = products.find(p => p.id === id);
    if (product) {
      Object.assign(product, productData);
    }
  } else {
    // Add new
    const newId = productData.name.toLowerCase().replace(/\s+/g, "-");
    products.push({
      id: newId,
      ...productData,
      tags: [],
      images: [{ url: productData.img, alt: productData.name, isPrimary: true }],
      sizes: { XS: 5, S: 10, M: 15, L: 12, XL: 8, "2XL": 5, "3XL": 3 },
      stock: 50,
      sold: 0,
      visible: true,
      featured: false,
      analytics: { views: 0, clicks: 0, addToCart: 0 },
      club: { id: newId, name: productData.name }
    });
  }

  saveProducts(products);
  document.getElementById("productModal").classList.remove("show");
  renderProducts();
  renderInventory();
});

// Order Modal
function editOrder(code) {
  const order = orders.find(o => o.code === code);
  if (!order) return;

  document.getElementById("orderCode").value = order.code;
  document.getElementById("orderStatus").value = order.status;
  document.getElementById("orderForm").dataset.code = code;
  document.getElementById("orderModal").classList.add("show");
}

document.getElementById("orderForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = e.target.dataset.code;
  const order = orders.find(o => o.code === code);

  if (order) {
    order.status = document.getElementById("orderStatus").value;
  }

  saveOrders(orders);
  document.getElementById("orderModal").classList.remove("show");
  renderOrders();
});

function editProduct(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  document.getElementById("productModalTitle").textContent = "Edit Product";
  document.getElementById("productForm").dataset.id = id;
  document.querySelector("[name='name']").value = product.name;
  document.querySelector("[name='league']").value = product.league;
  document.querySelector("[name='price']").value = product.price;
  document.querySelector("[name='img']").value = product.images?.[0]?.url || product.img;
  document.getElementById("productModal").classList.add("show");
}

function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  products = products.filter(p => p.id !== id);
  saveProducts(products);
  renderProducts();
  renderInventory();
}

// Search
adminSearch?.addEventListener("input", () => {
  const search = adminSearch.value.toLowerCase();
  // Could implement global search across sections here
});

// Settings
document.getElementById("exportBtn")?.addEventListener("click", () => {
  const data = {
    products,
    orders,
    exportDate: new Date().toISOString()
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jerseyhub-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("resetBtn")?.addEventListener("click", () => {
  if (!confirm("Reset all data to defaults? This cannot be undone.")) return;
  products = window.JerseyHubData.buildDefaultProducts();
  orders = [];
  saveProducts(products);
  saveOrders(orders);
  alert("Data reset to defaults");
  window.location.reload();
});

// Filter and search handlers
document.getElementById("ordersSearch")?.addEventListener("input", renderOrders);
document.getElementById("statusFilter")?.addEventListener("change", renderOrders);

// Initial render
renderDashboard();
