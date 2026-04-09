const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");
const { Pool } = require("pg");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");

require("dotenv").config();

const app = express();
const NODE_ENV = String(process.env.NODE_ENV || "development").toLowerCase();
const IS_PRODUCTION = NODE_ENV === "production";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);

// ============================================================================
// SECURITY & CONFIGURATION
// ============================================================================

if (IS_PRODUCTION) {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https" && !req.secure) {
      return res.redirect(301, `https://${req.header("host")}${req.url}`);
    }
    next();
  });
}

const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRESQL_URL;
const hasPgParts =
  process.env.PGHOST &&
  process.env.PGPORT &&
  process.env.PGUSER &&
  process.env.PGPASSWORD &&
  process.env.PGDATABASE;

if (!DATABASE_URL && !hasPgParts) {
  throw new Error(
    "Banco não configurado. Defina DATABASE_URL ou as variáveis PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE."
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

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@barbershop.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Fortaleza";

if (!JWT_SECRET || !REFRESH_TOKEN_SECRET) {
  throw new Error(
    "JWT_SECRET e REFRESH_TOKEN_SECRET devem estar definidas no .env"
  );
}

if (IS_PRODUCTION && (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12)) {
  throw new Error(
    "ADMIN_PASSWORD não definida ou muito curta. Use mínimo 12 caracteres em produção."
  );
}

const BARBERS = ["Evilázio", "Marcos"];
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

// Security middleware
app.disable("x-powered-by");
app.set("trust proxy", 1);

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  scriptSrcAttr: ["'none'"],
  styleSrcAttr: ["'none'"],
  connectSrc: ["'self'"],
  imgSrc: ["'self'", "data:", "https:"],
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

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives,
    },
    referrerPolicy: { policy: "no-referrer" },
    hsts: IS_PRODUCTION
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    noSniff: true,
    xssFilter: true,
    frameguard: { action: "deny" },
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Rate limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function query(text, params = []) {
  return pool.query(text, params);
}

async function hashPassword(password) {
  return bcryptjs.hash(password, 12);
}

async function verifyPassword(password, hash) {
  return bcryptjs.compare(password, hash);
}

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

function normalizeDay(day) {
  const parsed = Number.parseInt(day, 10);
  if (!Number.isInteger(parsed)) return null;
  return String(parsed).padStart(2, "0");
}

function isValidDayInCurrentMonth(day) {
  const normalizedDay = normalizeDay(day);
  if (!normalizedDay) return false;

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
  if (
    normalized === "corte + barba + sobrancelha"
  )
    return "corte_barba_sobrancelha";

  return "";
}

function getServiceDuration(service) {
  const key = normalizeServiceKey(service);
  return key ? SERVICE_DURATIONS[key] || null : null;
}

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  // Simple email validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function normalizePhoneInput(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^\d+\-() ]/g, "")
    .replace(/\s+/g, " ");

  if (normalized.length < 8 || normalized.length > 25) return null;
  return normalized;
}

function createAccessToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "15m" });
}

