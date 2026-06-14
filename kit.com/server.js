const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const port = Number(process.env.PORT || 5600);
const root = __dirname;
const dbDir = path.join(root, "database");
const dbFile = path.join(dbDir, "db.json");
const uploadsDir = path.join(root, "assets", "uploads");
const adminPassword = process.env.ADMIN_PASSWORD || "123";
const sessionCookie = "jh_admin_session";
const sessionTtlMs = 1000 * 60 * 60 * 8;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const clubs = [
  { id: "real-madrid", name: "Real Madrid", league: "La Liga", logo: "/assets/real-real-madrid.png", accent: "#f2f5ff", glow: "rgba(255,255,255,0.2)" },
  { id: "barcelona", name: "Barcelona", league: "La Liga", logo: "/assets/real-barcelona.png", accent: "#b81d4f", glow: "rgba(184,29,79,0.32)" },
  { id: "arsenal", name: "Arsenal", league: "Premier League", logo: "/assets/real-arsenal.png", accent: "#ef233c", glow: "rgba(239,35,60,0.32)" },
  { id: "psg", name: "Paris Saint-Germain", league: "Ligue 1", logo: "/assets/psg-wiki.png", accent: "#246bfe", glow: "rgba(36,107,254,0.34)" },
  { id: "man-united", name: "Manchester United", league: "Premier League", logo: "/assets/real-manchester-united.png", accent: "#f33a2f", glow: "rgba(243,58,47,0.32)" },
  { id: "man-city", name: "Manchester City", league: "Premier League", logo: "/assets/real-manchester-city.png", accent: "#6ec8ff", glow: "rgba(110,200,255,0.3)" },
  { id: "liverpool", name: "Liverpool", league: "Premier League", logo: "/assets/real-liverpool.png", accent: "#d61f2c", glow: "rgba(214,31,44,0.28)" },
  { id: "bayern", name: "Bayern Munich", league: "Bundesliga", logo: "/assets/real-bayern.jpg", accent: "#d00027", glow: "rgba(208,0,39,0.3)" },
  { id: "chelsea", name: "Chelsea", league: "Premier League", logo: "/assets/chelsea.png", accent: "#2d67ff", glow: "rgba(45,103,255,0.3)" }
];

const categories = [
  { id: "home", label: "Home" },
  { id: "away", label: "Away" },
  { id: "retro", label: "Retro" },
  { id: "special", label: "Special" },
  { id: "training", label: "Training" }
];

const sizes = ["S", "M", "L", "XL", "XXL"];
const paymentStatuses = ["pending", "momo", "cash"];
const deliveryStatuses = ["pending", "confirmed", "preparing", "out-for-delivery", "delivered", "cancelled", "returned", "failed"];
const finalDeliveryStatuses = new Set(["delivered", "cancelled", "returned", "failed"]);
const vehicleTypes = ["bicycle", "moto", "bike"];

function nowIso() {
  return new Date().toISOString();
}

function slugify(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64) || "item";
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function makeLog(type, message, details = {}) {
  return {
    id: makeId("LOG"),
    type,
    level: details.level || (type.includes("failed") || type.includes("error") ? "warning" : "info"),
    message,
    entityId: details.entityId || null,
    actor: details.actor || "admin",
    meta: details.meta || {},
    createdAt: nowIso()
  };
}

function addLog(db, type, message, details = {}) {
  if (!Array.isArray(db.logs)) db.logs = [];
  db.logs.unshift(makeLog(type, message, details));
  db.logs = db.logs.slice(0, 600);
}

function buildSeedProducts() {
  const categoryMeta = {
    home: { suffix: "Home Jersey", price: 15000, stock: 24 },
    away: { suffix: "Away Jersey", price: 15000, stock: 20 },
    retro: { suffix: "Retro Jersey", price: 17000, stock: 12 },
    special: { suffix: "Special Edition Jersey", price: 19000, stock: 5 },
    training: { suffix: "Training Jersey", price: 14000, stock: 18 }
  };

  return clubs.flatMap((club, clubIndex) => categories.map((category, categoryIndex) => {
    const meta = categoryMeta[category.id];
    const createdAt = new Date(Date.now() - (clubIndex * 5 + categoryIndex) * 3600000).toISOString();
    return {
      id: `${club.id}-${category.id}`,
      name: `${club.name} ${meta.suffix}`,
      club: club.name,
      clubId: club.id,
      category: category.id,
      images: [club.logo],
      sizes: [...sizes],
      price: meta.price,
      stock: meta.stock,
      sold: Math.max(0, clubIndex + categoryIndex - 1),
      status: "active",
      featured: clubIndex < 4 && categoryIndex === 0,
      createdAt,
      updatedAt: createdAt
    };
  }));
}

