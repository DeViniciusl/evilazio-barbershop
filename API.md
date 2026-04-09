# 📚 API Documentation - Evilazio Barbershop

## Base URL
```
http://localhost:3000/api
Producer: Authorization: Bearer {accessToken}
```

## Autenticação

Todos os endpoints protegidos requerem:
```
Header: Authorization: Bearer {accessToken}
```

---

## 🔑 Autenticação

### POST /auth/register
Registrar novo usuário

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SenhaSegura123",
    "name": "João Silva",
    "phone": "(85) 9 9999-9999"
  }'
```

**Response (201):**
```json
{
  "message": "Cadastro realizado com sucesso."
}
```

**Erros:**
- 400: Email inválido ou senha muito curta
- 409: Email já cadastrado

---

### POST /auth/login
Fazer login

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SenhaSegura123"
  }'
```

**Response (200):**
```json
{
  "message": "Login realizado com sucesso.",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "João Silva",
    "role": "user"
  }
}
```

**Cookies:** `refreshToken` (httpOnly)
**Erros:** 401: Credenciais inválidas

---

### POST /auth/refresh
Renovar access token

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "seu_refresh_token"}'
```

**Response (200):**
```json
{
  "accessToken": "novo_access_token...",
  "refreshToken": "novo_refresh_token..."
}
```

---

### POST /auth/logout
Fazer logout (protegido)

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer {token}"
```

**Response (200):**
```json
{
  "message": "Logout realizado com sucesso."
}
```

---

## 💈 Barbeiros

### GET /barbers
Listar todos os barbeiros (público)

**Request:**
```bash
curl http://localhost:3000/api/barbers
```

**Response (200):**
```json
{
  "barbers": [
    {
      "id": 1,
      "name": "Evilázio",
      "bio": "Bio de Evilázio",
      "specialty": "Cortes p profissionais",
      "contact": "",
      "photo_url": null
    },
    {
      "id": 2,
      "name": "Marcos",
      "bio": "Bio de Marcos",
      "specialty": "Cortes profissionais",
      "contact": "@marcos"
    }
  ]
}
```

---

### GET /barbers/:id
Obter perfil do barbeiro com carousel de imagens (público)

**Request:**
```bash
curl http://localhost:3000/api/barbers/1
```

**Response (200):**
```json
{
  "barber": {
    "id": 1,
    "name": "Evilázio",
    "bio": "...",
    "specialty": "...",
    "contact": ""
  },
  "images": [
    {
      "id": 1,
      "url": "https://s3.../image1.jpg",
      "thumbnail_url": "https://s3.../thumb1.jpg",
      "alt": "Corte profissional",
      "order_index": 0
    }
  ]
}
```

---

### POST /admin/barbers
Criar novo barbeiro (admin)

**Request:**
```bash
curl -X POST http://localhost:3000/api/admin/barbers \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Novo Barbeiro",
    "bio": "Descrição do barbeiro",
    "specialty": "Cortes modernos",
    "contact": "@barbeiro_insta"
  }'
```

**Response (201):**
```json
{
  "barber": {
    "id": 3,
    "name": "Novo Barbeiro",
    "bio": "...",
    "specialty": "...",
    "contact": "...",
    "photo_url": null,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

---

### PUT /admin/barbers/:id
Editar barbeiro (admin)

**Request:**
```bash
curl -X PUT http://localhost:3000/api/admin/barbers/1 \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Nova bio",
    "specialty": "Novas especialidades"
  }'
```

**Response (200):**
```json
{
  "barber": {
    "id": 1,
    "name": "Evilázio",
    "bio": "Nova bio",
    "specialty": "Novas especialidades",
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

---

### POST /admin/barbers/:barberId/images
Adicionar imagem ao carrossel do barbeiro (admin)

**Request:**
```bash
curl -X POST http://localhost:3000/api/admin/barbers/1/images \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://s3-bucket.../image.jpg",
    "alt": "Corte degradê do Evilázio"
  }'
```

**Response (201):**
```json
{
  "image": {
    "id": 1,
    "barber_id": 1,
    "url": "https://s3...",
    "thumbnail_url": "https://s3...",
    "alt": "Corte degradê",
    "order_index": 0,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

---

### DELETE /admin/barbers/:barberId/images/:imageId
Deletar imagem do carrossel (admin)

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/admin/barbers/1/images/1 \
  -H "Authorization: Bearer {admin_token}"
```

**Response (200):**
```json
{
  "message": "Imagem deletada com sucesso."
}
```

---

## 🖼️ Portfólio

### GET /portfolio
Listar portfólios publicados (público, paginado)

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10, max: 10)

**Request:**
```bash
curl "http://localhost:3000/api/portfolio?page=1&limit=10"
```

**Response (200):**
```json
{
  "portfolios": [
    {
      "id": 1,
      "title": "Cortes Clássicos",
      "description": "Coleção de cortes clássicos...",
      "created_at": "2024-01-15T10:00:00Z",
      "thumbnail": {
        "id": 5,
        "url": "https://s3.../thumb.jpg",
        "alt": "Corte clássico"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5
  }
}
```

---

### GET /portfolio/:id
Obter portfólio completo com todas as imagens (público)

**Request:**
```bash
curl http://localhost:3000/api/portfolio/1
```

**Response (200):**
```json
{
  "portfolio": {
    "id": 1,
    "title": "Cortes Clássicos",
    "description": "Coleção de cortes clássicos...",
    "published": true,
    "created_at": "2024-01-15T10:00:00Z"
  },
  "images": [
    {
      "id": 1,
      "url": "https://s3.../image1.jpg",
      "thumbnail_url": "https://s3.../thumb1.jpg",
      "alt": "Corte 1",
      "order_index": 0
    },
    {
      "id": 2,
      "url": "https://s3.../image2.jpg",
      "alt": "Corte 2",
      "order_index": 1
    }
  ]
}
```

---

### POST /admin/portfolio
Criar novo portfólio (admin)

**Request:**
```bash
curl -X POST http://localhost:3000/api/admin/portfolio \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cortes de Verão",
    "description": "Novos cortes para a estação"
  }'
```

**Response (201):**
```json
{
  "portfolio": {
    "id": 2,
    "title": "Cortes de Verão",
    "description": "...",
    "published": false,
    "created_by": 1,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

---

### PUT /admin/portfolio/:id
Editar portfólio (admin)

**Request:**
```bash
curl -X PUT http://localhost:3000/api/admin/portfolio/1 \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Novo título",
    "description": "Nova descrição",
    "published": true
  }'
