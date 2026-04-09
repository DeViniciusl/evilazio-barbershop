const TOKEN_KEY = "evilazio_token";
const backButton = document.getElementById("backBtn");
const daySelect = document.getElementById("daySelect");
const adminRows = document.getElementById("adminRows");
const adminFeedback = document.getElementById("adminFeedback");
const closedDaySelect = document.getElementById("closedDaySelect");
const closedDayReason = document.getElementById("closedDayReason");
const addClosedDayBtn = document.getElementById("addClosedDayBtn");
const closedDaysList = document.getElementById("closedDaysList");
const closedDaysEmpty = document.getElementById("closedDaysEmpty");
const closedDaysFeedback = document.getElementById("closedDaysFeedback");
const vipUsernameInput = document.getElementById("vipUsernameInput");
const assignVipBtn = document.getElementById("assignVipBtn");
const vipFeedback = document.getElementById("vipFeedback");
const cancellingBookings = new Set();

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
  };
}

function setFeedback(message, type) {
  adminFeedback.textContent = message;
  adminFeedback.className = `feedback ${type}`;
}

function setClosedDaysFeedback(message, type) {
  closedDaysFeedback.textContent = message;
  closedDaysFeedback.className = `feedback ${type}`;
}

function setVipFeedback(message, type) {
  vipFeedback.textContent = message;
  vipFeedback.className = `feedback ${type}`;
}

async function assignVip() {
  const username = vipUsernameInput.value.trim();

  if (!username) {
    setVipFeedback("Digite o username do cliente.", "error");
    return;
  }

  assignVipBtn.disabled = true;
  setVipFeedback("Processando...", "");

  try {
    const response = await fetch("/api/admin/assign-vip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ username }),
    });

    const data = await response.json();

    if (!response.ok) {
      setVipFeedback(data.message || "Erro ao atribuir plano VIP.", "error");
      return;
    }

    setVipFeedback(data.message, "success");
    vipUsernameInput.value = "";
  } catch (_error) {
    setVipFeedback("Erro de conexão ao atribuir plano VIP.", "error");
  } finally {
    assignVipBtn.disabled = false;
  }
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

function buildClosedDaySelectOptions() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.getDate();
  const lastDay = new Date(year, month, 0).getDate();

  closedDaySelect.innerHTML = "";

  for (let day = today; day <= lastDay; day += 1) {
    const value = String(day).padStart(2, "0");
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `Dia ${value}`;
    closedDaySelect.appendChild(option);
  }
}

async function loadMe() {
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

  if (data.user.role !== "admin") {
    window.location.href = "/home.html";
    return null;
  }

  return data.user;
}

function renderRows(slots) {
  adminRows.innerHTML = "";

  slots.forEach((slot) => {
    const tr = document.createElement("tr");

    const time = document.createElement("td");
    time.textContent = slot.time;

    const status = document.createElement("td");
    if (slot.status === "available") {
      status.textContent = "Livre";
    } else if (slot.status === "confirmed") {
      status.textContent = "Confirmado";
    } else {
      status.textContent = String(slot.status);
    }

    const client = document.createElement("td");
    if (slot.booking) {
      const clientContent = document.createElement("div");
      clientContent.style.display = "flex";
      clientContent.style.alignItems = "center";
      clientContent.style.gap = "8px";
      
      const nameSpan = document.createElement("span");
      nameSpan.textContent = slot.booking.displayName;
      clientContent.appendChild(nameSpan);
      
      if (slot.booking.isVip) {
        const vipBadge = document.createElement("span");
        vipBadge.textContent = "VIP";
        vipBadge.style.backgroundColor = "#4c6ce1";
        vipBadge.style.color = "#fff";
        vipBadge.style.padding = "2px 8px";
        vipBadge.style.borderRadius = "4px";
        vipBadge.style.fontSize = "0.85rem";
        vipBadge.style.fontWeight = "bold";
        clientContent.appendChild(vipBadge);
      }
      
      client.appendChild(clientContent);
    } else {
      client.textContent = "-";
    }

    const service = document.createElement("td");
    service.textContent = slot.booking ? slot.booking.service : "-";

    const duration = document.createElement("td");
    duration.textContent = slot.booking?.durationMinutes
      ? `${slot.booking.durationMinutes} min`
      : "-";

    const phone = document.createElement("td");
    phone.textContent = slot.booking ? slot.booking.phone : "-";

    const actions = document.createElement("td");
    if (slot.booking && slot.status === "confirmed") {
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "outline-btn";
      cancelBtn.textContent = cancellingBookings.has(slot.booking.id) ? "Cancelando..." : "Cancelar";
      cancelBtn.disabled = cancellingBookings.has(slot.booking.id);
      cancelBtn.addEventListener("click", () => {
        cancelBooking(slot.booking.id).catch(() => {
          setFeedback("Erro de conexao com o servidor.", "error");
        });
      });
      actions.appendChild(cancelBtn);
    } else {
      actions.textContent = "-";
    }

    tr.appendChild(time);
    tr.appendChild(status);
    tr.appendChild(client);
    tr.appendChild(service);
    tr.appendChild(duration);
    tr.appendChild(phone);
    tr.appendChild(actions);

    adminRows.appendChild(tr);
  });
}

