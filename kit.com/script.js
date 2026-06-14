const { loadProducts, saveProducts, loadOrders, saveOrders, clubCatalog } = window.JerseyHubData;

let products = loadProducts();
const cart = new Map();
const favorites = new Set();
let activeClub = "";
let activeCategory = "all";

const seededTracking = new Map([
  ["JH-1024", "Packed and ready for rider pickup in Kigali."],
  ["JH-2048", "Out for delivery. Estimated arrival: today before 6 PM."],
  ["JH-3001", "Payment confirmed. Jersey is being prepared."]
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

function formatRwf(amount) {
  return `${Number(amount).toLocaleString("en-RW")} RWF`;
}

function productImage(product) {
  return product.img || product.images?.find((image) => image.isPrimary)?.url || product.images?.[0]?.url || product.fallbackImg;
}

function availableSizes(product) {
  if (Array.isArray(product.sizes)) return product.sizes;
  return Object.entries(product.sizes || {})
    .filter(([, qty]) => Number(qty) > 0)
    .map(([size]) => size);
}

function productStatus(product) {
  if (product.stock <= 0) return "Sold Out";
  if (product.badge === "Dragon" || product.badge === "Limited") return "Limited Edition";
  if (product.stock <= 5) return "Low Stock";
  return "In Stock";
}

function activeClubMeta() {
  return clubCatalog.find((club) => club.id === activeClub);
}

function clubProducts(clubId = activeClub) {
  const query = searchInput?.value.trim().toLowerCase() || "";
  return products.filter((product) => {
    const text = `${product.name} ${product.category || ""} ${product.edition || ""} ${product.badge || ""}`.toLowerCase();
    return product.visible !== false &&
      product.status !== "inactive" &&
      product.clubId === clubId &&
      (activeCategory === "all" || product.category === activeCategory || product.tags?.includes(activeCategory)) &&
      (!query || text.includes(query));
  });
}

function renderClubDirectory() {
  clubDirectory.innerHTML = clubCatalog.map((club) => {
    const count = products.filter((product) => product.visible !== false && product.clubId === club.id).length;
    return `
      <button class="club-card-link" type="button" data-open-club="${club.id}" style="--club-accent:${club.accent}; --club-glow:${club.glow};">
        <span class="club-card-logo"><img src="${club.logo}" alt="${club.name}" loading="lazy" /></span>
        <span>
          <strong>${club.name}</strong>
          <em>${club.league} · ${count} jerseys</em>
        </span>
      </button>
    `;
  }).join("");
}

function showClubDirectory(shouldPush = false) {
  activeClub = "";
  clubPage.hidden = true;
  renderClubDirectory();
  clubDirectory.hidden = false;
  if (shouldPush) history.pushState(null, "", "#shop");
  document.querySelector("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
}

function openClub(clubId, shouldPush = true) {
  const club = clubCatalog.find((item) => item.id === clubId);
  if (!club) return showClubDirectory(shouldPush);
  activeClub = clubId;
  activeCategory = "all";
  filters.forEach((button) => button.classList.toggle("active", button.dataset.filter === "all"));
  searchInput.value = "";
  clubDirectory.hidden = true;
  clubDirectory.innerHTML = "";
  clubPage.hidden = false;
  if (shouldPush) history.pushState(null, "", `#club-${clubId}`);
  renderClubPage();
  document.querySelector("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderClubPage() {
  const club = activeClubMeta();
  if (!club) return;
  const items = clubProducts();
  clubSpotlight.style.setProperty("--club-accent", club.accent);
  clubSpotlight.style.setProperty("--club-glow", club.glow);
  clubSpotlight.innerHTML = `
    <div class="spotlight-copy">
      <p class="eyebrow">Dedicated Club Store</p>
      <h2>${club.name}</h2>
      <p>Only ${club.name} jerseys are shown here. Swipe through home, away, third, dragon, retro, training, and special editions.</p>
      <div class="collection-metrics"><span>${items.length} jerseys</span><span>${club.league}</span><span>MoMo ready</span></div>
    </div>
    <div class="spotlight-logo"><img src="${club.logo}" alt="${club.name}" loading="lazy" /></div>
  `;
  resultCount.textContent = `Showing ${items.length} ${club.name} jerseys`;
  grid.classList.add("is-switching");
  window.setTimeout(() => {
    grid.innerHTML = items.length
      ? `
        <section class="collection-row single-club-row" style="--club-accent:${club.accent}; --club-glow:${club.glow};">
          <div class="row-heading">
            <div><span class="row-logo"><img src="${club.logo}" alt="${club.name}" loading="lazy" /></span><div><p class="eyebrow">Swipe collection</p><h3>${club.name} Jersey Carousel</h3></div></div>
            <div class="row-actions"><button class="rail-arrow" type="button" data-direction="-1" aria-label="Scroll left">&lt;</button><button class="rail-arrow" type="button" data-direction="1" aria-label="Scroll right">&gt;</button></div>
          </div>
          <div class="product-rail" data-club-rail="${club.id}">
            ${items.map(productCard).join("")}
          </div>
          <div class="rail-dots">${items.map((_, index) => `<span class="${index === 0 ? "active" : ""}"></span>`).join("")}</div>
        </section>
      `
      : `<div class="empty-state"><h3>No jerseys found</h3><p>Try another category or search term.</p></div>`;
    grid.classList.remove("is-switching");
    setupRailInteractions();
  }, 120);
}

function productCard(product, index = 0) {
  const sizes = availableSizes(product);
  const selected = sizes[0] || "";
  const label = productStatus(product);
  return `
    <article class="product-card carousel-card" data-product-card="${product.id}" style="--club-accent:${product.clubAccent}; --club-glow:${product.clubGlow}; animation-delay:${Math.min(index, 8) * 32}ms;">
      <div class="product-image">
        <span class="edition-badge ${label === "Limited Edition" ? "hot" : ""}">${product.badge || product.category || "Jersey"}</span>
        <img src="${productImage(product)}" data-fallback="${product.fallbackImg || productImage(product)}" alt="${product.name}" loading="lazy" />
      </div>
      <div class="product-body">
        <div class="product-kicker">${product.category || product.edition || "Jersey"}</div>
        <h3>${product.name}</h3>
        <div class="price-row"><div><span class="price-label">Price</span><div class="price">${formatRwf(product.price)}</div></div><span class="stock-pill status-${label.toLowerCase().replace(/\s+/g, "-")}">${label}</span></div>
        <div class="sizes size-choice" aria-label="Select size">
          ${sizes.map((size, sizeIndex) => `<button class="${sizeIndex === 0 ? "selected" : ""}" type="button" data-size="${size}">${size}</button>`).join("") || `<span>Unavailable</span>`}
        </div>
        <div class="product-footer">
          <button class="add-btn" type="button" data-id="${product.id}" data-size="${selected}" ${!selected || product.stock <= 0 ? "disabled" : ""}>${product.stock <= 0 ? "Sold Out" : "Add to Cart"}</button>
          <button class="favorite-btn ${favorites.has(product.id) ? "active" : ""}" type="button" data-id="${product.id}" aria-label="Favorite ${product.name}" aria-pressed="${favorites.has(product.id)}"></button>
        </div>
      </div>
    </article>
  `;
}

function setupRailInteractions() {
  document.querySelectorAll(".product-rail").forEach((rail) => {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    rail.addEventListener("pointerdown", (event) => {
      isDown = true;
      rail.classList.add("dragging");
      rail.setPointerCapture(event.pointerId);
      startX = event.clientX;
      scrollLeft = rail.scrollLeft;
    });
    rail.addEventListener("pointermove", (event) => {
      if (!isDown) return;
      event.preventDefault();
      rail.scrollLeft = scrollLeft - (event.clientX - startX);
      updateDots(rail);
    });
    rail.addEventListener("scroll", () => updateDots(rail), { passive: true });
    ["pointerup", "pointercancel", "pointerleave"].forEach((type) => rail.addEventListener(type, () => {
      isDown = false;
      rail.classList.remove("dragging");
    }));
  });
}

function updateDots(rail) {
  const cards = [...rail.querySelectorAll(".product-card")];
  const dots = rail.closest(".collection-row")?.querySelectorAll(".rail-dots span");
  if (!cards.length || !dots?.length) return;
  const index = Math.round(rail.scrollLeft / Math.max(1, cards[0].offsetWidth + 16));
  dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === Math.min(index, dots.length - 1)));
}

function cartKey(id, size) {
  return `${id}::${size}`;
}

function cartEntries() {
  return [...cart.entries()]
    .map(([key, qty]) => {
      const [id, size] = key.split("::");
      return { product: products.find((item) => item.id === id), size, qty };
    })
    .filter((entry) => entry.product);
}

function renderCart() {
  const entries = cartEntries();
  const totalQty = entries.reduce((sum, entry) => sum + entry.qty, 0);
  const subtotal = entries.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);
  cartCount.textContent = totalQty;
  cartSubtotal.textContent = formatRwf(subtotal);
  cartEmpty.style.display = entries.length ? "none" : "block";
  document.querySelector(".checkout-btn").disabled = entries.length === 0;
  cartItems.innerHTML = entries.map(({ product, size, qty }) => `
    <div class="cart-line">
      <img src="${productImage(product)}" alt="${product.name}" />
      <div><h3>${product.name}</h3><p>${size} · ${formatRwf(product.price)} each</p></div>
      <div class="qty-controls"><button type="button" data-action="decrease" data-key="${cartKey(product.id, size)}">-</button><strong>${qty}</strong><button type="button" data-action="increase" data-key="${cartKey(product.id, size)}">+</button></div>
    </div>
  `).join("");
}

function addToCart(id, size) {
  const product = products.find((item) => item.id === id);
  if (!product || !availableSizes(product).includes(size) || product.stock <= 0) return;
  const key = cartKey(id, size);
  const current = cart.get(key) || 0;
  if (current >= product.stock) return;
  cart.set(key, current + 1);
  renderCart();
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

function orderStatus(code) {
  const order = loadOrders().find((item) => item.code === code);
  if (order) return `${order.status}. ${order.customer.name}, ${order.items.length} item type(s), total ${formatRwf(order.total)}.`;
  return seededTracking.get(code);
}

function showTracking(code) {
  const result = document.querySelector("#trackingResult");
  const normalized = code.trim().toUpperCase();
  const status = orderStatus(normalized);
  result.classList.add("show");
  result.innerHTML = status ? `<strong>${normalized}</strong><br>${status}` : `<strong>Order not found.</strong><br>Check the code and try again, or contact support on WhatsApp.`;
}

clubDirectory.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-club]");
  if (button) openClub(button.dataset.openClub);
});