function createRefreshToken(userId) {
  return jwt.sign({ userId }, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

async function initDatabase() {
  // Users table with email and MFA support
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      mfa_enabled BOOLEAN DEFAULT FALSE,
      mfa_secret TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Barbers table
  await query(`
    CREATE TABLE IF NOT EXISTS barbers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      bio TEXT DEFAULT '',
      specialty TEXT DEFAULT '',
      contact TEXT DEFAULT '',
      photo_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Portfolio entries
  await query(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      published BOOLEAN DEFAULT FALSE,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Portfolio images
  await query(`
    CREATE TABLE IF NOT EXISTS portfolio_images (
      id SERIAL PRIMARY KEY,
      portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      alt TEXT,
      order_index INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Barber images (carousel)
  await query(`
    CREATE TABLE IF NOT EXISTS barber_images (
      id SERIAL PRIMARY KEY,
      barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      thumbnail_url TEXT,
      alt TEXT,
      order_index INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Update bookings table to include barber_id
  await query(`
    ALTER TABLE bookings ADD COLUMN IF NOT EXISTS barber_id INTEGER REFERENCES barbers(id);
  `);

  // Refresh tokens (for JWT rotation)
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Blocked times for barbers
  await query(`
    CREATE TABLE IF NOT EXISTS barber_availability (
      id SERIAL PRIMARY KEY,
      barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
      day CHAR(2) NOT NULL,
      start_time CHAR(5),
      end_time CHAR(5),
      is_available BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Insert default barbers if they don't exist
  for (const barber of BARBERS) {
    await query(
      `
      INSERT INTO barbers (name, bio, specialty, contact)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO NOTHING;
      `,
      [barber, `Bio de ${barber}`, "Cortes profissionais", ""]
    );
  }

  // Migrate existing users if needed
  const usersCheck = await query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'email'
  `);

  if (usersCheck.rows.length === 0) {
    await query(`
      ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
      ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN mfa_secret TEXT;
    `);
  }

  // Ensure admin user exists
  const adminCheck = await query(
    `SELECT id FROM users WHERE email = $1`,
    [ADMIN_EMAIL]
  );

  if (adminCheck.rows.length === 0 && ADMIN_PASSWORD) {
    const adminHash = await hashPassword(ADMIN_PASSWORD);
    await query(
      `
      INSERT INTO users (email, password_hash, name, role)
      VALUES ($1, $2, 'Administrador', 'admin')
      `,
      [ADMIN_EMAIL, adminHash]
    );
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res
        .status(401)
        .json({ message: "Token de autenticação necessário." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await query(`SELECT * FROM users WHERE id = $1`, [
      decoded.userId,
    ]);

    if (user.rows.length === 0) {
      return res.status(401).json({ message: "Usuário não encontrado." });
    }

    req.user = {
      id: user.rows[0].id,
      email: user.rows[0].email,
      name: user.rows[0].name,
      role: user.rows[0].role,
      mfa_enabled: user.rows[0].mfa_enabled,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expirado." });
    }
    return res.status(401).json({ message: "Token inválido." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Acesso restrito a administrador." });
  }
  next();
}

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

app.post(
  "/api/auth/register",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, name, phone } = req.body || {};

    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ message: "Email, senha e nome são obrigatórios." });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Senha deve ter pelo menos 8 caracteres." });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: "Email inválido." });
    }

    const normalizedPhone = phone ? normalizePhoneInput(phone) : "";

    const existing = await query(`SELECT id FROM users WHERE email = $1`, [
      normalizedEmail,
    ]);

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "Email já cadastrado." });
    }

    const passwordHash = await hashPassword(password);

    await query(
      `INSERT INTO users (email, password_hash, name, phone, role)
       VALUES ($1, $2, $3, $4, 'user')`,
      [normalizedEmail, passwordHash, name, normalizedPhone]
    );

    return res
      .status(201)
      .json({ message: "Cadastro realizado com sucesso." });
  })
);

app.post(
  "/api/auth/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email e senha são obrigatórios." });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(401).json({ message: "Credenciais inválidas." });
    }

    const result = await query(`SELECT * FROM users WHERE email = $1`, [
      normalizedEmail,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Credenciais inválidas." });
    }

    const user = result.rows[0];
    const validPassword = await verifyPassword(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ message: "Credenciais inválidas." });
    }

    const accessToken = createAccessToken(user.id, user.role);
    const refreshToken = createRefreshToken(user.id);

    // Store refresh token in database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    // Set httpOnly cookie for refresh token
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: "Login realizado com sucesso.",
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  })
);

app.post(
  "/api/auth/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res
        .status(401)
        .json({ message: "Refresh token necessário." });
    }

    try {
      const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);

      const tokenResult = await query(
        `SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
        [refreshToken]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(401).json({ message: "Refresh token inválido." });
      }

      const user = await query(`SELECT * FROM users WHERE id = $1`, [
        decoded.userId,
      ]);

      if (user.rows.length === 0) {
        return res.status(401).json({ message: "Usuário não encontrado." });
      }

      const newAccessToken = createAccessToken(user.rows[0].id, user.rows[0].role);
      const newRefreshToken = createRefreshToken(user.rows[0].id);

      // Delete old refresh token and insert new one
      await query(`DELETE FROM refresh_tokens WHERE token = $1`, [
        refreshToken,
      ]);

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [user.rows[0].id, newRefreshToken, expiresAt]
      );

      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch (error) {
      return res.status(401).json({ message: "Refresh token inválido." });
    }
  })
);

app.post(
  "/api/auth/logout",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (refreshToken) {
      await query(`DELETE FROM refresh_tokens WHERE token = $1`, [
        refreshToken,
      ]);
    }

    res.clearCookie("refreshToken");
    return res.json({ message: "Logout realizado com sucesso." });
  })
);

