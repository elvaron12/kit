// Smart ecommerce assistant backed by the same catalog and order API as the storefront.
window.ChatAssistant = (() => {
  const { api, CATEGORY_LABELS, DELIVERY_LABELS, PAYMENT_LABELS, formatRwf, normalizeImage } = window.JerseyHubData;
  const chatAssistant = document.getElementById("chatAssistant");
  const chatMessages = document.getElementById("chatMessages");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatTrigger = document.getElementById("chatTrigger");
  const chatClose = document.querySelector(".chat-close");

  let isOpen = false;
  let products = [];
  let clubs = [];
  let orderDraft = null;
  let waitingFor = "";
  let hasWelcomed = false;
  let isLoading = false;
  let hasInitialized = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function activeProducts() {
    return products.filter((product) => product.status === "active");
  }

  async function loadCatalog() {
    const data = await api.getCatalog();
    clubs = data.clubs || [];
    products = data.products || [];
  }

  function toggleChat(forceOpen = null) {
    isOpen = forceOpen === null ? !isOpen : Boolean(forceOpen);
    chatAssistant.style.display = isOpen ? "flex" : "none";
    if (isOpen) {
      loadCatalog().catch(() => {});
      showInitialPrompt();
      chatInput.focus();
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  function addMessage(content, role = "assistant", options = {}) {
    const message = document.createElement("div");
    message.className = `chat-message ${role === "user" ? "user-message" : "assistant-message"}`;
    if (options.loading) {
      message.innerHTML = '<div class="chat-loading"><span></span><span></span><span></span></div>';
    } else if (options.html) {
      message.innerHTML = content;
    } else {
      const bubble = document.createElement("div");
      bubble.className = "chat-bubble";
      bubble.textContent = content;
      message.appendChild(bubble);
    }
    chatMessages.appendChild(message);
    scrollToBottom();
    return message;
  }

  function showInitialPrompt() {
    if (hasWelcomed) return;
    hasWelcomed = true;
    addMessage("Hi, I am Jersey AI. What jersey are you looking for today?");
    renderQuickReplies(["Show trending jerseys", "Real Madrid away jersey", "Track my order"]);
  }

  function quickReplies(replies) {
    return `
      <div class="chat-quick-replies">
        ${replies.map((reply) => `<button type="button" class="chat-quick-action" data-query="${escapeHtml(reply)}">${escapeHtml(reply)}</button>`).join("")}
      </div>
    `;
  }

  function parseSize(text) {
    const match = String(text).toUpperCase().match(/\b(XXL|XL|L|M|S|XS)\b/);
    return match ? match[1] : "";
  }

  function parseCategory(text) {
    const lower = text.toLowerCase();
    return Object.keys(CATEGORY_LABELS).find((category) => lower.includes(category)) || "";
  }

  function clubAliases(club) {
    const base = [club.name, club.id.replace(/-/g, " ")];
    if (club.id === "psg") base.push("psg", "paris", "paris saint germain");
    if (club.id === "man-united") base.push("man united", "manchester united", "united");
    if (club.id === "man-city") base.push("man city", "manchester city", "city");
    if (club.id === "bayern") base.push("bayern", "bayern munich");
    return base.map((value) => value.toLowerCase());
  }

  function parseClub(text) {
    const lower = text.toLowerCase();
    return clubs.find((club) => clubAliases(club).some((alias) => lower.includes(alias))) || null;
  }

  function findProducts(query) {
    const lower = query.toLowerCase();
    const size = parseSize(query);
    const category = parseCategory(query);
    const club = parseClub(query);
    let matches = activeProducts();

    if (club) matches = matches.filter((product) => product.clubId === club.id);
    if (category) matches = matches.filter((product) => product.category === category);
    if (!club && !category) {
      const words = lower.split(/[^a-z0-9]+/).filter((word) => word.length > 2);
      matches = matches.filter((product) => {
        const text = `${product.name} ${product.club} ${product.category}`.toLowerCase();
        return words.length ? words.some((word) => text.includes(word)) : true;
      });
    }
    if (size) matches = matches.filter((product) => product.sizes?.includes(size));
    matches.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.stock || 0) - Number(a.stock || 0));
    return { matches, club, category, size };
  }

  function similarProducts(product, limit = 3) {
    const pool = activeProducts().filter((item) => item.id !== product?.id && item.inStock);
    const sameClub = pool.filter((item) => product && item.clubId === product.clubId);
    const sameCategory = pool.filter((item) => product && item.category === product.category);
    return [...sameClub, ...sameCategory, ...pool]
      .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index)
      .slice(0, limit);
  }

  function trendingProducts(limit = 3) {
    return activeProducts()
      .filter((product) => product.inStock)
      .sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0) || Number(b.stock || 0) - Number(a.stock || 0))
      .slice(0, limit);
  }

  function productCard(product, querySize = "") {
    const allSizes = Array.isArray(product.sizes) ? product.sizes : [];
    const sizes = querySize ? allSizes.filter((size) => size === querySize) : allSizes;
    const image = normalizeImage(product.images?.[0] || product.clubLogo);
    return `
      <div class="chat-product-card" data-chat-product="${escapeHtml(product.id)}">
        <div class="chat-product-image">
          <img src="${image}" alt="${escapeHtml(product.name)}" onerror="this.src='${normalizeImage("/assets/hero-jerseys.png")}'" />
        </div>
        <div class="chat-product-info">
          <div class="name">${escapeHtml(product.name)}</div>
          <div class="price">${formatRwf(product.price)}</div>
          <div class="stock">${product.inStock ? `${Number(product.stock || 0)} available` : "Sold out"}${sizes.length ? ` in ${sizes.join(", ")}` : ""}</div>
          ${product.inStock ? `
            <div class="chat-size-selector" data-product-id="${escapeHtml(product.id)}">
              ${sizes.map((size) => `<button type="button" class="chat-size-btn" data-size="${escapeHtml(size)}">${escapeHtml(size)}</button>`).join("")}
            </div>
            <div class="chat-product-buttons">
              <button type="button" class="chat-quick-action" data-action="add-to-cart" data-product-id="${escapeHtml(product.id)}">Add to Cart</button>
              <button type="button" class="chat-quick-action" data-action="buy-now" data-product-id="${escapeHtml(product.id)}">Buy Now</button>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  function showProducts(matches, size = "") {
    matches.slice(0, 4).forEach((product) => addMessage(productCard(product, size), "assistant", { html: true }));
    if (matches.length > 4) addMessage(`I found ${matches.length - 4} more. Tell me the club, edition, or size to narrow it down.`);
  }

  function beginOrder(product, size) {
    if (!product?.inStock || !product.sizes?.includes(size)) {
      addMessage("That jersey size is not available right now.");
      return;
    }
    orderDraft = { product, size, customerName: "", phone: "", location: "", paymentStatus: "pending" };
    waitingFor = "name";
    chatInput.placeholder = "Enter your full name";
    addMessage(`${product.name} in size ${size} is available for ${formatRwf(product.price)}. What name should I put on the order?`);
  }

  async function completeOrder() {
    const loading = addMessage("", "assistant", { loading: true });
    try {
      const { order } = await api.createOrder({
        source: "ai-assistant",
        customerName: orderDraft.customerName,
        phone: orderDraft.phone,
        location: orderDraft.location,
        paymentStatus: orderDraft.paymentStatus,
        notes: "Order created via AI assistant",
        items: [{ productId: orderDraft.product.id, size: orderDraft.size, quantity: 1 }]
      });
      loading.remove();
      addMessage(`Order created via AI assistant. Your order ID is ${order.id}. Total: ${formatRwf(order.totalPrice)}. Delivery status: ${DELIVERY_LABELS[order.deliveryStatus] || order.deliveryStatus}.`);
      orderDraft = null;
      waitingFor = "";
      chatInput.placeholder = "Ask for a jersey...";
      await loadCatalog();
      await window.JerseyStorefront?.refreshCatalog?.();
      addMessage(quickReplies(["Track " + order.id, "Show trending jerseys", "Barcelona home jersey"]), "assistant", { html: true });
    } catch (error) {
      loading.remove();
      addMessage(error.message || "I could not create the order. Please check the details and try again.");
    }
  }

  async function handleOrderStep(text) {
    if (!orderDraft) {
      waitingFor = "";
      return;
    }
    if (waitingFor === "name") {
      if (text.trim().length < 2) {
        addMessage("Please send the name I should put on the order.");
        return;
      }
      orderDraft.customerName = text.trim();
      waitingFor = "phone";
      chatInput.placeholder = "Enter phone number";
      addMessage("Got it. What phone number should delivery use?");
      return;
    }
    if (waitingFor === "phone") {
      if (!/[0-9+ ]{7,}/.test(text.trim())) {
        addMessage("Please send a valid phone number for delivery.");
        return;
      }
      orderDraft.phone = text.trim();
      waitingFor = "location";
      chatInput.placeholder = "Enter delivery location";
      addMessage("Thanks. What is the delivery location?");
      return;
    }
    if (waitingFor === "location") {
      if (text.trim().length < 3) {
        addMessage("Please send the delivery area or address.");
        return;
      }
      orderDraft.location = text.trim();
      waitingFor = "payment";
      chatInput.placeholder = "MoMo, cash, or pending";
      addMessage("How would you like to pay?");
      addMessage(quickReplies(["MoMo", "Cash", "Confirm with me first"]), "assistant", { html: true });
      return;
    }
    if (waitingFor === "payment") {
      const lower = text.toLowerCase();
      orderDraft.paymentStatus = lower.includes("momo") ? "momo" : lower.includes("cash") ? "cash" : "pending";
      await completeOrder();
    }
  }

  async function trackOrder(query) {
    const id = query.match(/\bJH-[A-Z0-9-]+\b/i)?.[0];
    if (!id) {
      addMessage("Send me your order ID, for example JH-AB12CD34, and I will check it.");
      return;
    }
    const loading = addMessage("", "assistant", { loading: true });
    try {
      const { order } = await api.trackOrder(id.toUpperCase());
      loading.remove();
      const rider = order.assignedRider ? ` Rider: ${order.assignedRider.name} (${order.assignedRider.phone}).` : " No rider assigned yet.";
      addMessage(`${order.id}: delivery is ${DELIVERY_LABELS[order.deliveryStatus] || order.deliveryStatus}, payment is ${PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}.${rider}`);
    } catch {
      loading.remove();
      addMessage("I could not find that order ID. Please check the code and try again.");
    }
  }

  function renderQuickReplies(replies = []) {
    if (!replies.length) return;
    addMessage(quickReplies(replies.slice(0, 4)), "assistant", { html: true });
  }

  async function renderAssistantResponse(response) {
    if (response.reply) addMessage(response.reply);
    if (Array.isArray(response.products) && response.products.length) {
      showProducts(response.products, response.cartAction?.size || response.orderAction?.size || "");
    }
    if (response.cartAction) {
      const added = window.addToCartFromChat?.(response.cartAction.productId, response.cartAction.size);
      addMessage(added ? "Jersey added to cart. Open the cart to review quantity and checkout." : "I could not add that jersey to cart because the size is unavailable.");
    }
    if (response.orderAction) {
      const product = [...products, ...(response.products || [])].find((item) => item.id === response.orderAction.productId);
      if (product) beginOrder(product, response.orderAction.size);
    }
    if (Array.isArray(response.alternatives) && response.alternatives.length && response.intent === "no-results") {
      showProducts(response.alternatives);
    }
    renderQuickReplies(response.quickReplies);
  }

  async function handleLocalUserInput(query) {
    const lower = query.toLowerCase();
    await loadCatalog().catch(() => {});
    const mentionsStore = Boolean(parseSize(query) || parseCategory(query) || parseClub(query)) ||
      /\b(jersey|jerseys|shirt|shirts|kit|kits|stock|available|availability|order|buy|checkout|cart|basket|track|delivery|rider|status)\b/.test(lower);
    if (/^(hi|hello|hey|yo|sup|good morning|good afternoon|good evening)\b/.test(lower) && !mentionsStore) {
      addMessage("Hey. I can help you find a jersey, add it to cart, place an order, or track delivery.");
      renderQuickReplies(["Show trending jerseys", "Barcelona home jersey", "Track my order"]);
      return;
    }
    if (/\b(thanks|thank you|appreciate|nice|great)\b/.test(lower) && !mentionsStore) {
      addMessage("Happy to help. Tell me the club or order ID whenever you are ready.");
      return;
    }
    if (/\b(help|what can you do|how does this work)\b/.test(lower) && !mentionsStore) {
      addMessage("Tell me a club, edition, size, or order ID and I will handle it from the live store catalog.");
      renderQuickReplies(["Show retro jerseys", "Arsenal size L", "Track my order"]);
      return;
    }
    if (/\b(track|where|shipped|delivery|delivering)\b/.test(lower) || /\bJH-[A-Z0-9-]+\b/i.test(query)) {
      await trackOrder(query);
      return;
    }

    const { matches, club, category, size } = findProducts(query);

    if (/\b(trending|popular|latest|suggest|recommend)\b/.test(lower)) {
      addMessage("Here are strong picks from the current catalog:");
      showProducts(trendingProducts(), size);
      return;
    }

    if (!matches.length) {
      addMessage("I do not see that exact jersey available right now. Here are close alternatives from the live catalog:");
      showProducts(trendingProducts(), size);
      return;
    }

    const wantsCart = /\b(add to cart|cart|basket)\b/.test(lower);
    const wantsOrder = /\b(want|order|buy|place|get me)\b/.test(lower);
    if (wantsCart && matches.length === 1 && size) {
      const added = window.addToCartFromChat?.(matches[0].id, size);
      addMessage(added ? "Jersey added to cart. Open the cart to review quantity and checkout." : "That jersey is not available in the selected size.");
      return;
    }
    if (wantsOrder && matches.length === 1 && size) {
      beginOrder(matches[0], size);
      return;
    }

    const label = [club?.name, category ? CATEGORY_LABELS[category] : "", size ? `size ${size}` : ""].filter(Boolean).join(" ");
    addMessage(`Yes. I found ${matches.length} ${label || "matching"} jersey${matches.length === 1 ? "" : "s"} available. Prices and sizes are below.`);
    showProducts(matches, size);
    const suggestions = similarProducts(matches[0]);
    if (suggestions.length) {
      addMessage(`If you like ${matches[0].club}, you may also like these:`);
      showProducts(suggestions);
    }
  }

  async function handleUserInput(rawQuery) {
    const query = rawQuery.trim();
    if (!query || isLoading) return;
    isLoading = true;
    addMessage(query, "user");
    chatInput.value = "";
    chatInput.disabled = true;
    chatForm?.querySelector(".chat-send-btn")?.setAttribute("disabled", "");

    try {
      if (waitingFor) {
        await handleOrderStep(query);
        return;
      }

      const loading = addMessage("", "assistant", { loading: true });
      try {
        await loadCatalog().catch(() => {});
        const response = await api.assistant({
          message: query,
          cart: window.JerseyStorefront?.getCart?.().map(({ product, size, qty }) => ({ productId: product.id, size, quantity: qty })) || []
        });
        loading.remove();
        await renderAssistantResponse(response);
      } catch {
        loading.remove();
        await handleLocalUserInput(query);
      }
    } finally {
      isLoading = false;
      chatInput.disabled = false;
      chatForm?.querySelector(".chat-send-btn")?.removeAttribute("disabled");
      chatInput.focus();
    }
  }

  function selectedSizeForCard(button) {
    const card = button.closest("[data-chat-product]");
    return card?.querySelector(".chat-size-btn.selected")?.dataset.size || "";
  }

  function handleProductAction(event) {
    const sizeButton = event.target.closest(".chat-size-btn");
    if (sizeButton) {
      const selector = sizeButton.closest(".chat-size-selector");
      selector.querySelectorAll(".chat-size-btn").forEach((button) => button.classList.remove("selected"));
      sizeButton.classList.add("selected");
      return;
    }

    const quick = event.target.closest("[data-query]");
    if (quick) {
      handleUserInput(quick.dataset.query);
      return;
    }

    const action = event.target.closest("[data-action]");
    if (!action) return;
    const product = products.find((item) => String(item.id) === String(action.dataset.productId));
    const size = selectedSizeForCard(action);
    if (!product) return;
    if (!size) {
      addMessage("Please select a size first.");
      return;
    }
    if (action.dataset.action === "add-to-cart") {
      const added = window.addToCartFromChat?.(product.id, size);
      addMessage(added ? "Jersey added to cart." : "That size is not available right now.");
      return;
    }
    beginOrder(product, size);
  }

  async function init() {
    if (hasInitialized) return;
    hasInitialized = true;
    await loadCatalog().catch(() => {});
  }

  chatTrigger?.addEventListener("click", () => toggleChat());
  chatClose?.addEventListener("click", () => toggleChat(false));
  chatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleUserInput(chatInput.value);
  });
  chatMessages?.addEventListener("click", handleProductAction);

  return {
    init,
    open: () => toggleChat(true),
    close: () => toggleChat(false)
  };
})();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.ChatAssistant.init();
  });
} else {
  window.ChatAssistant.init();
}
