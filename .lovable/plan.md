# Phase 1 Foundation — Build Plan

## ⚠️ Security First (do this BEFORE I build)

You pasted your **service role key** and **secret key** in plain chat. That chat is logged. Treat them as compromised:

1. Go to Supabase Dashboard → Project Settings → API → **Rotate** the `service_role` key and the new `sb_secret_...` key.
2. Then give me the **new** values through the secure secrets form I'll trigger (never paste secrets in chat again).

I will NOT hardcode these into the repo. They go into project secrets (env vars on the server) via the `add_secret` tool — you'll see a secure form.

Keys I'll request via secrets form:
- `SUPABASE_URL` = `https://nggaiqniweggifcjtoio.supabase.co`
- `VITE_SUPABASE_URL` = same
- `SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_hBHieKq-Cj0y1VwrSdH2Bg_mpjEZsim` (safe, publishable)
- `VITE_SUPABASE_PUBLISHABLE_KEY` = same
- `SUPABASE_SERVICE_ROLE_KEY` = **new rotated** service_role JWT

## Build Steps

1. **Install deps** — `@supabase/supabase-js`, `framer-motion`, `zod`, `react-hook-form`, `@hookform/resolvers`, `sonner` (already), fonts via Google Fonts CDN in `__root.tsx`.

2. **Supabase wiring** (`src/integrations/supabase/`):
   - `client.ts` — browser client (publishable key, persist session)
   - `client.server.ts` — admin client (service role, server-only)
   - `auth-middleware.ts` — `requireSupabaseAuth` for protected server fns
   - `auth-attacher.ts` — attaches bearer token to every server fn call
   - Register `attachSupabaseAuth` in `src/start.ts`

3. **SQL migration** — I generate ONE SQL file. You paste it into Supabase SQL Editor once. Includes:
   - `app_role` enum (`super_admin`, `cafe_owner`, `cafe_staff`, `customer`)
   - 11 tables: `profiles`, `user_roles`, `cafes`, `devices`, `customers`, `sessions`, `bookings`, `memberships`, `customer_memberships`, `staff_permissions`, `subscription_plans`, `contacts`
   - `has_role()` SECURITY DEFINER + `get_user_cafe_id()` helpers
   - GRANTs + RLS + policies per table
   - Trigger on `auth.users` insert → creates `profiles` row + default `customer` role
   - `updated_at` triggers

4. **Seed super admin** — server function (admin-guarded) that creates `giganexa2026@gmail.com` and assigns `super_admin` role. Triggered once from a hidden setup route, then locked.

5. **Design system** (`src/styles.css`):
   - Midnight base `oklch(0.12 0.03 270)`, electric cyan `oklch(0.72 0.18 200)`, magenta `oklch(0.65 0.25 340)`
   - Fonts: Orbitron (display), Space Grotesk (headings), Inter (body), JetBrains Mono (numbers/IDs)
   - Gradient, glow, glass tokens; motion easing curves
   - Reusable: `GlassCard`, `GlowButton`, `AnimatedGradient`, `ParticleField`, `MagneticCursor`

6. **Routes**:
   - `/` — Landing (hero w/ animated particles, features, pricing, stats counter, contact form → `contacts` table, footer). SEO head().
   - `/auth` — Split-screen sign in / sign up (email+password + Google). Role-based redirect.
   - `/_authenticated/route.tsx` — integration-managed auth gate
   - `/_authenticated/admin` — super admin shell (empty animated state)
   - `/_authenticated/cafe/$slug` — cafe owner shell
   - `/_authenticated/cafe/$slug/staff` — staff shell
   - `/_authenticated/portal` — customer shell
   - `/reset-password` — public, handles recovery token

7. **Mobile-native polish** — every page mobile-first 375px, bottom sheets on mobile, touch targets ≥44px, safe-area insets, 60fps animations, no layout shift.

## Out of scope (later phases)
CRUD inside dashboards, realtime live sessions, Razorpay, PWA manifest, React Native shell.

## What you do
1. **Rotate the two leaked keys in Supabase NOW.**
2. Approve this plan.
3. Paste the new keys into the secure secrets form I trigger.
4. Copy-paste one SQL file into Supabase SQL Editor.
5. Click the one-time "seed super admin" button I'll show you.

Everything else = me.