```

**Response (200):**
```json
{
  "portfolio": {
    "id": 1,
    "title": "Novo título",
    "description": "Nova descrição",
    "published": true,
    "updated_at": "2024-01-15T11:00:00Z"
  }
}
```

---

### DELETE /admin/portfolio/:id
Deletar portfólio (admin)

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/admin/portfolio/1 \
  -H "Authorization: Bearer {admin_token}"
```

**Response (200):**
```json
{
  "message": "Portfólio deletado com sucesso."
}
```

---

### POST /admin/portfolio/:portfolioId/images
Adicionar imagem ao portfólio (admin)

**Request:**
```bash
curl -X POST http://localhost:3000/api/admin/portfolio/1/images \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://s3.../portfolio-image.jpg",
    "alt": "Corte clássico de exemplo"
  }'
```

**Response (201):**
```json
{
  "image": {
    "id": 1,
    "portfolio_id": 1,
    "url": "https://s3...",
    "thumbnail_url": "https://s3...",
    "alt": "Corte clássico",
    "order_index": 0
  }
}
```

---

### DELETE /admin/portfolio/images/:imageId
Deletar imagem do portfólio (admin)

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/admin/portfolio/images/1 \
  -H "Authorization: Bearer {admin_token}"
```

**Response (200):**
```json
{
  "message": "Imagem deletada com sucesso."
}
```

---

## 📅 Agendamentos

### POST /appointments
Criar novo agendamento (público ou autenticado)

**Request:**
```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "phone": "(85) 9 9999-9999",
    "service": "corte_social",
    "barber_preference": "Evilázio",
    "day": "15",
    "time": "14:00"
  }'
```

**Serviços válidos:**
- corte_social (30 min)
- corte_tradicional (30 min)
- corte_degrade (35 min)
- corte_navalhado (40 min)
- barba (15 min)
- sobrancelha (10 min)
- pezinho (20 min)
- corte_barba (45 min)
- corte_barba_sobrancelha (50 min)

**Preferência de barbeiro:**
- "Evilázio"
- "Marcos"
- "indiferente"

**Response (201):**
```json
{
  "message": "Agendamento realizado com sucesso.",
  "booking": {
    "id": 1,
    "user_id": null,
    "username": "guest",
    "display_name": "João Silva",
    "phone": "(85) 9 9999-9999",
    "service": "corte_social",
    "duration_minutes": 30,
    "day": "15",
    "time": "14:00",
    "status": "confirmed",
    "barber_id": 1,
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

**Erros:**
- 400: Dados inválidos ou horário no passado
- 409: Horário já ocupado

---

### GET /appointments
Listar agendamentos (protegido)
- Usuários: veem apenas seus agendamentos
- Admin: vê todos

**Request:**
```bash
curl http://localhost:3000/api/appointments \
  -H "Authorization: Bearer {token}"
```

**Response (200):**
```json
{
  "bookings": [
    {
      "id": 1,
      "user_id": 1,
      "username": "joao",
      "display_name": "João Silva",
      "phone": "(85) 9 9999-9999",
      "service": "corte_social",
      "day": "15",
      "time": "14:00",
      "status": "confirmed",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### PUT /appointments/:id/status
Atualizar status do agendamento (admin)

**Request:**
```bash
curl -X PUT http://localhost:3000/api/appointments/1/status \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

**Status válidos:**
- confirmed
- completed
- cancelled
- pending

**Response (200):**
```json
{
  "booking": {
    "id": 1,
    "status": "completed",
    "updated_at": "2024-01-15T16:00:00Z"
  }
}
```

---

## ❌ Error Responses

**Formato padrão:**
```json
{
  "message": "Descrição do erro"
}
```

**Possíveis status codes:**
- 200: Sucesso
- 201: Recurso criado
- 400: Requisição inválida
- 401: Não autenticado
- 403: Não autorizado (role insuficiente)
- 404: Recurso não encontrado
- 409: Conflito (ex: email duplicado, horário ocupado)
- 500: Erro interno do servidor

---

## 🔒 Rate Limiting

- `/api/auth/*`: 20 requisições por 15 minutos
- `/api/*`: 500 requisições por 15 minutos

**Response ao exceder limite (429):**
```json
{
  "message": "Muitas requisições. Tente novamente em alguns minutos."
}
```

---

## 📋 Horários Disponíveis

- 08:00 até 19:00
- Slot de 1 hora cada
- Validação automática de double booking

---

**Última atualização:** Janeiro 2024
