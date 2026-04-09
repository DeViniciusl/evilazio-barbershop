const TOKEN_KEY = "evilazio_token";
const accountButton = document.getElementById("accountBtn");
const myBookingsButton = document.getElementById("myBookingsBtn");
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
let currentTime = "";
let barbershopStatus = null;

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

function isTimeAfterOrEqual(timeStr) {
  // Compara uma string de tempo (HH:MM) com o tempo atual
  const [currentHour, currentMinute] = currentTime.split(":").map(Number);
  const [timeHour, timeMinute] = timeStr.split(":").map(Number);
  
  if (timeHour > currentHour) return true;
  if (timeHour === currentHour && timeMinute >= currentMinute) return true;
  return false;
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

  const now = new Date();
  const todayStr = String(now.getDate()).padStart(2, "0");
  const selectedDay = daySelect.value;
  const isToday = selectedDay === todayStr;

  slots.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot-btn";
    button.dataset.time = slot.time;

    const isPastTime = isToday && !isTimeAfterOrEqual(slot.time);

    if (slot.status === "available" && !isPastTime) {
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
    } else if (isPastTime) {
      button.textContent = `${slot.time} - passado`;
      button.classList.add("booked");
      button.disabled = true;
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

    // Captura o tempo atual e o status da barbearia
    if (data.currentTime) {
      currentTime = data.currentTime;
    }

    if (data.barbershopStatus) {
      barbershopStatus = data.barbershopStatus;
      if (!data.barbershopStatus.isOpen) {
        showBarbershopClosedModal(data.barbershopStatus.closureReason);
        bookingBtn.disabled = true;
        return;
      }
    }

    bookingBtn.disabled = false;

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

function showBarbershopClosedModal(reason) {
  // Remove modal anterior se existir
  const existingModal = document.getElementById("barbershopClosedModal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.id = "barbershopClosedModal";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 10px;
    text-align: center;
    max-width: 500px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  `;

  content.innerHTML = `
    <h2 style="color: #e74c3c; margin-bottom: 15px;">🔒 Barbearia Fechada</h2>
    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
      ${reason ? `<strong>Motivo:</strong> ${reason}` : "A barbearia está temporariamente fechada."}
    </p>
    <p style="color: #666; font-size: 14px;">Entre em contato conosco para mais informações.</p>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);
}

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
