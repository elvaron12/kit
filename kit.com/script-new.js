const {
  api,
  CATEGORY_LABELS,
  DELIVERY_LABELS,
  PAYMENT_LABELS,
  formatRwf,
  normalizeImage,
  clubCatalog = []
} = window.JerseyHubData;

let products = [];
let clubs = [];
let categories = [];
const cart = new Map();
const favorites = new Set();
let activeClub = "";
let activeCategory = "all";
const CART_STORAGE_KEY = "jerseyhub.cart.v2";
const PRODUCTS_STORAGE_KEY = "products";
const DEFAULT_SIZES = ["S", "M", "L", "XL", "XXL"];

const seededTracking = new Map([
  ["JH-1024", "Preparing. Payment confirmed and the jersey is being packed."],
  ["JH-2048", "Out for Delivery. Your rider is on the way."],
  ["JH-3001", "Confirmed. The order has been accepted by the store."]
]);

const clubDirectory = document.querySelector("#clubDirectory");
const clubPage = document.querySelector("#clubPage");
const grid = document.querySelector("#productGrid");
const searchInput = document.querySelector("#searchInput");
const filters = document.querySelectorAll(".filter");
const clubSpotlight = document.querySelector("#clubSpotlight");
const cartDrawer = document.querySelector(".cart-drawer");
const overlay = document.querySelector(".overlay");
const cartItems = document.querySelector(".cart-items");
const cartEmpty = document.querySelector(".cart-empty");
const cartSubtotal = document.querySelector("#cartSubtotal");
const cartCount = document.querySelector(".cart-count");
const resultCount = document.querySelector("#resultCount");
const checkoutModal = document.querySelector("#checkoutModal");
const supportPage = document.querySelector("#supportPage");
const homeHashes = new Set(["", "#top", "#shop", "#how", "#track", "#support"]);
const shopToast = document.createElement("div");
const miniCart = document.createElement("div");

