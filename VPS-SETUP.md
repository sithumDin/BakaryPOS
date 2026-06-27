# VPS PostgreSQL Setup Guide

## 1. Install PostgreSQL on VPS

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql
```

Inside psql:
```sql
CREATE DATABASE bakarypos;
CREATE USER bakaryuser WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE bakarypos TO bakaryuser;
\q
```

## 2. .env file on the VPS

Create `.env` in the project root:

```env
DATABASE_URL="postgresql://bakaryuser:your_strong_password@localhost:5432/bakarypos"
JWT_SECRET="replace_with_a_long_random_secret_string"
NODE_ENV="production"
```

## 3. Install dependencies & set up DB

```bash
npm install
npx prisma generate
npx prisma migrate deploy
node scripts/seed-users.mjs
```

## 4. Build & start

```bash
npm run build
npm start
```

Or with PM2:
```bash
npm install -g pm2
pm2 start "npm start" --name bakarypos
pm2 save
pm2 startup
```

## 5. Useful commands

| Command | Purpose |
|---|---|
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed admin users |
| `npm run db:studio` | Open Prisma Studio (DB browser) |

## Default login credentials

| Username | Password | Role |
|---|---|---|
| admin | adminpassword123 | admin |
| sithum | sithumD | admin |
| dumindu | dunkudda | admin |
| sahan | sahansessi | admin |

**Change these passwords after first login.**
