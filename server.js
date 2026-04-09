const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const { Pool } = require("pg");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const NODE_ENV = String(process.env.NODE_ENV || "development").toLowerCase();
const IS_PRODUCTION = NODE_ENV === "production";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const scryptAsync = promisify(crypto.scrypt);

// SECURITY: Enforce HTTPS in production
if (IS_PRODUCTION) {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https" && !req.secure) {
      return res.redirect(301, `https://${req.header("host")}${req.url}`);
    }
    next();
  });
}

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRESQL_URL;
const hasPgParts =
  process.env.PGHOST &&
  process.env.PGPORT &&
  process.env.PGUSER &&
  process.env.PGPASSWORD &&
  process.env.PGDATABASE;

if (!DATABASE_URL && !hasPgParts) {
  throw new Error(
    "Banco nao configurado. Defina DATABASE_URL (ou POSTGRES_URL) ou as variaveis PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE no Railway."
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL || undefined,
  host: process.env.PGHOST || undefined,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER || undefined,
  password: process.env.PGPASSWORD || undefined,
  database: process.env.PGDATABASE || undefined,
  ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : undefined,
});

const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || "admin")
  .trim()
  .toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "").trim();
const RESET_ADMIN_PASSWORD_ON_BOOT = String(process.env.RESET_ADMIN_PASSWORD_ON_BOOT || "false").toLowerCase() === "true";

// SECURITY: Validate admin password strength in production
if (IS_PRODUCTION && (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12)) {
  throw new Error(
    "ADMIN_PASSWORD nao definida ou muito curta. Use minimo 12 caracteres em producao."
  );
}

const SLOT_TIMES = Array.from({ length: 12 }, (_, index) => {
  const hour = 8 + index;
  return `${String(hour).padStart(2, "0")}:00`;
});

const SERVICE_DURATIONS = {
  corte_social: 30,
  corte_tradicional: 30,
  corte_degrade: 35,
  corte_navalhado: 40,
  barba: 15,
  sobrancelha: 10,
  pezinho: 20,
  corte_barba: 45,
  corte_barba_sobrancelha: 50,
};

const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Fortaleza";
const SESSION_TTL_MS = Number.parseInt(process.env.SESSION_TTL_MS || `${12 * 60 * 60 * 1000}`, 10);
const SESSION_SWEEP_INTERVAL_MS = Number.parseInt(process.env.SESSION_SWEEP_INTERVAL_MS || `${5 * 60 * 1000}`, 10);
const MAX_JSON_BODY_SIZE = process.env.MAX_JSON_BODY_SIZE || "100kb";
const MAX_ACTIVE_SESSIONS = Number.parseInt(process.env.MAX_ACTIVE_SESSIONS || "5000", 10);

const sessions = new Map();

app.disable("x-powered-by");
app.set("trust proxy", 1);

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  scriptSrcAttr: ["'none'"],
  styleSrcAttr: ["'none'"],
  connectSrc: ["'self'"],
  imgSrc: ["'self'", "data:"],
  styleSrc: ["'self'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  objectSrc: ["'none'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
};

if (IS_PRODUCTION) {
  cspDirectives.upgradeInsecureRequests = [];
}

// SECURITY: Enhanced headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    referrerPolicy: { policy: "no-referrer" },
    hsts: IS_PRODUCTION ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    noSniff: true,
    xssFilter: true,
    frameguard: { action: "deny" },
  })
);

app.use(express.json({ limit: MAX_JSON_BODY_SIZE }));
app.use(express.static(path.join(__dirname, "public")));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas requisicoes. Tente novamente em alguns minutos." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas de acesso. Aguarde alguns minutos." },
});

app.use("/api", apiLimiter);

function getCurrentMonthContext() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((item) => item.type === "year")?.value);
  const month = Number(parts.find((item) => item.type === "month")?.value);
  const today = Number(parts.find((item) => item.type === "day")?.value);
  const daysInMonth = new Date(year, month, 0).getDate();

  return { year, month, today, daysInMonth };
}

function getCurrentMonthKey() {
  const { year, month } = getCurrentMonthContext();
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getCurrentTimeInTimezone() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find((item) => item.type === "hour")?.value;
  const minute = parts.find((item) => item.type === "minute")?.value;
  return `${hour}:${minute}`;
}