// ============================================================================
// BARBER ENDPOINTS
// ============================================================================

app.get("/api/barbers", asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, bio, specialty, contact, photo_url FROM barbers ORDER BY name ASC`
  );

  return res.json({ barbers: result.rows });
}));

app.get(
  "/api/barbers/:id",
  asyncHandler(async (req, res) => {
    const barberId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(barberId)) {
      return res.status(400).json({ message: "ID de barbeiro inválido." });
    }

    const barber = await query(
      `SELECT id, name, bio, specialty, contact, photo_url FROM barbers WHERE id = $1`,
      [barberId]
    );

    if (barber.rows.length === 0) {
      return res.status(404).json({ message: "Barbeiro não encontrado." });
    }

    const images = await query(
      `SELECT id, url, thumbnail_url, alt, order_index FROM barber_images WHERE barber_id = $1 ORDER BY order_index ASC`,
      [barberId]
    );

    return res.json({
      barber: barber.rows[0],
      images: images.rows,
    });
  })
);

app.post(
  "/api/admin/barbers",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, bio, specialty, contact } = req.body || {};

    if (!name) {
      return res.status(400).json({ message: "Nome do barbeiro é obrigatório." });
    }

    const result = await query(
      `INSERT INTO barbers (name, bio, specialty, contact)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, bio || "", specialty || "", contact || ""]
    );

    return res.status(201).json({ barber: result.rows[0] });
  })
);

app.put(
  "/api/admin/barbers/:id",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const barberId = Number.parseInt(req.params.id, 10);
    const { name, bio, specialty, contact, photo_url } = req.body || {};

    if (!Number.isInteger(barberId)) {
      return res.status(400).json({ message: "ID de barbeiro inválido." });
    }

    const result = await query(
      `UPDATE barbers 
       SET name = COALESCE($1, name),
           bio = COALESCE($2, bio),
           specialty = COALESCE($3, specialty),
           contact = COALESCE($4, contact),
           photo_url = COALESCE($5, photo_url),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, bio, specialty, contact, photo_url, barberId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Barbeiro não encontrado." });
    }

    return res.json({ barber: result.rows[0] });
  })
);

// ============================================================================
// PORTFOLIO ENDPOINTS
// ============================================================================

app.get(
  "/api/portfolio",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page || 1, 10));
    const limit = Math.min(10, Number.parseInt(req.query.limit || 10, 10));
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) as total FROM portfolios WHERE published = TRUE`
    );

    const result = await query(
      `SELECT id, title, description, created_at
       FROM portfolios
       WHERE published = TRUE
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const portfolios = await Promise.all(
      result.rows.map(async (p) => {
        const images = await query(
          `SELECT id, url, thumbnail_url, alt FROM portfolio_images 
           WHERE portfolio_id = $1 ORDER BY order_index ASC LIMIT 1`,
          [p.id]
        );
        return { ...p, thumbnail: images.rows[0] };
      })
    );

    return res.json({
      portfolios,
      pagination: {
        page,
        limit,
        total: Number(countResult.rows[0].total),
      },
    });
  })
);

app.get(
  "/api/portfolio/:id",
  asyncHandler(async (req, res) => {
    const portfolioId = Number.parseInt(req.params.id, 10);

    const portfolio = await query(
      `SELECT * FROM portfolios WHERE id = $1 AND published = TRUE`,
      [portfolioId]
    );

    if (portfolio.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Portfólio não encontrado." });
    }

    const images = await query(
      `SELECT id, url, thumbnail_url, alt, order_index FROM portfolio_images 
       WHERE portfolio_id = $1 ORDER BY order_index ASC`,
      [portfolioId]
    );

    return res.json({
      portfolio: portfolio.rows[0],
      images: images.rows,
    });
  })
);

app.post(
  "/api/admin/portfolio",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { title, description } = req.body || {};

    if (!title) {
      return res.status(400).json({ message: "Título é obrigatório." });
    }

    const result = await query(
      `INSERT INTO portfolios (title, description, published, created_by)
       VALUES ($1, $2, FALSE, $3)
       RETURNING *`,
      [title, description || "", req.user.id]
    );

    return res.status(201).json({ portfolio: result.rows[0] });
  })
);

app.put(
  "/api/admin/portfolio/:id",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const portfolioId = Number.parseInt(req.params.id, 10);
    const { title, description, published } = req.body || {};

    const result = await query(
      `UPDATE portfolios
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           published = COALESCE($3, published),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [title, description, published, portfolioId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Portfólio não encontrado." });
    }

    return res.json({ portfolio: result.rows[0] });
  })
);

