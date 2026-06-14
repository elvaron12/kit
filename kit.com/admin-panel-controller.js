(() => {
  "use strict";

  const PRODUCTS_STORAGE_KEY = "products";
  const PRODUCTS_UPDATED_KEY = "productsUpdatedAt";
  const PRODUCTS_SEEDED_KEY = "productsSeeded";
  const LOCAL_ADMIN_SESSION_KEY = "jerseyhub.admin.localSession";
  const DEFAULT_SIZES = ["S", "M", "L", "XL", "XXL"];
  const DEFAULT_CATEGORY_OPTIONS = [
    "Premier League",
    "La Liga",
    "Bundesliga",
    "Serie A",
    "Ligue 1",
    "International",
    "home",
    "away",
    "retro",
    "special",
    "training"
  ];
  const DEFAULT_CLUB = {
    id: "general",
    name: "General Collection",
    league: "Football",
    logo: "/assets/hero-jerseys.png"
  };

  let activeEditId = null;
  let pendingUploadedImages = [];
  let currentProductImages = [];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const fieldSelectors = {
    id: "#productId, [name='id'], [name='productId']",
    name: "#productName, #name, [name='name'], [name='productName']",
    price: "#productPrice, #price, [name='price'], [name='productPrice']",
    category: "#productCategory, #category, [name='category'], [name='productCategory']",
    image: "#productImageUrl, #productImage, #imageUrl, #image, [name='image'], [name='imageUrl'], [name='productImage']",
    description: "#productDescription, #description, [name='description'], [name='productDescription']",
    features: "#productFeatures, #features, [name='features'], [name='productFeatures']",
    club: "#productClub, #club, [name='club'], [name='clubId'], [name='productClub']",
    stock: "#productStock, #stock, [name='stock'], [name='productStock']",
    status: "#productStatus, #status, [name='status'], [name='productStatus']",
    featured: "#productFeatured, #featured, [name='featured'], [name='productFeatured']",
    images: "#productImages, [name='images'], [name='productImages']"
  };

  function field(name) {
    return $(fieldSelectors[name]);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "general";
  }

  function toTitleCase(value) {
    return String(value || "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function categoryLabel(category) {
    const labels = window.JerseyHubData?.CATEGORY_LABELS || {};
    return labels[category] || toTitleCase(category);
  }

  function formatPrice(value) {
    const price = Number(value || 0);
    if (window.JerseyHubData?.formatRwf) {
      return window.JerseyHubData.formatRwf(price);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(price);
  }

  function formatDateTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "Not recorded";
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function setMetric(selector, value, tone = "") {
    const node = $(selector);
    if (!node) return;
    node.textContent = value;
    node.className = tone;
  }

  function normalizeImagePath(path) {
    const image = String(path || "").trim();
    if (!image) return normalizeImagePath("/assets/hero-jerseys.png");
    if (window.JerseyHubData?.normalizeImage) return window.JerseyHubData.normalizeImage(image);
    if (/^(data:|https?:\/\/|blob:)/i.test(image)) return image;
    if (window.location.protocol === "file:" && image.startsWith("/")) return image.slice(1);
    return image.startsWith("/") ? image : `/${image}`;
  }

  function splitFeatures(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    const text = String(value || "").trim();
    if (!text) return [];

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return text.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
    }

    return text.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  }

  function formatFeatures(features) {
    return splitFeatures(features).join("\n");
  }

  function clubCatalog() {
    const fromData = window.JerseyHubData?.clubCatalog;
    if (Array.isArray(fromData) && fromData.length) {
      return fromData.map((club) => ({
        id: String(club.id || slugify(club.name)),
        name: String(club.name || club.id || "Club"),
        league: String(club.league || ""),
        logo: club.logo || "/assets/hero-jerseys.png"
      }));
    }
    return [DEFAULT_CLUB];
  }

  function clubById(clubId) {
    return clubCatalog().find((club) => String(club.id) === String(clubId)) || null;
  }

  function rawProductsFromDataJs() {
    const possibleGlobals = [
      window.products,
      window.Products,
      window.PRODUCTS,
      window.productData,
      window.ProductData,
      window.catalogProducts
    ];

    const found = possibleGlobals.find((candidate) => Array.isArray(candidate));
    if (found) return found.map((product) => ({ ...product }));

    const categories = Object.keys(window.JerseyHubData?.CATEGORY_LABELS || {
      home: "Home",
      away: "Away",
      retro: "Retro",
      special: "Special",
      training: "Training"
    });
    const prices = {
      home: 89.99,
      away: 89.99,
      retro: 99.99,
      special: 109.99,
      training: 74.99
    };

    return clubCatalog().flatMap((club, clubIndex) => categories.map((category, categoryIndex) => ({
      id: clubIndex * 100 + categoryIndex + 1,
      name: `${club.name} ${categoryLabel(category)} Jersey`,
      price: prices[category] || 89.99,
      category,
      image: club.logo || "/assets/hero-jerseys.png",
      images: [club.logo || "/assets/hero-jerseys.png"],
      description: `${categoryLabel(category)} jersey from the ${club.name} collection.`,
      features: ["Premium fabric", "Club-inspired detailing", "Available in multiple sizes"],
      club: club.name,
      clubId: club.id,
      sizes: DEFAULT_SIZES,
      stock: category === "special" ? 5 : 20,
      status: "active",
      featured: categoryIndex === 0
    })));
  }

  function normalizeProduct(product) {
    const source = product && typeof product === "object" ? product : {};
    const rawImage = source.image || source.thumbnail || source.imageUrl || source.clubLogo || (Array.isArray(source.images) ? source.images[0] : "");
    const images = Array.isArray(source.images) && source.images.length
      ? source.images.filter(Boolean)
      : (rawImage ? [rawImage] : []);
    const clubMeta = clubById(source.clubId) || clubCatalog().find((club) => club.name === source.club) || null;
    const clubName = source.club || source.team || clubMeta?.name || "";
    const clubId = source.clubId || clubMeta?.id || (clubName ? slugify(clubName) : DEFAULT_CLUB.id);

    return {
      ...source,
      id: source.id,
      name: String(source.name || "").trim(),
      price: Number.parseFloat(source.price) || 0,
      category: String(source.category || source.league || "").trim(),
      image: rawImage || images[0] || "/assets/hero-jerseys.png",
      images: images.length ? images : [rawImage || "/assets/hero-jerseys.png"],
      description: String(source.description || "").trim(),
      features: splitFeatures(source.features),
      club: clubName || clubById(clubId)?.name || DEFAULT_CLUB.name,
      clubId,
      sizes: Array.isArray(source.sizes) && source.sizes.length ? source.sizes.map(String) : DEFAULT_SIZES.slice(),
      stock: Number.isFinite(Number(source.stock)) ? Number(source.stock) : 20,
      status: source.status || "active",
      featured: Boolean(source.featured),
      updatedAt: source.updatedAt || source.createdAt || new Date().toISOString()
    };
  }

  function seedProductsIfNeeded() {
    const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    const alreadySeeded = localStorage.getItem(PRODUCTS_SEEDED_KEY) === "true";

    if (stored !== null) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && (parsed.length > 0 || alreadySeeded)) return;
      } catch {
        // Bad local product data gets replaced by the baseline catalog below.
      }
    }

    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(rawProductsFromDataJs()));
    localStorage.setItem(PRODUCTS_UPDATED_KEY, new Date().toISOString());
    localStorage.setItem(PRODUCTS_SEEDED_KEY, "true");
  }

  function readProducts() {
    seedProductsIfNeeded();
    try {
      const parsed = JSON.parse(localStorage.getItem(PRODUCTS_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map(normalizeProduct) : [];
    } catch {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify([]));
      return [];
    }
  }

  function saveProducts(products) {
    const normalized = products.map(normalizeProduct);
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(normalized));
    localStorage.setItem(PRODUCTS_UPDATED_KEY, new Date().toISOString());
    localStorage.setItem(PRODUCTS_SEEDED_KEY, "true");
    window.dispatchEvent(new CustomEvent("products:updated", {
      detail: { products: normalized }
    }));
  }

  function generateNumericId(products) {
    const usedIds = new Set(products.map((product) => String(product.id)));
    const numericIds = products
      .map((product) => Number(product.id))
      .filter((id) => Number.isFinite(id));
    let nextId = (numericIds.length ? Math.max(...numericIds) : 0) + 1;
    while (usedIds.has(String(nextId))) nextId += 1;
    return nextId;
  }

  function productImage(product) {
    return normalizeImagePath(product.image || product.images?.[0] || product.clubLogo || "/assets/hero-jerseys.png");
  }

  function productContainer() {
    return $("#productsTableBody, #productList, #productsList, #productGrid, [data-products-container], .products-list, .product-list");
  }

  function productForm() {
    return $("#productForm, #addProductForm, form[data-product-form]");
  }

  function toast(message) {
    const node = $("#toast");
    if (!node) {
      window.alert(message);
      return;
    }
    node.textContent = message;
    node.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove("show"), 2600);
  }

  function setOptions(select, options, selectedValue = "", placeholder = "") {
    if (!select) return;
    const existingValue = selectedValue || select.value;
    const uniqueOptions = [];
    const seen = new Set();

    options.forEach((option) => {
      const value = typeof option === "string" ? option : option.value ?? option.id;
      const label = typeof option === "string" ? option : option.label ?? option.name ?? value;
      if (!value || seen.has(String(value))) return;
      seen.add(String(value));
      uniqueOptions.push({ value: String(value), label: String(label) });
    });

    select.innerHTML = `${placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ""}${uniqueOptions.map((option) => (
      `<option value="${escapeHtml(option.value)}"${String(existingValue) === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`
    )).join("")}`;
  }

  function ensureSupplementalFormFields() {
    const form = productForm();
    if (!form) return;
    const body = $(".dialog-body", form) || form;
    const formGrid = $(".form-grid", body) || body;

    if (!field("image")) {
      formGrid.insertAdjacentHTML("beforeend", `
        <div class="form-field full" data-generated-field="image-url">
          <label for="productImageUrl">Image URL</label>
          <input id="productImageUrl" name="image" type="text" placeholder="/assets/real-arsenal.png or https://..." />
        </div>
      `);
    }

    if (!field("description")) {
      formGrid.insertAdjacentHTML("beforeend", `
        <div class="form-field full" data-generated-field="description">
          <label for="productDescription">Description</label>
          <textarea id="productDescription" name="description" maxlength="800" placeholder="Short jersey description"></textarea>
        </div>
      `);
    }

    if (!field("features")) {
      formGrid.insertAdjacentHTML("beforeend", `
        <div class="form-field full" data-generated-field="features">
          <label for="productFeatures">Features</label>
          <textarea id="productFeatures" name="features" maxlength="800" placeholder="One feature per line, or comma separated"></textarea>
        </div>
      `);
    }
  }

  function allCategoryOptions(products) {
    const fromProducts = products.map((product) => product.category).filter(Boolean);
    const fromLabels = Object.keys(window.JerseyHubData?.CATEGORY_LABELS || {});
    return [...new Set([...fromProducts, ...fromLabels, ...DEFAULT_CATEGORY_OPTIONS])]
      .filter(Boolean)
      .map((category) => ({ id: category, label: categoryLabel(category) }));
  }

  function allClubOptions(products) {
    const fromCatalog = clubCatalog();
    const fromProducts = products
      .filter((product) => product.clubId || product.club)
      .map((product) => ({
        id: product.clubId || slugify(product.club),
        name: product.club || product.clubId,
        league: product.league || ""
      }));
    return [...fromCatalog, ...fromProducts, DEFAULT_CLUB].filter((club, index, array) => (
      array.findIndex((candidate) => String(candidate.id) === String(club.id)) === index
    ));
  }

  function populateControls() {
    const products = readProducts();
    const categoryOptions = allCategoryOptions(products);
    const clubOptions = allClubOptions(products);

    setOptions($("#productCategoryFilter"), categoryOptions, $("#productCategoryFilter")?.value || "", "All categories");
    setOptions(field("category"), categoryOptions, field("category")?.value || "");
    setOptions($("#productClubFilter"), clubOptions, $("#productClubFilter")?.value || "", "All clubs");
    setOptions(field("club"), clubOptions, field("club")?.value || "");

    const statusOptions = [
      { id: "active", label: "Active" },
      { id: "inactive", label: "Inactive" }
    ];
    setOptions($("#productStatusFilter"), statusOptions, $("#productStatusFilter")?.value || "", "All availability");
    setOptions(field("status"), statusOptions, field("status")?.value || "active");
    renderSizeCheckboxes(DEFAULT_SIZES);
  }

  function renderSizeCheckboxes(selectedSizes = DEFAULT_SIZES) {
    const wrapper = $("#productSizes, [data-product-sizes]");
    if (!wrapper) return;
    const selected = new Set((selectedSizes.length ? selectedSizes : DEFAULT_SIZES).map(String));
    wrapper.innerHTML = DEFAULT_SIZES.map((size) => `
      <label><input type="checkbox" name="productSize" value="${escapeHtml(size)}"${selected.has(size) ? " checked" : ""}> ${escapeHtml(size)}</label>
    `).join("");
  }

  function selectedSizes() {
    const checked = $$("input[name='productSize']:checked").map((input) => input.value);
    return checked.length ? checked : DEFAULT_SIZES.slice();
  }

  function renderImagePreview(images) {
    const preview = $("#productImagePreview, [data-image-preview]");
    if (!preview) return;
    preview.innerHTML = images.filter(Boolean).map((image) => `
      <img src="${escapeHtml(normalizeImagePath(image))}" alt="Product preview" />
    `).join("");
  }

  function currentFilters() {
    return {
      query: ($("#productSearch")?.value || "").trim().toLowerCase(),
      club: ($("#productClubFilter")?.value || "").trim(),
      category: ($("#productCategoryFilter")?.value || "").trim(),
      status: ($("#productStatusFilter")?.value || "").trim()
    };
  }

  function filteredProducts(products) {
    const filters = currentFilters();
    return products.filter((product) => {
      const searchableText = [
        product.id,
        product.name,
        product.category,
        product.club,
        product.description,
        product.features.join(" ")
      ].join(" ").toLowerCase();
      return (!filters.query || searchableText.includes(filters.query)) &&
        (!filters.club || String(product.clubId) === filters.club || String(product.club) === filters.club) &&
        (!filters.category || String(product.category) === filters.category) &&
        (!filters.status || String(product.status) === filters.status);
    });
  }

  function renderProducts() {
    const container = productContainer();
    if (!container) return;

    const products = filteredProducts(readProducts());
    if (!products.length) {
      container.innerHTML = container.tagName.toLowerCase() === "tbody"
        ? `<tr><td colspan="9" class="muted">No products found.</td></tr>`
        : `<div class="muted">No products found.</div>`;
      return;
    }

    if (container.tagName.toLowerCase() === "tbody") {
      container.innerHTML = products.map((product) => `
        <tr data-product-id="${escapeHtml(product.id)}">
          <td>
            <div class="product-cell">
              <img src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name)}" />
              <div>
                <strong>${escapeHtml(product.name)}</strong><br>
                <span class="muted">ID: ${escapeHtml(product.id)}</span>
              </div>
            </div>
          </td>
          <td>${escapeHtml(product.club || "General")}</td>
          <td>${escapeHtml(categoryLabel(product.category))}</td>
          <td>${escapeHtml(formatPrice(product.price))}</td>
          <td>${Number(product.stock || 0).toLocaleString("en-US")}</td>
          <td>${escapeHtml(product.sizes.join(", "))}</td>
          <td>${product.featured ? `<span class="status-badge status-active">Featured</span>` : `<span class="muted">No</span>`}</td>
          <td><span class="status-badge status-${escapeHtml(slugify(product.status))}">${escapeHtml(toTitleCase(product.status))}</span></td>
          <td>
            <button class="btn" type="button" data-product-action="edit" data-product-id="${escapeHtml(product.id)}">Edit</button>
            <button class="btn danger" type="button" data-product-action="delete" data-product-id="${escapeHtml(product.id)}">Delete</button>
          </td>
        </tr>
      `).join("");
      return;
    }

    container.innerHTML = products.map((product) => `
      <article class="product-admin-card" data-product-id="${escapeHtml(product.id)}">
        <img src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name)}" />
        <h3>${escapeHtml(product.name)}</h3>
        <p>ID: ${escapeHtml(product.id)}</p>
        <p>${escapeHtml(categoryLabel(product.category))}</p>
        <strong>${escapeHtml(formatPrice(product.price))}</strong>
        <div>
          <button class="btn" type="button" data-product-action="edit" data-product-id="${escapeHtml(product.id)}">Edit</button>
          <button class="btn danger" type="button" data-product-action="delete" data-product-id="${escapeHtml(product.id)}">Delete</button>
        </div>
      </article>
    `).join("");
  }

  function renderDashboardPlaceholders() {
    const products = readProducts();
    const totalProducts = products.length;
    const activeProducts = products.filter((product) => product.status === "active").length;
    const lowStockProducts = products.filter((product) => product.status === "active" && Number(product.stock || 0) > 0 && Number(product.stock || 0) <= 5);
    const soldOutProducts = products.filter((product) => Number(product.stock || 0) <= 0 || product.status !== "active");
    const featuredProducts = products.filter((product) => product.featured);
    const clubCount = new Set(products.map((product) => product.clubId || product.club).filter(Boolean)).size;
    const inventoryValue = products.reduce((sum, product) => sum + Number(product.price || 0) * Number(product.stock || 0), 0);
    const averagePrice = totalProducts ? products.reduce((sum, product) => sum + Number(product.price || 0), 0) / totalProducts : 0;

    setMetric("#statOrders", totalProducts.toLocaleString("en-US"));
    setMetric("#statSales", formatPrice(inventoryValue), inventoryValue > 0 ? "metric-positive" : "");
    setMetric("#statPending", lowStockProducts.length.toLocaleString("en-US"), lowStockProducts.length ? "metric-warning" : "metric-positive");
    setMetric("#statDelivered", activeProducts.toLocaleString("en-US"), "metric-positive");
    setMetric("#statRiders", featuredProducts.length.toLocaleString("en-US"));
    setMetric("#statFailed", soldOutProducts.length.toLocaleString("en-US"), soldOutProducts.length ? "metric-danger" : "metric-positive");
    setMetric("#statDaily", formatPrice(averagePrice));
    setMetric("#statWeekly", clubCount.toLocaleString("en-US"));

    const recentProducts = [...products]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .slice(0, 6);

    if ($("#recentOrdersBody")) {
      $("#recentOrdersBody").innerHTML = recentProducts.length ? recentProducts.map((product) => `
        <tr>
          <td>
            <div class="product-cell">
              <img src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name)}" />
              <div><strong>${escapeHtml(product.name)}</strong><br><span class="muted">ID: ${escapeHtml(product.id)}</span></div>
            </div>
          </td>
          <td>${escapeHtml(product.club || "General")}<br><span class="muted">${escapeHtml(categoryLabel(product.category))}</span></td>
          <td>${Number(product.stock || 0).toLocaleString("en-US")}</td>
          <td>${escapeHtml(formatPrice(product.price))}</td>
          <td><span class="status-badge status-${escapeHtml(slugify(product.status))}">${escapeHtml(toTitleCase(product.status))}</span></td>
          <td>${escapeHtml(formatDateTime(product.updatedAt || product.createdAt))}</td>
        </tr>
      `).join("") : `<tr><td colspan="6" class="muted">No jerseys in local storage yet.</td></tr>`;
    }

    const categorySummary = [...products.reduce((map, product) => {
      const key = product.category || "uncategorized";
      const current = map.get(key) || { category: key, count: 0, stock: 0, value: 0 };
      current.count += 1;
      current.stock += Number(product.stock || 0);
      current.value += Number(product.price || 0) * Number(product.stock || 0);
      map.set(key, current);
      return map;
    }, new Map()).values()].sort((a, b) => b.count - a.count || b.stock - a.stock);

    if ($("#riderPerformanceBody")) {
      $("#riderPerformanceBody").innerHTML = categorySummary.length ? categorySummary.map((item) => `
        <tr>
          <td><strong>${escapeHtml(categoryLabel(item.category))}</strong></td>
          <td>${item.count.toLocaleString("en-US")}</td>
          <td>${item.stock.toLocaleString("en-US")}</td>
          <td>${escapeHtml(formatPrice(item.value))}</td>
        </tr>
      `).join("") : `<tr><td colspan="4" class="muted">No category data yet.</td></tr>`;
    }

    if ($("#activityFeed")) {
      const lastUpdated = localStorage.getItem(PRODUCTS_UPDATED_KEY);
      const topSignals = [
        {
          title: lowStockProducts.length ? `${lowStockProducts.length} low-stock jersey${lowStockProducts.length === 1 ? "" : "s"}` : "Stock levels are healthy",
          detail: lowStockProducts.length ? lowStockProducts.slice(0, 3).map((product) => product.name).join(", ") : "No active jersey is at or below 5 units."
        },
        {
          title: `${featuredProducts.length} featured listing${featuredProducts.length === 1 ? "" : "s"}`,
          detail: featuredProducts.length ? featuredProducts.slice(0, 3).map((product) => product.name).join(", ") : "Mark standout jerseys as featured from the product editor."
        },
        {
          title: `Catalog synced locally`,
          detail: lastUpdated ? `Last saved ${formatDateTime(lastUpdated)}` : "Waiting for the first local catalog save."
        }
      ];

      $("#activityFeed").innerHTML = topSignals.map((signal) => `
        <article class="activity-item catalog-summary">
          <strong>${escapeHtml(signal.title)}</strong>
          <span>${escapeHtml(signal.detail)}</span>
        </article>
      `).join("");
    }

    if ($("#ordersTableBody")) $("#ordersTableBody").innerHTML = `<tr><td colspan="8" class="muted">No local orders available.</td></tr>`;
    if ($("#ridersTableBody")) $("#ridersTableBody").innerHTML = `<tr><td colspan="8" class="muted">No local riders available.</td></tr>`;
    if ($("#logsTableBody")) {
      const logRows = recentProducts.map((product) => `
        <tr>
          <td>${escapeHtml(formatDateTime(product.updatedAt || product.createdAt))}</td>
          <td>catalog</td>
          <td><span class="status-badge status-active">info</span></td>
          <td>${escapeHtml(product.name)} is saved in the local catalog.</td>
          <td>${escapeHtml(product.id)}</td>
        </tr>
      `);
      $("#logsTableBody").innerHTML = logRows.length ? logRows.join("") : `<tr><td colspan="5" class="muted">No local activity logs available.</td></tr>`;
    }
  }

  function renderAll() {
    populateControls();
    renderProducts();
    renderDashboardPlaceholders();
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
      return;
    }
    dialog.removeAttribute("hidden");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
      return;
    }
    dialog.setAttribute("hidden", "hidden");
  }

  function setFormMode(mode) {
    const isEdit = mode === "edit";
    if ($("#productDialogTitle")) $("#productDialogTitle").textContent = isEdit ? "Edit Jersey" : "Add Jersey";
    if ($("#saveProductBtn")) $("#saveProductBtn").textContent = isEdit ? "Save Changes" : "Save Jersey";
    if ($("#deleteProductBtn")) $("#deleteProductBtn").hidden = !isEdit;
  }

  function resetProductForm() {
    const form = productForm();
    if (form) form.reset();
    activeEditId = null;
    pendingUploadedImages = [];
    currentProductImages = [];
    if (field("id")) field("id").value = "";
    if (field("status")) field("status").value = "active";
    if (field("featured")) field("featured").checked = false;
    renderSizeCheckboxes(DEFAULT_SIZES);
    renderImagePreview([]);
    setFormMode("create");
  }

  function openCreateForm() {
    resetProductForm();
    populateControls();
    openDialog($("#productDialog"));
    field("name")?.focus();
  }

  function openEditForm(productId) {
    const product = readProducts().find((item) => String(item.id) === String(productId));
    if (!product) {
      toast("Product not found");
      return;
    }

    populateControls();
    activeEditId = product.id;
    pendingUploadedImages = [];
    currentProductImages = product.images?.length ? product.images.slice() : [product.image].filter(Boolean);

    if (field("id")) field("id").value = product.id;
    if (field("name")) field("name").value = product.name;
    if (field("price")) field("price").value = product.price;
    if (field("category")) field("category").value = product.category;
    if (field("image")) field("image").value = product.image || product.images?.[0] || "";
    if (field("description")) field("description").value = product.description;
    if (field("features")) field("features").value = formatFeatures(product.features);
    if (field("club")) field("club").value = product.clubId || "";
    if (field("stock")) field("stock").value = product.stock;
    if (field("status")) field("status").value = product.status;
    if (field("featured")) field("featured").checked = Boolean(product.featured);
    if (field("images")) field("images").value = "";

    renderSizeCheckboxes(product.sizes);
    renderImagePreview(currentProductImages);
    setFormMode("edit");
    openDialog($("#productDialog"));
    field("name")?.focus();
  }

  function productFromForm(existingProduct = null) {
    const name = field("name")?.value.trim() || "";
    const price = Number.parseFloat(field("price")?.value || "0");
    const category = field("category")?.value.trim() || "";
    const imageUrl = field("image")?.value.trim() || "";
    const description = field("description")?.value.trim() || "";
    const features = splitFeatures(field("features")?.value || "");
    const selectedClubId = field("club")?.value || existingProduct?.clubId || DEFAULT_CLUB.id;
    const selectedClub = clubById(selectedClubId) || allClubOptions(readProducts()).find((club) => String(club.id) === String(selectedClubId)) || DEFAULT_CLUB;
    const images = pendingUploadedImages.length
      ? pendingUploadedImages.slice()
      : (imageUrl ? [imageUrl] : (currentProductImages.length ? currentProductImages.slice() : [existingProduct?.image || "/assets/hero-jerseys.png"]));

    if (!name) throw new Error("Product name is required.");
    if (!Number.isFinite(price) || price < 0) throw new Error("Enter a valid product price.");
    if (!category) throw new Error("Product category is required.");

    return normalizeProduct({
      ...(existingProduct || {}),
      id: existingProduct?.id,
      name,
      price,
      category,
      image: images[0] || imageUrl || "/assets/hero-jerseys.png",
      images,
      description,
      features,
      club: selectedClub.name || existingProduct?.club || DEFAULT_CLUB.name,
      clubId: selectedClub.id || selectedClubId,
      sizes: selectedSizes(),
      stock: Number.isFinite(Number(field("stock")?.value)) ? Number(field("stock")?.value) : existingProduct?.stock || 20,
      status: field("status")?.value || existingProduct?.status || "active",
      featured: Boolean(field("featured")?.checked),
      updatedAt: new Date().toISOString()
    });
  }

  function saveProductFromForm(event) {
    event.preventDefault();

    try {
      const products = readProducts();
      const editingId = activeEditId ?? field("id")?.value ?? "";
      const existingIndex = editingId === "" ? -1 : products.findIndex((product) => String(product.id) === String(editingId));

      if (existingIndex >= 0) {
        const updatedProduct = productFromForm(products[existingIndex]);
        updatedProduct.id = products[existingIndex].id;
        products[existingIndex] = updatedProduct;
        saveProducts(products);
        resetProductForm();
        closeDialog($("#productDialog"));
        renderAll();
        toast("Jersey updated");
        return;
      }

      const newProduct = productFromForm(null);
      newProduct.id = generateNumericId(products);
      newProduct.createdAt = new Date().toISOString();
      products.push(newProduct);
      saveProducts(products);
      resetProductForm();
      closeDialog($("#productDialog"));
      renderAll();
      toast("Jersey added");
    } catch (error) {
      toast(error.message || "Could not save product.");
    }
  }

  function deleteProduct(productId) {
    const products = readProducts();
    const product = products.find((item) => String(item.id) === String(productId));
    if (!product) {
      toast("Product not found");
      return;
    }

    if (!window.confirm(`Delete "${product.name}" from JerseyHub?`)) return;

    saveProducts(products.filter((item) => String(item.id) !== String(productId)));
    if (String(activeEditId) === String(productId)) {
      resetProductForm();
      closeDialog($("#productDialog"));
    }
    renderAll();
    toast("Jersey deleted");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });
  }

  async function filesToImages(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    const images = [];
    for (const file of files.slice(0, 6)) {
      images.push(await readFileAsDataUrl(file));
    }
    return images;
  }

  async function handleImageInputChange(event) {
    try {
      pendingUploadedImages = await filesToImages(event.target.files);
      renderImagePreview(pendingUploadedImages.length ? pendingUploadedImages : currentProductImages);
      if (field("image") && pendingUploadedImages[0]) field("image").value = pendingUploadedImages[0];
    } catch (error) {
      toast(error.message || "Could not read selected images.");
    }
  }

  function switchSection(sectionId) {
    $$(".section").forEach((section) => {
      section.classList.toggle("active", section.id === sectionId);
    });
    $$(".nav-btn[data-section]").forEach((button) => {
      button.classList.toggle("active", button.dataset.section === sectionId);
    });
    renderAll();
  }

  function setupNavigation() {
    $$(".nav-btn[data-section]").forEach((button) => {
      button.addEventListener("click", () => switchSection(button.dataset.section));
    });

    $$("[data-open-section]").forEach((button) => {
      button.addEventListener("click", () => switchSection(button.dataset.openSection));
    });
  }

  function setupDialogs() {
    $$("[data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => closeDialog($(`#${button.dataset.closeDialog}`)));
    });

    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });
    });
  }

  function setupEvents() {
    $("#addProductBtn, [data-add-product]")?.addEventListener("click", openCreateForm);
    $("#refreshBtn")?.addEventListener("click", renderAll);
    $("#logoutBtn")?.addEventListener("click", () => {
      localStorage.removeItem(LOCAL_ADMIN_SESSION_KEY);
      window.location.href = "admin-login-new.html";
    });

    productForm()?.addEventListener("submit", saveProductFromForm);

    ["productSearch", "productClubFilter", "productCategoryFilter", "productStatusFilter"].forEach((id) => {
      $(`#${id}`)?.addEventListener("input", renderProducts);
      $(`#${id}`)?.addEventListener("change", renderProducts);
    });

    productContainer()?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-product-action]");
      if (!button) return;
      const productId = button.dataset.productId;
      if (button.dataset.productAction === "edit") openEditForm(productId);
      if (button.dataset.productAction === "delete") deleteProduct(productId);
    });

    $("#deleteProductBtn")?.addEventListener("click", () => {
      const id = activeEditId ?? field("id")?.value;
      if (id !== null && id !== undefined && id !== "") deleteProduct(id);
    });

    field("images")?.addEventListener("change", handleImageInputChange);

    const dropzone = $("#productDropzone");
    if (dropzone && field("images")) {
      dropzone.addEventListener("click", () => field("images").click());
      ["dragenter", "dragover"].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
          event.preventDefault();
          dropzone.classList.add("drag-over");
        });
      });
      ["dragleave", "drop"].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
          event.preventDefault();
          dropzone.classList.remove("drag-over");
        });
      });
      dropzone.addEventListener("drop", async (event) => {
        try {
          pendingUploadedImages = await filesToImages(event.dataTransfer.files);
          renderImagePreview(pendingUploadedImages.length ? pendingUploadedImages : currentProductImages);
          if (field("image") && pendingUploadedImages[0]) field("image").value = pendingUploadedImages[0];
        } catch (error) {
          toast(error.message || "Could not read dropped images.");
        }
      });
    }

    document.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (!action) return;
      if (action.dataset.action === "edit-product") openEditForm(action.dataset.id);
      if (action.dataset.action === "delete-product") deleteProduct(action.dataset.id);
    });

    productContainer()?.addEventListener("error", (event) => {
      if (event.target.matches("img")) {
        event.target.src = normalizeImagePath("/assets/hero-jerseys.png");
      }
    }, true);

    window.addEventListener("storage", (event) => {
      if (event.key === PRODUCTS_STORAGE_KEY) renderAll();
    });
  }

  function init() {
    seedProductsIfNeeded();
    ensureSupplementalFormFields();
    populateControls();
    setupNavigation();
    setupDialogs();
    setupEvents();
    renderAll();
    document.body.classList.remove("auth-locked");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