function isTimeAfterOrEqual(timeStr, currentTimeStr) {
  // Compara duas strings de tempo no formato HH:MM
  const [currentHour, currentMinute] = currentTimeStr.split(":").map(Number);
  const [timeHour, timeMinute] = timeStr.split(":").map(Number);
  
  if (timeHour > currentHour) return true;
  if (timeHour === currentHour && timeMinute >= currentMinute) return true;
  return false;
}

function normalizeDay(day) {
  const parsed = Number.parseInt(day, 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }
  return String(parsed).padStart(2, "0");
}

function isValidDayInCurrentMonth(day) {
  const normalizedDay = normalizeDay(day);
  if (!normalizedDay) {
    return false;
  }

  const dayNumber = Number.parseInt(normalizedDay, 10);
  const context = getCurrentMonthContext();
  return dayNumber >= context.today && dayNumber <= context.daysInMonth;
}

function isValidSlotTime(time) {
  return SLOT_TIMES.includes(String(time || ""));
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

function normalizeUsernameInput(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9._-]{3,32}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeDisplayNameInput(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 80) {
    return null;
  }
  return normalized;
}

function normalizePhoneInput(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^\d+\-() ]/g, "")
    .replace(/\s+/g, " ");

  if (normalized.length < 8 || normalized.length > 25) {
    return null;
  }

  return normalized;
}

function getSessionTtlMs() {
  if (!Number.isFinite(SESSION_TTL_MS) || SESSION_TTL_MS < 5 * 60 * 1000) {
    return 12 * 60 * 60 * 1000;
  }
  return SESSION_TTL_MS;
}

function getSessionSweepIntervalMs() {
  if (!Number.isFinite(SESSION_SWEEP_INTERVAL_MS) || SESSION_SWEEP_INTERVAL_MS < 60 * 1000) {
    return 5 * 60 * 1000;
  }
  return SESSION_SWEEP_INTERVAL_MS;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function calculateVipExpirationDate() {
  const today = new Date();
  const expirationDate = new Date(today);
  expirationDate.setDate(expirationDate.getDate() + 31);
  return expirationDate;
}

function buildUserPayload(row) {
  const now = new Date();
  const vipExpirationDate = row.vip_expiration_date ? new Date(row.vip_expiration_date) : null;
  const vipActive = vipExpirationDate && now <= vipExpirationDate;
  
  return {
    id: row.id,
    name: row.name || "",
    username: row.username || "",
    phone: row.phone || "",
    role: row.role || "user",
    vipActive: vipActive || false,
    vipExpirationDate: vipExpirationDate ? vipExpirationDate.toISOString() : null,
  };
}

function parseBookingRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    phone: row.phone,
    service: row.service,
    durationMinutes: row.duration_minutes,
    day: row.day,
    time: row.time,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
  };
}

function getBookingStatusLabel(status) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "confirmed") return "Confirmado";
  if (normalizedStatus === "cancelled") return "Cancelado";
  if (normalizedStatus === "pending") return "Pendente";
  if (normalizedStatus === "completed") return "Concluido";

  return normalizedStatus || "Indefinido";
}

function formatBookingDateLabel(day) {
  const normalizedDay = normalizeDay(day) || String(day || "").padStart(2, "0");
  const { month, year } = getCurrentMonthContext();
  return `${normalizedDay}/${String(month).padStart(2, "0")}/${year}`;
}