app.delete(
  "/api/admin/portfolio/:id",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const portfolioId = Number.parseInt(req.params.id, 10);

    await query(`DELETE FROM portfolio_images WHERE portfolio_id = $1`, [
      portfolioId,
    ]);

    const result = await query(`DELETE FROM portfolios WHERE id = $1`, [
      portfolioId,
    ]);

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Portfólio não encontrado." });
    }

    return res.json({ message: "Portfólio deletado com sucesso." });
  })
);

// ============================================================================
// PORTFOLIO IMAGES ENDPOINTS
// ============================================================================

app.post(
  "/api/admin/portfolio/:portfolioId/images",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const portfolioId = Number.parseInt(req.params.portfolioId, 10);
    const { url, alt } = req.body || {};

    if (!url) {
      return res.status(400).json({ message: "URL é obrigatória." });
    }

    // Get max order_index
    const maxOrder = await query(
      `SELECT MAX(order_index) as max_order FROM portfolio_images WHERE portfolio_id = $1`,
      [portfolioId]
    );

    const orderIndex = (maxOrder.rows[0]?.max_order || 0) + 1;

    const result = await query(
      `INSERT INTO portfolio_images (portfolio_id, url, thumbnail_url, alt, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [portfolioId, url, url, alt || "", orderIndex]
    );

    return res.status(201).json({ image: result.rows[0] });
  })
);

app.delete(
  "/api/admin/portfolio/images/:imageId",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const imageId = Number.parseInt(req.params.imageId, 10);

    const result = await query(
      `DELETE FROM portfolio_images WHERE id = $1`,
      [imageId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Imagem não encontrada." });
    }

    return res.json({ message: "Imagem deletada com sucesso." });
  })
);

// ============================================================================
// BARBER IMAGES (Carousel) ENDPOINTS
// ============================================================================

app.post(
  "/api/admin/barbers/:barberId/images",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const barberId = Number.parseInt(req.params.barberId, 10);
    const { url, alt } = req.body || {};

    if (!url) {
      return res.status(400).json({ message: "URL é obrigatória." });
    }

    // Get max order_index
    const maxOrder = await query(
      `SELECT MAX(order_index) as max_order FROM barber_images WHERE barber_id = $1`,
      [barberId]
    );

    const orderIndex = (maxOrder.rows[0]?.max_order || 0) + 1;

    const result = await query(
      `INSERT INTO barber_images (barber_id, url, thumbnail_url, alt, order_index)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [barberId, url, url, alt || "", orderIndex]
    );

    return res.status(201).json({ image: result.rows[0] });
  })
);

