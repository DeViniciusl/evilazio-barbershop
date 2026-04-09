const TOKEN_KEY = "evilazio_token";
const BOOKING_SUCCESS_KEY = "booking_success_shown";

const btnLogin = document.getElementById("btnLogin");
const btnRegister = document.getElementById("btnRegister");
const btnAccount = document.getElementById("btnAccount");
const btnMyBookings = document.getElementById("btnMyBookings");
const btnBooking = document.getElementById("btnBooking");
const btnAdminSchedule = document.getElementById("btnAdminSchedule");
const btnLogout = document.getElementById("btnLogout");
const panelTitle = document.getElementById("panelTitle");
const panelSubtitle = document.getElementById("panelSubtitle");

const bookingSection = document.getElementById("bookingSection");
const serviceSelect = document.getElementById("serviceSelect");
const phoneInput = document.getElementById("phoneInput");
const daySelect = document.getElementById("daySelect");
const slotGrid = document.getElementById("slotGrid");
const serviceDurationInfo = document.getElementById("serviceDurationInfo");
const feedback = document.getElementById("feedback");
const createPaymentBtn = document.getElementById("createPaymentBtn");

let selectedTime = "";
let currentUser = null;
let slotsRequestId = 0;
let closedDays = [];

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
  };
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

function setFeedback(message, type) {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
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
    
    // Pula dias marcados como fechados
    if (closedDays.includes(value)) {
      continue;
    }
    
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    daySelect.appendChild(option);
  }

  // Seleciona automaticamente o primeiro dia disponível (hoje ou próximo dia aberto)
  if (daySelect.options.length > 0) {
    daySelect.value = daySelect.options[0].value;
  }
}

