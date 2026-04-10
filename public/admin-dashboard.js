// ============================================================================
// ADMIN DASHBOARD - Sistema de Gerenciamento
// ============================================================================

class AdminDashboard {
  constructor() {
    this.currentSection = "portfolio";
    this.accessToken = localStorage.getItem("accessToken");
    this.refreshToken = localStorage.getItem("refreshToken");
    this.currentUser = this.parseUser();
    this.init();
  }

  async init() {
    if (!this.accessToken || !this.currentUser?.id) {
      window.location.href = "/login.html";
      return;
    }

    this.setupEventListeners();
    await this.loadPortfolio();
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll("[data-section]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        this.changeSection(el.dataset.section);
      });
    });

    // Logout
    document.getElementById("logoutBtn")?.addEventListener("click", () =>
      this.logout()
    );

    // 2FA toggle
    document.getElementById("setup2FABtn")?.addEventListener("click", () =>
      this.setup2FA()
    );

    // Portfolio events
    document.getElementById("createPortfolioBtn")?.addEventListener("click", () =>
      this.showCreatePortfolioModal()
    );

    // Barber events
    document.getElementById("createBarberBtn")?.addEventListener("click", () =>
      this.showEditBarberModal(null)
    );

    // Upload handlers
    document.getElementById("portfolioImageUpload")?.addEventListener("change", (e) =>
      this.handleImageUpload(e, "portfolio")
    );

    document.getElementById("barberImageUpload")?.addEventListener("change", (e) =>
      this.handleImageUpload(e, "barber")
    );
  }

  parseUser() {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  }

  changeSection(section) {
    this.currentSection = section;
    document.querySelectorAll("[data-content]").forEach((el) => {
      el.classList.add("hidden");
    });
    document.querySelector(`[data-content="${section}"]`)?.classList.remove("hidden");

    // Load section data
    if (section === "portfolio") this.loadPortfolio();
    if (section === "barbers") this.loadBarbers();
    if (section === "bookings") this.loadBookings();
    if (section === "profile") this.loadProfile();
  }

  async apiCall(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.accessToken}`,
      ...options.headers,
    };

    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && this.refreshToken) {
      await this.refreshAccessToken();
      headers.Authorization = `Bearer ${this.accessToken}`;
      return fetch(`/api${endpoint}`, { ...options, headers });
    }

    return response;
  }

  async refreshAccessToken() {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.accessToken;
        localStorage.setItem("accessToken", this.accessToken);
      } else {
        this.logout();
      }
    } catch (error) {
      console.error("Refresh token error:", error);
      this.logout();
    }
  }

  // ==================== PORTFOLIO ====================

  async loadPortfolio() {
    try {
      const response = await this.apiCall("/admin/portfolio");
      const data = await response.json();

      let html = `
        <div class="admin-header">
          <h2>Gerenciar Portfólio</h2>
          <button id="createPortfolioBtn" class="btn btn-primary">+ Novo Portfólio</button>
        </div>
        <div class="portfolio-list">
      `;

      if (data.portfolios && data.portfolios.length > 0) {
        for (const portfolio of data.portfolios) {
          html += `
            <div class="portfolio-card">
              <h3>${portfolio.title}</h3>
              <p>${portfolio.description || ""}</p>
              <div class="status">
                Status: <strong>${portfolio.published ? "Publicado" : "Rascunho"}</strong>
              </div>
              <div class="actions">
                <button onclick="admin.editPortfolio(${portfolio.id})" class="btn btn-secondary">Editar</button>
                <button onclick="admin.deletePortfolio(${portfolio.id})" class="btn btn-danger">Deletar</button>
              </div>
            </div>
          `;
        }
      } else {
        html += "<p>Nenhum portfólio criado ainda.</p>";
      }

      html += "</div>";
      document.querySelector("[data-content='portfolio']").innerHTML = html;
      this.setupEventListeners();
    } catch (error) {
      console.error("Error loading portfolio:", error);
      this.showError("Erro ao carregar portfólio");
    }
  }

  showCreatePortfolioModal() {
    const html = `
      <div class="modal-overlay" onclick="this.remove()">
        <div class="modal" onclick="event.stopPropagation()">
          <h3>Novo Portfólio</h3>
          <form onsubmit="admin.createPortfolio(event)">
            <input type="text" id="portfolioTitle" placeholder="Título" required>
            <textarea id="portfolioDesc" placeholder="Descrição"></textarea>
            <button type="submit" class="btn btn-primary">Criar</button>
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", html);
  }

  async createPortfolio(event) {
    event.preventDefault();
    const title = document.getElementById("portfolioTitle").value;
    const description = document.getElementById("portfolioDesc").value;

    try {
      const response = await this.apiCall("/admin/portfolio", {
        method: "POST",
        body: JSON.stringify({ title, description }),
      });

      if (response.ok) {
        this.showSuccess("Portfólio criado com sucesso!");
        document.querySelector(".modal-overlay")?.remove();
        this.loadPortfolio();
      } else {
        const error = await response.json();
        this.showError(error.message || "Erro ao criar portfólio");
      }
    } catch (error) {
      console.error("Error creating portfolio:", error);
      this.showError("Erro ao criar portfólio");
    }
  }

  async deletePortfolio(portfolioId) {
    if (!confirm("Tem certeza que deseja deletar este portfólio?")) return;

    try {
      const response = await this.apiCall(`/admin/portfolio/${portfolioId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        this.showSuccess("Portfólio deletado com sucesso!");
        this.loadPortfolio();
      } else {
        this.showError("Erro ao deletar portfólio");
      }
    } catch (error) {
      console.error("Error deleting portfolio:", error);
    }
  }

  // ==================== BARBERS ====================

  async loadBarbers() {
    try {
      const response = await this.apiCall("/barbers");
      const data = await response.json();

      let html = `
        <div class="admin-header">
          <h2>Gerenciar Barbeiros</h2>
          <button id="createBarberBtn" class="btn btn-primary">+ Novo Barbeiro</button>
        </div>
        <div class="barbers-list">
      `;

      if (data.barbers && data.barbers.length > 0) {
        for (const barber of data.barbers) {
          html += `
            <div class="barber-card">
              <h3>${barber.name}</h3>
              <p><strong>Bio:</strong> ${barber.bio}</p>
              <p><strong>Especialidade:</strong> ${barber.specialty}</p>
              <div class="actions">
                <button onclick="admin.editBarber(${barber.id})" class="btn btn-secondary">Editar</button>
                <button onclick="admin.manageBarberImages(${barber.id}, '${barber.name}')" class="btn btn-secondary">Gerenciar Imagens</button>
              </div>
            </div>
          `;
        }
      }

      html += "</div>";
      document.querySelector("[data-content='barbers']").innerHTML = html;
      this.setupEventListeners();
    } catch (error) {
      console.error("Error loading barbers:", error);
      this.showError("Erro ao carregar barbeiros");
    }
  }

  showEditBarberModal(barberId) {
    const html = `
      <div class="modal-overlay" onclick="this.remove()">
        <div class="modal" onclick="event.stopPropagation()">
          <h3>${barberId ? "Editar Barbeiro" : "Novo Barbeiro"}</h3>
          <form onsubmit="admin.saveBarber(event, ${barberId})">
            <input type="text" id="barberName" placeholder="Nome" required>
            <textarea id="barberBio" placeholder="Bio"></textarea>
            <input type="text" id="barberSpecialty" placeholder="Especialidade">
            <input type="email" id="barberContact" placeholder="Email/Contato">
            <button type="submit" class="btn btn-primary">Salvar</button>
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", html);

    if (barberId) {
      // Load barber data
      this.loadBarberData(barberId);
    }
  }

  async saveBarber(event, barberId) {
    event.preventDefault();
    const name = document.getElementById("barberName").value;
    const bio = document.getElementById("barberBio").value;
    const specialty = document.getElementById("barberSpecialty").value;
    const contact = document.getElementById("barberContact").value;

    try {
      const endpoint = barberId ? `/admin/barbers/${barberId}` : "/admin/barbers";
      const method = barberId ? "PUT" : "POST";

      const response = await this.apiCall(endpoint, {
        method,
        body: JSON.stringify({ name, bio, specialty, contact }),
      });

      if (response.ok) {
        this.showSuccess("Barbeiro salvo com sucesso!");
        document.querySelector(".modal-overlay")?.remove();
        this.loadBarbers();
      } else {
        const error = await response.json();
        this.showError(error.message || "Erro ao salvar barbeiro");
      }
    } catch (error) {
      console.error("Error saving barber:", error);
      this.showError("Erro ao salvar barbeiro");
    }
  }

  async manageBarberImages(barberId, barberName) {
    const modal = `
      <div class="modal-overlay" onclick="this.remove()">
        <div class="modal" onclick="event.stopPropagation()">
          <h3>Imagens de ${barberName}</h3>
          <div class="upload-area">
            <input type="file" id="barberImageUpload" accept="image/*" multiple>
            <button onclick="document.getElementById('barberImageUpload').click()" class="btn btn-secondary">Escolher Imagens</button>
          </div>
          <div id="barberImagesContainer" class="images-grid"></div>
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modal);
    this.loadBarberImages(barberId);
  }

  async loadBarberImages(barberId) {
    try {
      const response = await this.apiCall(`/barbers/${barberId}`);
      const data = await response.json();

      let html = "<div class='images-grid'>";
      if (data.images && data.images.length > 0) {
        for (const img of data.images) {
          html += `
            <div class="image-item">
              <img src="${img.url}" alt="${img.alt}" style="width: 100%; height: 150px; object-fit: cover;">
              <button onclick="admin.deleteBarberImage(${barberId}, ${img.id})" class="btn btn-danger btn-small">Deletar</button>
            </div>
          `;
        }
      } else {
        html += "<p>Nenhuma imagem adicionada ainda.</p>";
      }
      html += "</div>";
      document.getElementById("barberImagesContainer").innerHTML = html;
    } catch (error) {
      console.error("Error loading barber images:", error);
    }
  }

  // ==================== BOOKINGS ====================

  async loadBookings() {
    try {
      const response = await this.apiCall("/appointments");
      const data = await response.json();

      let html = `
        <div class="admin-header">
          <h2>Agendamentos</h2>
        </div>
        <table class="bookings-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Hora</th>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>Serviço</th>
              <th>Barbeiro</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
      `;

      if (data.bookings && data.bookings.length > 0) {
        for (const booking of data.bookings) {
          html += `
            <tr>
              <td>${booking.day}/${new Date().getMonth() + 1}</td>
              <td>${booking.time}</td>
              <td>${booking.display_name}</td>
              <td>${booking.phone}</td>
              <td>${booking.service}</td>
              <td>${booking.barber_name || "Não atribuído"}</td>
              <td>
                <select onchange="admin.updateBookingStatus(${booking.id}, this.value)">
                  <option value="confirmed" ${booking.status === "confirmed" ? "selected" : ""}>Confirmado</option>
                  <option value="completed" ${booking.status === "completed" ? "selected" : ""}>Concluído</option>
                  <option value="cancelled" ${booking.status === "cancelled" ? "selected" : ""}>Cancelado</option>
                </select>
              </td>
              <td>
                <button onclick="admin.deleteBooking(${booking.id})" class="btn btn-danger btn-small">Deletar</button>
              </td>
            </tr>
          `;
        }
      } else {
        html += "<tr><td colspan='8'>Nenhum agendamento</td></tr>";
      }

      html += "</tbody></table>";
      document.querySelector("[data-content='bookings']").innerHTML = html;
    } catch (error) {
      console.error("Error loading bookings:", error);
      this.showError("Erro ao carregar agendamentos");
    }
  }

  async updateBookingStatus(bookingId, status) {
    try {
      const response = await this.apiCall(`/appointments/${bookingId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        this.showSuccess("Status atualizado!");
      } else {
        this.showError("Erro ao atualizar status");
      }
    } catch (error) {
      console.error("Error updating booking status:", error);
    }
  }

  // ==================== UTILS ====================

  async handleImageUpload(event, type) {
    const files = Array.from(event.target.files);
    for (const file of files) {
      await this.uploadImage(file, type);
    }
    event.target.value = "";
  }

  async uploadImage(file, type) {
    try {
      // Get presigned URL
      const presignResponse = await this.apiCall("/upload/presign", {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });

      const presignData = await presignResponse.json();

      // Upload to S3 using presigned URL
      const uploadResponse = await fetch(presignData.presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (uploadResponse.ok) {
        this.showSuccess("Imagem enviada com sucesso!");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      this.showError("Erro ao enviar imagem");
    }
  }

  showError(message) {
    alert(`❌ ${message}`);
  }

  showSuccess(message) {
    alert(`✓ ${message}`);
  }

  async editBarber(barberId) {
    this.showEditBarberModal(barberId);
  }

  async loadBarberData(barberId) {
    try {
      const response = await this.apiCall(`/barbers/${barberId}`);
      const data = await response.json();
      document.getElementById("barberName").value = data.barber.name;
      document.getElementById("barberBio").value = data.barber.bio;
      document.getElementById("barberSpecialty").value = data.barber.specialty;
      document.getElementById("barberContact").value = data.barber.contact;
    } catch (error) {
      console.error("Error loading barber:", error);
    }
  }

  async deleteBarberImage(barberId, imageId) {
    if (!confirm("Deletar esta imagem?")) return;

    try {
      const response = await this.apiCall(
        `/admin/barbers/${barberId}/images/${imageId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        this.loadBarberImages(barberId);
        this.showSuccess("Imagem deletada!");
      }
    } catch (error) {
      console.error("Error deleting barber image:", error);
    }
  }

  async deleteBooking(bookingId) {
    if (!confirm("Cancelar este agendamento?")) return;

    try {
      const response = await this.apiCall(`/appointments/${bookingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        this.loadBookings();
        this.showSuccess("Agendamento cancelado!");
      }
    } catch (error) {
      console.error("Error deleting booking:", error);
    }
  }

  async setup2FA() {
    try {
      const response = await this.apiCall("/auth/2fa/setup", {
        method: "POST",
      });

      const data = await response.json();
      alert(`Use este código no seu aplicativo de autenticação:\n\n${data.secret}`);
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      this.showError("Erro ao configurar 2FA");
    }
  }

  async loadProfile() {
    const html = `
      <div class="profile-section">
        <h2>Meu Perfil</h2>
        <p><strong>Email:</strong> ${this.currentUser.email}</p>
        <p><strong>Nome:</strong> ${this.currentUser.name}</p>
        <p><strong>Role:</strong> ${this.currentUser.role}</p>
        <button id="setup2FABtn" class="btn btn-primary">Configurar Autenticação 2FA</button>
      </div>
    `;
    document.querySelector("[data-content='profile']").innerHTML = html;
    this.setupEventListeners();
  }

  async logout() {
    try {
      await this.apiCall("/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    }

    localStorage.clear();
    window.location.href = "/login.html";
  }
}

// Initialize dashboard
const admin = new AdminDashboard();