shopToast.className = "shop-toast";
shopToast.setAttribute("role", "status");
shopToast.setAttribute("aria-live", "polite");
miniCart.className = "mini-cart-preview";
document.body.append(shopToast, miniCart);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusClass(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function productImage(product) {
  return normalizeImage(product.images?.[0] || product.clubLogo || "/assets/hero-jerseys.png");
}

function availableSizes(product) {
  return Array.isArray(product.sizes) ? product.sizes : [];
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "general";
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function readLocalProducts() {
  try {
    const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (stored === null) return null;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function localStockLabel(product) {
  if (product.status !== "active" || Number(product.stock) <= 0) return "Sold Out";
  if (product.category === "special") return "Limited Edition";
  if (Number(product.stock) <= 5) return "Low Stock";
  return "In Stock";
}

function normalizeLocalProduct(product) {
  const source = product && typeof product === "object" ? product : {};
  const category = String(source.category || "home").trim() || "home";
  const baseClub = clubCatalog.find((club) => String(club.id) === String(source.clubId)) ||
    clubCatalog.find((club) => String(club.name) === String(source.club));
  const inferredClub = source.club || source.team || baseClub?.name || "JerseyHub";
  const clubId = String(source.clubId || baseClub?.id || slugify(inferredClub));
  const rawImage = source.image || source.thumbnail || source.imageUrl || source.clubLogo || (Array.isArray(source.images) ? source.images[0] : "");
  const images = Array.isArray(source.images) && source.images.length
    ? source.images.filter(Boolean)
    : [rawImage || baseClub?.logo || "/assets/hero-jerseys.png"];
  const stock = Math.max(0, Number(source.stock ?? 20));
  const status = source.status || "active";
  const normalized = {
    id: String(source.id),
    name: String(source.name || "Untitled Jersey").trim(),
    club: inferredClub,
    clubId,
    clubLogo: baseClub?.logo || images[0] || "/assets/hero-jerseys.png",
    clubAccent: baseClub?.accent || "#ff4d16",
    clubGlow: baseClub?.glow || "rgba(255, 77, 22, 0.28)",
    category,
    images,
    sizes: Array.isArray(source.sizes) && source.sizes.length ? source.sizes.map(String) : DEFAULT_SIZES.slice(),
    price: Number(source.price || 0),
    stock,
    sold: Math.max(0, Number(source.sold || 0)),
    status,
    featured: Boolean(source.featured),
    badge: CATEGORY_LABELS[category] || titleCase(category)
  };
  normalized.stockLabel = localStockLabel(normalized);
  normalized.inStock = normalized.status === "active" && normalized.stock > 0;
  return normalized;
}

function localCatalogFromStorage() {
  const storedProducts = readLocalProducts();
  if (!storedProducts) return null;

  const localProducts = storedProducts
    .map(normalizeLocalProduct)
    .filter((product) => product.id && product.name && product.status === "active");
  const clubMap = new Map();

  localProducts.forEach((product) => {
    if (clubMap.has(product.clubId)) return;
    const baseClub = clubCatalog.find((club) => String(club.id) === product.clubId);
    clubMap.set(product.clubId, {
      id: product.clubId,
      name: product.club,
      league: baseClub?.league || CATEGORY_LABELS[product.category] || titleCase(product.category),
      logo: baseClub?.logo || product.clubLogo || product.images[0] || "/assets/hero-jerseys.png",
      accent: baseClub?.accent || product.clubAccent,
      glow: baseClub?.glow || product.clubGlow
    });
  });

  const categoryMap = new Map();
  localProducts.forEach((product) => {
    categoryMap.set(product.category, {
      id: product.category,
      label: CATEGORY_LABELS[product.category] || titleCase(product.category)
    });
  });

  return {
    clubs: [...clubMap.values()],
    categories: [...categoryMap.values()],
    products: localProducts
  };
}

function activeClubMeta() {
  return clubs.find((club) => club.id === activeClub);
}

function clubProducts(clubId = activeClub) {
  const query = searchInput?.value.trim().toLowerCase() || "";
  return products.filter((product) => {
    const text = `${product.name} ${product.club} ${product.category}`.toLowerCase();
    return product.clubId === clubId &&
      (activeCategory === "all" || product.category === activeCategory) &&
      (!query || text.includes(query));
  });
}

function renderClubDirectory() {
  if (!clubDirectory) return;
  clubDirectory.innerHTML = clubs.map((club) => {
    const count = products.filter((product) => product.clubId === club.id).length;
    return `
      <button class="club-card-link" type="button" data-open-club="${escapeHtml(club.id)}" style="--club-accent:${club.accent}; --club-glow:${club.glow};">
        <span class="club-card-logo"><img src="${normalizeImage(club.logo)}" alt="${escapeHtml(club.name)}" loading="lazy" /></span>
        <span>
          <strong>${escapeHtml(club.name)}</strong>
          <em>${escapeHtml(club.league)} &middot; ${count} jerseys</em>
        </span>
      </button>
    `;
  }).join("");
}

function showClubDirectory(shouldPush = false) {
  activeClub = "";
  activeCategory = "all";
  if (clubPage) clubPage.hidden = true;
  renderClubDirectory();
  clubDirectory.hidden = false;
  if (shouldPush) history.pushState(null, "", "#shop");
  document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openClub(clubId, shouldPush = true) {
  const club = clubs.find((item) => item.id === clubId);
  if (!club) return showClubDirectory(shouldPush);
  activeClub = clubId;
  activeCategory = "all";
  filters.forEach((button) => button.classList.toggle("active", button.dataset.filter === "all"));
  if (searchInput) searchInput.value = "";
  clubDirectory.hidden = true;
  clubPage.hidden = false;
  if (shouldPush) history.pushState(null, "", `#club-${clubId}`);
  renderClubPage();
  document.querySelector("#shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderClubPage() {
  const club = activeClubMeta();
  if (!club) return;
  const items = clubProducts();
  clubSpotlight.style.setProperty("--club-accent", club.accent);
  clubSpotlight.style.setProperty("--club-glow", club.glow);
  clubSpotlight.innerHTML = `
    <div class="spotlight-copy">
      <p class="eyebrow">Club Store</p>
      <h2>${escapeHtml(club.name)}</h2>
      <p>Choose from Home, Away, Retro, Special, and Training jerseys for ${escapeHtml(club.name)}.</p>
      <div class="collection-metrics"><span>${items.length} jerseys</span><span>${escapeHtml(club.league)}</span><span>MoMo ready</span></div>
    </div>
    <div class="spotlight-logo"><img src="${normalizeImage(club.logo)}" alt="${escapeHtml(club.name)}" loading="lazy" /></div>
  `;
  resultCount.textContent = `Showing ${items.length} ${club.name} jerseys`;
  grid.classList.add("is-switching");
  window.setTimeout(() => {
    grid.innerHTML = items.length
      ? items.map(productCard).join("")
      : `<div class="empty-state"><h3>No jerseys found</h3><p>Try another category or search term.</p></div>`;
    grid.classList.remove("is-switching");
  }, 90);
}

function productCard(product, index = 0) {
  const sizes = availableSizes(product);
  const selected = sizes[0] || "";
  const label = product.stockLabel || (product.inStock ? "In Stock" : "Sold Out");
  return `
    <article class="product-card" data-product-card="${escapeHtml(product.id)}" style="--club-accent:${product.clubAccent}; --club-glow:${product.clubGlow}; animation-delay:${Math.min(index, 8) * 32}ms;">
      <div class="product-image">
        <span class="edition-badge ${product.category === "special" ? "hot" : ""}">${escapeHtml(CATEGORY_LABELS[product.category] || "Jersey")}</span>
        <img src="${productImage(product)}" data-fallback="${normalizeImage(product.clubLogo)}" alt="${escapeHtml(product.name)}" loading="lazy" />
      </div>
      <div class="product-body">
        <div class="product-kicker">${escapeHtml(product.club)}</div>
        <h3>${escapeHtml(product.name)}</h3>
        <div class="price-row">
          <div><span class="price-label">Price</span><div class="price">${formatRwf(product.price)}</div></div>
          <span class="stock-pill status-${statusClass(label)}">${escapeHtml(label)}</span>
        </div>
        <div class="sizes size-choice" aria-label="Select size">
          ${sizes.map((size, sizeIndex) => `<button class="${sizeIndex === 0 ? "selected" : ""}" type="button" data-size="${escapeHtml(size)}">${escapeHtml(size)}</button>`).join("") || `<span>Sold Out</span>`}
        </div>
        <div class="product-footer">
          <button class="add-btn" type="button" data-id="${escapeHtml(product.id)}" data-size="${escapeHtml(selected)}" ${!selected || !product.inStock ? "disabled" : ""}>${product.inStock ? "Add to Cart" : "Sold Out"}</button>
          <button class="favorite-btn ${favorites.has(product.id) ? "active" : ""}" type="button" data-id="${escapeHtml(product.id)}" aria-label="Favorite ${escapeHtml(product.name)}" aria-pressed="${favorites.has(product.id)}"></button>
        </div>
      </div>
    </article>
  `;
}

function cartKey(id, size) {
  return `${id}::${size}`;
}

function readStoredCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed).map(([key, qty]) => {
        const [id, size] = key.includes("::") ? key.split("::") : String(key).split("|");
        return { id, size, qty };
      });
    }
    return [];
  } catch {
    return [];
  }
}

function saveCart() {
  const entries = [...cart.entries()].map(([key, qty]) => {
    const [id, size] = key.split("::");
    return { id, size, qty };
  });
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Cart still works in memory if browser storage is unavailable.
  }
}

function loadCart() {
  cart.clear();
  readStoredCart().forEach(({ id, size, qty }) => {
    const product = products.find((item) => String(item.id) === String(id));
    const quantity = Math.max(1, Math.min(20, Number(qty || 1)));
    if (!product || !availableSizes(product).includes(size) || !product.inStock) return;
    cart.set(cartKey(id, size), Math.min(quantity, Math.max(1, Number(product.stock || 20))));
  });
  saveCart();
}

function cartEntries() {
  return [...cart.entries()]
    .map(([key, qty]) => {
      const [id, size] = key.split("::");
      return { product: products.find((item) => String(item.id) === String(id)), size, qty };
    })
    .filter((entry) => entry.product);
}

function renderCart() {
  const entries = cartEntries();
  const totalQty = entries.reduce((sum, entry) => sum + entry.qty, 0);
  const subtotal = entries.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);
  cartCount.textContent = totalQty;
  cartCount.classList.remove("cart-count-bump");
  window.requestAnimationFrame(() => cartCount.classList.add("cart-count-bump"));
  cartSubtotal.textContent = formatRwf(subtotal);
  cartEmpty.style.display = entries.length ? "none" : "block";
  document.querySelector(".checkout-btn").disabled = entries.length === 0;
  cartItems.innerHTML = entries.map(({ product, size, qty }) => `
    <div class="cart-line">
      <img src="${productImage(product)}" alt="${escapeHtml(product.name)}" />
      <div><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(size)} &middot; ${formatRwf(product.price)} each</p></div>
      <div class="qty-controls">
        <button type="button" data-action="decrease" data-key="${escapeHtml(cartKey(product.id, size))}" aria-label="Decrease quantity">-</button>
        <strong>${qty}</strong>
        <button type="button" data-action="increase" data-key="${escapeHtml(cartKey(product.id, size))}" aria-label="Increase quantity">+</button>
        <button class="remove-line" type="button" data-action="remove" data-key="${escapeHtml(cartKey(product.id, size))}" aria-label="Remove ${escapeHtml(product.name)}">Remove</button>
      </div>
    </div>
  `).join("");
  saveCart();
}