function buildClientBookingPayload(row) {
  const booking = parseBookingRow(row);

  return {
    ...booking,
    dateLabel: formatBookingDateLabel(booking.day),
    statusLabel: getBookingStatusLabel(booking.status),
  };
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function getUserById(id) {
  const result = await query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function getUserByUsername(username) {
  const result = await query("SELECT * FROM users WHERE username = $1", [String(username || "").toLowerCase()]);
  return result.rows[0] || null;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash || "").split(":");
  if (!salt || !key) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, 64);
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

async function isClosedDay(day) {
  const result = await query("SELECT id FROM closed_days WHERE day = $1 LIMIT 1", [day]);
  return result.rows.length > 0;
}

async function getBarbershopStatus() {
  const result = await query("SELECT is_open, closure_reason FROM barbershop_status LIMIT 1");
  if (result.rows.length === 0) {
    return { is_open: true, closure_reason: null };
  }
  return result.rows[0];
}

async function getClosedDaysInMonth() {
  const result = await query("SELECT day FROM closed_days ORDER BY day ASC");
  return result.rows.map((row) => row.day);
}

async function getNextAvailableDay(currentDay, currentMonth, currentYear) {
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  let checkDay = Number(currentDay);

  while (checkDay <= lastDay) {
    const dayStr = String(checkDay).padStart(2, "0");
    const isClosed = await isClosedDay(dayStr);
    if (!isClosed) {
      return dayStr;
    }
    checkDay += 1;
  }

  return null;
}

async function findNearestAvailableTime(client, day, preferredTime) {
  const availableTimes = [];

  for (const time of SLOT_TIMES) {
    const result = await client.query(
      "SELECT id FROM bookings WHERE day = $1 AND time = $2 AND status = 'confirmed'",
      [day, time]
    );
    if (result.rows.length === 0) {
      availableTimes.push(time);
    }
  }

  if (availableTimes.length === 0) {
    return null;
  }

  // Se o horário preferido está disponível, usa ele
  if (availableTimes.includes(preferredTime)) {
    return preferredTime;
  }

  // Caso contrário, retorna o primeiro disponível
  return availableTimes[0];
}

async function initDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      password_hash TEXT NOT NULL,
      vip_start_date TIMESTAMPTZ,
      vip_expiration_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Add VIP columns to existing tables (migration)
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_start_date TIMESTAMPTZ;`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_expiration_date TIMESTAMPTZ;`);

  await query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      day CHAR(2) NOT NULL,
      time CHAR(5) NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cancelled_at TIMESTAMPTZ,
      cancelled_by TEXT
    );
  `);

  await query(`
    DROP INDEX IF EXISTS idx_bookings_active_slot;
  `);

  // Clean legacy duplicates before recreating the unique active-slot index.
  await query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY day, time
          ORDER BY
            CASE WHEN status = 'confirmed' THEN 0 ELSE 1 END,
            created_at DESC,
            id DESC
        ) AS rn
      FROM bookings
      WHERE status IN ('confirmed')
    )
    UPDATE bookings b
    SET
      status = 'cancelled',
      cancelled_at = NOW(),
      cancelled_by = COALESCE(b.cancelled_by, 'system_dedup')
    FROM ranked r
    WHERE b.id = r.id
      AND r.rn > 1;
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot
    ON bookings(day, time)
    WHERE status = 'confirmed';
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS closed_days (
      id SERIAL PRIMARY KEY,
      day CHAR(2) NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT
    );
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_closed_days_day
    ON closed_days(day);
  `);

  // Tabela para status da barbearia (aberta/fechada)
  await query(`
    CREATE TABLE IF NOT EXISTS barbershop_status (
      id SERIAL PRIMARY KEY,
      is_open BOOLEAN NOT NULL DEFAULT TRUE,
      closure_reason TEXT,
      closure_start TIMESTAMPTZ,
      closure_end TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    );
  `);

  // Garante que existe apenas um registro
  const statusCheck = await query("SELECT COUNT(*) as count FROM barbershop_status");
  if (statusCheck.rows[0].count === 0) {
    await query(
      `INSERT INTO barbershop_status (is_open, updated_at) VALUES (TRUE, NOW());`
    );
  }
}

async function ensureAdminOnly() {
  const existingAdminResult = await query(
    "SELECT id FROM users WHERE username = $1 LIMIT 1",
    [ADMIN_USERNAME]
  );
  const existingAdmin = existingAdminResult.rows[0];

  if (!existingAdmin && !ADMIN_PASSWORD) {
    if (IS_PRODUCTION) {
      throw new Error(
        "ADMIN_PASSWORD nao configurada. Defina ADMIN_USERNAME e ADMIN_PASSWORD antes de subir em producao."
      );
    }
    console.warn("ADMIN_PASSWORD nao configurada. Usando senha local padrao somente para desenvolvimento.");
  }

  if (!existingAdmin) {
    const initialPassword = ADMIN_PASSWORD || "001212";
    const adminPasswordHash = await hashPassword(initialPassword);

    await query(
      `
        INSERT INTO users (username, name, phone, role, password_hash)
        VALUES ($1, $2, '', 'admin', $3)
        ON CONFLICT (username)
        DO NOTHING;
      `,
      [ADMIN_USERNAME, "Administrador", adminPasswordHash]
    );
    return;
  }

  if (RESET_ADMIN_PASSWORD_ON_BOOT && ADMIN_PASSWORD) {
    const adminPasswordHash = await hashPassword(ADMIN_PASSWORD);
    await query(
      `
        UPDATE users
        SET password_hash = $2,
            updated_at = NOW()
        WHERE username = $1;
      `,
      [ADMIN_USERNAME, adminPasswordHash]
    );
  }
}

