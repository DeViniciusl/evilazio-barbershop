const TOKEN_KEY = "evilazio_token";
const backButton = document.getElementById("backBtn");
const refreshButton = document.getElementById("refreshBtn");
const bookingsRows = document.getElementById("myBookingsRows");
const emptyState = document.getElementById("myBookingsEmpty");
const feedback = document.getElementById("myBookingsFeedback");
const summaryTotal = document.getElementById("summaryTotal");
const summaryConfirmed = document.getElementById("summaryConfirmed");
const summaryCancelled = document.getElementById("summaryCancelled");

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
  };
}

function setFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
}

function getDisplayServiceName(service) {
  if (typeof getServiceDisplayName === "function") {
    const normalizedKey = String(service || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s*\+\s*/g, "_")
      .replace(/\s+/g, "_");

    return getServiceDisplayName(normalizedKey) || service;
  }

  return service;
}

function buildStatusBadge(status, statusLabel) {
  const badge = document.createElement("span");
  const normalizedStatus = String(status || "").toLowerCase();
  badge.className = `status-badge ${normalizedStatus}`;
  badge.textContent = statusLabel || normalizedStatus || "Indefinido";
  return badge;
}

function updateSummary(bookings) {
  const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;
  const cancelledCount = bookings.filter((booking) => booking.status === "cancelled").length;

  summaryTotal.textContent = String(bookings.length);
  summaryConfirmed.textContent = String(confirmedCount);
  summaryCancelled.textContent = String(cancelledCount);
}

function renderBookings(bookings) {
  bookingsRows.innerHTML = "";
  updateSummary(bookings);

  if (!bookings.length) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  bookings.forEach((booking) => {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = booking.dateLabel || booking.day;

    const timeCell = document.createElement("td");
    timeCell.textContent = booking.time || "-";

    const serviceCell = document.createElement("td");
    serviceCell.textContent = getDisplayServiceName(booking.service) || "-";

    const statusCell = document.createElement("td");
    statusCell.appendChild(buildStatusBadge(booking.status, booking.statusLabel));

    row.appendChild(dateCell);
    row.appendChild(timeCell);
    row.appendChild(serviceCell);
    row.appendChild(statusCell);
    bookingsRows.appendChild(row);
  });
}

async function loadMe() {
  const token = getToken();

  if (!token) {
    window.location.href = "/login.html";
    return null;
  }

  const response = await fetch("/api/me", {
    headers: authHeaders(),
  });

  if (!response.ok) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/login.html";
    return null;
  }

  const data = await response.json();

  if (data.user.role === "admin") {
    window.location.href = "/admin.html";
    return null;
  }

  return data.user;
}

async function loadBookings() {
  setFeedback("Atualizando seus agendamentos...", "");

  try {
    const response = await fetch("/api/my-bookings", {
      headers: authHeaders(),
    });
    const data = await response.json();

    if (!response.ok) {
      setFeedback(data.message || "Nao foi possivel carregar seus agendamentos.", "error");
      return;
    }

    renderBookings(data.bookings || []);
    setFeedback("Lista atualizada.", "success");
  } catch (_error) {
    setFeedback("Erro de conexao ao carregar seus agendamentos.", "error");
  }
}

backButton.addEventListener("click", () => {
  window.location.href = "/home.html";
});

refreshButton.addEventListener("click", () => {
  loadBookings();
});

(async () => {
  const user = await loadMe();
  if (!user) {
    return;
  }

  await loadBookings();
})();
