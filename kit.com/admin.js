const { buildDefaultProducts, loadProducts, saveProducts, loadOrders, saveOrders } = window.JerseyHubData;

let products = loadProducts();
let orders = loadOrders();
let selectedId = products[0]?.id || "";

const productForm = document.querySelector("#productForm");
const inventoryList = document.querySelector("#inventoryList");
const ordersList = document.querySelector("#ordersList");
const adminSearch = document.querySelector("#adminSearch");
const previewImage = document.querySelector("#previewImage");
const saveMessage = document.querySelector("#saveMessage");

function formatRwf(amount) {
  return `${Number(amount).toLocaleString("en-US")} RWF`;
}

function leagueFromTag(tag) {
  return tag === "premier" ? "Premier League" : "Champions League";
}

function currentProduct() {
  return products.find((product) => product.id === selectedId) || products[0];
}

function renderStats() {
  const paidOrders = orders.filter((order) => ["Paid", "Out for delivery", "Delivered"].includes(order.status));
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const sold = products.reduce((sum, product) => sum + Number(product.sold || 0), 0);
  const inventory = products.reduce((sum, product) => sum + Number(product.stock || 0) * Number(product.price || 0), 0);
  document.querySelector("#totalRevenue").textContent = formatRwf(revenue);
  document.querySelector("#totalOrders").textContent = orders.length;
  document.querySelector("#totalSold").textContent = sold;
  document.querySelector("#inventoryValue").textContent = formatRwf(inventory);
  document.querySelector("#ordersSummary").textContent = orders.length ? `${orders.length} order(s), ${formatRwf(revenue)} paid revenue` : "No orders yet";
}

function fillForm(product = currentProduct()) {
  if (!product) return;
  selectedId = product.id;
  productForm.elements.id.value = product.id;
  productForm.elements.name.value = product.name;
  productForm.elements.tag.value = product.tags[0] || "premier";
  productForm.elements.price.value = product.price;
  productForm.elements.stock.value = product.stock;
  productForm.elements.sold.value = product.sold || 0;
  productForm.elements.img.value = product.img;
  productForm.elements.visible.checked = product.visible !== false;
  productForm.elements.featured.checked = Boolean(product.featured);
  previewImage.src = product.img;
  saveMessage.textContent = "";
}