app.delete(
  "/api/admin/barbers/:barberId/images/:imageId",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const imageId = Number.parseInt(req.params.imageId, 10);

    const result = await query(
      `DELETE FROM barber_images WHERE id = $1`,
      [imageId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Imagem não encontrada." });
    }

    return res.json({ message: "Imagem deletada com sucesso." });
  })
);

app.put(
  "/api/admin/barbers/:barberId/images/:imageId/reorder",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const imageId = Number.parseInt(req.params.imageId, 10);
    const { order_index } = req.body || {};

    if (!Number.isInteger(order_index)) {
      return res.status(400).json({ message: "order_index inválido." });
    }

    const result = await query(
      `UPDATE barber_images SET order_index = $1 WHERE id = $2 RETURNING *`,
      [order_index, imageId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Imagem não encontrada." });
    }

    return res.json({ image: result.rows[0] });
  })
);

// ============================================================================
// BOOKING ENDPOINTS (ENHANCED)
// ============================================================================

app.post(
  "/api/appointments",
  asyncHandler(async (req, res) => {
    const { day, time, service, phone, name, email, barber_preference } =
      req.body || {};

    const normalizedDay = normalizeDay(day);
    const normalizedPhone = normalizePhoneInput(phone);
    const normalizedService = String(service || "").trim();

    if (
      !normalizedDay ||
      !isValidDayInCurrentMonth(normalizedDay)
    ) {
      return res
        .status(400)
        .json({ message: "Dia inválido para o mês atual." });
    }

    if (!isValidSlotTime(time)) {
      return res
        .status(400)
        .json({ message: "Horário inválido." });
    }

    if (!normalizedPhone || !normalizedService) {
      return res
        .status(400)
        .json({ message: "Telefone e serviço são obrigatórios." });
    }

    const serviceDuration = getServiceDuration(normalizedService);
    if (!serviceDuration) {
      return res.status(400).json({ message: "Serviço inválido." });
    }

    // Determine barber_id
    let barberId = null;
    if (barber_preference && barber_preference !== "indiferente") {
      const barber = await query(
        `SELECT id FROM barbers WHERE name = $1`,
        [barber_preference]
      );
      if (barber.rows.length > 0) {
        barberId = barber.rows[0].id;
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const insertBooking = await client.query(
        `INSERT INTO bookings (
          user_id, username, display_name, phone, service, duration_minutes,
          day, time, status, barber_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', $9)
        RETURNING *`,
        [
          req.user?.id || null,
          req.user?.email || email || "guest",
          name || "Cliente",
          normalizedPhone,
          normalizedService,
          serviceDuration,
          normalizedDay,
          String(time),
          barberId,
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        message: "Agendamento realizado com sucesso.",
        booking: insertBooking.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        return res
          .status(409)
          .json({ message: "Horário indisponível." });
      }
      throw error;
    } finally {
      client.release();
    }
  })
);

app.get(
  "/api/appointments",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const result =
      req.user.role === "admin"
        ? await query(
            `SELECT * FROM bookings ORDER BY created_at DESC LIMIT 100`
          )
        : await query(
            `SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.user.id]
          );

    return res.json({ bookings: result.rows });
  })
);

app.put(
  "/api/appointments/:id/status",
  authMiddleware,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const bookingId = Number.parseInt(req.params.id, 10);
    const { status } = req.body || {};

    const result = await query(
      `UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *`,
      [status, bookingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Agendamento não encontrado." });
    }

    return res.json({ booking: result.rows[0] });
  })
);

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error(err);

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Token inválido." });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expirado." });
  }

  return res
    .status(500)
    .json({ message: "Erro interno do servidor." });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function start() {
  try {
    await initDatabase();
    console.log("✓ Database initialized");

    app.listen(PORT, () => {
      console.log(`✓ Server listening on port ${PORT}`);
      console.log(`✓ Environment: ${NODE_ENV}`);
      console.log(`✓ API: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error("✗ Startup error:", error);
    process.exit(1);
  }
}

start();

module.exports = app;