function createSession(userId, req) {
  cleanupExpiredSessions();
  if (sessions.size >= MAX_ACTIVE_SESSIONS) {
    // Remove the oldest session when limit is reached to avoid memory growth.
    const oldest = [...sessions.entries()].sort((a, b) => (a[1]?.createdAt || 0) - (b[1]?.createdAt || 0))[0];
    if (oldest?.[0]) {
      sessions.delete(oldest[0]);
    }
  }

  const now = Date.now();
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, {
    userId,
    createdAt: now,
    expiresAt: now + getSessionTtlMs(),
    ip: req.ip,
    userAgent: String(req.headers["user-agent"] || ""),
  });
  return token;
}

function extractToken(req) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme === "Bearer" && token) {
    return token;
  }
  return null;
}

async function authMiddleware(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token || !sessions.has(token)) {
      return res.status(401).json({ message: "Sessao invalida." });
    }

    const session = sessions.get(token);
    if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) {
      sessions.delete(token);
      return res.status(401).json({ message: "Sessao expirada. Faca login novamente." });
    }
    const user = await getUserById(session.userId);

    if (!user) {
      sessions.delete(token);
      return res.status(401).json({ message: "Sessao invalida." });
    }

    session.expiresAt = Date.now() + getSessionTtlMs();
    sessions.set(token, session);
    req.user = buildUserPayload(user);
    req.token = token;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Acesso restrito ao admin." });
  }
  return next();
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function getBookingStatusForSlot(day, time) {
  const result = await query(
    `
      SELECT *
      FROM bookings
      WHERE day = $1
        AND time = $2
        AND status = 'confirmed'
      LIMIT 1;
    `,
    [day, time]
  );
  return result.rows[0] || null;
}

async function buildDaySchedule(day) {
  const result = await query(
    `
      SELECT *
      FROM bookings
      WHERE day = $1
        AND status = 'confirmed';
    `,
    [day]
  );

  const byTime = new Map(result.rows.map((row) => [row.time, row]));

  return SLOT_TIMES.map((time) => {
    const booking = byTime.get(time);
    if (!booking) {
      return { time, status: "available" };
    }

    return {
      time,
      status: booking.status,
      booking: {
        id: booking.id,
        displayName: booking.display_name,
        username: booking.username,
        service: booking.service,
        phone: booking.phone,
      },
    };
  });
}

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mode: "scheduling_only",
  });
});

app.post(
  "/api/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { username, displayName, phone, password } = req.body || {};

    if (!username || !displayName || !phone || !password) {
      return res.status(400).json({ message: "Preencha usuario, nome de exibicao, telefone e senha." });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
    }
    if (String(password).length > 128) {
      return res.status(400).json({ message: "A senha excede o tamanho maximo permitido." });
    }

    const normalizedUsername = normalizeUsernameInput(username);
    const normalizedDisplayName = normalizeDisplayNameInput(displayName);
    const normalizedPhone = normalizePhoneInput(phone);

    if (!normalizedUsername) {
      return res.status(400).json({
        message: "Usuario invalido. Use 3-32 caracteres com letras minusculas, numeros, ponto, underline ou hifen.",
      });
    }

    if (!normalizedDisplayName) {
      return res.status(400).json({ message: "Nome de exibicao invalido." });
    }

    if (!normalizedPhone) {
      return res.status(400).json({ message: "Telefone invalido." });
    }

    if (normalizedUsername === ADMIN_USERNAME) {
      return res.status(409).json({ message: "Usuario indisponivel." });
    }

    const existing = await getUserByUsername(normalizedUsername);
    if (existing) {
      return res.status(409).json({ message: "Usuario ja cadastrado." });
    }

    const passwordHash = await hashPassword(String(password));

    await query(
      `
        INSERT INTO users (username, name, phone, role, password_hash)
        VALUES ($1, $2, $3, 'user', $4);
      `,
      [normalizedUsername, normalizedDisplayName, normalizedPhone, passwordHash]
    );

    return res.status(201).json({ message: "Cadastro realizado com sucesso." });
  })
);

