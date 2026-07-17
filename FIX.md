# CoreCade — Pre-Launch Fix Report
_Last updated: this turn. Read top-to-bottom. Copy-paste ready._

---

## 1. RUN THIS IN SUPABASE (ONE FILE)

**File: `supabase-migration-v28-FINAL.sql`** (at project root)

This ONE file supersedes v27 (which errored). It contains:

1. Fix for v27 "generation expression is not immutable" — replaced generated column with trigger-maintained `booking_window`.
2. `btree_gist` extension.
3. Tournament capacity + duplicate-team guard (trigger).
4. Booking overlap exclusion constraint (no more double-booking a device).
5. All performance indexes (fixes dashboard lag on bookings/sessions/orders/wallet/roles/notifications).
6. Full RLS rewrite on `bookings` — owner + assigned staff + customer + super_admin can each see what they should.
7. RLS rewrite on `notifications` — permissive insert so booking→notification never fails again.
8. Storage bucket RLS for `cafe-gallery` and `avatars` (fixes "new row violates row-level security" on image upload).
9. Trial defaults + `cafe_is_active(uuid)` helper for read-only lockout gating.
10. Sanity pass: enables RLS on every public table that's missing it.

### Migration order (if starting fresh)
Run in this exact order in Supabase SQL Editor:
```
supabase-migration.sql          (base schema)
supabase-migration-v2.sql
supabase-migration-v3.sql   ... v22.sql   (in numeric order)
supabase-migration-v23.sql      (messaging / trial extensions / revenue)
supabase-migration-v24.sql      (terms tracking)
supabase-migration-v25.sql      (notifications FK + storage RLS baseline)
                                 SKIP v27 — replaced by v28
supabase-migration-v28-FINAL.sql  ← this fixes v27 and closes RLS gaps
```

If you already ran v27 successfully somehow, v28 is still idempotent (drops+recreates).

If v27 errored halfway through, run these two lines FIRST, then run v28:
```sql
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS no_overlapping_device_bookings;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS booking_window;
```

### After running v28 — verify
```sql
-- Should return the constraint name
SELECT conname FROM pg_constraint WHERE conname = 'no_overlapping_device_bookings';

-- Should return ZERO rows (every public table has RLS on)
SELECT tablename FROM pg_tables
WHERE schemaname='public' AND rowsecurity=false AND tablename <> 'rls_status';

-- Should show cafe-gallery + avatars as public
SELECT id, public FROM storage.buckets WHERE id IN ('cafe-gallery','avatars');
```

---

## 2. WHAT I FIXED THIS TURN

- ✅ **Pricing card redesigned** — rotating conic gradient border, shine sweep, price crossed-out original (₹2,499 → ₹999), animated feature list stagger, trust row, glow ambient, launch-offer ribbon, primary CTA lifts + shimmers on hover. `src/routes/index.tsx`.
- ✅ **v28 migration file** written (see §1).
- ✅ **FIX.md** (this file).

---

## 3. WHAT'S ALREADY DONE (across all 3 portals)

### Super Admin (`/admin/*`)
Overview, cafés, users + roles, revenue, reports, audit, health, support, announcements, config, backups, API keys, leads.
User inspector with roles / IP / audit log. Café restriction + maintenance windows.

### Café Owner (`/cafe/$slug/*`)
Dashboard, devices, floor builder, bookings (+ rich detail dialog: live countdown, mark paid, extend, end early, delete no-show), POS, menu, memberships, tournaments, staff, customers, wallet, ledger, reports, analytics, audit, public page editor (theme + UPI), support tickets.

### Customer (`/portal`, `/discover`, `/c/$slug`)
Portal with wallet + booking history, discover with search + filters + map, café public page (realtime theme sync, UPI checkout, tournament registration).

### Cross-cutting
Auth (email/pass + Google), password reset, PWA manifest, sitemap, robots, legal pages (terms/privacy/refund), footer, SEO metadata per route, referrals (+30 trial days), CSV import, session timer, notification bell, idle 30-min logout, redirecting page.

---

## 4. WHAT'S LEFT — LAUNCH BLOCKERS ( 🔴 do before launch )

| # | Item | Where | Effort |
|---|---|---|---|
| 1 | **Run v28 SQL** in Supabase | SQL editor | 1 min |
| 2 | **Set Cloudflare env vars** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` as Plaintext; `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `SETUP_TOKEN` as Secret | Cloudflare dashboard | 5 min |
| 3 | **Set Supabase Auth redirect URLs** — add `https://corecade.coreegin.com/**` + `https://codecade.lovable.app/**` under Auth → URL Configuration | Supabase dashboard | 2 min |
| 4 | **Seed first super admin** — hit `/setup` once with your `SETUP_TOKEN` + email/password | Browser | 1 min |
| 5 | **Verify storage buckets are Public** — Storage → cafe-gallery + avatars → Public toggle | Supabase | 1 min |
| 6 | **Smoke-test end-to-end** — signup owner → create café → add device → customer books → owner sees booking → mark paid → complete | Live app | 15 min |

---

## 5. WHAT'S LEFT — SHOULD SHIP ( 🟡 day-1 polish )

