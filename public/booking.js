const TOKEN_KEY = "evilazio_token";
const bookingForm = document.getElementById("bookingForm");
const serviceSelect = document.getElementById("serviceSelect");
const phoneInput = document.getElementById("phoneInput");
const daySelect = document.getElementById("daySelect");
const timeSelect = document.getElementById("timeSelect");
const backBtn = document.getElementById("backBtn");
const feedback = document.getElementById("bookingFeedback");
const submitBtn = bookingForm.querySelector('button[type="submit"]');

let selectedTime = "";
let slotsRequestId = 0;
let isSubmitting = false;

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

function buildTimeslots() {
  timeSelect.innerHTML = '<option value="">Escolha um horário</option>';
  
  for (let hour = 8; hour < 19; hour += 1) {
    const timeStr = String(hour).padStart(2, "0") + ":00";
    const option = document.createElement("option");
    option.value = timeStr;
    option.textContent = timeStr;
    timeSelect.appendChild(option);
  }
}

async function loadUser() {
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
  return data.user;
}

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) {
    return;
  }

  const day = daySelect.value;
  const service = serviceSelect.value;
  const phone = phoneInput.value.trim();
  const time = timeSelect.value;

  if (!service || !phone || !day || !time) {
    setFeedback("Preencha todos os campos corretamente.", "error");
    return;
  }

  isSubmitting = true;
  submitBtn.disabled = true;
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
        time,
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
      `✓ Agendamento confirmado! Data: ${day}/${new Date().getMonth() + 1}, Horário: ${time}. Pagamento no local.`,
      "success"
    );

    // Reset form
    bookingForm.reset();
    selectedTime = "";
    
    // Redirect after 3 seconds
    setTimeout(() => {
      window.location.href = "/index.html";
    }, 3000);
  } catch (_error) {
    setFeedback("Erro de conexão com o servidor.", "error");
  } finally {
    isSubmitting = false;
    submitBtn.disabled = false;
  }
});

backBtn.addEventListener("click", () => {
  window.location.href = "/index.html";
});

(async () => {
  const user = await loadUser();
  if (!user) {
    return;
  }

  buildDayOptions();
  buildTimeslots();
})();