app.post(
  "/api/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: "Informe usuario e senha." });
    }
    if (String(password).length > 128) {
      return res.status(401).json({ message: "Credenciais invalidas." });
    }

    const normalizedUsername = normalizeUsernameInput(username);
    if (!normalizedUsername) {
      return res.status(401).json({ message: "Credenciais invalidas." });
    }

    const user = await getUserByUsername(normalizedUsername);
    if (!user) {
      return res.status(401).json({ message: "Credenciais invalidas." });
    }

    const validPassword = await verifyPassword(String(password), user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ message: "Credenciais invalidas." });
    }

    const token = createSession(user.id, req);

    return res.json({
      message: "Login realizado.",
      token,
      user: buildUserPayload(user),
    });
  })
);

app.post("/api/logout", authMiddleware, (req, res) => {
  sessions.delete(req.token);
  return res.json({ message: "Logout realizado." });
});

app.get("/api/me", authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

app.put(
  "/api/profile",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { displayName, phone, password } = req.body || {};
    const normalizedDisplayName = normalizeDisplayNameInput(displayName);
    const normalizedPhone = normalizePhoneInput(phone);

    if (!normalizedDisplayName) {
      return res.status(400).json({ message: "Nome de exibicao invalido." });
    }

    if (!normalizedPhone) {
      return res.status(400).json({ message: "Telefone invalido." });
    }

    if (password && String(password).length < 6) {
      return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
    }
    if (password && String(password).length > 128) {
      return res.status(400).json({ message: "A senha excede o tamanho maximo permitido." });
    }

    if (password) {
      const passwordHash = await hashPassword(String(password));
      await query(
        `
          UPDATE users
          SET name = $1,
              phone = $2,
              password_hash = $3,
              updated_at = NOW()
          WHERE id = $4;
        `,
        [normalizedDisplayName, normalizedPhone, passwordHash, req.user.id]
      );
    } else {
      await query(
        `
          UPDATE users
          SET name = $1,
              phone = $2,
              updated_at = NOW()
          WHERE id = $3;
        `,
        [normalizedDisplayName, normalizedPhone, req.user.id]
      );
    }

    const refreshed = await getUserById(req.user.id);
    return res.json({
      message: "Conta atualizada com sucesso.",
      user: buildUserPayload(refreshed),
    });
  })
);

app.get(
  "/api/schedule/day",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const normalizedDay = normalizeDay(req.query.day);

    if (!isValidDayInCurrentMonth(normalizedDay)) {
      return res.status(400).json({ message: "Dia invalido para este mes." });
    }

    const barbershopStatus = await getBarbershopStatus();
    const currentTime = getCurrentTimeInTimezone();
    const slots = await buildDaySchedule(normalizedDay);

    return res.json({
      day: normalizedDay,
      slots,
      barbershopStatus: {
        isOpen: barbershopStatus.is_open,
        closureReason: barbershopStatus.closure_reason,
      },
      currentTime,
    });
  })
);

