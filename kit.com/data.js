(() => {
  const CATEGORY_LABELS = {
    home: "Home",
    away: "Away",
    retro: "Retro",
    special: "Special",
    training: "Training"
  };

  const DELIVERY_LABELS = {
    pending: "Pending",
    confirmed: "Confirmed",
    preparing: "Preparing",
    "out-for-delivery": "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    returned: "Returned",
    failed: "Failed"
  };

  const PAYMENT_LABELS = {
    pending: "Pending",
    momo: "MoMo",
    cash: "Cash"
  };

  const VEHICLE_LABELS = {
    bicycle: "Bicycle",
    moto: "Moto",
    bike: "Bike"
  };

  const DEFAULT_CLUBS = [
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

  const DEFAULT_CATEGORIES = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label }));
  const DEFAULT_SIZES = ["S", "M", "L", "XL", "XXL"];
  const LOCAL_PRODUCTS_KEY = "jerseyhub.products";
  const LOCAL_ORDERS_KEY = "jerseyhub.orders.local";

  function formatRwf(amount) {
    return `${Number(amount || 0).toLocaleString("en-RW")} RWF`;
  }

  function normalizeImage(path) {
    if (!path) return "/assets/hero-jerseys.png";
    if (path.startsWith("data:") || path.startsWith("http://") || path.startsWith("https://")) return path;
    if (window.location.protocol === "file:" && path.startsWith("/")) return path.slice(1);
    return path.startsWith("/") ? path : `/${path}`;
  }

  function stockLabel(product) {
    if (product.status !== "active" || Number(product.stock) <= 0) return "Sold Out";
    if (product.category === "special") return "Limited Edition";
    if (Number(product.stock) <= 5) return "Low Stock";
    return "In Stock";
  }

  function publicProduct(product) {
    const club = DEFAULT_CLUBS.find((item) => item.id === product.clubId) ||
      DEFAULT_CLUBS.find((item) => item.name === product.club) ||
      DEFAULT_CLUBS[0];
    return {
      id: product.id,
      name: product.name,
      club: product.club || club.name,
      clubId: product.clubId || club.id,
      clubLogo: club.logo,
      clubAccent: club.accent,
      clubGlow: club.glow,
      category: product.category || "home",
      images: Array.isArray(product.images) && product.images.length ? product.images : [club.logo],
      sizes: Array.isArray(product.sizes) && product.sizes.length ? product.sizes : DEFAULT_SIZES,
      price: Number(product.price || 0),
      stock: Math.max(0, Number(product.stock || 0)),
      sold: Math.max(0, Number(product.sold || 0)),
      status: product.status || "active",
      featured: Boolean(product.featured),
      stockLabel: stockLabel(product),
      inStock: (product.status || "active") === "active" && Number(product.stock || 0) > 0,
      badge: CATEGORY_LABELS[product.category] || "Jersey"
    };
  }

  function seedProducts() {
    const prices = { home: 15000, away: 15000, retro: 17000, special: 19000, training: 14000 };
    return DEFAULT_CLUBS.flatMap((club) => DEFAULT_CATEGORIES.map((category) => publicProduct({
      id: `${club.id}-${category.id}`,
      name: `${club.name} ${category.id === "special" ? "Special Edition" : category.label} Jersey`,
      club: club.name,
      clubId: club.id,
      category: category.id,
      images: [club.logo],
      sizes: DEFAULT_SIZES,
      price: prices[category.id] || 15000,
      stock: category.id === "special" ? 5 : 18,
      status: "active"
    })));
  }

  function readLocalProducts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_PRODUCTS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map(publicProduct) : [];
    } catch {
      return [];
    }
  }

  function saveLocalProducts(products) {
    try {
      const normalized = Array.isArray(products) ? products.map(publicProduct) : [];
      localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(normalized));
      return normalized;
    } catch {
      return Array.isArray(products) ? products.map(publicProduct) : [];
    }
  }

  async function fallbackCatalog() {
    const localProducts = readLocalProducts().filter((product) => product.status === "active");
    if (localProducts.length) {
      const usedClubIds = new Set(localProducts.map((product) => product.clubId));
      return {
        clubs: DEFAULT_CLUBS.filter((club) => usedClubIds.has(club.id)),
        categories: DEFAULT_CATEGORIES,
        products: localProducts
      };
    }

    try {
      const db = await request("/database/db.json");
      const products = Array.isArray(db.products) ? db.products.map(publicProduct).filter((product) => product.status === "active") : seedProducts();
      const usedClubIds = new Set(products.map((product) => product.clubId));
      return {
        clubs: DEFAULT_CLUBS.filter((club) => usedClubIds.has(club.id)),
        categories: DEFAULT_CATEGORIES,
        products
      };
    } catch {
      const products = seedProducts();
      return {
        clubs: DEFAULT_CLUBS,
        categories: DEFAULT_CATEGORIES,
        products
      };
    }
  }

  function apiCandidates(path) {
    if (/^https?:\/\//i.test(path)) return [path];
    const configured = window.JERSEYHUB_API_BASE || localStorage.getItem("jerseyhub.apiBase") || "";
    const candidates = [path];
    if (configured) candidates.push(`${configured.replace(/\/$/, "")}${path}`);
    const shouldTryLocalApi = window.location.protocol === "file:" ||
      window.location.port === "5500" ||
      window.location.port === "3000" ||
      window.location.port === "8080";
    if (shouldTryLocalApi) {
      for (let port = 5600; port <= 5610; port += 1) {
        candidates.push(`http://127.0.0.1:${port}${path}`);
        candidates.push(`http://localhost:${port}${path}`);
      }
    }
    return [...new Set(candidates)];
  }

  async function request(path, options = {}) {
    const headers = {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    };
    const body = options.body && !(options.body instanceof FormData) && typeof options.body !== "string"
      ? JSON.stringify(options.body)
      : options.body;
    let lastError = null;

    for (const candidate of apiCandidates(path)) {
      let response = null;
      let payload = null;
      try {
        response = await fetch(candidate, {
          credentials: "include",
          ...options,
          headers,
          body
        });
        try {
          payload = await response.json();
        } catch {
          payload = {};
        }
      } catch (error) {
        lastError = error;
        continue;
      }

      if (response.ok) return payload;

      lastError = new Error(payload.error || `Request failed with ${response.status}`);
      lastError.status = response.status;
      lastError.payload = payload;
      if (![404, 405].includes(response.status)) throw lastError;
    }

    throw lastError || new Error("Request failed");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read image"));
      reader.readAsDataURL(file);
    });
  }

  async function filesToImages(fileList) {
    const files = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
    const images = [];
    for (const file of files.slice(0, 6)) {
      images.push(await readFileAsDataUrl(file));
    }
    return images;
  }

  function readLocalOrders() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveLocalOrders(orders) {
    try {
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders.slice(0, 120)));
    } catch {
      // Order submission will still resolve for the current session.
    }
  }

  async function createLocalOrder(order) {
    const catalog = await fallbackCatalog();
    const items = (Array.isArray(order.items) ? order.items : []).map((item) => {
      const product = catalog.products.find((candidate) => candidate.id === item.productId);
      if (!product) throw new Error("One jersey in your cart is no longer available");
      if (!product.sizes.includes(item.size)) throw new Error(`${product.name} is not available in size ${item.size}`);
      const quantity = Math.max(1, Math.min(20, Number(item.quantity || 1)));
      return {
        productId: product.id,
        name: product.name,
        club: product.club,
        clubId: product.clubId,
        category: product.category,
        size: item.size,
        quantity,
        price: product.price,
        lineTotal: product.price * quantity
      };
    });
    if (!items.length) throw new Error("Order must include at least one jersey");
    const savedOrder = {
      id: `JH-LOCAL-${Date.now().toString(36).toUpperCase()}`,
      customerName: String(order.customerName || order.name || "").trim(),
      phone: String(order.phone || order.customerPhone || "").trim(),
      location: String(order.location || order.customerLocation || "").trim(),
      items,
      totalPrice: items.reduce((sum, item) => sum + item.lineTotal, 0),
      paymentStatus: PAYMENT_LABELS[order.paymentStatus] ? order.paymentStatus : "pending",
      deliveryStatus: "pending",
      source: order.source || "storefront",
      assignedRider: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!savedOrder.customerName) throw new Error("Customer name is required");
    if (!savedOrder.phone) throw new Error("Phone number is required");
    if (!savedOrder.location) throw new Error("Delivery location is required");
    saveLocalOrders([savedOrder, ...readLocalOrders()]);
    return { order: savedOrder };
  }

  async function trackLocalOrder(orderId) {
    const normalized = String(orderId || "").trim().toUpperCase();
    const order = readLocalOrders().find((item) => item.id.toUpperCase() === normalized);
    if (!order) throw new Error("Order not found");
    return { order };
  }

  const api = {
    getCatalog: () => request("/api/catalog").catch(fallbackCatalog),
    createOrder: (order) => request("/api/orders", { method: "POST", body: order }).catch(() => createLocalOrder(order)),
    trackOrder: (orderId) => request(`/api/orders/${encodeURIComponent(orderId)}/track`).catch(() => trackLocalOrder(orderId)),
    assistant: (payload) => request("/api/assistant", { method: "POST", body: payload }),

    adminLogin: (username, password) => {
      if (password === undefined) return request("/api/admin/login", { method: "POST", body: { username: "admin", password: username } });
      return request("/api/admin/login", { method: "POST", body: { username, password } });
    },
    adminLogout: () => request("/api/admin/logout", { method: "POST", body: {} }),
    adminSession: () => request("/api/admin/session"),
    adminData: () => request("/api/admin/data"),
    adminStats: () => request("/api/admin/stats"),

    createProduct: (product) => request("/api/admin/products", { method: "POST", body: product }),
    updateProduct: (id, product) => request(`/api/admin/products/${encodeURIComponent(id)}`, { method: "PUT", body: product }),
    deleteProduct: (id) => request(`/api/admin/products/${encodeURIComponent(id)}`, { method: "DELETE" }),

    updateOrder: (id, order) => request(`/api/admin/orders/${encodeURIComponent(id)}`, { method: "PUT", body: order }),
    deleteOrder: (id) => request(`/api/admin/orders/${encodeURIComponent(id)}`, { method: "DELETE" }),

    createRider: (rider) => request("/api/admin/riders", { method: "POST", body: rider }),
    updateRider: (id, rider) => request(`/api/admin/riders/${encodeURIComponent(id)}`, { method: "PUT", body: rider }),
    deleteRider: (id) => request(`/api/admin/riders/${encodeURIComponent(id)}`, { method: "DELETE" })
  };

  if (!Array.isArray(window.products)) {
    window.products = seedProducts();
  }

  window.JerseyHubData = {
    api,
    clubCatalog: DEFAULT_CLUBS,
    CATEGORY_LABELS,
    DELIVERY_LABELS,
    PAYMENT_LABELS,
    VEHICLE_LABELS,
    formatRwf,
    normalizeImage,
    filesToImages,
    loadProducts: readLocalProducts,
    saveProducts: saveLocalProducts
  };
})();
