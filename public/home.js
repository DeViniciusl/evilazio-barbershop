const TOKEN_KEY = "evilazio_token";
const accountButton = document.getElementById("accountBtn");
const myBookingsButton = document.getElementById("myBookingsBtn");
const logoutButton = document.getElementById("logoutBtn");
const welcomeText = document.getElementById("welcomeText");
const serviceSelect = document.getElementById("serviceSelect");
const phoneInput = document.getElementById("phoneInput");
const daySelect = document.getElementById("daySelect");
const slotGrid = document.getElementById("slotGrid");
const bookingBtn = document.getElementById("bookingBtn");
const serviceDurationInfo = document.getElementById("serviceDurationInfo");
const feedback = document.getElementById("feedback");

let selectedTime = "";
let slotsRequestId = 0;
let isCreatingBooking = false;

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

function normalizeServiceKey(service) {
  const normalized = String(service || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized === "corte social") return "corte_social";
  if (normalized === "corte tradicional") return "corte_tradicional";
  if (normalized === "corte degrade") return "corte_degrade";
  if (normalized === "corte navalhado") return "corte_navalhado";
  if (normalized === "barba") return "barba";
  if (normalized === "sobrancelha") return "sobrancelha";
  if (normalized === "pezinho") return "pezinho";
  if (normalized === "corte + barba") return "corte_barba";
  if (normalized === "corte + barba + sobrancelha") return "corte_barba_sobrancelha";

  return "";
}

function getServiceDuration(service) {
  const key = normalizeServiceKey(service);
  return key ? SERVICE_DURATIONS[key] || null : null;
}

function updateServiceDurationInfo() {
  const service = serviceSelect.value;
  const duration = getServiceDuration(service);

  if (!duration) {
    serviceDurationInfo.textContent = "";
    return;
  }

  serviceDurationInfo.textContent = `Tempo médio do servico: ${duration} minutos`;
}

function buildDayOptions() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.getDate();
  const lastDay = new Date(year, month, 0).getDate();

  daySelect.innerHTML = "";

  for (let day = today; day <= lastDay; day += 1) {
    const value = String(day).padStart(2, "0");
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    daySelect.appendChild(option);
  }
}

async function loadUser() {
  const token = getToken();

  if (!token) {
    window.location.href = "/";
    return null;
  }

  const response = await fetch("/api/me", {
    headers: authHeaders(),
  });

  if (!response.ok) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/";
    return null;
  }

  const data = await response.json();

  if (data.user.role === "admin") {
    window.location.href = "/admin.html";
    return null;
  }

  const displayName = data.user.name || data.user.username || "cliente";
  welcomeText.textContent = `Bem-vindo, ${displayName}.`;
  return data.user;
}

function renderSlots(slots) {
  slotGrid.innerHTML = "";

  slots.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot-btn";
    button.dataset.time = slot.time;

    if (slot.status === "available") {
      button.textContent = slot.time;
      button.classList.add("available");
      if (slot.time === selectedTime) {
        button.classList.add("selected");
      }
      button.addEventListener("click", () => {
        selectedTime = slot.time;
        setFeedback(`Horário selecionado: ${slot.time}`, "success");
        loadSlots();
      });
    } else {
      button.textContent = `${slot.time} - ocupado`;
      button.classList.add("booked");
      button.disabled = true;
    }

    slotGrid.appendChild(button);
  });
}

async function loadSlots() {
  const day = daySelect.value;

  if (!day) {
    return;
  }
  const requestId = ++slotsRequestId;

  try {
    const response = await fetch(`/api/schedule/day?day=${encodeURIComponent(day)}`, {
      headers: authHeaders(),
    });
    const data = await response.json();

    if (requestId !== slotsRequestId) {
      return;
    }

    if (!response.ok) {
      setFeedback(data.message || "Nao foi possivel carregar horarios.", "error");
      return;
    }

    if (!data.slots.some((slot) => slot.time === selectedTime && slot.status === "available")) {
      selectedTime = "";
    }

    renderSlots(data.slots);
  } catch (_error) {
    if (requestId === slotsRequestId) {
      setFeedback("Erro de conexao ao carregar horarios.", "error");
    }
  }
}

async function createBooking() {
  if (isCreatingBooking) {
    return;
  }

  const day = daySelect.value;
  const service = serviceSelect.value;
  const phone = phoneInput.value.trim();

  if (!service || !phone || !day || !selectedTime) {
    setFeedback("Selecione serviço, telefone, dia e horário.", "error");
    return;
  }

  isCreatingBooking = true;
  bookingBtn.disabled = true;
  setFeedback("Confirmando agendamento...", "");

  try {
    const response = await fetch("/api/bookings/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        day,
        time: selectedTime,
        service,
        phone,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setFeedback(data.message || "Não foi possível confirmar agendamento.", "error");
      return;
    }

    setFeedback(
      `✓ Agendamento confirmado para ${day}/${new Date().getMonth() + 1} às ${selectedTime}. Pagamento no local.`,
      "success"
    );
    
    // Reset form
    phoneInput.value = "";
    selectedTime = "";
    serviceSelect.value = "";
    updateServiceDurationInfo();
    await loadSlots();
  } catch (_error) {
    setFeedback("Erro de conexão com o servidor.", "error");
  } finally {
    isCreatingBooking = false;
    bookingBtn.disabled = false;
  }
}

logoutButton.addEventListener("click", async () => {
  const token = getToken();

  if (token) {
    await fetch("/api/logout", {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  }

  localStorage.removeItem(TOKEN_KEY);
  window.location.href = "/";
});

daySelect.addEventListener("change", () => {
  selectedTime = "";
  loadSlots();
});

serviceSelect.addEventListener("change", () => {
  updateServiceDurationInfo();
});

bookingBtn.addEventListener("click", () => {
  createBooking();
});

accountButton.addEventListener("click", () => {
  window.location.href = "/account.html";
});

myBookingsButton.addEventListener("click", () => {
  window.location.href = "/my-bookings.html";
});

(async () => {
  const user = await loadUser();
  if (!user) {
    return;
  }

  buildDayOptions();
  updateServiceDurationInfo();
  await loadSlots();
})();
