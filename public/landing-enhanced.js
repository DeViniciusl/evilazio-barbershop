// ============================================================================
// LANDING PAGE - Portfólio, Barbeiros e Agendamentos Melhorados
// ============================================================================

class LandingPage {
  constructor() {
    this.API_BASE = "/api";
    this.init();
  }

  async init() {
    try {
      // Wait for DOM to be ready
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => this.setupPage());
      } else {
        this.setupPage();
      }
    } catch (error) {
      console.error("Initialization error:", error);
    }
  }

  setupPage() {
    this.loadPortfolio();
    this.loadBarbers();
    this.setupBookingForm();
    this.checkAuthentication();
  }

  // ==================== PORTFOLIO ====================

  async loadPortfolio() {
    try {
      const response = await fetch(`${this.API_BASE}/portfolio`);
      const data = await response.json();

      if (!data.portfolios || data.portfolios.length === 0) {
        console.log("No portfolio items to show");
        return;
      }

      // Find or create portfolio section exists
      let portfolioSection = document.getElementById("portfolioSection");
      if (!portfolioSection) {
        portfolioSection = this.createPortfolioSection();
        document.body.insertAdjacentElement("beforeend", portfolioSection);
      }

      this.renderPortfolio(data.portfolios, portfolioSection);
    } catch (error) {
      console.error("Error loading portfolio:", error);
    }
  }

  createPortfolioSection() {
    const section = document.createElement("section");
    section.id = "portfolioSection";
    section.className = "card landing-portfolio";
    section.innerHTML = `
      <h2>Portfólio de Trabalhos</h2>
      <div class="portfolio-grid"></div>
    `;
    return section;
  }

  renderPortfolio(portfolios, section) {
    let html = "<div class='portfolio-grid'>";
    for (const portfolio of portfolios) {
      html += `
        <div class="portfolio-item">
          <h3>${portfolio.title}</h3>
          <p>${portfolio.description || ""}</p>
          <button onclick="landingPage.viewPortfolio(${portfolio.id})" class="outline-btn">Ver</button>
        </div>
      `;
    }
    html += "</div>";
    const grid = section.querySelector(".portfolio-grid");
    if (grid) {
      grid.innerHTML = html;
    }
  }

  async viewPortfolio(portfolioId) {
    try {
      const response = await fetch(`${this.API_BASE}/portfolio/${portfolioId}`);
      const data = await response.json();

      const images = data.images
        .map((img, idx) => `<img src="${img.url}" alt="${img.alt}" />`)
        .join("");

      const modal = `
        <div class="modal-overlay" onclick="this.remove()">
          <div class="modal portfolio-modal" onclick="event.stopPropagation()">
            <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
            <h2>${data.portfolio.title}</h2>
            <p>${data.portfolio.description || ""}</p>
            <div class="carousel">${images}</div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML("beforeend", modal);
    } catch (error) {
      console.error("Error viewing portfolio:", error);
    }
  }

  // ==================== BARBERS ====================

  async loadBarbers() {
    try {
      const response = await fetch(`${this.API_BASE}/barbers`);
      const data = await response.json();

      if (!data.barbers || data.barbers.length === 0) {
        console.log("No barbers to show");
        return;
      }

      // Find or create barbers section
      let barbersSection = document.getElementById("barbersSection");
      if (!barbersSection) {
        barbersSection = this.createBarbersSection();
        document.body.insertAdjacentElement("beforeend", barbersSection);
      }

      this.renderBarbers(data.barbers, barbersSection);

      // Also populate booking form select
      this.updateBarberSelect(data.barbers);
    } catch (error) {
      console.error("Error loading barbers:", error);
    }
  }

  createBarbersSection() {
    const section = document.createElement("section");
    section.id = "barbersSection";
    section.className = "card landing-barbers";
    section.innerHTML = `
      <h2>Conheça Nossos Barbeiros</h2>
      <div class="barbers-grid"></div>
    `;
    return section;
  }

  renderBarbers(barbers, section) {
    let html = "<div class='barbers-grid'>";
    for (const barber of barbers) {
      html += `
        <div class="barber-card">
          <h3>${barber.name}</h3>
          <p class="bio">${barber.bio}</p>
          <p class="specialty"><strong>Especialidade:</strong> ${barber.specialty}</p>
          <button onclick="landingPage.viewBarberProfile(${barber.id}, '${barber.name}')" class="outline-btn">Ver Perfil</button>
        </div>
      `;
    }
    html += "</div>";
    const grid = section.querySelector(".barbers-grid");
    if (grid) {
      grid.innerHTML = html;
    }
  }

  async viewBarberProfile(barberId, barberName) {
    try {
      const response = await fetch(`${this.API_BASE}/barbers/${barberId}`);
      const data = await response.json();

      let imagesHtml = "";
      if (data.images && data.images.length > 0) {
        imagesHtml = `
          <div class="barber-carousel">
            ${data.images.map((img) => `<img src="${img.url}" alt="${img.alt}" />`).join("")}
          </div>
        `;
      }

      const modal = `
        <div class="modal-overlay" onclick="this.remove()">
          <div class="modal barber-modal" onclick="event.stopPropagation()">
            <button class="close-btn" onclick="this.closest('.modal-overlay').remove()">✕</button>
            <h2>${barberName}</h2>
            <p class="bio">${data.barber.bio}</p>
            <p><strong>Especialidade:</strong> ${data.barber.specialty}</p>
            ${imagesHtml}
            <button onclick="landingPage.openBookingForm('${barberName}')" class="btn-primary">Agendar com ${barberName}</button>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML("beforeend", modal);

      // Setup carousel
      this.setupCarousel();
    } catch (error) {
      console.error("Error loading barber profile:", error);
    }
  }

  updateBarberSelect(barbers) {
    const select = document.getElementById("barberSelect");
    if (select) {
      let html = '<option value="">Indiferente</option>';
      for (const barber of barbers) {
        html += `<option value="${barber.name}">${barber.name}</option>`;
      }
      select.innerHTML = html;
    }
  }

  // ==================== BOOKING FORM ====================

  setupBookingForm() {
    const bookingBtn = document.getElementById("btnBooking");
    if (bookingBtn) {
      bookingBtn.addEventListener("click", () => this.openBookingForm());
    }

    const submitBtn = document.getElementById("createPaymentBtn");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => this.submitBooking());
    }
  }

  openBookingForm(preferredBarber = null) {
    const bookingSection = document.getElementById("bookingSection");
    if (bookingSection) {
      bookingSection.classList.remove("hidden");
      if (preferredBarber) {
        document.getElementById("barberSelect").value = preferredBarber;
      }
      bookingSection.scrollIntoView({ behavior: "smooth" });

      // Load available slots
      this.loadAvailableSlots();
    }
  }

  async loadAvailableSlots() {
    try {
      const daySelect = document.getElementById("daySelect");
      const dayValue = daySelect?.value;

      if (!dayValue) {
        console.log("No day selected");
        return;
      }

      const barberId = document.getElementById("barberSelect")?.value;
      const query = new URLSearchParams();
      query.append("day", dayValue);
      if (barberId) query.append("barber_id", barberId);

      const response = await fetch(`${this.API_BASE}/appointments/available?${query}`);
      const data = await response.json();

      this.renderSlots(data.available);
    } catch (error) {
      console.error("Error loading slots:", error);
    }
  }

  renderSlots(availableSlots) {
    const slotGrid = document.getElementById("slotGrid");
    if (!slotGrid) return;

    let html = "";
    for (const time of availableSlots) {
      html += `
        <button type="button" class="slot-btn" onclick="document.getElementById('timeInput').value = '${time}'">
          ${time}
        </button>
      `;
    }
    slotGrid.innerHTML = html;
  }

  async submitBooking() {
    try {
      // Get form data
      const name = document.getElementById("nameInput")?.value || document.getElementById("displayName")?.value;
      const email = document.getElementById("emailInput")?.value;
      const phone = document.getElementById("phoneInput")?.value;
      const service = document.getElementById("serviceSelect")?.value;
      const day = document.getElementById("daySelect")?.value;
      const time = document.getElementById("timeInput")?.value || document.getElementById("slotGrid").querySelector(".slot-btn")?.textContent;
      const barberPreference = document.getElementById("barberSelect")?.value || "indiferente";

      if (!name || !phone || !service || !day || !time) {
        alert("Por favor, preencha todos os campos obrigatórios");
        return;
      }

      const response = await fetch(`${this.API_BASE}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          service,
          day,
          time,
          barber_preference: barberPreference,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✓ Agendamento realizado com sucesso!\n\nData: ${day}/${new Date().getMonth() + 1}\nHora: ${time}\nServiço: ${service}`);
        document.getElementById("bookingSection")?.classList.add("hidden");
        document.getElementById("bookingForm")?.reset?.();
      } else {
        alert(`✗ Erro: ${data.message || "Erro ao agendar"}`);
      }
    } catch (error) {
      console.error("Error submitting booking:", error);
      alert("Erro ao agendar. Tente novamente.");
    }
  }

  // ==================== CAROUSEL ====================

  setupCarousel() {
    const carousels = document.querySelectorAll(".carousel, .barber-carousel");
    for (const carousel of carousels) {
      let index = 0;
      const images = carousel.querySelectorAll("img");

      if (images.length <= 1) continue;

      const showImage = () => {
        images.forEach((img, i) => {
          img.style.display = i === index ? "block" : "none";
        });
      };

      // Previous button
      const prevBtn = document.createElement("button");
      prevBtn.className = "carousel-btn prev";
      prevBtn.textContent = "❮";
      prevBtn.onclick = () => {
        index = (index - 1 + images.length) % images.length;
        showImage();
      };

      // Next button
      const nextBtn = document.createElement("button");
      nextBtn.className = "carousel-btn next";
      nextBtn.textContent = "❯";
      nextBtn.onclick = () => {
        index = (index + 1) % images.length;
        showImage();
      };

      carousel.appendChild(prevBtn);
      carousel.appendChild(nextBtn);
      showImage();

      // Keyboard navigation
      document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") prevBtn.click();
        if (e.key === "ArrowRight") nextBtn.click();
      });
    }
  }

  // ==================== AUTHENTICATION ====================

  checkAuthentication() {
    const token = localStorage.getItem("accessToken");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (token && user) {
      // User is authenticated
      document.getElementById("btnLogin")?.classList.add("hidden");
      document.getElementById("btnRegister")?.classList.add("hidden");
      document.getElementById("btnAccount")?.classList.remove("hidden");
      document.getElementById("btnMyBookings")?.classList.remove("hidden");
      document.getElementById("btnLogout")?.classList.remove("hidden");
    } else {
      // User is not authenticated
      document.getElementById("btnLogin")?.classList.remove("hidden");
      document.getElementById("btnRegister")?.classList.remove("hidden");
      document.getElementById("btnAccount")?.classList.add("hidden");
      document.getElementById("btnMyBookings")?.classList.add("hidden");
      document.getElementById("btnLogout")?.classList.add("hidden");
    }
  }
}

// Initialize landing page
const landingPage = new LandingPage();