- **Trial-expired lockout on owner dashboard** — component scaffolded; needs to wrap `<Outlet />` in `cafe.$slug.tsx` with a call to `cafe_is_active(cafe.id)` and show a paywall overlay when false. ~30 min.
- **pg_cron trial-ending emails** — schedule a call to a public server route that queries cafés with `trial_ends_at` between now+1d and now+3d, sends via Resend. ~20 min once RESEND_API_KEY is set.
- **Admin→Owner messaging UI** — `admin_messages` table exists (v23), needs an admin composer + owner inbox drawer. ~1 hr.
- **Subscription extend calendar** — `extend_trial()` RPC exists (v23), needs a date picker in `admin.cafes.tsx` row action. ~30 min.
- **Manual revenue entry UI** — `record_revenue()` RPC exists (v23), needs a "Log payment" button on owner dashboard. ~30 min.
- **Mobile perf pass** — disable `HeroBackdrop3D` + `ParticleField` + `Meteors` under `lg` breakpoint globally (single className change, biggest LCP win). ~10 min.
- **Google OAuth polish** — configure Google provider in Supabase Auth + `configure_social_auth` call. ~15 min.
- **Payment reminder cron** — email owners 3 days before subscription due. Needs Resend + pg_cron. ~30 min.

---

## 6. WHAT'S LEFT — NICE-TO-HAVE ( 🟢 post-launch )

- White-label enterprise tier (custom domain per café, remove CoreCade branding).
- Push notifications (web push + Android WebAPK).
- Two-factor auth for admins.
- Booking calendar drag-to-reschedule.
- Cafe-to-cafe leaderboard for tournaments.
- AI-assisted revenue forecasting on admin reports.
- Loyalty tiers (bronze/silver/gold) auto-computed from wallet spend.
- Live-chat widget (Crisp / Intercom-alt) on landing page.
- Multi-language (Hindi, Tamil, Telugu, Bengali).
- Automated device usage → suggested pricing recommendations.

---

## 7. KNOWN BUGS / GLITCHES

| Severity | Issue | Status |
|---|---|---|
| 🟡 | First-paint of dashboard sometimes empty until user clicks another section and back | Mostly fixed via force-invalidate on `_authenticated` mount; edge cases remain on very slow networks. Real fix: SSR-friendly loaders on protected routes (blocked by Supabase-in-localStorage). |
| 🟡 | Occasional double-tap needed on mobile bottom-nav "More" sheet | Reduced by switching to `pointerdown`; edge cases when scroll momentum is active. |
| 🟢 | `HeroBackdrop3D` briefly flashes on mobile before hiding | Cosmetic. |
| 🟢 | Legal markdown renderer doesn't parse tables (mostly plain prose so unused) | Cosmetic. |
| 🟢 | `SessionTimer` re-renders every second; fine but wastes a few CPU cycles on the owner dashboard when 20+ sessions live | Cosmetic. |

---

## 8. SECURITY CHECKLIST (do these before flipping DNS)

- [ ] v28 migration applied (RLS closed on every table).
- [ ] `SETUP_TOKEN` set in Cloudflare env (blocks anyone else from claiming super_admin).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is a **Secret** in Cloudflare (never Plaintext).
- [ ] Supabase Auth → **Password HIBP Check** turned on.
- [ ] Supabase Auth → email confirmation off only if you explicitly want that (currently off per your request).
- [ ] Storage buckets `cafe-gallery` and `avatars` set to Public; all others Private.
- [ ] Rate-limit signup at Supabase Auth → Rate Limits (set to 30/hour to avoid spam).
- [ ] `robots.txt` and `sitemap.xml` reachable at production URL.
- [ ] Legal pages linked in footer (terms / privacy / refund).
- [ ] Formspree endpoint receives test submission.
- [ ] Verify no `console.log(session)` or `console.log(user)` in production build.

---

## 9. THE 24-HOUR LAUNCH RUNBOOK

1. **T-24h** — Run `supabase-migration-v28-FINAL.sql`. Verify with queries in §1.
2. **T-20h** — Set all Cloudflare env vars. Redeploy Worker.
3. **T-18h** — Configure Supabase Auth URLs + rate limits + HIBP.
4. **T-16h** — Hit `/setup`, create super admin, delete `/setup` env token (or set `SETUP_TOKEN=disabled`).
5. **T-12h** — Smoke test full flow (see §4 item 6).
6. **T-6h** — Point DNS. Wait for propagation.
7. **T-2h** — Full end-to-end test on production domain (signup, booking, payment mark, admin action).
8. **T-0** — Launch tweet / WhatsApp broadcast.

---

## 10. IF SOMETHING BREAKS AT LAUNCH

- **"Auth loop / can't sign in on prod"** → Supabase Auth URL Configuration missing your prod domain.
- **"Data doesn't load"** → hard-refresh once; if persistent, check Cloudflare env vars are set on the right environment (Production, not Preview).
- **"RLS blocks a query"** → check the exact policy in Supabase → Authentication → Policies. v28 covers bookings/notifications/storage; if another table trips, add a `SELECT` policy scoped to `auth.uid()` and re-run.
- **"Image upload fails"** → bucket not public OR policy from v28 didn't apply (re-run §6 of v28).
- **"Booking overlap error"** → this is the new guard working; that timeslot really is taken.

---

Ship it. 🚀
