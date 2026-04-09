# 🚀 Guia Completo de Deploy - Evilazio Barbershop

## 📋 Sumário

- [Deploy no Railway](#deploy-no-railway)
- [Deploy no Heroku](#deploy-no-heroku)
- [Deploy em VPS](#deploy-em-vps)
- [Docker](#docker)
- [SSL/HTTPS](#ssl-https)
- [Backups](#backups)
- [Monitoramento](#monitoramento)

---

## 🚂 Deploy no Railway (Recomendado)

### Pré-requisitos
- Conta Railway (gratuita)
- Repositório GitHub

### Passos

1. **Conecte seu repositório**
   - Acesse https://railway.app
   - Clique "Create New" → "Project from GitHub Repo"
   - Selecione o repositório
   - Autorize o Railway no GitHub

2. **Railway cria automaticamente**
   - Serviço Node.js
   - Banco PostgreSQL
   - Variável `DATABASE_URL`

3. **Configure variáveis de ambiente**
   - Vá a Project Settings → Variables
   - Adicione:
   ```
   NODE_ENV=production
   PORT=3000
   JWT_SECRET=openssl rand -hex 32  # Gere com openssl
   REFRESH_TOKEN_SECRET=openssl rand -hex 32
   ADMIN_EMAIL=admin@evilazio.local
   ADMIN_PASSWORD=sua_senha_super_segura (min 12 chars)
   APP_TIMEZONE=America/Fortaleza
   ```

4. **Deploy automático**
   - Cada push no GitHub dispara novo deploy
   - Railway mostra logs em tempo real
   - Acesse seu app em `seu-app.up.railway.app`

5. **Conectar domínio próprio**
   - Vá a Project Settings → Domains
   - Clique "Generate Domain" ou "Custom Domain"
   - Configure DNS do seu domínio apontando para Railway

### Monitoramento no Railway
```
Deployments: Veja histórico e rollback se necessário
Logs: Acompanhe erros em tempo real
Usage: Monitore CPU, RAM, conexões
```

---

## 🦸 Deploy no Heroku

### Pré-requisitos
- Conta Heroku
- Heroku CLI instalado

### Passos

```bash
# 1. Login
heroku login

# 2. Crie a aplicação
heroku create seu-app-name

# 3. Crie o banco PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# 4. Configure variáveis
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
heroku config:set REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)
heroku config:set ADMIN_PASSWORD=sua_senha_super_segura
heroku config:set ADMIN_EMAIL=admin@evilazio.local

# 5. Deploy
git push heroku main

# 6. Veja logs
heroku logs --tail

# 7. Acesse
open https://seu-app-name.herokuapp.com
```

### Comandos úteis Heroku

```bash
# Ver variáveis
heroku config

# Ver logs
heroku logs --tail

# Reiniciar app
heroku dyno:restart

# Acessar shell remoto
heroku run bash

# Ver banco
heroku pg:info
```

---

## 🖥️ Deploy em VPS (AWS, DigitalOcean, Linode)

### Requisitos do Servidor
- Ubuntu 20.04+
- Node.js 18+
- PostgreSQL 12+
- Nginx (para proxy reverso)
- Certbot (para SSL)

### Instalação

```bash
# 1. Atualize sistema
sudo apt update && sudo apt upgrade -y

# 2. Instale Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Instale PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# 4. Instale Nginx
sudo apt install -y nginx

# 5. Instale Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx

# 6. Clone repositório
cd /var/www
sudo git clone https://github.com/seu-usuario/evilazio-barbershop.git
cd evilazio-barbershop
sudo npm install --omit=dev
```

### Configurar PostgreSQL

```bash
# Acesse PostgreSQL
sudo -i -u postgres psql

# Crie banco
CREATE DATABASE evilazio_barbershop;

# Crie usuário
CREATE USER evilazio WITH PASSWORD 'sua_senha_super_segura';

# Dê permissões
GRANT ALL PRIVILEGES ON DATABASE evilazio_barbershop TO evilazio;

# Saia
\q
```

### Configurar .env

```bash
cd /var/www/evilazio-barbershop
sudo nano .env
```

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://evilazio:sua_senha_super_segura@localhost:5432/evilazio_barbershop
JWT_SECRET=seu_secret_gerado_com_openssl
REFRESH_TOKEN_SECRET=seu_refresh_secret_gerado
ADMIN_EMAIL=admin@evilazio.local
ADMIN_PASSWORD=sua_senha_super_segura
APP_TIMEZONE=America/Fortaleza
```

### Configurar Nginx (Proxy Reverso)

```bash
# Crie arquivo de configuração
sudo nano /etc/nginx/sites-available/evilazio

```

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Ative o site
sudo ln -s /etc/nginx/sites-available/evilazio /etc/nginx/sites-enabled/

# Teste configuração
sudo nginx -t

# Reinicie Nginx
sudo systemctl restart nginx
```

### Configurar SSL com Certbot

```bash
# Gere certificado
sudo certbot certonly --nginx -d seu-dominio.com

# Certbot atualiza automaticamente Nginx com HTTPS
```

### Usar PM2 para manter app rodando

```bash
# Instale PM2 globalmente
sudo npm install -g pm2

# Inicie app com PM2
cd /var/www/evilazio-barbershop
pm2 start server-enhanced.js --name "evilazio"

# Salve configuração
pm2 save

# Configure para iniciar no boot
pm2 startup

# Veja logs
pm2 logs evilazio
```

### Monitoring e Logs

```bash
# Ver status com PM2
pm2 status

# Ver logs em tempo real
pm2 logs evilazio

# Ver estatísticas
pm2 monit
```

---

## 🐳 Docker

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copie package files
COPY package*.json ./

# Instale dependências produção
RUN npm ci --only=production

# Copie código
COPY . .

# Exponha porta
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: evilazio
      POSTGRES_PASSWORD: sua_senha
      POSTGRES_DB: evilazio_barbershop
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://evilazio:sua_senha@db:5432/evilazio_barbershop
      JWT_SECRET: seu_secret_aleatorio
      REFRESH_TOKEN_SECRET: seu_refresh_secret
      ADMIN_EMAIL: admin@evilazio.local
      ADMIN_PASSWORD: sua_senha_super_segura
    ports:
      - "3000:3000"
    depends_on:
      - db
    volumes:
      - ./public:/app/public

volumes:
  postgres_data:
```

### Usar Docker Compose

```bash
# Construir e iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f app

# Parar
docker-compose down

# Limpar tudo (cuidado!)
docker-compose down -v
```

---

## 🔐 SSL/HTTPS

### Opção 1: Certbot (Grátis, Let's Encrypt)

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# Gere certificado
sudo certbot certonly --nginx -d seu-dominio.com

# Renovação automática
sudo systemctl enable certbot.timer
```

### Opção 2: CloudFlare (Grátis, fácil)

1. Registre domínio em CloudFlare
2. Aponte nameservers
3. CloudFlare fornece SSL grátis automaticamente
4. Configure em Railway/Heroku/VPS apontando para CloudFlare

### Verificar SSL

```bash
# Teste seu HTTPS
curl -I https://seu-dominio.com

# Pontuação SSL
https://www.ssllabs.com/ssltest/
```

---

## 💾 Backups

### Railway
- Backups automáticos diários
- Retenção: 30 dias
- Acesse em Project Settings → Backups

### Heroku
- Backups automáticos "free" (limitado)
```bash
# Backup manual
heroku pg:backups:capture

# Liste backups
heroku pg:backups

# Restaure
heroku pg:backups:restore b001
```

### PostgreSQL Manual (VPS/Local)

```bash
# Backup completo
pg_dump -U evilazio evilazio_barbershop > backup_$(date +%Y%m%d).sql

# Compress
gzip backup_$(date +%Y%m%d).sql

# Restaure
psql -U evilazio evilazio_barbershop < backup_YYYYMMDD.sql

# Backup automático (cron)
# Adicione ao crontab:
0 2 * * * pg_dump -U evilazio evilazio_barbershop | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

### Upload de Backups para S3 (AWS)

```bash
# Instale AWS CLI
pip install awscli

# Configure credenciais
aws configure

# Script de backup automático
#!/bin/bash
pg_dump -U evilazio evilazio_barbershop | gzip | aws s3 cp - s3://seu-bucket/backups/db_$(date +%Y%m%d).sql.gz
```

---

## 📊 Monitoramento

### Ferramentas Recomendadas

1. **Sentry (Erro Tracking)**
```bash
npm install @sentry/node @sentry/tracing
```

```javascript
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

2. **UptimeRobot (Monitoramento de período de atividade)**
   - Acesse https://uptimerobot.com
   - Configure para verificar seu site a cada 5 minutos
   - Receba alertas via email/SMS

3. **CPU/RAM/Disco**
   - Railway: Dashboard automático
   - Heroku: `heroku ps:type`
   - VPS: `htop`, `df -h`

### Logs e Alertas

```bash
# VPS - Ver logs do app
pm2 logs evilazio

# VPS - Ver logs do sistema
sudo journalctl -u nginx
sudo journalctl -u postgresql

# Monitorar erros em tempo real
tail -f /var/log/syslog | grep -i error
```

---

## 🔄 Atualizar Produção

### No Railway/Heroku
```bash
git push origin main
# Deploy automático
```

### Em VPS
```bash
cd /var/www/evilazio-barbershop
git pull origin main
npm install --omit=dev
pm2 restart evilazio
```

### Com Docker
```bash
git pull origin main
docker-compose down
docker-compose build
docker-compose up -d
```

---

## ⚡ Performance

### Otimizações Implementadas
- ✅ Gzip compression
- ✅ Index no banco
- ✅ Query otimizadas
- ✅ Rate limiting
- ✅ Connection pooling

### Melhorias Futuras
- [ ] Redis para cache
- [ ] CDN para assets
- [ ] Image optimization (WebP)
- [ ] Preload DNS

---

##  🆘 Troubleshooting

### "App crashed"
```bash
# Verifique logs
pm2 logs  # VPS
heroku logs --tail  # Heroku

# Verifique variáveis de ambiente
echo $DATABASE_URL
echo $JWT_SECRET
```

### "Connection refused"
```bash
# Verifique se banco está rodando
pg_isready -h localhost

# Verifique porta
netstat -tuln | grep 5432
```

### "HTTPS mixed content"
Verifique que todas as requisições usam `https://` ou `//`

### "Out of memory"
```bash
# Aumente recursos (Railway/Heroku)
# VPS: Monitore com `free -h`

# Redimensione VM se necessário
# Limpe cache/logs antigos
find /var/log -type f -name "*.log" -mtime +30 -delete
```

---

## 📞 Suporte

- Railway Support: https://railway.app/support
- GitHub Issues: Issues no repositório
- Email: seu-email@example.com

---

**Documenting for production deployment** ✅