function renderInventory() {
  const query = adminSearch.value.trim().toLowerCase();
  const visible = products.filter((product) => `${product.name} ${product.league}`.toLowerCase().includes(query));
  inventoryList.innerHTML = visible
    .map(
      (product) => `
        <article class="inventory-item">
          <img src="${product.img}" alt="${product.name}" />
          <div>
            <h3>${product.name}</h3>
            <p>${product.league} | ${formatRwf(product.price)} | Stock ${product.stock} | Sold ${product.sold || 0}</p>
            <div class="item-badges">
              <span class="${product.visible === false ? "badge-muted" : "badge-live"}">${product.visible === false ? "Hidden" : "Live"}</span>
              <span class="${product.stock <= 0 ? "badge-danger" : "badge-stock"}">${product.stock <= 0 ? "Out of stock" : "In stock"}</span>
            </div>
          </div>
          <div class="inventory-actions">
            <button type="button" data-action="edit" data-id="${product.id}">Edit</button>
            <button type="button" data-action="toggle" data-id="${product.id}">${product.visible === false ? "Show" : "Hide"}</button>
            <button type="button" data-action="stockout" data-id="${product.id}">Out of Stock</button>
            <button type="button" data-action="restock" data-id="${product.id}">Restock</button>
            <button type="button" class="danger-action" data-action="remove" data-id="${product.id}">Remove</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderOrders() {
  ordersList.innerHTML = orders.length
    ? orders
        .map(
          (order) => `
            <article class="order-item">
              <div>
                <h3>${order.code} | ${order.customer.name}</h3>
                <p>${order.customer.phone} | ${order.customer.address}</p>
                <p>${order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}</p>
                <p>Total ${formatRwf(order.total)} | ${new Date(order.createdAt).toLocaleString()}</p>
              </div>
              <div class="order-actions">
                <select data-id="${order.code}">
                  ${["Payment pending", "Paid", "Packed", "Out for delivery", "Delivered", "Cancelled"]
                    .map((status) => `<option value="${status}" ${status === order.status ? "selected" : ""}>${status}</option>`)
                    .join("")}
                </select>
                <button type="button" data-delete-order="${order.code}">Delete</button>
              </div>
            </article>
          `
        )
        .join("")
    : `<p class="admin-note">Orders from checkout will appear here automatically.</p>`;
}

function renderAll() {
  products = loadProducts();
  orders = loadOrders();
  renderStats();
  renderInventory();
  renderOrders();
  fillForm(currentProduct());
}

function productFromForm(imageOverride) {
  const form = productForm.elements;
  const id = form.id.value || form.name.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const tag = form.tag.value;
  return {
    id,
    name: form.name.value.trim(),
    league: leagueFromTag(tag),
    tags: [tag],
    img: imageOverride || form.img.value.trim(),
    price: Number(form.price.value),
    stock: Number(form.stock.value),
    sold: Number(form.sold.value),
    visible: form.visible.checked,
    featured: form.featured.checked
  };
}

function readUploadedImage() {
  const file = productForm.elements.file.files[0];
  if (!file) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const uploadedImage = await readUploadedImage();
  const product = productFromForm(uploadedImage);
  const index = products.findIndex((item) => item.id === product.id);
  if (index >= 0) products[index] = product;
  else products.unshift(product);
  selectedId = product.id;
  saveProducts(products);
  productForm.elements.file.value = "";
  renderAll();
  saveMessage.textContent = "Saved. Storefront updates automatically after refresh.";
});

productForm.elements.img.addEventListener("input", (event) => {
  previewImage.src = event.target.value;
});

productForm.elements.file.addEventListener("change", async () => {
  const uploadedImage = await readUploadedImage();
  if (uploadedImage) previewImage.src = uploadedImage;
});

document.querySelector("#newProduct").addEventListener("click", () => {
  selectedId = "";
  productForm.reset();
  productForm.elements.price.value = 15000;
  productForm.elements.stock.value = 12;
  productForm.elements.sold.value = 0;
  productForm.elements.visible.checked = true;
  previewImage.removeAttribute("src");
});

document.querySelector("#deleteProduct").addEventListener("click", () => {
  if (!selectedId) return;
  products = products.filter((product) => product.id !== selectedId);
  saveProducts(products);
  selectedId = products[0]?.id || "";
  renderAll();
});

inventoryList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const product = products.find((item) => item.id === button.dataset.id);
  if (!product) return;
  if (button.dataset.action === "edit") fillForm(product);
  if (button.dataset.action === "toggle") {
    product.visible = product.visible === false;
    saveProducts(products);
    renderAll();
  }
  if (button.dataset.action === "stockout") {
    product.stock = 0;
    saveProducts(products);
    renderAll();
  }
  if (button.dataset.action === "restock") {
    product.stock = Math.max(12, Number(product.stock || 0) + 12);
    product.visible = true;
    saveProducts(products);
    renderAll();
  }
  if (button.dataset.action === "remove") {
    products = products.filter((item) => item.id !== product.id);
    selectedId = products[0]?.id || "";
    saveProducts(products);
    renderAll();
  }
});

ordersList.addEventListener("change", (event) => {
  const select = event.target.closest("select[data-id]");
  if (!select) return;
  const order = orders.find((item) => item.code === select.dataset.id);
  if (!order) return;
  order.status = select.value;
  saveOrders(orders);
  renderAll();
});

ordersList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-delete-order]");
  if (!button) return;
  orders = orders.filter((order) => order.code !== button.dataset.deleteOrder);
  saveOrders(orders);
  renderAll();
});

adminSearch.addEventListener("input", renderInventory);

document.querySelector("#exportData").addEventListener("click", () => {
  const payload = JSON.stringify({ products, orders }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "jerseyhub-data.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector("#resetData").addEventListener("click", () => {
  products = buildDefaultProducts();
  orders = [];
  saveProducts(products);
  saveOrders(orders);
  selectedId = products[0].id;
  renderAll();
});

renderAll();
