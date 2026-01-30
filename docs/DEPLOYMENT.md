# Deployment Guide

Deploy QueueDrop with Vercel (frontend) and Railway (backend + PostgreSQL).

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Vercel      │────▶│     Railway     │────▶│   PostgreSQL    │
│  React Frontend │     │   .NET API      │     │   (Railway)     │
│                 │◀────│   + SignalR     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
      HTTPS                  HTTPS                   Internal
```

---

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub Repo"**
3. Select the QueueDrop repository
4. Railway will detect the Dockerfile automatically

### 1.2 Add PostgreSQL

1. In your Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway automatically sets `DATABASE_URL` environment variable

### 1.3 Configure Environment Variables

In the Railway service settings, add:

```
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=${{Postgres.DATABASE_URL}}
Cors__AllowedOrigins__0=https://your-app.vercel.app
Vapid__PublicKey=<your-vapid-public-key>
Vapid__PrivateKey=<your-vapid-private-key>
Vapid__Subject=mailto:your@email.com
```

**Generate VAPID keys:**

```bash
npx web-push generate-vapid-keys
```

### 1.4 Deploy

Railway deploys automatically on push to main. First deploy runs migrations.

### 1.5 Get API URL

After deployment, Railway provides a URL like:

```
https://queuedrop-api-production.up.railway.app
```

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Import Project

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New..."** → **"Project"**
3. Import the QueueDrop repository

### 2.2 Configure Build Settings

| Setting          | Value           |
| ---------------- | --------------- |
| Framework Preset | Next.js         |
| Root Directory   | `src/client`    |
| Build Command    | `npm run build` |
| Output Directory | _(leave blank)_ |

### 2.3 Configure Environment Variables

In Vercel Project Settings → Environment Variables, add:

| Variable      | Value                                         |
| ------------- | --------------------------------------------- |
| `BACKEND_URL` | `https://YOUR-RAILWAY-URL.up.railway.app`     |

The `BACKEND_URL` is used by Next.js rewrites to proxy `/api/*` and `/hubs/*` requests to your Railway backend.

### 2.4 Deploy

Push to main. Vercel deploys automatically.

---

## Step 3: Update CORS

After getting your Vercel URL (e.g., `https://queuedrop.vercel.app`):

1. Go to Railway → Your service → Variables
2. Update `Cors__AllowedOrigins__0` with your Vercel URL
3. Redeploy the service

---

## Environment Variables Reference

### Railway (Backend)

| Variable                               | Description           | Example                        |
| -------------------------------------- | --------------------- | ------------------------------ |
| `ASPNETCORE_ENVIRONMENT`               | Environment name      | `Production`                   |
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection | `${{Postgres.DATABASE_URL}}`   |
| `Cors__AllowedOrigins__0`              | Frontend URL          | `https://queuedrop.vercel.app` |
| `Cors__AllowedOrigins__1`              | Custom domain (if any)| `https://queuedrop.me`         |
| `Vapid__PublicKey`                     | Web Push public key   | `BEl62i...`                    |
| `Vapid__PrivateKey`                    | Web Push private key  | `UGXsNQ...`                    |
| `Vapid__Subject`                       | Contact email         | `mailto:you@example.com`       |

### Vercel (Frontend)

| Variable      | Description              | Example                                       |
| ------------- | ------------------------ | --------------------------------------------- |
| `BACKEND_URL` | Railway backend URL      | `https://queuedrop-api.up.railway.app`        |

---

## Verify Deployment

### Backend Health Check

```bash
curl https://your-railway-url.up.railway.app/health
# Should return: {"status":"healthy","timestamp":"..."}
```

### Frontend

1. Visit `https://your-vercel-url.vercel.app`
2. Click "Try Demo Queue"
3. Join queue and verify position updates in real-time

### SignalR WebSocket

Open browser DevTools → Network → WS tab. Should see active WebSocket connection to `/hubs/queue`.

---

## Troubleshooting

### CORS Errors

- Verify `Cors__AllowedOrigins__0` matches your Vercel URL exactly
- Check for trailing slashes (should not have one)
- Redeploy Railway after changing CORS settings

### Database Connection Failed

- Verify PostgreSQL service is running in Railway
- Check `ConnectionStrings__DefaultConnection` uses `${{Postgres.DATABASE_URL}}`
- Railway auto-formats the connection string for .NET

### SignalR Connection Failed

- Vercel rewrites must include `/hubs/(.*)`
- Railway must allow WebSocket connections (enabled by default)
- Check browser console for connection errors

### Migrations Not Running

- Verify `RunMigrationsOnStartup=true` in Production settings
- Check Railway logs for migration output
- Manual migration: `dotnet ef database update` with production connection string

---

## Custom Domain

### Vercel

1. Project Settings → Domains → Add
2. Configure DNS CNAME to `cname.vercel-dns.com`

### Railway

1. Service Settings → Networking → Custom Domain
2. Configure DNS CNAME to provided Railway domain

Update CORS settings after adding custom domain.

---

## Estimated Costs

| Service     | Free Tier             | Paid                       |
| ----------- | --------------------- | -------------------------- |
| **Vercel**  | 100GB bandwidth/month | $20/month Pro              |
| **Railway** | $5 credit/month       | ~$5-10/month for small app |
| **Total**   | Free for hobby        | ~$25/month                 |

Railway free tier is sufficient for demo/portfolio use.
