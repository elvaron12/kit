// Club Collections - Horizontal Scrolling Carousels
class ClubCollections {
  constructor() {
    this.products = window.JerseyHubData.loadProducts();
    this.init();
  }

  init() {
    this.groupByLeague();
    this.render();
    this.setupCarousels();
  }

  groupByLeague() {
    this.leagues = {};
    this.products.forEach(product => {
      if (!this.leagues[product.league]) {
        this.leagues[product.league] = [];
      }
      this.leagues[product.league].push(product);
    });
  }

  render() {
    const container = document.querySelector(".club-collections");
    if (!container) return;

    let html = `
      <div class="club-collections-header">
        <h2>Shop by Club</h2>
        <p>Browse premium jerseys organized by your favorite leagues</p>
      </div>
    `;

    Object.entries(this.leagues).forEach(([league, products]) => {
      html += `
        <div class="club-carousel-group" data-league="${league}">
          <h3>${league}</h3>
          <div class="carousel-container">
            <button class="carousel-nav prev" aria-label="Previous clubs">‹</button>
            <div class="carousel-track">
              ${products.map(p => `
                <div class="club-card" data-product-id="${p.id}" onclick="window.productDetail?.show('${p.id}')">
                  <div class="club-card-image">
                    <img src="${p.images?.[0]?.url || p.img}" alt="${p.name}" loading="lazy">
                  </div>
                  <div class="club-card-info">
                    <h4>${p.name}</h4>
                    <span class="club-card-price">${Number(p.price).toLocaleString('en-RW')} RWF</span>
                  </div>
                </div>
              `).join("")}
            </div>
            <button class="carousel-nav next" aria-label="Next clubs">›</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  setupCarousels() {
    document.querySelectorAll(".carousel-container").forEach(container => {
      const track = container.querySelector(".carousel-track");
      const prevBtn = container.querySelector(".carousel-nav.prev");
      const nextBtn = container.querySelector(".carousel-nav.next");

      if (!track || !prevBtn || !nextBtn) return;

      const scrollAmount = 260; // Card width + gap

      prevBtn.addEventListener("click", () => {
        track.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      });

      nextBtn.addEventListener("click", () => {
        track.scrollBy({ left: scrollAmount, behavior: "smooth" });
      });

      // Update button visibility on scroll
      const updateButtons = () => {
        prevBtn.style.opacity = track.scrollLeft > 0 ? "1" : "0.3";
        nextBtn.style.opacity = track.scrollLeft < track.scrollWidth - track.clientWidth - 10 ? "1" : "0.3";
      };

      track.addEventListener("scroll", updateButtons);
      window.addEventListener("resize", updateButtons);
      updateButtons();
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new ClubCollections();
  });
} else {
  new ClubCollections();
}