function showShopToast(message) {
  shopToast.textContent = message;
  shopToast.classList.add("show");
  window.clearTimeout(showShopToast.timer);
  showShopToast.timer = window.setTimeout(() => shopToast.classList.remove("show"), 2200);
}

function showMiniCartPreview(product, size) {
  const entries = cartEntries();
  const totalQty = entries.reduce((sum, entry) => sum + entry.qty, 0);
  const subtotal = entries.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);
  miniCart.innerHTML = `
    <img src="${productImage(product)}" alt="${escapeHtml(product.name)}" />
    <div>
      <strong>Added to cart</strong>
      <span>${escapeHtml(product.name)} · ${escapeHtml(size)}</span>
      <em>${totalQty} item${totalQty === 1 ? "" : "s"} · ${formatRwf(subtotal)}</em>
    </div>
    <button type="button" data-mini-cart-open>View</button>
  `;
  miniCart.classList.add("show");
  window.clearTimeout(showMiniCartPreview.timer);
  showMiniCartPreview.timer = window.setTimeout(() => miniCart.classList.remove("show"), 3600);
}

function animateAddButton(button) {
  if (!button) return;
  const card = button.closest(".product-card");
  button.classList.remove("just-added");
  card?.classList.remove("added-to-cart");
  window.requestAnimationFrame(() => {
    button.classList.add("just-added");
    card?.classList.add("added-to-cart");
  });
  window.setTimeout(() => {
    button.classList.remove("just-added");
    card?.classList.remove("added-to-cart");
  }, 700);
}

