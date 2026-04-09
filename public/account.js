const TOKEN_KEY = "evilazio_token";
const form = document.getElementById("accountForm");
const usernameInput = document.getElementById("usernameInput");
const displayNameInput = document.getElementById("displayNameInput");
const phoneInput = document.getElementById("phoneInput");
const passwordInput = document.getElementById("passwordInput");
const feedback = document.getElementById("accountFeedback");
const backBtn = document.getElementById("backBtn");
const vipStatus = document.getElementById("vipStatus");

const saveBtn = form.querySelector('button[type="submit"]');
let isSaving = false;

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

function displayVipStatus(user) {
  if (!user) {
    vipStatus.textContent = "Sem plano VIP ativo.";
    vipStatus.className = "section-label";
    return;
  }

  if (user.vipActive) {
    const expirationDate = new Date(user.vipExpirationDate);
    const formattedDate = expirationDate.toLocaleDateString("pt-BR");
    vipStatus.innerHTML = `<strong style="color: #4c6ce1;">✓ Você é um cliente VIP!</strong><br>Data de vencimento: <strong>${formattedDate}</strong>`;
    vipStatus.className = "section-label";
  } else {
    vipStatus.textContent = "Sem plano VIP ativo.";
    vipStatus.className = "section-label";
  }
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
  usernameInput.value = data.user.username || "";
  displayNameInput.value = data.user.name || "";
  phoneInput.value = data.user.phone || "";
  displayVipStatus(data.user);
  return data.user;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSaving) {
    return;
  }

  const payload = {
    displayName: displayNameInput.value.trim(),
    phone: phoneInput.value.trim(),
  };

  const newPassword = passwordInput.value.trim();
  if (newPassword) {
    payload.password = newPassword;
  }

  isSaving = true;
  saveBtn.disabled = true;

  try {
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      setFeedback(data.message || "Nao foi possivel atualizar conta.", "error");
      return;
    }

    passwordInput.value = "";
    setFeedback("Conta atualizada com sucesso.", "success");
  } catch (_error) {
    setFeedback("Erro de conexao com o servidor.", "error");
  } finally {
    isSaving = false;
    saveBtn.disabled = false;
  }
});

backBtn.addEventListener("click", () => {
  window.location.href = "/index.html";
});

loadMe().catch(() => {
  setFeedback("Erro de conexao com o servidor.", "error");
});