async function cancelBooking(bookingId) {
  if (!Number.isInteger(bookingId) || cancellingBookings.has(bookingId)) {
    return;
  }

  cancellingBookings.add(bookingId);
  await loadSchedule();

  const response = await fetch(`/api/admin/bookings/${bookingId}/cancel`, {
    method: "POST",
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    cancellingBookings.delete(bookingId);
    await loadSchedule();
    setFeedback(data.message || "Nao foi possivel cancelar agendamento.", "error");
    return;
  }

  cancellingBookings.delete(bookingId);
  await loadSchedule();
  setFeedback(data.message || "Agendamento cancelado.", "success");
}

async function loadSchedule() {
  const day = daySelect.value;

  if (!day) {
    return;
  }

  const response = await fetch(`/api/admin/schedule?day=${encodeURIComponent(day)}`, {
    headers: authHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    setFeedback(data.message || "Nao foi possivel carregar planilha.", "error");
    return;
  }

  renderRows(data.slots);
  setFeedback("Planilha atualizada.", "success");
}

async function loadClosedDays() {
  try {
    const response = await fetch("/api/admin/closed-days", {
      headers: authHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      setClosedDaysFeedback(data.message || "Nao foi possivel carregar dias fechados.", "error");
      return;
    }

    renderClosedDays(data.closedDays || []);
  } catch (error) {
    setClosedDaysFeedback("Erro de conexao ao carregar dias fechados.", "error");
  }
}

function renderClosedDays(closedDays) {
  closedDaysList.innerHTML = "";

  if (closedDays.length === 0) {
    closedDaysEmpty.style.display = "block";
    return;
  }

  closedDaysEmpty.style.display = "none";

  closedDays.forEach((closedDay) => {
    const item = document.createElement("div");
    item.className = "closed-day-item";
    item.innerHTML = `
      <div>
        <strong>Dia ${closedDay.day}</strong>
        ${closedDay.reason ? `<p>${closedDay.reason}</p>` : ""}
      </div>
      <button type="button" class="remove-closed-day-btn" data-day="${closedDay.day}">Remover</button>
    `;
    closedDaysList.appendChild(item);
  });

  document.querySelectorAll(".remove-closed-day-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const day = e.target.dataset.day;
      await removeClosedDay(day);
    });
  });
}

async function removeClosedDay(day) {
  if (!confirm(`Tem certeza que deseja remover o dia ${day} da lista de fechados?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/admin/closed-days/${day}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      setClosedDaysFeedback(data.message || "Nao foi possivel remover dia fechado.", "error");
      return;
    }

    setClosedDaysFeedback(data.message || "Dia reaberto com sucesso.", "success");
    await loadClosedDays();
  } catch (error) {
    setClosedDaysFeedback("Erro de conexao ao remover dia fechado.", "error");
  }
}

async function addClosedDay() {
  const day = closedDaySelect.value;
  const reason = closedDayReason.value.trim();

  if (!day) {
    setClosedDaysFeedback("Selecione um dia.", "error");
    return;
  }

  addClosedDayBtn.disabled = true;
  setClosedDaysFeedback("Marcando dia como fechado...", "");

  try {
    const response = await fetch("/api/admin/closed-days", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        day,
        reason: reason || null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setClosedDaysFeedback(data.message || "Nao foi possivel marcar dia como fechado.", "error");
      return;
    }

    setClosedDaysFeedback(data.message || "Dia marcado como fechado com sucesso.", "success");
    closedDayReason.value = "";
    await loadClosedDays();
  } catch (error) {
    setClosedDaysFeedback("Erro de conexao ao marcar dia como fechado.", "error");
  } finally {
    addClosedDayBtn.disabled = false;
  }
}

backButton.addEventListener("click", () => {
  window.location.href = "/";
});

daySelect.addEventListener("change", () => {
  loadSchedule().catch(() => {
    setFeedback("Erro de conexao com o servidor.", "error");
  });
});

addClosedDayBtn.addEventListener("click", async () => {
  await addClosedDay();
});

assignVipBtn.addEventListener("click", async () => {
  await assignVip();
});

(async () => {
  const user = await loadMe();
  if (!user) {
    return;
  }

  buildDayOptions();
  buildClosedDaySelectOptions();
  await loadSchedule();
  await loadClosedDays();
})();