function addToCart(id, size, sourceButton = null) {
  const product = products.find((item) => String(item.id) === String(id));
  if (!product || !product.inStock) {
    showShopToast("Product is not available");
    return false;
  }
  if (!size || !availableSizes(product).includes(size)) {
    showShopToast("Select a size first");
    return false;
  }
  const key = cartKey(id, size);
  const current = cart.get(key) || 0;
  const maxQty = Math.max(1, Number(product.stock || 20));
  if (current >= maxQty) {
    showShopToast("Maximum quantity reached");
    return false;
  }
  cart.set(key, current + 1);
  renderCart();
  animateAddButton(sourceButton);
  showShopToast("Jersey added to cart");
  showMiniCartPreview(product, size);
  return true;
}

function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  renderClubPage();
}

function openCart() {
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  overlay.classList.add("show");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  overlay.classList.remove("show");
}

async function showTracking(code) {
  const result = document.querySelector("#trackingResult");
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) {
    result.classList.add("show");
    result.innerHTML = "<strong>Enter an order code.</strong>";
    return;
  }

  result.classList.add("show");
  result.innerHTML = "Checking order...";

  try {
    const { order } = await api.trackOrder(normalized);
    const rider = order.assignedRider ? `<br>Rider: ${escapeHtml(order.assignedRider.name)} (${escapeHtml(order.assignedRider.phone)})` : "";
    result.innerHTML = `
      <strong>${escapeHtml(order.id)}</strong><br>
      Delivery: ${escapeHtml(DELIVERY_LABELS[order.deliveryStatus] || order.deliveryStatus)}<br>
      Payment: ${escapeHtml(PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus)}<br>
      Total: ${formatRwf(order.totalPrice)}${rider}
    `;
  } catch {
    const fallback = seededTracking.get(normalized);
    result.innerHTML = fallback
      ? `<strong>${escapeHtml(normalized)}</strong><br>${escapeHtml(fallback)}`
      : `<strong>Order not found.</strong><br>Check the code and try again, or contact support on WhatsApp.`;
  }
}