document.querySelector("#backToClubs").addEventListener("click", () => showClubDirectory(true));

grid.addEventListener("click", (event) => {
  const arrow = event.target.closest(".rail-arrow");
  if (arrow) {
    const rail = arrow.closest(".collection-row")?.querySelector(".product-rail");
    if (rail) rail.scrollBy({ left: Number(arrow.dataset.direction) * Math.max(320, rail.clientWidth * 0.82), behavior: "smooth" });
    return;
  }
  const sizeButton = event.target.closest("[data-size]");
  if (sizeButton) {
    const card = sizeButton.closest("[data-product-card]");
    card.querySelectorAll("[data-size]").forEach((button) => button.classList.remove("selected"));
    sizeButton.classList.add("selected");
    card.querySelector(".add-btn").dataset.size = sizeButton.dataset.size;
    return;
  }
  const favoriteButton = event.target.closest(".favorite-btn");
  if (favoriteButton) {
    toggleFavorite(favoriteButton.dataset.id);
    return;
  }
  const addButton = event.target.closest(".add-btn");
  if (!addButton) return;
  addToCart(addButton.dataset.id, addButton.dataset.size);
  openCart();
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
  const [id] = key.split("::");
  const product = products.find((item) => item.id === id);
  const next = button.dataset.action === "increase" ? Math.min(current + 1, product?.stock || current) : current - 1;
  if (next <= 0) cart.delete(key);
  else cart.set(key, next);
  renderCart();
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
document.querySelector(".admin-link-btn").addEventListener("click", () => { window.location.href = "admin-login.html"; });
document.querySelector(".checkout-btn").addEventListener("click", () => {
  if (!cart.size) return;
  closeCart();
  checkoutModal.showModal();
});

document.querySelector("#checkoutForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "close") return;
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const form = new FormData(event.currentTarget);
  const entries = cartEntries();
  const total = entries.reduce((sum, entry) => sum + entry.product.price * entry.qty, 0);
  const code = `JH-${Math.floor(4000 + Math.random() * 5000)}`;
  const order = {
    code,
    createdAt: new Date().toISOString(),
    status: "Payment pending",
    paymentStatus: "Pending",
    customer: {
      name: String(form.get("name") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
      address: String(form.get("address") || "").trim()
    },
    items: entries.map(({ product, size, qty }) => ({ id: product.id, name: product.name, clubId: product.clubId, size, qty, price: product.price })),
    total
  };
  entries.forEach(({ product, qty }) => {
    product.stock = Math.max(0, product.stock - qty);
    product.sold = (product.sold || 0) + qty;
  });
  saveProducts(products);
  saveOrders([order, ...loadOrders()]);
  cart.clear();
  renderClubPage();
  renderCart();
  event.currentTarget.reset();
  checkoutModal.close();
  document.querySelector("#trackInput").value = code;
  showTracking(code);
  document.querySelector("#track").scrollIntoView({ behavior: "smooth" });
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
  privacy: `<a class="back-link" href="#top">Back to Home</a><h1>Privacy Policy</h1><div class="text-page"><p>Order data is stored locally for this demo.</p></div>`,
  terms: `<a class="back-link" href="#top">Back to Home</a><h1>Terms of Service</h1><div class="text-page"><p>Prices are listed in RWF. MoMo payment is confirmed before dispatch.</p></div>`
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
window.addEventListener("storage", () => {
  products = loadProducts();
  renderClubDirectory();
  if (activeClub) renderClubPage();
  renderCart();
});
window.addEventListener("hashchange", handlePageHash);
window.addEventListener("popstate", handlePageHash);

renderClubDirectory();
handlePageHash();
renderCart();
