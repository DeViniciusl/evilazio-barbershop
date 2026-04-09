# Evilazio Barbershop

Sistema de agendamento de barbearia com Node.js, Express e PostgreSQL.

## Setup

```bash
npm install
npm start
```

Configure as variáveis de ambiente em `.env` (copie de `.env.example`).

## Tecnologia

- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Frontend**: HTML/CSS/JavaScript
- **Segurança**: Helmet, Rate Limiting, Validação de entrada

## Funcionalidades

- Cadastro e autenticação de usuários
- Agendamento de serviços
- Painel administrativo com gerenciamento de VIP
- Pagamento presencial (sem integração online)
4. No terminal da hospedagem, execute:
   - npm install --omit=dev
   - npm start

## Deploy no Railway

### Pré-requisitos
- Conta no [railway.app](https://railway.app)
- Conta no GitHub

### Passos

1. **Conecte seu repositório GitHub ao Railway:**
   - Acesse [railway.app](https://railway.app)
   - Clique em "Create New" → "Project from GitHub Repo"
   - Selecione seu repositório `evilazio-barbershop`
   - Selecione branch `main`
   - Railway começará o deploy automaticamente

2. **Configure o PostgreSQL:**
   - No painel do seu projeto, clique em "+ Add"
   - Selecione "PostgreSQL"
   - Railway criará automaticamente a variável `DATABASE_URL`

3. **Configure as variáveis de ambiente:**
   - No painel do seu projeto, vá para **"Variables"**
   - Adicione as seguintes variáveis:
   ```
   NODE_ENV=production
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=sua_senha_muito_segura_aqui
   RESET_ADMIN_PASSWORD_ON_BOOT=false
   APP_TIMEZONE=America/Fortaleza
   SESSION_TTL_MS=43200000
   ```
   - ⚠️ **IMPORTANTE:** `DATABASE_URL` será criada automaticamente pelo Railway quando você adicionar PostgreSQL

4. **Deploy:**
   - Railway fará o deploy automaticamente quando você fizer `git push`
   - Acesse sua aplicação através da URL fornecida pelo Railway (ex: `seu-app-random.railway.app`)
   - Você verá o status do build em "Deployments"

5. **Testando em produção:**
   - Acesse `https://seu-url-railway.app/`
   - Teste o registro e login
   - Acesse `/admin.html` com as credenciais admin

### Troubleshooting Railway

| Erro | Solução |
|------|---------|
| `node: command not found` | ✅ Resolvido - Railway agora instala dependências via `railway.json` |
| `DATABASE_URL not set` | Adicione PostgreSQL no painel "Add" |
| `ADMIN_PASSWORD not provided` | Configure variáveis de ambiente no Railway |
| Build falha | Verifique se o repositório está public no GitHub |

## Rotas principais

- POST /api/register
- POST /api/login
- POST /api/bookings/create
- GET /api/bookings
- GET /api/schedule/day
- GET /api/me
- PUT /api/profile

## IMPORTANTE

Este sistema NÃO inclui processamento de pagamento online.
Não há integração com Mercado Pago, Stripe, PayPal ou similares.

O pagamento é 100% presencial, no local, com o atendente no dia do agendamento.