async function refreshCatalog() {
  const data = localCatalogFromStorage() || await api.getCatalog();
  clubs = data.clubs || [];
  categories = data.categories || [];
  products = data.products || [];
  renderClubDirectory();
  if (activeClub) renderClubPage();
}

clubDirectory.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-club]");
  if (button) openClub(button.dataset.openClub);
});

document.querySelector("#backToClubs").addEventListener("click", () => showClubDirectory(true));

grid.addEventListener("click", (event) => {
  const sizeButton = event.target.closest(".size-choice button[data-size]");
  if (sizeButton) {
    const card = sizeButton.closest("[data-product-card]");
    card.querySelectorAll(".size-choice button[data-size]").forEach((button) => button.classList.remove("selected"));
    sizeButton.classList.add("selected");
    const addButton = card.querySelector(".add-btn");
    addButton.dataset.size = sizeButton.dataset.size;
    addButton.disabled = false;
    addButton.textContent = "Add to Cart";
    return;
  }

  const favoriteButton = event.target.closest(".favorite-btn");
  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.id);
    return;
  }

  const addButton = event.target.closest(".add-btn");
  if (!addButton) return;
  addToCart(addButton.dataset.id, addButton.dataset.size, addButton);
});

grid.addEventListener("error", (event) => {
  if (!event.target.matches(".product-image img")) return;
  const fallback = event.target.dataset.fallback;
  if (fallback && event.target.src !== new URL(fallback, window.location.href).href) event.target.src = fallback;
}, true);

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const key = button.dataset.key;
  const current = cart.get(key) || 0;
  if (button.dataset.action === "remove") {
    cart.delete(key);
    showShopToast("Removed from cart");
    renderCart();
    return;
  }
  const [id] = key.split("::");
  const product = products.find((item) => String(item.id) === String(id));
  const maxQty = Math.max(1, Number(product?.stock || 20));
  const next = button.dataset.action === "increase" ? Math.min(current + 1, maxQty) : current - 1;
  if (next <= 0) cart.delete(key);
  else cart.set(key, next);
  renderCart();
});