function updateServiceDurationInfo() {
  const duration = getServiceDuration(serviceSelect.value);
  serviceDurationInfo.textContent = duration ? `Tempo medio do servico: ${duration} minutos` : "";
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
        setFeedback(`Horario selecionado: ${slot.time}`, "success");
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

  if (!day || !currentUser || currentUser.role === "admin") {
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

function toggleForLoggedOut() {
  console.log("=== toggleForLoggedOut ===");
  document.documentElement.removeAttribute("data-authenticated");
  panelTitle.textContent = "Painel inicial";
  panelSubtitle.textContent = "Conheca os servicos e entre para agendar.";
  btnLogin.classList.remove("hidden");
  btnRegister.classList.remove("hidden");
  btnAccount.classList.add("hidden");
  btnMyBookings.classList.add("hidden");
  btnBooking.classList.add("hidden");
  btnAdminSchedule.classList.add("hidden");
  btnLogout.classList.add("hidden");
  bookingSection.classList.add("hidden");
  selectedTime = "";
}

function toggleForUser(user) {
  console.log("=== toggleForUser ===");
  document.documentElement.setAttribute("data-authenticated", "true");
  panelTitle.textContent = `Bem-vindo, ${user.name || user.username}`;
  panelSubtitle.textContent = "Escolha o servico, veja sua conta ou finalize um agendamento.";
  btnLogin.classList.add("hidden");
  btnRegister.classList.add("hidden");
  btnAccount.classList.remove("hidden");
  btnMyBookings.classList.remove("hidden");
  btnBooking.classList.remove("hidden");
  btnAdminSchedule.classList.add("hidden");
  btnLogout.classList.remove("hidden");
  phoneInput.value = user.phone || "";

  // Verifica se deve exibir mensagem de sucesso do agendamento
  if (sessionStorage.getItem(BOOKING_SUCCESS_KEY)) {
    setFeedback("Corte agendado com sucesso! Confirme o pagamento na barbearia.", "success");
    sessionStorage.removeItem(BOOKING_SUCCESS_KEY);
  }
}

function toggleForAdmin(user) {
  console.log("=== toggleForAdmin ===");
  document.documentElement.setAttribute("data-authenticated", "true");
  panelTitle.textContent = `Bem-vindo, ${user.name || user.username}`;
  panelSubtitle.textContent = "Acesse edicao de conta ou painel de cortes marcados.";
  btnLogin.classList.add("hidden");
  btnRegister.classList.add("hidden");
  btnAccount.classList.remove("hidden");
  btnMyBookings.classList.add("hidden");
  btnBooking.classList.add("hidden");
  btnAdminSchedule.classList.remove("hidden");
  btnLogout.classList.remove("hidden");
  bookingSection.classList.add("hidden");
}

async function loadClosedDays() {
  try {
    const response = await fetch("/api/schedule/closed-days");
    const data = await response.json();
    
    if (response.ok && data.closedDays) {
      closedDays = data.closedDays;
    }
  } catch (_error) {
    // Se falhar ao carregar dias fechados, continua normalmente
    console.error("Nao foi possivel carregar dias fechados");
  }
}

async function loadSession() {
  const token = getToken();
  console.log("loadSession called, token exists:", !!token);

  if (!token) {
    console.log("No token found, showing logged out view");
    toggleForLoggedOut();
    return;
  }

  const response = await fetch("/api/me", {
    headers: authHeaders(),
  });

  console.log("Fetch /api/me response status:", response.status);

  if (!response.ok) {
    console.log("Token invalid, clearing and showing logged out view");
    localStorage.removeItem(TOKEN_KEY);
    toggleForLoggedOut();
    return;
  }

  const data = await response.json();
  currentUser = data.user;
  console.log("Session loaded, user:", currentUser.username, "role:", currentUser.role);

  if (currentUser.role === "admin") {
    toggleForAdmin(currentUser);
    return;
  }

  toggleForUser(currentUser);
  buildDayOptions();
  updateServiceDurationInfo();
}

btnLogin.addEventListener("click", () => {
  window.location.href = "/login.html";
});

btnRegister.addEventListener("click", () => {
  window.location.href = "/login.html?tab=register";
});

btnAccount.addEventListener("click", () => {
  window.location.href = "/account.html";
});

btnMyBookings.addEventListener("click", () => {
  window.location.href = "/my-bookings.html";
});

btnBooking.addEventListener("click", async () => {
  bookingSection.classList.remove("hidden");
  if (currentUser?.phone) {
    phoneInput.value = currentUser.phone;
  }
  bookingSection.scrollIntoView({ behavior: "smooth", block: "start" });
  await loadSlots();
});

btnAdminSchedule.addEventListener("click", () => {
  window.location.href = "/admin.html";
});

btnLogout.addEventListener("click", async () => {
  const token = getToken();

  if (token) {
    await fetch("/api/logout", {
      method: "POST",
      headers: authHeaders(),
    }).catch(() => {});
  }

  localStorage.removeItem(TOKEN_KEY);
  document.documentElement.removeAttribute("data-authenticated");
  currentUser = null;
  toggleForLoggedOut();
});

serviceSelect.addEventListener("change", updateServiceDurationInfo);

daySelect.addEventListener("change", async () => {
  selectedTime = "";
  await loadSlots();
});

createPaymentBtn.addEventListener("click", async () => {
  if (!serviceSelect.value) {
    setFeedback("Selecione um servico.", "error");
    return;
  }
  if (!phoneInput.value.trim()) {
    setFeedback("Informe um telefone.", "error");
    return;
  }
  if (!daySelect.value) {
    setFeedback("Escolha um dia.", "error");
    return;
  }
  if (!selectedTime) {
    setFeedback("Selecione um horario.", "error");
    return;
  }

  createPaymentBtn.disabled = true;
  setFeedback("Agendando seu corte...", "");

  try {
    const response = await fetch("/api/bookings/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        service: serviceSelect.value,
        phone: phoneInput.value,
        day: daySelect.value,
        time: selectedTime,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setFeedback(data.message || "Nao foi possivel agendar.", "error");
      return;
    }

    // Limpa o formulário
    serviceSelect.value = "";
    daySelect.value = "";
    selectedTime = "";
    updateServiceDurationInfo();
    
    // Armazena flag para exibir mensagem de sucesso após voltar à tela principal
    sessionStorage.setItem(BOOKING_SUCCESS_KEY, "true");
    
    // Oculta a seção de agendamento e redireciona para home
    setTimeout(() => {
      bookingSection.classList.add("hidden");
      window.location.href = "/";
    }, 1500);
  } catch (_error) {
    setFeedback("Erro de conexao ao tentar agendar.", "error");
  } finally {
    createPaymentBtn.disabled = false;
  }
});

(async () => {
  await loadClosedDays();
  await loadSession();
})().catch(() => {
  console.error("loadSession failed with error");
  toggleForLoggedOut();
});

// Sincroniza autenticação em tempo real se token mudar (ex: logout em outra aba)
window.addEventListener("storage", (event) => {
  if (event.key === TOKEN_KEY) {
    console.log("Token mudou em outra aba, recarregando sessão");
    loadSession().catch(() => {
      toggleForLoggedOut();
    });
  }
});