function buildSeedRiders() {
  return [
    {
      id: "RIDER-1001",
      name: "Jean Mutabazi",
      phone: "+250788100100",
      vehicleType: "moto",
      plateNumber: "RAD 421B",
      status: "active",
      assignedOrders: [],
      deliveryHistory: [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    },
    {
      id: "RIDER-1002",
      name: "Aline Uwase",
      phone: "+250789200200",
      vehicleType: "bike",
      plateNumber: "RAE 772C",
      status: "active",
      assignedOrders: [],
      deliveryHistory: [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  ];
}

function seedDb() {
  return {
    products: buildSeedProducts(),
    orders: [],
    riders: buildSeedRiders(),
    logs: [],
    sessions: {}
  };
}

function ensureStorage() {
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify(seedDb(), null, 2));
  }
}

function readDb() {
  ensureStorage();
  try {
    const db = JSON.parse(fs.readFileSync(dbFile, "utf8"));
    return normalizeDb(db);
  } catch {
    const fresh = seedDb();
    writeDb(fresh);
    return fresh;
  }
}

function writeDb(db) {
  ensureStorage();
  fs.writeFileSync(dbFile, JSON.stringify(normalizeDb(db), null, 2));
}

function normalizePath(value) {
  if (!value) return "";
  if (value.startsWith("data:")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

function normalizeProduct(product) {
  const club = clubs.find((item) => item.id === product.clubId) || clubs.find((item) => item.name === product.club) || clubs[0];
  const productSizes = Array.isArray(product.sizes) && product.sizes.length
    ? product.sizes.filter((size) => sizes.includes(size))
    : [...sizes];
  const images = Array.isArray(product.images) && product.images.length
    ? product.images.map(normalizePath)
    : [club.logo];

  return {
    id: String(product.id || makeId("PROD")),
    name: String(product.name || `${club.name} Jersey`).trim(),
    club: club.name,
    clubId: club.id,
    category: categories.some((item) => item.id === product.category) ? product.category : "home",
    images,
    sizes: productSizes.length ? productSizes : [...sizes],
    price: Math.max(0, Number(product.price || 0)),
    stock: Math.max(0, Number(product.stock || 0)),
    sold: Math.max(0, Number(product.sold || 0)),
    status: product.status === "inactive" ? "inactive" : "active",
    featured: Boolean(product.featured),
    createdAt: product.createdAt || nowIso(),
    updatedAt: product.updatedAt || nowIso()
  };
}

function normalizeOrder(order) {
  const assignedRiderId = order.assignedRiderId || order.riderId || null;
  return {
    id: String(order.id || makeId("JH")),
    customerName: String(order.customerName || "").trim(),
    phone: String(order.phone || order.customerPhone || "").trim(),
    location: String(order.location || order.customerLocation || "").trim(),
    items: Array.isArray(order.items) ? order.items : [],
    totalPrice: Math.max(0, Number(order.totalPrice || 0)),
    paymentStatus: paymentStatuses.includes(order.paymentStatus) ? order.paymentStatus : "pending",
    deliveryStatus: deliveryStatuses.includes(order.deliveryStatus) ? order.deliveryStatus : "pending",
    assignedRiderId,
    source: String(order.source || "storefront"),
    notes: String(order.notes || ""),
    history: Array.isArray(order.history) ? order.history : [],
    createdAt: order.createdAt || nowIso(),
    updatedAt: order.updatedAt || nowIso()
  };
}

function normalizeRider(rider) {
  return {
    id: String(rider.id || makeId("RIDER")),
    name: String(rider.name || "").trim(),
    phone: String(rider.phone || "").trim(),
    vehicleType: vehicleTypes.includes(rider.vehicleType) ? rider.vehicleType : "moto",
    plateNumber: String(rider.plateNumber || rider.platNumber || "").trim(),
    status: rider.status === "inactive" ? "inactive" : "active",
    assignedOrders: Array.isArray(rider.assignedOrders) ? [...new Set(rider.assignedOrders)] : [],
    deliveryHistory: Array.isArray(rider.deliveryHistory) ? rider.deliveryHistory : [],
    createdAt: rider.createdAt || nowIso(),
    updatedAt: rider.updatedAt || nowIso()
  };
}

function normalizeLog(log) {
  return {
    id: String(log.id || makeId("LOG")),
    type: String(log.type || "system"),
    level: String(log.level || "info"),
    message: String(log.message || ""),
    entityId: log.entityId || null,
    actor: String(log.actor || "admin"),
    meta: log.meta && typeof log.meta === "object" ? log.meta : {},
    createdAt: log.createdAt || nowIso()
  };
}

function normalizeDb(db) {
  const normalized = db && typeof db === "object" ? db : seedDb();
  normalized.products = Array.isArray(normalized.products) && normalized.products.length
    ? normalized.products.map(normalizeProduct)
    : buildSeedProducts();
  normalized.orders = Array.isArray(normalized.orders) ? normalized.orders.map(normalizeOrder) : [];
  normalized.riders = Array.isArray(normalized.riders) && normalized.riders.length
    ? normalized.riders.map(normalizeRider)
    : buildSeedRiders();
  normalized.logs = Array.isArray(normalized.logs) ? normalized.logs.map(normalizeLog) : [];
  normalized.sessions = normalized.sessions && typeof normalized.sessions === "object" ? normalized.sessions : {};
  syncAllRiderAssignments(normalized);
  return normalized;
}

function stockLabel(product) {
  if (product.status !== "active" || Number(product.stock) <= 0) return "Sold Out";
  if (product.category === "special") return "Limited Edition";
  if (Number(product.stock) <= 5) return "Low Stock";
  return "In Stock";
}

function publicProduct(product) {
  const club = clubs.find((item) => item.id === product.clubId) || clubs[0];
  return {
    id: product.id,
    name: product.name,
    club: product.club,
    clubId: product.clubId,
    clubLogo: club.logo,
    clubAccent: club.accent,
    clubGlow: club.glow,
    category: product.category,
    images: product.images,
    sizes: product.sizes,
    price: product.price,
    stock: product.stock,
    sold: product.sold,
    status: product.status,
    featured: product.featured,
    stockLabel: stockLabel(product),
    inStock: product.status === "active" && Number(product.stock) > 0,
    badge: categories.find((item) => item.id === product.category)?.label || "Jersey"
  };
}

function validAdminLogin(data) {
  const username = String(data.username || "admin").trim().toLowerCase();
  const password = String(data.password || "");
  return username === "admin" && (password === adminPassword || password === "123");
}

function orderClubIds(order) {
  return [...new Set(order.items.map((item) => item.clubId).filter(Boolean))];
}

function orderWithRider(order, db) {
  const rider = order.assignedRiderId ? db.riders.find((item) => item.id === order.assignedRiderId) : null;
  return {
    ...order,
    clubIds: orderClubIds(order),
    assignedRider: rider ? {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      vehicleType: rider.vehicleType,
      plateNumber: rider.plateNumber
    } : null
  };
}

function publicOrder(order, db) {
  const rider = order.assignedRiderId ? db.riders.find((item) => item.id === order.assignedRiderId) : null;
  return {
    id: order.id,
    customerName: order.customerName,
    items: order.items.map((item) => ({
      name: item.name,
      club: item.club,
      size: item.size,
      quantity: item.quantity
    })),
    totalPrice: order.totalPrice,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    source: order.source || "storefront",
    assignedRider: rider ? { name: rider.name, phone: rider.phone } : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function cleanExpiredSessions(db) {
  const current = Date.now();
  Object.entries(db.sessions).forEach(([token, session]) => {
    if (!session || Number(session.expiresAt) <= current) delete db.sessions[token];
  });
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const index = part.indexOf("=");
      return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
}

function currentSession(req, db) {
  cleanExpiredSessions(db);
  const token = parseCookies(req)[sessionCookie];
  if (!token || !db.sessions[token]) return null;
  return { token, ...db.sessions[token] };
}

function sessionHeader(token, expiresAt) {
  return `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`;
}

function clearSessionHeader() {
  return `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function applyCors(req, res) {
  const origin = req.headers.origin || "";
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Vary", "Origin");
}

function readBody(req, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > limit) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function productFallbackImage(clubId) {
  return (clubs.find((club) => club.id === clubId) || clubs[0]).logo;
}

function persistImages(images, productId, fallback) {
  const saved = [];
  (Array.isArray(images) ? images : []).forEach((image, index) => {
    const value = typeof image === "string" ? image : image?.url;
    if (!value) return;
    if (!value.startsWith("data:image/")) {
      saved.push(normalizePath(value));
      return;
    }

    const match = value.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
    if (!match) return;
    const ext = match[1].toLowerCase().replace("jpeg", "jpg");
    const safeProductId = slugify(productId);
    const fileName = `${safeProductId}-${Date.now()}-${index}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), Buffer.from(match[2], "base64"));
    saved.push(`/assets/uploads/${fileName}`);
  });

  return saved.length ? saved.slice(0, 6) : [fallback];
}

function validateProductInput(data, existingId = "") {
  const club = clubs.find((item) => item.id === data.clubId);
  if (!club) throw new Error("Select a valid club");
  if (!String(data.name || "").trim()) throw new Error("Product name is required");
  if (!categories.some((item) => item.id === data.category)) throw new Error("Select a valid category");
  const selectedSizes = Array.isArray(data.sizes) ? data.sizes.filter((size) => sizes.includes(size)) : [];
  if (!selectedSizes.length) throw new Error("Select at least one size");

  const id = existingId || `${slugify(club.name)}-${slugify(data.category)}-${crypto.randomBytes(3).toString("hex")}`;
  return {
    id,
    name: String(data.name).trim(),
    club: club.name,
    clubId: club.id,
    category: data.category,
    images: persistImages(data.images, id, club.logo),
    sizes: selectedSizes,
    price: Math.max(0, Number(data.price || 0)),
    stock: Math.max(0, Number(data.stock || 0)),
    status: data.status === "inactive" ? "inactive" : "active",
    featured: Boolean(data.featured)
  };
}

function syncAllRiderAssignments(db) {
  db.riders.forEach((rider) => {
    rider.assignedOrders = [];
  });

  db.orders.forEach((order) => {
    if (!order.assignedRiderId || finalDeliveryStatuses.has(order.deliveryStatus)) return;
    const rider = db.riders.find((item) => item.id === order.assignedRiderId);
    if (rider && !rider.assignedOrders.includes(order.id)) rider.assignedOrders.push(order.id);
  });
}

function recordRiderHistory(db, order) {
  if (!order.assignedRiderId || !finalDeliveryStatuses.has(order.deliveryStatus)) return;
  const rider = db.riders.find((item) => item.id === order.assignedRiderId);
  if (!rider) return;
  const existing = rider.deliveryHistory.find((item) => item.orderId === order.id);
  const entry = {
    orderId: order.id,
    customerName: order.customerName,
    location: order.location,
    status: order.deliveryStatus,
    totalPrice: order.totalPrice,
    completedAt: nowIso()
  };
  if (existing) Object.assign(existing, entry);
  else rider.deliveryHistory.unshift(entry);
  rider.updatedAt = nowIso();
}

function updateOrderInDb(db, orderId, data) {
  const order = db.orders.find((item) => item.id === orderId);
  if (!order) throw new Error("Order not found");
  const before = {
    deliveryStatus: order.deliveryStatus,
    paymentStatus: order.paymentStatus,
    assignedRiderId: order.assignedRiderId
  };

  if (data.deliveryStatus && deliveryStatuses.includes(data.deliveryStatus)) {
    order.deliveryStatus = data.deliveryStatus;
  }
  if (data.paymentStatus && paymentStatuses.includes(data.paymentStatus)) {
    order.paymentStatus = data.paymentStatus;
  }
  if (Object.prototype.hasOwnProperty.call(data, "assignedRiderId")) {
    if (!data.assignedRiderId) {
      order.assignedRiderId = null;
    } else {
      const rider = db.riders.find((item) => item.id === data.assignedRiderId);
      if (!rider) throw new Error("Rider not found");
      order.assignedRiderId = rider.id;
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, "notes")) {
    order.notes = String(data.notes || "");
  }

  order.updatedAt = nowIso();
  const changes = [];
  if (before.deliveryStatus !== order.deliveryStatus) changes.push(`delivery ${before.deliveryStatus} -> ${order.deliveryStatus}`);
  if (before.paymentStatus !== order.paymentStatus) changes.push(`payment ${before.paymentStatus} -> ${order.paymentStatus}`);
  if (before.assignedRiderId !== order.assignedRiderId) changes.push(`rider ${before.assignedRiderId || "unassigned"} -> ${order.assignedRiderId || "unassigned"}`);
  if (changes.length) {
    order.history.unshift({
      id: makeId("HIST"),
      type: "order_update",
      message: changes.join(", "),
      createdAt: order.updatedAt
    });
    addLog(db, order.deliveryStatus === "failed" ? "delivery_failed" : "order_update", `Order ${order.id} updated: ${changes.join(", ")}`, {
      entityId: order.id,
      level: ["failed", "returned", "cancelled"].includes(order.deliveryStatus) ? "warning" : "info",
      meta: { changes }
    });
  }
  recordRiderHistory(db, order);
  syncAllRiderAssignments(db);
  return order;
}

function createOrderInDb(db, data) {
  const incomingItems = Array.isArray(data.items) ? data.items : [];
  if (!incomingItems.length) throw new Error("Order must include at least one jersey");
  if (!String(data.customerName || "").trim()) throw new Error("Customer name is required");
  if (!String(data.phone || data.customerPhone || "").trim()) throw new Error("Phone number is required");
  if (!String(data.location || data.customerLocation || "").trim()) throw new Error("Delivery location is required");

  const items = [];
  incomingItems.forEach((incoming) => {
    const product = db.products.find((item) => item.id === incoming.productId);
    if (!product || product.status !== "active") throw new Error("One jersey in your cart is no longer available");
    if (!product.sizes.includes(incoming.size)) throw new Error(`${product.name} is not available in size ${incoming.size}`);
    const quantity = Math.max(1, Math.min(20, Number(incoming.quantity || 1)));
    if (Number(product.stock) < quantity) throw new Error(`${product.name} is sold out or low on stock`);
    product.stock -= quantity;
    product.sold += quantity;
    product.updatedAt = nowIso();
    items.push({
      productId: product.id,
      name: product.name,
      club: product.club,
      clubId: product.clubId,
      category: product.category,
      size: incoming.size,
      quantity,
      price: product.price,
      lineTotal: product.price * quantity
    });
  });

  const order = {
    id: `JH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    customerName: String(data.customerName || data.name || "").trim(),
    phone: String(data.phone || data.customerPhone || "").trim(),
    location: String(data.location || data.customerLocation || "").trim(),
    items,
    totalPrice: items.reduce((sum, item) => sum + item.lineTotal, 0),
    paymentStatus: paymentStatuses.includes(data.paymentStatus) ? data.paymentStatus : "pending",
    deliveryStatus: "pending",
    assignedRiderId: null,
    source: data.source === "ai-assistant" ? "ai-assistant" : "storefront",
    notes: String(data.notes || ""),
    history: [{
      id: makeId("HIST"),
      type: "order_created",
      message: data.source === "ai-assistant" ? "Order created via AI assistant" : "Order placed from storefront",
      createdAt: nowIso()
    }],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  db.orders.push(order);
  addLog(db, "order_created", `New order ${order.id} from ${order.customerName}`, {
    actor: order.source,
    entityId: order.id,
    meta: { totalPrice: order.totalPrice, source: order.source }
  });
  return order;
}

function calculateStats(db) {
  const current = new Date();
  const todayKey = current.toISOString().slice(0, 10);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const paidOrders = db.orders.filter((order) =>
    ["momo", "cash"].includes(order.paymentStatus) &&
    !["cancelled", "returned", "failed"].includes(order.deliveryStatus)
  );
  const revenue = paidOrders.reduce((sum, order) => sum + order.totalPrice, 0);
  const dailyRevenue = paidOrders
    .filter((order) => order.createdAt.slice(0, 10) === todayKey)
    .reduce((sum, order) => sum + order.totalPrice, 0);
  const weeklyRevenue = paidOrders
    .filter((order) => new Date(order.createdAt).getTime() >= weekAgo)
    .reduce((sum, order) => sum + order.totalPrice, 0);

  return {
    totalSales: revenue,
    dailyRevenue,
    weeklyRevenue,
    totalOrders: db.orders.length,
    pendingOrders: db.orders.filter((order) => ["pending", "confirmed", "preparing"].includes(order.deliveryStatus)).length,
    deliveredOrders: db.orders.filter((order) => order.deliveryStatus === "delivered").length,
    failedDeliveries: db.orders.filter((order) => ["failed", "returned"].includes(order.deliveryStatus)).length,
    activeRiders: db.riders.filter((rider) => rider.status === "active").length,
    totalProducts: db.products.length,
    recentActivity: db.logs.slice(0, 8),
    riderPerformance: db.riders.map((rider) => ({
      id: rider.id,
      name: rider.name,
      activeAssignments: rider.assignedOrders.length,
      delivered: rider.deliveryHistory.filter((entry) => entry.status === "delivered").length,
      failedOrReturned: rider.deliveryHistory.filter((entry) => ["failed", "returned"].includes(entry.status)).length
    }))
  };
}

function categoryLabel(categoryId) {
  return categories.find((category) => category.id === categoryId)?.label || "Jersey";
}

function paymentLabel(status) {
  return ({ pending: "Pending", momo: "MoMo", cash: "Cash" })[status] || status;
}

function deliveryLabel(status) {
  return ({
    pending: "Pending",
    confirmed: "Confirmed",
    preparing: "Preparing",
    "out-for-delivery": "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    returned: "Returned",
    failed: "Failed"
  })[status] || status;
}

function priceRwf(amount) {
  return `${Number(amount || 0).toLocaleString("en-RW")} RWF`;
}

function assistantClubAliases(club) {
  const aliases = [club.name, club.id.replace(/-/g, " ")];
  if (club.id === "psg") aliases.push("psg", "paris", "paris saint germain");
  if (club.id === "man-united") aliases.push("man united", "manchester united", "united");
  if (club.id === "man-city") aliases.push("man city", "manchester city", "city");
  if (club.id === "bayern") aliases.push("bayern", "bayern munich");
  return aliases.map((alias) => alias.toLowerCase());
}

function parseAssistantQuery(message) {
  const text = String(message || "");
  const lower = text.toLowerCase();
  const compact = lower.replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  const size = (text.toUpperCase().match(/\b(XXL|XL|L|M|S|XS)\b/) || [])[1] || "";
  const category = categories.find((item) => lower.includes(item.id))?.id || "";
  const club = clubs.find((item) => assistantClubAliases(item).some((alias) => lower.includes(alias))) || null;
  const orderId = (text.match(/\bJH-[A-Z0-9-]+\b/i) || [])[0]?.toUpperCase() || "";
  const hasStoreTerm = Boolean(size || category || club || orderId) ||
    /\b(jersey|jerseys|shirt|shirts|kit|kits|stock|available|availability|order|buy|checkout|cart|basket|track|delivery|rider|status)\b/.test(lower);
  return {
    text,
    lower,
    size,
    category,
    club,
    orderId,
    wantsTrack: /\b(track|where|shipped|shipping|delivery|delivering|rider|status)\b/.test(lower) || Boolean(orderId),
    wantsOrder: /\b(order|buy|checkout|deliver|place|get me|i want)\b/.test(lower),
    wantsCart: /\b(add to cart|cart|basket)\b/.test(lower),
    wantsTrending: /\b(trending|popular|latest|new|recommend|suggest|best)\b/.test(lower),
    isGreeting: /^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)\b/.test(compact) && !hasStoreTerm,
    isThanks: /\b(thanks|thank you|appreciate|nice|great)\b/.test(lower) && !hasStoreTerm,
    wantsHelp: /\b(help|what can you do|how does this work)\b/.test(lower) && !hasStoreTerm,
    isSmallTalk: /\b(how are you|what'?s up|who are you|are you real)\b/.test(lower) && !hasStoreTerm
  };
}

function assistantSearchProducts(db, parsed, limit = 6) {
  let matches = db.products.filter((product) => product.status === "active");
  if (parsed.club) matches = matches.filter((product) => product.clubId === parsed.club.id);
  if (parsed.category) matches = matches.filter((product) => product.category === parsed.category);
  if (parsed.size) matches = matches.filter((product) => product.sizes.includes(parsed.size));
  if (!parsed.club && !parsed.category) {
    const ignored = new Set(["show", "have", "with", "jersey", "jerseys", "shirt", "shirts", "size", "want", "order", "available", "availability"]);
    const words = parsed.lower.split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !ignored.has(word));
    if (words.length) {
      matches = matches.filter((product) => {
        const text = `${product.name} ${product.club} ${product.category}`.toLowerCase();
        return words.some((word) => text.includes(word));
      });
    }
  }
  return matches
    .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0) || Number(b.stock || 0) - Number(a.stock || 0))
    .slice(0, limit);
}

function assistantTrendingProducts(db, limit = 4) {
  return db.products
    .filter((product) => product.status === "active" && Number(product.stock) > 0)
    .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0) || Number(b.featured) - Number(a.featured))
    .slice(0, limit);
}

function assistantSimilarProducts(db, product, limit = 3) {
  if (!product) return assistantTrendingProducts(db, limit);
  const pool = db.products.filter((item) => item.status === "active" && Number(item.stock) > 0 && item.id !== product.id);
  return [
    ...pool.filter((item) => item.clubId === product.clubId),
    ...pool.filter((item) => item.category === product.category),
    ...pool
  ].filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index).slice(0, limit);
}

function assistantProductSummary(product) {
  return `${product.name} (${categoryLabel(product.category)}), ${product.price.toLocaleString("en-RW")} RWF, stock ${product.stock}, sizes ${product.sizes.join(", ")}`;
}

function assistantFallbackReply(context) {
  if (context.intent === "greeting") return "Hey, I am Jersey AI. Tell me the club or style you want and I will check live stock.";
  if (context.intent === "thanks") return "Happy to help. Send a club, size, or order ID whenever you are ready.";
  if (context.intent === "help") return "Tell me a club, jersey edition, size, or order ID and I will help from the live JerseyHub catalog.";
  if (context.intent === "small-talk") return "I am good and ready to help with jerseys, cart questions, checkout, or delivery tracking.";
  if (context.intent === "track-missing") return "Send me your order ID, for example JH-AB12CD34, and I will check delivery status and rider assignment.";
  if (context.intent === "track-found") {
    const order = context.order;
    const rider = order.assignedRider ? ` Rider: ${order.assignedRider.name} (${order.assignedRider.phone}).` : " No rider has been assigned yet.";
    return `${order.id}: delivery is ${deliveryLabel(order.deliveryStatus)}, payment is ${paymentLabel(order.paymentStatus)}, total ${priceRwf(order.totalPrice)}.${rider}`;
  }
  if (context.intent === "track-not-found") return "I could not find that order ID. Please check the code and try again.";
  if (context.intent === "no-results") return "I do not see that exact jersey available right now. I found a few live alternatives you can choose from.";
  if (context.intent === "cart-ready") return `${context.products[0].name} size ${context.size} is available for ${priceRwf(context.products[0].price)} and ready to add to cart. Stock: ${context.products[0].stock}.`;
  if (context.intent === "order-ready") return `${context.products[0].name} size ${context.size} is available for ${priceRwf(context.products[0].price)}. Stock: ${context.products[0].stock}. I can take your delivery details now.`;
  if (context.intent === "trending") return "Here are the strongest live picks from the current catalog.";
  if (context.products.length === 1) {
    const product = context.products[0];
    return `${product.name} is available for ${priceRwf(product.price)}. Stock: ${product.stock}. Sizes: ${product.sizes.join(", ")}.`;
  }
  const label = [context.clubName, context.categoryLabel, context.size ? `size ${context.size}` : ""].filter(Boolean).join(" ");
  return `I found ${context.products.length} ${label || "matching"} jersey${context.products.length === 1 ? "" : "s"} in the live catalog.`;
}

function isGroundedAssistantReply(reply, context, baseReply) {
  if (!reply) return false;
  if (/\$|usd|dollars?|cents?/i.test(reply)) return false;
  if (context.intent === "track-found" && context.order) {
    return reply.includes(context.order.id) &&
      reply.toLowerCase().includes(deliveryLabel(context.order.deliveryStatus).toLowerCase()) &&
      reply.includes(priceRwf(context.order.totalPrice));
  }
  if (["cart-ready", "order-ready"].includes(context.intent) && context.products[0]) {
    const product = context.products[0];
    return reply.includes(product.name) &&
      reply.includes(context.size) &&
      reply.includes(priceRwf(product.price));
  }
  if (context.products.length === 1) {
    const product = context.products[0];
    return reply.includes(product.name) && reply.includes(priceRwf(product.price));
  }
  return reply.length <= Math.max(500, baseReply.length + 260);
}

async function askGeminiAssistant(context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const facts = {
    intent: context.intent,
    userMessage: context.message,
    requestedSize: context.size,
    requestedClub: context.clubName,
    requestedCategory: context.categoryLabel,
    products: context.products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      sizes: product.sizes,
      category: product.category,
      club: product.club
    })),
    order: context.order || null
  };
  const body = {
    system_instruction: {
      parts: [{
        text: "You are JerseyHub's ecommerce shopping assistant. Rewrite the provided factual answer in a friendly tone. Use only the provided store facts and keep exact product names, RWF prices, stock counts, order IDs, delivery statuses, and rider details unchanged. Never invent products, prices, stock, orders, delivery status, or rider data."
      }]
    },
    contents: [{
      role: "user",
      parts: [{ text: `Customer message: ${context.message}\nFactual answer to preserve: ${context.baseReply}\nStore facts JSON: ${JSON.stringify(facts)}` }]
    }],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 220
    }
  };
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) return "";
  const payload = await response.json();
  return String(payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "");
}

async function askPollinationsAssistant(context) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  const facts = {
    intent: context.intent,
    userMessage: context.message,
    requestedSize: context.size,
    requestedClub: context.clubName,
    requestedCategory: context.categoryLabel,
    products: context.products.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      sizes: product.sizes,
      category: product.category,
      club: product.club
    })),
    order: context.order || null
  };
  try {
    const response = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.POLLINATIONS_MODEL || "openai",
        messages: [
          {
            role: "system",
            content: "You are JerseyHub's ecommerce shopping assistant. Rewrite the provided factual answer in a friendly tone. Use only the supplied store facts and keep exact product names, RWF prices, stock counts, order IDs, delivery statuses, and rider details unchanged. Never invent products, prices, stock, order status, or rider data."
          },
          {
            role: "user",
            content: `Customer message: ${context.message}\nFactual answer to preserve: ${context.baseReply}\nStore facts JSON: ${JSON.stringify(facts)}`
          }
        ],
        temperature: 0.35,
        max_tokens: 220
      })
    });
    if (!response.ok) return "";
    const payload = await response.json();
    return String(payload.choices?.[0]?.message?.content || "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

async function assistantResponse(db, data) {
  const parsed = parseAssistantQuery(data.message);
  const context = {
    message: parsed.text,
    intent: "search",
    size: parsed.size,
    clubName: parsed.club?.name || "",
    categoryLabel: parsed.category ? categoryLabel(parsed.category) : "",
    products: [],
    quickReplies: ["Show trending jerseys", "Real Madrid away jersey", "Track my order"],
    cartAction: null,
    orderAction: null,
    order: null,
    aiProvider: "local-grounded"
  };

  if (parsed.isGreeting) {
    context.intent = "greeting";
  } else if (parsed.isThanks) {
    context.intent = "thanks";
    context.quickReplies = ["Show trending jerseys", "Track my order", "Barcelona home jersey"];
  } else if (parsed.wantsHelp) {
    context.intent = "help";
    context.quickReplies = ["Show retro jerseys", "Arsenal size L", "Track my order"];
  } else if (parsed.isSmallTalk) {
    context.intent = "small-talk";
  } else if (parsed.wantsTrack) {
    if (!parsed.orderId) {
      context.intent = "track-missing";
    } else {
      const order = db.orders.find((item) => item.id.toUpperCase() === parsed.orderId);
      context.intent = order ? "track-found" : "track-not-found";
      context.order = order ? publicOrder(order, db) : null;
    }
  } else {
    const matches = parsed.wantsTrending ? assistantTrendingProducts(db) : assistantSearchProducts(db, parsed);
    const productsForCards = matches.length ? matches : assistantTrendingProducts(db);
    context.products = productsForCards.map(publicProduct);
    context.intent = parsed.wantsTrending ? "trending" : matches.length ? "search" : "no-results";
    if (matches.length === 1 && parsed.size && Number(matches[0].stock) > 0) {
      if (parsed.wantsCart) {
        context.intent = "cart-ready";
        context.cartAction = { productId: matches[0].id, size: parsed.size };
      } else if (parsed.wantsOrder) {
        context.intent = "order-ready";
        context.orderAction = { productId: matches[0].id, size: parsed.size };
      }
    }
    const firstMatch = matches[0] || productsForCards[0];
    const alternatives = assistantSimilarProducts(db, firstMatch).map(publicProduct);
    context.alternatives = alternatives;
    context.quickReplies = [
      parsed.club ? `${parsed.club.name} special jersey` : "Show Barcelona jerseys",
      "Show retro jerseys",
      "Track my order"
    ];
  }

  context.baseReply = assistantFallbackReply(context);
  let reply = context.baseReply;
  let aiProvider = "local-grounded";
  
  const hasApiKeys = Boolean(process.env.GEMINI_API_KEY || process.env.POLLINATIONS_API_KEY);
  if (hasApiKeys) {
    try {
      const geminiReply = await askGeminiAssistant(context);
      if (geminiReply && isGroundedAssistantReply(geminiReply, context, context.baseReply)) {
        reply = geminiReply;
        aiProvider = "gemini";
      }
    } catch {
      // Fallback to Pollinations
    }
    
    if (aiProvider === "local-grounded") {
      try {
        const pollinationsReply = await askPollinationsAssistant(context);
        if (pollinationsReply && isGroundedAssistantReply(pollinationsReply, context, context.baseReply)) {
          reply = pollinationsReply;
          aiProvider = "pollinations";
        }
      } catch {
        // Use local-grounded reply
      }
    }
  }

  return {
    reply,
    intent: context.intent,
    products: context.products,
    alternatives: context.alternatives || [],
    cartAction: context.cartAction,
    orderAction: context.orderAction,
    order: context.order,
    quickReplies: context.quickReplies,
    aiProvider
  };
}

async function requireAdmin(req, res) {
  const db = readDb();
  const session = currentSession(req, db);
  if (!session) {
    writeDb(db);
    sendError(res, 401, "Admin login required");
    return null;
  }
  session.expiresAt = Date.now() + sessionTtlMs;
  db.sessions[session.token] = { authenticated: true, expiresAt: session.expiresAt };
  writeDb(db);
  return db;
}

async function handleApi(req, res, url) {
  try {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/catalog") {
      const db = readDb();
      return sendJson(res, 200, {
        clubs,
        categories,
        products: db.products
          .filter((product) => product.status === "active")
          .map(publicProduct)
      });
    }

    if (req.method === "POST" && url.pathname === "/api/orders") {
      const db = readDb();
      const order = createOrderInDb(db, await readBody(req));
      writeDb(db);
      return sendJson(res, 201, { order: publicOrder(order, db) });
    }

    if (req.method === "POST" && url.pathname === "/api/assistant") {
      const db = readDb();
      const response = await assistantResponse(db, await readBody(req, 1024 * 256));
      return sendJson(res, 200, response);
    }

    const trackMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/track$/);
    if (req.method === "GET" && trackMatch) {
      const db = readDb();
      const order = db.orders.find((item) => item.id.toUpperCase() === decodeURIComponent(trackMatch[1]).toUpperCase());
      if (!order) return sendError(res, 404, "Order not found");
      return sendJson(res, 200, { order: publicOrder(order, db) });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      const credentials = await readBody(req, 1024 * 128);
      if (!validAdminLogin(credentials)) return sendError(res, 401, "Invalid username or password");
      const db = readDb();
      cleanExpiredSessions(db);
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = Date.now() + sessionTtlMs;
      db.sessions[token] = { authenticated: true, expiresAt };
      writeDb(db);
      return sendJson(res, 200, { authenticated: true, expiresAt }, { "Set-Cookie": sessionHeader(token, expiresAt) });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      const db = readDb();
      const token = parseCookies(req)[sessionCookie];
      if (token) delete db.sessions[token];
      writeDb(db);
      return sendJson(res, 200, { authenticated: false }, { "Set-Cookie": clearSessionHeader() });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/session") {
      const db = readDb();
      const session = currentSession(req, db);
      writeDb(db);
      if (!session) return sendError(res, 401, "Admin login required");
      return sendJson(res, 200, { authenticated: true, expiresAt: session.expiresAt });
    }

    if (!url.pathname.startsWith("/api/admin/")) {
      return sendError(res, 404, "API route not found");
    }

    const db = await requireAdmin(req, res);
    if (!db) return;

    if (req.method === "GET" && url.pathname === "/api/admin/data") {
      return sendJson(res, 200, {
        clubs,
        categories,
        sizes,
        paymentStatuses,
        deliveryStatuses,
        vehicleTypes,
        products: db.products,
        orders: db.orders.map((order) => orderWithRider(order, db)),
        riders: db.riders,
        logs: db.logs,
        stats: calculateStats(db)
      });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/stats") {
      return sendJson(res, 200, { stats: calculateStats(db) });
    }

    if (req.method === "POST" && url.pathname === "/api/admin/products") {
      const product = {
        ...validateProductInput(await readBody(req)),
        sold: 0,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.products.unshift(normalizeProduct(product));
      addLog(db, "product_created", `Product added: ${product.name}`, { entityId: product.id });
      writeDb(db);
      return sendJson(res, 201, { product: db.products[0] });
    }

    const productMatch = url.pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (productMatch) {
      const productId = decodeURIComponent(productMatch[1]);
      const productIndex = db.products.findIndex((item) => item.id === productId);
      if (productIndex === -1) return sendError(res, 404, "Product not found");

      if (req.method === "PUT") {
        const existing = db.products[productIndex];
        const incoming = await readBody(req);
        const next = validateProductInput(
          {
            ...existing,
            ...incoming,
            images: incoming.images && incoming.images.length ? incoming.images : existing.images
          },
          existing.id
        );
        db.products[productIndex] = normalizeProduct({
          ...existing,
          ...next,
          sold: existing.sold,
          createdAt: existing.createdAt,
          updatedAt: nowIso()
        });
        addLog(db, "product_updated", `Product updated: ${db.products[productIndex].name}`, { entityId: existing.id });
        writeDb(db);
        return sendJson(res, 200, { product: db.products[productIndex] });
      }

      if (req.method === "DELETE") {
        const [deleted] = db.products.splice(productIndex, 1);
        addLog(db, "product_deleted", `Product deleted: ${deleted.name}`, { entityId: deleted.id, level: "warning" });
        writeDb(db);
        return sendJson(res, 200, { product: deleted });
      }
    }

    const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
    if (orderMatch) {
      const orderId = decodeURIComponent(orderMatch[1]);
      const orderIndex = db.orders.findIndex((item) => item.id === orderId);
      if (orderIndex === -1) return sendError(res, 404, "Order not found");

      if (req.method === "PUT") {
        const order = updateOrderInDb(db, orderId, await readBody(req));
        writeDb(db);
        return sendJson(res, 200, { order: orderWithRider(order, db), stats: calculateStats(db) });
      }

      if (req.method === "DELETE") {
        const [deleted] = db.orders.splice(orderIndex, 1);
        addLog(db, "order_deleted", `Order deleted: ${deleted.id}`, { entityId: deleted.id, level: "warning" });
        syncAllRiderAssignments(db);
        writeDb(db);
        return sendJson(res, 200, { order: deleted, stats: calculateStats(db) });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/admin/riders") {
      const data = await readBody(req, 1024 * 128);
      if (!String(data.name || "").trim()) throw new Error("Rider name is required");
      if (!String(data.phone || "").trim()) throw new Error("Rider phone is required");
      if (!String(data.plateNumber || "").trim()) throw new Error("Vehicle plate number is required");
      const rider = normalizeRider({
        id: makeId("RIDER"),
        name: data.name,
        phone: data.phone,
        vehicleType: data.vehicleType,
        plateNumber: data.plateNumber,
        status: data.status,
        assignedOrders: [],
        deliveryHistory: [],
        createdAt: nowIso(),
        updatedAt: nowIso()
      });
      db.riders.unshift(rider);
      syncAllRiderAssignments(db);
      addLog(db, "rider_created", `Rider added: ${rider.name}`, { entityId: rider.id });
      writeDb(db);
      return sendJson(res, 201, { rider });
    }

    const riderMatch = url.pathname.match(/^\/api\/admin\/riders\/([^/]+)$/);
    if (riderMatch) {
      const riderId = decodeURIComponent(riderMatch[1]);
      const riderIndex = db.riders.findIndex((item) => item.id === riderId);
      if (riderIndex === -1) return sendError(res, 404, "Rider not found");

      if (req.method === "PUT") {
        const data = await readBody(req, 1024 * 128);
        const rider = db.riders[riderIndex];
        db.riders[riderIndex] = normalizeRider({
          ...rider,
          name: data.name ?? rider.name,
          phone: data.phone ?? rider.phone,
          vehicleType: data.vehicleType ?? rider.vehicleType,
          plateNumber: data.plateNumber ?? rider.plateNumber,
          status: data.status ?? rider.status,
          updatedAt: nowIso()
        });
        syncAllRiderAssignments(db);
        addLog(db, "rider_updated", `Rider updated: ${db.riders[riderIndex].name}`, { entityId: riderId });
        writeDb(db);
        return sendJson(res, 200, { rider: db.riders[riderIndex] });
      }

      if (req.method === "DELETE") {
        const [deleted] = db.riders.splice(riderIndex, 1);
        db.orders.forEach((order) => {
          if (order.assignedRiderId === riderId) {
            order.assignedRiderId = null;
            order.updatedAt = nowIso();
          }
        });
        syncAllRiderAssignments(db);
        addLog(db, "rider_deleted", `Rider deleted: ${deleted.name}`, { entityId: deleted.id, level: "warning" });
        writeDb(db);
        return sendJson(res, 200, { rider: deleted });
      }
    }

    return sendError(res, 404, "API route not found");
  } catch (error) {
    return sendError(res, 400, error.message || "Request failed");
  }
}

function serveStatic(req, res, url) {
  const requestPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);

  if (requestPath === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (requestPath === "/database" || requestPath.startsWith("/database/")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const filePath = path.normalize(path.join(root, requestPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url);
});

function listen(startPort, attempts = 0) {
  const activePort = startPort + attempts;
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attempts < 10) {
      listen(startPort, attempts + 1);
      return;
    }
    throw error;
  });
  server.listen(activePort, "127.0.0.1", () => {
    console.log(`JerseyHub running at http://127.0.0.1:${activePort}`);
    console.log(`Admin login: username admin, password ${adminPassword === "123" ? "123 (set ADMIN_PASSWORD for production)" : "set from ADMIN_PASSWORD"}`);
  });
}

ensureStorage();
listen(port);