miniCart.addEventListener("click", (event) => {
  if (!event.target.closest("[data-mini-cart-open]")) return;
  miniCart.classList.remove("show");
  openCart();
});

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    activeCategory = button.dataset.filter;
    renderClubPage();
  });
});

searchInput.addEventListener("input", renderClubPage);
document.querySelector(".cart-button").addEventListener("click", openCart);
document.querySelector(".close-cart").addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
document.querySelector(".login-button").addEventListener("click", () => document.getElementById("loginModal").showModal());
document.querySelector(".checkout-btn").addEventListener("click", () => {
  if (!cart.size) return;
  closeCart();
  checkoutModal.showModal();
});

document.querySelector("#checkoutForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "close") return;
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const form = new FormData(event.currentTarget);
  const entries = cartEntries();
  const checkoutButton = event.currentTarget.querySelector(".primary-btn");
  checkoutButton.disabled = true;
  checkoutButton.textContent = "Confirming...";

  try {
    const { order } = await api.createOrder({
      customerName: String(form.get("name") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      location: String(form.get("address") || "").trim(),
      items: entries.map(({ product, size, qty }) => ({
        productId: product.id,
        size,
        quantity: qty
      }))
    });

    cart.clear();
    saveCart();
    renderCart();
    event.currentTarget.reset();
    checkoutModal.close();
    await refreshCatalog();
    document.querySelector("#trackInput").value = order.id;
    await showTracking(order.id);
    document.querySelector("#track").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    alert(error.message || "Could not create order. Please try again.");
  } finally {
    checkoutButton.disabled = false;
    checkoutButton.textContent = "Confirm Order";
  }
});

document.querySelector("#trackForm").addEventListener("submit", (event) => {
  event.preventDefault();
  showTracking(document.querySelector("#trackInput").value);
});

const pageHashes = {
  "#faqs": "faqs",
  "#returns": "returns",
  "#size-guide": "size",
  "#contact": "contact",
  "#privacy": "privacy",
  "#terms": "terms"
};

const pageToHash = Object.fromEntries(Object.entries(pageHashes).map(([hash, page]) => [page, hash]));
const pageContent = {
  faqs: `<a class="back-link" href="#top">Back to Home</a><h1>FAQs</h1><p class="support-lede">Common questions about ordering, payment, delivery, and jersey care.</p><div class="faq-list"><details><summary>How do I pay with MoMo?</summary><p>Place your order, enter your MoMo phone number, and we contact you to confirm payment before dispatch.</p></details><details><summary>How do I track my order?</summary><p>Use your order code in the Track Delivery section.</p></details></div>`,
  returns: `<a class="back-link" href="#top">Back to Home</a><h1>Returns & Delivery</h1><div class="policy-grid"><article><h2>Free Delivery</h2><ul><li>Free delivery across Rwanda</li><li>Kigali delivery within 2-5 business days</li></ul></article><article><h2>Returns</h2><ul><li>Returns accepted within 7 days</li><li>Items must be unworn with tags attached</li></ul></article><article><h2>Quality</h2><ul><li>Every jersey is checked before dispatch</li></ul></article></div>`,
  size: `<a class="back-link" href="#top">Back to Home</a><h1>Size Guide</h1><table class="size-table"><tr><th>Size</th><th>Chest</th><th>Length</th></tr><tr><td>S</td><td>88-92</td><td>70</td></tr><tr><td>M</td><td>92-100</td><td>72</td></tr><tr><td>L</td><td>100-108</td><td>74</td></tr><tr><td>XL</td><td>108-116</td><td>76</td></tr><tr><td>XXL</td><td>116-124</td><td>78</td></tr></table>`,
  contact: `<a class="back-link" href="#top">Back to Home</a><h1>Contact</h1><div class="contact-panel"><p><strong>Phone</strong><span>+250 7XX XXX XXX</span></p><p><strong>Email</strong><span>hello@jerseyhub.rw</span></p></div>`,
  privacy: `<a class="back-link" href="#top">Back to Home</a><h1>Privacy Policy</h1><div class="text-page"><p>Order data is stored securely by the JerseyHub order system and used only for fulfilment, payment confirmation, and delivery tracking.</p></div>`,
  terms: `<a class="back-link" href="#top">Back to Home</a><h1>Terms of Service</h1><div class="text-page"><p>Prices are listed in RWF. MoMo or cash payment is confirmed before delivery completion.</p></div>`
};

