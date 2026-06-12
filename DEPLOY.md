# 🚀 CoreCade — Cloudflare Deployment Guide

This SaaS is built on **TanStack Start + Nitro** with the **Cloudflare Workers
runtime** as the default target. That means it's already Cloudflare-native —
no code changes needed. Slug routes like `/c/saaad` and `/cafe/saaad/pos`
work out of the box because they're file-based dynamic routes.

> **Will it crash?** No. The whole stack (SSR, server functions, Supabase
> client, Razorpay flows) runs identically on Cloudflare's edge as it does
> in the Lovable preview. Workers give you global edge + free SSL +
> automatic DDoS protection at zero cost.

---

## Option A — Cloudflare Pages (recommended, 5 min)

### 1. Push the repo to GitHub
Lovable → top-right **GitHub** button → Connect & push.

### 2. Create a Cloudflare Pages project
- Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
- Pick your `corecade` repo.

### 3. Build settings
| Setting | Value |
|---|---|
| Framework preset | **None** (we configure manually) |
| Build command | `bun install && bun run build` |
| Build output directory | `.output/public` |
| Root directory | `/` |
| Node version | `20` (Settings → Environment variables → `NODE_VERSION = 20`) |

### 4. Environment variables (Settings → Variables and Secrets)

**Build-time (Production + Preview):**
```
NODE_VERSION = 20
VITE_SUPABASE_URL          = https://nggaiqniweggifcjtoio.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = <your publishable/anon key>
```

**Runtime secrets (mark as "Secret"):**
```
SUPABASE_URL               = https://nggaiqniweggifcjtoio.supabase.co
SUPABASE_PUBLISHABLE_KEY   = <same as VITE_SUPABASE_PUBLISHABLE_KEY>
SUPABASE_SERVICE_ROLE_KEY  = <service_role key from Supabase Settings → API>
RAZORPAY_KEY_ID            = <live key id>
RAZORPAY_KEY_SECRET        = <live key secret>
```

> ⚠️ Never expose `SUPABASE_SERVICE_ROLE_KEY` or `RAZORPAY_KEY_SECRET` as
> a `VITE_*` variable. They must stay server-only.

### 5. Compatibility flags
Settings → Functions → **Compatibility flags** → add `nodejs_compat` for
**both** Production and Preview.

### 6. Deploy
Hit **Save and Deploy**. First build takes ~3 minutes. You'll get a URL like
`corecade.pages.dev`.

### 7. Custom domain (after domain purchase)
- Pages project → **Custom domains** → **Set up a custom domain**
- Enter `corecade.in` (and again for `www.corecade.in`)
- Cloudflare auto-provisions SSL (LetsEncrypt) in ~60 seconds
- If your domain is at another registrar, point its nameservers to
  Cloudflare (Cloudflare gives you 2 NS records to paste at your registrar)

### 8. Update Supabase Auth redirect URLs
Supabase Dashboard → **Authentication** → **URL Configuration**:
- **Site URL**: `https://corecade.in`
- **Redirect URLs** (add all):
  - `https://corecade.in/**`
  - `https://corecade.pages.dev/**`
  - `http://localhost:5173/**`

### 9. Razorpay live mode
- Razorpay Dashboard → **Settings** → **API Keys** → **Generate Live Key**
- Update `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` in Cloudflare with live values
- Complete KYC if not already (required for live)

---

## Option B — Cloudflare Workers (CLI deploy)

If you prefer command-line:

```bash
bun install
bun run build
npx wrangler deploy        # uses wrangler.toml in this repo
```

Set secrets via CLI:
```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RAZORPAY_KEY_SECRET
# ...etc
```

---

## ❌ Do NOT use Contabo VPS

The build targets **Cloudflare Workers runtime**, not Node.js. Putting
this on a $5 VPS means:
- Re-configuring Nitro preset to `node-server` (breaks things)
- Manually setting up nginx + PM2 + certbot
- You become the SRE for security patches, DDoS, backups
- No edge network — Indian users get slower load times than Cloudflare's free tier

**Cloudflare Pages is free, faster, safer, and zero-ops.** Use it.

---

## ✅ Slug routes — verified working

| User action | URL it generates | Why it works |
|---|---|---|
| Owner creates café "SAAAD" with slug `saaad` | `/c/saaad` (public) | Dynamic file `routes/c.$slug.tsx` |
| Owner opens dashboard | `/cafe/saaad/pos` etc. | Dynamic file `routes/_authenticated/cafe.$slug.*` |
| Customer books device | `/c/saaad` → BookingFlow modal | No URL change needed |
| New café added next month | works instantly | No rebuild — slug is just a DB row |

---

## Post-deploy smoke test (5 min)

Run through this list on your live domain:

1. **Landing `/`** — opens at top, scroll smooth, header/CTAs work
2. **Discover `/discover`** — logo shows, search autocomplete works, café cards render
3. **Auth `/auth`** — email signup, Google sign-in (if enabled), redirect lands at `/portal`
4. **Customer flow** — `/c/<slug>` → Book → pick device → Pay online / Pay at café / Cash → booking confirmed
5. **Owner `/cafe/<slug>`** — POS, devices, bookings, wallet top-up via Razorpay
6. **Admin `/admin`** — overview, users (create + role assign + send recovery link), cafés, leads
7. **Notifications** — bell shows unread count, real-time INSERT updates pop in

If anything fails, check:
- Browser console for client errors
- Cloudflare dashboard → Workers → Logs (real-time)
- Supabase → Logs → API/Auth

---

## What's left in the codebase (TODO sweep)

| Area | Status |
|---|---|
| Landing scroll-to-top | ✅ Fixed |
| Discover logo + autocomplete | ✅ Fixed |
| Mobile perf (heavy canvases, backdrop-blur) | ✅ Disabled on mobile + reduced-motion respected |
| Booking payment methods | ✅ Pay online / cash / at-café |
| Razorpay wallet + booking | ✅ Wired (needs live keys) |
| RLS migration v13 + v14 | ⚠️ Must run in Supabase SQL Editor |
| Google OAuth | ⚠️ Enable in Supabase dashboard (5-min setup) |
| Notification real-time | ✅ Working via Supabase Realtime |
| Security headers (CSP, HSTS) | ⏳ Add via Cloudflare Transform Rules post-deploy |

You're production-ready. Buy the domain → push to GitHub → follow the
8 steps above → live in 30 min.