app.post(
  "/api/bookings/create",
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (req.user.role === "admin") {
      return res.status(403).json({ message: "Admin nao realiza agendamento." });
    }

    // Verificar se a barbearia está aberta
    const barbershopStatus = await getBarbershopStatus();
    if (!barbershopStatus.is_open) {
      return res.status(403).json({
        message: `A barbearia está fechada.${barbershopStatus.closure_reason ? ` Motivo: ${barbershopStatus.closure_reason}` : ""}`,
        barbershopClosed: true,
      });
    }

    const { day, time, service, phone } = req.body || {};
    const normalizedDay = normalizeDay(day);
    const normalizedService = String(service || "").trim();
    const normalizedPhone = normalizePhoneInput(phone);

    if (!normalizedDay || !isValidDayInCurrentMonth(normalizedDay)) {
      return res.status(400).json({ message: "Escolha um dia valido no mes atual, sem datas passadas." });
    }

    // Verifica se o dia está marcado como fechado
    const dayIsClosed = await isClosedDay(normalizedDay);
    if (dayIsClosed) {
      return res.status(400).json({ message: "Este dia nao esta disponivel para agendamento." });
    }

    if (!isValidSlotTime(time)) {
      return res.status(400).json({ message: "Horario invalido. Escolha entre 08:00 e 19:00." });
    }

    // Validar que o horário não é passado para o dia de hoje
    const { today } = getCurrentMonthContext();
    const todayStr = String(today).padStart(2, "0");
    
    if (normalizedDay === todayStr) {
      const currentTime = getCurrentTimeInTimezone();
      if (!isTimeAfterOrEqual(time, currentTime)) {
        return res.status(400).json({ message: "Nao eh possivel agendar para um horario passado. Escolha um horario futuro." });
      }
    }

    if (!normalizedService || !normalizedPhone) {
      return res.status(400).json({ message: "Informe servico e telefone." });
    }

    const serviceDuration = getServiceDuration(normalizedService);
    if (!serviceDuration) {
      return res.status(400).json({ message: "Servico invalido para agendamento." });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const insertBooking = await client.query(
        `
          INSERT INTO bookings (
            user_id, username, display_name, phone, service, duration_minutes,
            day, time, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed')
          RETURNING *;
        `,
        [
          req.user.id,
          req.user.username,
          req.user.name || req.user.username,
          normalizedPhone,
          normalizedService,
          serviceDuration,
          normalizedDay,
          String(time),
        ]
      );

      await client.query("COMMIT");
      const booking = parseBookingRow(insertBooking.rows[0]);

      return res.status(201).json({
        message: "Agendamento realizado com sucesso.",
        bookingId: booking.id,
        durationMinutes: booking.durationMinutes,
        booking,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        return res.status(409).json({ message: "Horario indisponivel para este dia." });
      }
      throw error;
    } finally {
      client.release();
    }
  })
);

app.get(
  "/api/bookings/:bookingId/status",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const bookingId = Number.parseInt(req.params.bookingId, 10);
    if (!Number.isInteger(bookingId)) {
      return res.status(400).json({ message: "Agendamento invalido." });
    }

    const result = await query(
      `
        SELECT id, user_id, status, day, time, created_at
        FROM bookings
        WHERE id = $1
        LIMIT 1;
      `,
      [bookingId]
    );

    const booking = result.rows[0];
    if (!booking) {
      return res.status(404).json({ message: "Agendamento nao encontrado." });
    }

    if (req.user.role !== "admin" && booking.user_id !== req.user.id) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    return res.json({
      bookingId: booking.id,
      status: booking.status,
      day: booking.day,
      time: booking.time,
      createdAt: booking.created_at,
    });
  })
);

app.get(
  "/api/bookings",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const result = await query(
      req.user.role === "admin"
        ? "SELECT * FROM bookings ORDER BY created_at DESC"
        : "SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC",
      req.user.role === "admin" ? [] : [req.user.id]
    );

    return res.json(result.rows.map(parseBookingRow));
  })
);