function closeMobileMenu() {
  document.querySelector(".nav-links").classList.remove("open");
  document.querySelector(".menu-btn").setAttribute("aria-expanded", "false");
}

function showHome(targetHash = "#top", shouldScroll = false) {
  document.querySelectorAll("main > section:not(#supportPage)").forEach((section) => { section.hidden = false; });
  supportPage.hidden = true;
  supportPage.innerHTML = "";
  closeMobileMenu();
  if (targetHash === "#shop" && !activeClub) showClubDirectory(false);
  if (shouldScroll) document.querySelector(targetHash || "#top")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showSupportPage(page, shouldUpdateHash = false) {
  if (!pageContent[page]) return;
  document.querySelectorAll("main > section:not(#supportPage)").forEach((section) => { section.hidden = true; });
  supportPage.innerHTML = pageContent[page];
  supportPage.hidden = false;
  closeMobileMenu();
  if (shouldUpdateHash) history.pushState(null, "", pageToHash[page]);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function handlePageHash() {
  const hash = window.location.hash;
  const clubMatch = hash.match(/^#club-(.+)$/);
  if (clubMatch) {
    showHome("#shop", false);
    openClub(clubMatch[1], false);
    return;
  }
  const page = pageHashes[hash];
  if (page) showSupportPage(page);
  else showHome(homeHashes.has(hash) ? hash || "#top" : "#top", true);
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;
  if (link.dataset.page) {
    event.preventDefault();
    showSupportPage(link.dataset.page, true);
    return;
  }
  const hash = link.getAttribute("href");
  if (homeHashes.has(hash)) {
    event.preventDefault();
    if (hash === "#shop") showClubDirectory(true);
    else {
      history.pushState(null, "", hash || "#top");
      showHome(hash, true);
    }
  }
});

document.querySelector(".menu-btn").addEventListener("click", (event) => {
  const navLinks = document.querySelector(".nav-links");
  const isOpen = navLinks.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
});
document.querySelectorAll(".nav-links a").forEach((link) => link.addEventListener("click", closeMobileMenu));

window.addEventListener("hashchange", handlePageHash);
window.addEventListener("popstate", handlePageHash);
window.addEventListener("storage", (event) => {
  if (event.key === CART_STORAGE_KEY) {
    loadCart();
    renderCart();
    return;
  }
  if (event.key === PRODUCTS_STORAGE_KEY) {
    refreshCatalog().then(() => {
      loadCart();
      renderCart();
      handlePageHash();
    }).catch(() => {});
  }
});

(async function initStorefront() {
  try {
    await refreshCatalog();
    loadCart();
    renderCart();
    handlePageHash();
  } catch (error) {
    clubDirectory.innerHTML = `<div class="empty-state"><h3>Store is offline</h3><p>Start the JerseyHub server and refresh this page.</p></div>`;
    renderCart();
  }
})();

// Chat Assistant Integration
window.addToCartFromChat = function(productId, size) {
  const product = products.find((p) => String(p.id) === String(productId));
  if (!product || !product.inStock) {
    showShopToast("Product is not available");
    return false;
  }
  if (!availableSizes(product).includes(size)) {
    showShopToast(`Size ${size} is not available`);
    return false;
  }
  return addToCart(productId, size);
};

window.JerseyStorefront = {
  getProducts: () => products.slice(),
  getCart: () => cartEntries().map(({ product, size, qty }) => ({ product, size, qty })),
  addToCart,
  openCart,
  closeCart,
  refreshCatalog,
  formatRwf
};
