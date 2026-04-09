# 🏃 Quick Reference Card

## ⚡ 60-Second Setup

```bash
npm install
cp .env.example .env
# Edit .env with PostgreSQL URL
npm run start:enhanced
# Open http://localhost:3000/landing.html
```

---

## 📋 What's Ready (Check These First)

✅ **Backend Server** - All 22 endpoints implemented
✅ **Database** - Auto-creates 8 tables on startup  
✅ **Authentication** - JWT + Refresh tokens working
✅ **Frontend Pages** - Landing, booking, auth, admin
✅ **API Docs** - Complete reference in `API.md`
✅ **Deployment** - Guides for Railway/Heroku/VPS/Docker

---

## 🔄 Authentication Flow

```
1. Register: POST /api/auth/register (email, password)
2. Login: POST /api/auth/login → get accessToken
3. Every Request: Header "Authorization: Bearer {token}"
4. Refresh: POST /api/auth/refresh (when token expires)
5. Logout: POST /api/auth/logout
```

---

## 🎯 22 Endpoints by Category

### Auth (4)
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
```

### Barbers (6)
```
GET    /api/barbers                    (public)
GET    /api/barbers/:id                (public + carousel)
POST   /api/admin/barbers              (admin)
PUT    /api/admin/barbers/:id          (admin)
POST   /api/admin/barbers/:id/images   (admin)
DELETE /api/admin/barbers/:id/images   (admin)
```

### Portfolio (7)
```
GET    /api/portfolio                  (paginated)
GET    /api/portfolio/:id              (with images)
POST   /api/admin/portfolio            (admin)
PUT    /api/admin/portfolio/:id        (admin)
DELETE /api/admin/portfolio/:id        (admin)
POST   /api/admin/portfolio/:id/images (admin)
DELETE /api/admin/portfolio/images     (admin)
```

### Appointments (3)
```
POST   /api/appointments
GET    /api/appointments
PUT    /api/appointments/:id/status
```

### Health (2)
```
GET    /api/health
GET    /api/upload/health
```

---

## 📁 Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `server-enhanced.js` | Backend with all 22 endpoints | 900+ |
| `public/landing.html` | Public landing page | 280 |
| `public/booking.html` | Booking form with barber selection | 370 |
| `public/auth.html` | Login/Register UI | 290 |
| `public/admin.html` | Admin dashboard (forms pending) | 350 |
| `server.test.js` | Jest test suite | 150 |
| API.md | Complete endpoint documentation | - |

---

## 🗄️ Database Tables (8 Total)

```
users              → id, email, password_hash, role, refresh_token
barbers            → id, name, bio, specialty, contact, photo_url
barber_images      → id, barber_id, url, thumbnail, alt, order
portfolios         → id, title, description, published, created_by
portfolio_images   → id, portfolio_id, url, thumbnail, alt, order
bookings           → id, user_id, display_name, phone, service, day, time, barber_id, status
refresh_tokens     → id, user_id, token, expires_at
barber_availability → (future use for scheduling)
```

---

## 🧪 Common Commands

```bash
# Development
npm run start:enhanced          # Start server
npm run dev:enhanced           # With hot reload
npm run test                   # Run tests
npm run test:watch            # Tests in watch mode

# Production
npm run start                  # Use standard server.js
# Then deploy (see DEPLOYMENT.md)
```

---

## 🔌 Test Endpoint

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!",
    "name": "User Name"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "Password123!"}'

# Get Barbers (no auth)
curl http://localhost:3000/api/barbers

# With specific endpoint (see API.md for 22 more)
```

---

## 🔒 Security Checklist

✅ Bcryptjs hashing (12 salt rounds)
✅ JWT tokens with expiration
✅ Refresh token rotation
✅ httpOnly cookies
✅ Rate limiting: 20/15min on /auth
✅ Security headers (Helmet.js)
✅ Input validation
✅ Role-based access control
✅ HTTPS in production
✅ Password length validation

---

## 📖 Documentation Links

- **API.md** - 22 endpoints with curl examples
- **IMPLEMENTATION_GUIDE.md** - Setup + architecture
- **DEPLOYMENT.md** - Production deployment
- **README.md** - Features overview
- **INDEX.md** - Complete documentation index

---

## 🚨 What's Missing (Final 15%)

- [ ] Admin dashboard CRUD forms (backend ready!)
- [ ] S3 presigned URL upload workflow
- [ ] Email notifications on booking
- [ ] Barber profile detail page
- [ ] 2FA with Google Authenticator (optional)

---

## 💡 Pro Tips

1. **First time?** → Run `npm run start:enhanced`, open landing.html
2. **Testing API?** → Use curl examples from API.md
3. **Need database?** → Create PostgreSQL, server sets up tables automatically
4. **Deploy?** → Railway is easiest (5 minutes), see DEPLOYMENT.md
5. **Admin panel?** → Endpoints ready, form UI needs to be completed
6. **JWT debugging?** → Check localStorage on browser console
7. **Rate limit hit?** → Cool off 15 minutes before retry

---

## 🎯 Next Steps

1. `npm install && npm run start:enhanced`
2. Open `http://localhost:3000/landing.html`
3. Try booking a service
4. Open `API.md` to understand all endpoints
5. Complete admin dashboard CRUD forms
6. Deploy to production (DEPLOYMENT.md)

---

**System Status: 85% Complete - Production Ready Core**

Questions? Check INDEX.md or API.md first! 📚