app.get(
  "/api/my-bookings",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        SELECT *
        FROM bookings
        WHERE user_id = $1
        ORDER BY day ASC, time ASC, created_at DESC;
      `,
      [req.user.id]
    );

    return res.json({
      bookings: result.rows.map(buildClientBookingPayload),
    });
  })
);

app.post(
  "/api/admin/bookings/:bookingId/cancel",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const bookingId = Number.parseInt(req.params.bookingId, 10);

    if (!Number.isInteger(bookingId)) {
      return res.status(400).json({ message: "Agendamento invalido." });
    }

    const result = await query(
      `
        UPDATE bookings
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_by = $2
        WHERE id = $1
          AND status = 'confirmed'
        RETURNING *;
      `,
      [bookingId, req.user.username]
    );

    const booking = result.rows[0];
    if (!booking) {
      return res.status(404).json({ message: "Agendamento nao encontrado ou nao pode ser cancelado." });
    }

    return res.json({
      message: "Agendamento cancelado com sucesso.",
      booking: {
        id: booking.id,
        day: booking.day,
        time: booking.time,
        status: booking.status,
        cancelledAt: booking.cancelled_at,
      },
    });
  })
);

app.get(
  "/api/admin/schedule",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const normalizedDay = normalizeDay(req.query.day);

    if (!isValidDayInCurrentMonth(normalizedDay)) {
      return res.status(400).json({ message: "Dia invalido para este mes." });
    }

    const result = await query(
      `
        SELECT b.*,
               u.vip_expiration_date
        FROM bookings b
        LEFT JOIN users u ON b.user_id = u.id
        WHERE b.day = $1
          AND b.status = 'confirmed'
        ORDER BY b.time ASC;
      `,
      [normalizedDay]
    );

    const byTime = new Map(result.rows.map((row) => [row.time, row]));

    const slots = SLOT_TIMES.map((time) => {
      const booking = byTime.get(time);

      if (!booking) {
        return {
          time,
          status: "available",
        };
      }

      // Check if VIP is active
      const now = new Date();
      const vipExpirationDate = booking.vip_expiration_date ? new Date(booking.vip_expiration_date) : null;
      const isVip = vipExpirationDate && now <= vipExpirationDate;

      return {
        time,
        status: booking.status,
        booking: {
          id: booking.id,
          displayName: booking.display_name,
          username: booking.username,
          phone: booking.phone,
          service: booking.service,
          durationMinutes: booking.duration_minutes || getServiceDuration(booking.service),
          isVip: isVip || false,
        },
      };
    });

    return res.json({ day: normalizedDay, slots });
  })
);

// GET /api/admin/closed-days - Retorna dias fechados
app.get(
  "/api/admin/closed-days",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await query("SELECT day, reason FROM closed_days ORDER BY day ASC");
    return res.json({ closedDays: result.rows.map((row) => ({ day: row.day, reason: row.reason })) });
  })
);

// GET /api/schedule/closed-days - Retorna dias fechados (público)
app.get(
  "/api/schedule/closed-days",
  asyncHandler(async (req, res) => {
    const result = await query("SELECT day FROM closed_days ORDER BY day ASC");
    return res.json({ closedDays: result.rows.map((row) => row.day) });
  })
);

// POST /api/admin/closed-days - Adiciona um dia fechado
app.post(
  "/api/admin/closed-days",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { day, reason } = req.body || {};
    const normalizedDay = normalizeDay(day);

    if (!isValidDayInCurrentMonth(normalizedDay)) {
      return res.status(400).json({ message: "Dia invalido para este mes." });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Verifica se já está marcado como fechado
      const alreadyClosed = await client.query("SELECT id FROM closed_days WHERE day = $1", [normalizedDay]);
      if (alreadyClosed.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Este dia ja esta marcado como fechado." });
      }

      // Insere o dia fechado
      await client.query(
        "INSERT INTO closed_days (day, reason, created_by) VALUES ($1, $2, $3)",
        [normalizedDay, reason || null, req.user.username]
      );

      // Busca agendamentos neste dia e reschedula para o próximo dia disponível
      const bookings = await client.query(
        "SELECT id, day, time, service FROM bookings WHERE day = $1 AND status = 'confirmed'",
        [normalizedDay]
      );

      if (bookings.rows.length > 0) {
        const now = new Date();
        const nextDay = await getNextAvailableDay(
          Number(normalizedDay) + 1,
          now.getMonth() + 1,
          now.getFullYear()
        );

        if (!nextDay) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message: "Nao foi possivel reagendar os agendamentos, pois nao ha dias disponiveis no mes.",
          });
        }

        for (const booking of bookings.rows) {
          // Tenta manter o mesmo horário
          const timeCheck = await client.query(
            "SELECT id FROM bookings WHERE day = $1 AND time = $2 AND status = 'confirmed'",
            [nextDay, booking.time]
          );

          const newTime = timeCheck.rows.length === 0 ? booking.time : await findNearestAvailableTime(client, nextDay, booking.time);

          if (!newTime) {
            await client.query("ROLLBACK");
            return res.status(400).json({
              message: `Nao foi possivel reagendar o agendamento do cliente ${booking.id} para o dia ${nextDay}.`,
            });
          }

          await client.query(
            "UPDATE bookings SET day = $1, time = $2 WHERE id = $3",
            [nextDay, newTime, booking.id]
          );
        }
      }

      await client.query("COMMIT");
      return res.json({ message: "Dia marcado como fechado. Agendamentos enviados para o próximo dia disponível." });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

// DELETE /api/admin/closed-days/:day - Remove um dia fechado
app.delete(
  "/api/admin/closed-days/:day",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const normalizedDay = normalizeDay(req.params.day);

    if (!isValidDayInCurrentMonth(normalizedDay)) {
      return res.status(400).json({ message: "Dia invalido para este mes." });
    }

    await query("DELETE FROM closed_days WHERE day = $1", [normalizedDay]);
    return res.json({ message: "Dia reaberto com sucesso." });
  })
);

// POST /api/admin/assign-vip - Atribui plano VIP a um usuário
app.post(
  "/api/admin/assign-vip",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { username } = req.body || {};

    if (!username || typeof username !== "string") {
      return res.status(400).json({ message: "Username é obrigatório." });
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const user = await getUserByUsername(normalizedUsername);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const vipExpirationDate = calculateVipExpirationDate();
    const vipStartDate = new Date();

    await query(
      `
        UPDATE users
        SET vip_start_date = $1,
            vip_expiration_date = $2,
            updated_at = NOW()
        WHERE id = $3;
      `,
      [vipStartDate, vipExpirationDate, user.id]
    );

    const updatedUser = await getUserById(user.id);
    const userPayload = buildUserPayload(updatedUser);

    return res.json({
      message: `Plano VIP atribuído a ${user.username} com sucesso. Vencimento: ${vipExpirationDate.toLocaleDateString("pt-BR")}.`,
      user: userPayload,
    });
  })
);

// GET /api/barbershop/status - Consulta status da barbearia
app.get(
  "/api/barbershop/status",
  asyncHandler(async (req, res) => {
    const status = await getBarbershopStatus();
    return res.json({
      isOpen: status.is_open,
      closureReason: status.closure_reason,
    });
  })
);

// PUT /api/admin/barbershop/status - Altera status da barbearia (admin only)
app.put(
  "/api/admin/barbershop/status",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { isOpen, closureReason } = req.body || {};

    if (typeof isOpen !== "boolean") {
      return res.status(400).json({ message: "isOpen deve ser booleano (true/false)." });
    }

    // Se for fechar, closureReason é obrigatório
    if (!isOpen && (!closureReason || String(closureReason).trim().length === 0)) {
      return res.status(400).json({ message: "Motivo do fechamento é obrigatório." });
    }

    const normalizedReason = isOpen ? null : String(closureReason).trim();

    await query(
      `
        UPDATE barbershop_status
        SET is_open = $1,
            closure_reason = $2,
            updated_at = NOW(),
            updated_by = $3
        WHERE id = 1;
      `,
      [isOpen, normalizedReason, req.user.username]
    );

    return res.json({
      message: isOpen ? "Barbearia aberta com sucesso." : "Barbearia fechada com sucesso.",
      status: {
        isOpen,
        closureReason: normalizedReason,
      },
    });
  })
);

app.use((error, _req, res, next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ message: "Payload muito grande." });
  }
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ message: "JSON invalido na requisicao." });
  }
  return next(error);
});

app.use((error, _req, res, _next) => {
  console.error("Erro interno:", error);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ message: "Erro interno do servidor." });
});

Promise.resolve()
  .then(initDatabase)
  .then(ensureAdminOnly)
  .then(() => {
    const sessionSweepTimer = setInterval(() => {
      cleanupExpiredSessions();
    }, getSessionSweepIntervalMs());

    if (typeof sessionSweepTimer.unref === "function") {
      sessionSweepTimer.unref();
    }

    if (!IS_PRODUCTION && !ADMIN_PASSWORD) {
      console.warn("ADMIN_PASSWORD nao definida. Em desenvolvimento, a senha inicial padrao do admin e 001212.");
    }

    console.log("Evilazio Barbershop - Sistema de Agendamento Simples");
    console.log("Servidor iniciado. Nenhuma funcionalidade de pagamento ativa.");

    app.listen(PORT, () => {
      console.log(`Evilazio Barbershop online em http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao iniciar aplicacao:", error);
    process.exit(1);
  });
