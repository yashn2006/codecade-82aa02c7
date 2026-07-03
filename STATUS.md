# CoreCade SaaS — Full Status Report

> Handoff document for a senior developer. Written the day before launch.
> Everything the project has, everything it doesn't, every known glitch,
> every schema addition still required, and every idea worth shipping.
>
> **Stack:** TanStack Start v1 (React 19, Vite 7) · Supabase (Postgres + Auth + Realtime + Storage) · TailwindCSS v4 · Framer Motion · Cloudflare Workers (production) · Lovable Cloud (managed Supabase).
>
> **Deadline:** Launch tomorrow.
> **Current confidence level:** ~78% production-ready. Core is solid, polish and a few structural bugs remain.

---

## 0. TL;DR — What must happen before launch

| Priority | Item | Effort |
|----------|------|--------|
| 🔴 P0 | Fix "dashboard empty until I click another section and come back" | 2h |
| 🔴 P0 | Fix "click a nav item — nothing happens, need to click again" | 1h |
| 🔴 P0 | Admin → Café Owner direct messaging (inbox both sides) | 4h |
| 🔴 P0 | Admin manual subscription extend (calendar picker + audit log) | 2h |
| 🔴 P0 | Café Owner uploads UPI QR — customers see QR at checkout, owner marks paid | 3h |
| 🔴 P0 | Booking detail view (PC/console/customer/time-left/paid?) for owner | 4h |
| 🟡 P1 | Booking-end reminders for owner + staff (5 min before + on expiry) | 2h |
| 🟡 P1 | Owner can delete no-show bookings | 30m |
| 🟡 P1 | Admin "create café owner" that actually logs in (email + password + role in one txn) | 2h |
| 🟢 P2 | Realtime toasts on new booking / payment / message | 2h |
| 🟢 P2 | Email via Resend for credentials + trial reminders | 3h |

Total ~26 hours of focused work. Achievable in one long day + one polish morning.

---

## 1. Architecture at a glance

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (React 19 + TanStack Router + Query + Framer)       │
│  ├─ Public routes:   /, /discover, /c/$slug, /auth ...       │
│  └─ _authenticated/: /admin, /owner, /portal, /cafe/$slug/*  │
└──────────────┬───────────────────────────────────────────────┘
               │  createServerFn RPC (bearer attached)
┌──────────────▼───────────────────────────────────────────────┐
│  TanStack Start server (Cloudflare Worker in prod)           │
│  ├─ requireSupabaseAuth middleware                           │
│  ├─ src/lib/*.functions.ts   ← all business logic            │
│  └─ src/routes/api/*         ← sitemap, webhooks             │
└──────────────┬───────────────────────────────────────────────┘
               │  supabase-js (RLS as user)  |  service role (admin only)
┌──────────────▼───────────────────────────────────────────────┐
│  Supabase (Postgres + Auth + Realtime + Storage)             │
│  ├─ 22 migrations applied (supabase-migration-v22.sql)       │
│  ├─ RLS on every user-facing table                           │
│  ├─ user_roles table + has_role() security-definer           │
│  └─ pg_cron: trial expiry + notification sweeper             │
└──────────────────────────────────────────────────────────────┘
```

**Three portals, one codebase:**
1. `/admin` — super admin (platform owner: you)
2. `/owner` and `/cafe/$slug/*` — café owners (paying customers)
3. `/portal` — end customers (gamers who book PCs/consoles)

Plus public marketing: `/`, `/discover`, `/c/$slug` (public café page), `/auth`, `/reset-password`.

---

## 2. What is DONE — deep breakdown per surface

### 2.1 Auth & Session

- ✅ Email + password sign in / sign up (`src/routes/auth.tsx`, `signup.tsx`)
- ✅ Password reset flow with live strength meter (`src/routes/reset-password.tsx`)
- ✅ Google OAuth wired through Lovable broker
- ✅ Role-based redirect after login (`src/lib/auth-routing.ts`) — super_admin → `/admin`, cafe_owner → `/owner`, else → `/portal`
- ✅ Waits for `access_token` (not just user) before routing to prevent race conditions
- ✅ Cinematic `/redirecting` transition page
- ✅ Idle logout after 30 minutes of no mouse/keyboard/touch (`src/hooks/useIdleLogout.ts`), cross-tab via `localStorage`
- ✅ "Clear session" escape hatch in the global error boundary
- ✅ `_authenticated` layout gates the whole subtree client-side (`ssr: false`), force-invalidates queries on mount to fix the auth-token race

### 2.2 Super Admin Portal (`/admin`)

All routes live under `src/routes/_authenticated/admin.*.tsx`:

| Route | Status | Notes |
|-------|--------|-------|
| `admin.index` | ✅ | Overview: total cafés, active trials, MRR-lite, tickets |
| `admin.cafes` | ✅ | List + edit any café, view owner, force-suspend |
| `admin.users` | ✅ | List, create, ban, generate recovery link, `UserDetailDialog` shows auth details + roles + audit |
| `admin.leads` | ✅ | Formspree/website leads inbox |
| `admin.support` | ✅ | All support tickets across all cafés |
| `admin.revenue` | ✅ | Manual + observed revenue view |
| `admin.reports` | ✅ | CSV export by table |
| `admin.audit` | ✅ | Full audit log with filters |
| `admin.announcements` | ✅ | Broadcast to owners |
| `admin.health` | ✅ | Realtime channel + DB latency probes |
| `admin.backups` | ✅ | Per-table JSON export + full snapshot |
| `admin.api-keys` | ✅ | Rotate Supabase / Razorpay / Lovable creds |
| `admin.config` | ✅ | Feature flags + platform config |
| `admin.settings` | ✅ | Wiring into the above |

### 2.3 Café Owner Portal (`/owner`, `/cafe/$slug/*`)

| Route | Status | Notes |
|-------|--------|-------|
| `owner` | ✅ | Multi-café switcher, per-café KPIs |
| `owner_.help` | ✅ | Getting-started + FAQ |
| `cafe.$slug.index` | ✅ | Dashboard: today's sessions, revenue, occupancy |
| `cafe.$slug.floor` | ✅ | Station pods with live status |
| `cafe.$slug.devices` | ✅ | Register PCs / consoles / VR rigs |
| `cafe.$slug.bookings` | ⚠️ | List works. **Booking detail view is thin — see §4** |
| `cafe.$slug.pos` | ✅ | Cash / UPI / card entries |
| `cafe.$slug.menu` | ✅ | Items + CSV bulk import |
| `cafe.$slug.customers` | ✅ | CRM view |
| `cafe.$slug.memberships` | ✅ | Membership tiers |
| `cafe.$slug.tournaments` + `$id` | ✅ | Create + bracket view |
| `cafe.$slug.wallet` | ✅ | Store credit balances |
| `cafe.$slug.ledger` | ✅ | Immutable financial ledger |
| `cafe.$slug.staff` | ✅ | Staff invites + roles |
| `cafe.$slug.support` | ✅ | Per-café tickets to platform admin |
| `cafe.$slug.page` | ⚠️ | Public page editor. Theme change persists (v20 fixed the Zod schema). UPI ID + QR fields present. |
| `cafe.$slug.reports` | ✅ | Sales + session CSVs |
| `cafe.$slug.audit` | ✅ | Per-café audit trail |
| `cafe.$slug.analytics` | ✅ | Charts (Recharts) |

### 2.4 Customer Portal (`/portal`) + Public

- ✅ `/discover` — browsable café directory, search bar, mobile-optimised (heavy canvases disabled on mobile)
- ✅ `/c/$slug` — public café page with hero, menu, book CTA
- ✅ `/c/$slug/tournaments/$id` — public bracket
- ✅ Booking flow (`src/components/BookingFlow.tsx`) — customer picks slot; payment defaults to "Pay at counter" (Razorpay hidden from customers per your instruction)
- ✅ Realtime updates on the public café page via `REPLICA IDENTITY FULL`

### 2.5 Infrastructure & Ops

- ✅ Cloudflare Worker deployment (`wrangler.toml`, `src/server.ts` bridges env → `process.env`)
- ✅ 22 SQL migrations, RLS everywhere
- ✅ `user_roles` table + `has_role()` security-definer (no privilege escalation)
- ✅ pg_cron: 15-day trial auto-expiry + daily notification sweep
- ✅ Dynamic `/api/sitemap.xml` + `robots.txt`
- ✅ Per-route `head()` metadata with distinct titles/descriptions, OG tags on leaf routes only, JSON-LD `LocalBusiness` on café pages
- ✅ PWA manifest (`public/manifest.webmanifest`)
- ✅ Formspree contact form (`mpqebaak`) with Enter-to-submit
- ✅ 3D hero backdrop with all-hooks-first ordering (mobile crash fixed)
- ✅ iOS-grade mobile bottom nav (frosted glass, spring pill, "More" overflow sheet)
- ✅ Referral system: +30 trial days per successful referral
- ✅ White-label-lite: custom logo + accent colour on public café pages

---

## 3. Design system

- **Font:** display = extra-bold sans (used via `font-display`), body = system default
- **Colour:** OKLCH tokens in `src/styles.css`. Primary hue ~`0.72 0.26 330` (hot pink/magenta), accent nearby. Never hardcode hex in components.
- **Surfaces:** `card/60` + `backdrop-blur-xl` frosted panels, `border-border/70`, soft `shadow-pop`
- **Motion:** Framer Motion. Spring `{ stiffness: 380–420, damping: 30–38 }` for pills, ease `[0.22, 1, 0.36, 1]` for page transitions
- **Backgrounds:** `AuroraBackground`, `HeroBackdrop3D`, `Meteors`, `ParticleField` — all disabled on mobile for perf
- **Nav pattern:** desktop sidebar (260px, frosted) + top bar with notification bell; mobile floating pill bar + "More" sheet
- **Empty / error / loading:** dedicated `EmptyState`, `ErrorState`, `LoadingSkeleton`, `StatLoader` (animated logo pulse)
- **Command palette** (`⌘K`) mounted globally

---

## 4. What is NOT DONE / open issues

### 4.1 🔴 P0 — Blocks launch

#### Bug: "Dashboard is empty until I click another section and come back"

- **Symptom:** After sign-in the first render of any dashboard route shows zero rows. Navigate to another tab and back → data appears.
- **Root cause:** The Supabase bearer token attach middleware reads `supabase.auth.getSession()` per server-fn call. On the very first paint after login, `getSession()` sometimes resolves *after* the intent-preload has already fired the queries → those queries hit the server without an Authorization header → server returns 401 → TanStack Query caches the failure → the second navigation triggers `refetchOnMount: "always"` and it recovers.
- **What's already in place:** `refetchOnMount: "always"`, `retry: 2`, `getSupabaseUserReady()` waits for `access_token`, and `_authenticated/route.tsx` force-invalidates on mount with a 50ms timeout.
- **Still needed:** replace `attachSupabaseAuth` with a version that awaits a cached in-memory session promise (populated once at bootstrap) instead of calling `getSession()` per request. Also change router `defaultPreloadStaleTime` handling so intent-preloads *don't* fire until the token promise resolves. Concrete plan:
  1. In `src/lib/supabase/auth-attacher.ts`, cache `supabase.auth.getSession()` in a module-level `Promise` and `await` it (instead of calling per invocation).
  2. On `SIGNED_IN` / `TOKEN_REFRESHED`, replace the cached promise.
  3. Add `await sessionReady()` inside the `attachSupabaseAuth` client middleware before returning headers.

#### Bug: "Click a nav item — nothing happens, need to click twice"

- **Symptom:** Especially on mobile. First tap seems to be swallowed.
- **Root cause:** Two suspects. (a) Framer Motion's `AnimatePresence mode="wait"` in `ConsoleShell` blocks the new route from mounting until the exit animation finishes; if the user taps again during the exit, the router debounces the second navigation. (b) The bottom-bar pill uses `layoutId="mob-nav-pill"` which internally listens for pointer events during the layout transition.
- **Fix:** switch `AnimatePresence` to `mode="popLayout"` OR remove it and use a simple fade-in on `key={path}`. Set `layout` transition on the pill to `duration: 0.18` and add `pointer-events-none` to the animated pill itself so it never intercepts taps.

#### Missing: Admin ↔ Café Owner messaging

- Need `conversations` and `messages` tables scoped to `(admin_id, cafe_owner_id)`.
- Admin dashboard: inbox listing every owner, unread count, thread view.
- Owner dashboard: single thread with "Support (Platform)" pinned.
- Realtime via Supabase channels; toast + `NotificationBell` badge on new message.
- Optional: mirror to email through Resend when the recipient is offline > 5 min.

#### Missing: Admin manual subscription extend

- Admin opens any café → "Extend trial / subscription" button → calendar picker → writes new `subscription_ends_at` + inserts audit row with reason.
- Server fn already has the pattern (`updateUserById`); mirror for `cafes`.

#### Missing: UPI QR checkout for customers

- Owner already stores `upi_id` + `upi_qr_url` on the public café page.
- At booking checkout, show the QR + UPI deep-link (`upi://pay?pa=<id>&pn=<name>&am=<amount>&tn=Booking%20<id>`).
- Booking row starts as `payment_status = 'pending'`.
- Owner has a "Payments to verify" queue → tap "Mark paid" → booking flips to `confirmed`.

#### Missing: Rich booking detail view for owner

Show per booking:
- Customer name + phone
- Device (which PC / console / VR)
- Start → End time, minutes remaining (live countdown)
- Price + payment status (pending / paid / refunded)
- Actions: mark paid, extend +15 min, end early, delete no-show, refund
- 5-min-before-end + on-expiry push/toast to owner + all on-shift staff

### 4.2 🟡 P1 — Should ship day 1 or day 2

- Admin "Create Café Owner" flow: single form that creates auth user with confirmed email, seeds a café row with default trial, assigns `cafe_owner` role, emails credentials. Currently these steps exist but aren't one-click.
- Booking-end reminders (staff-scoped).
- Owner deletes no-show bookings (needs a soft-delete + audit).
- Trial countdown banner in owner shell when < 5 days remain (component exists — `TrialBanner` — needs to be mounted in the owner layout).
- Announcements → Notification bell fan-out (partially wired).

### 4.3 🟢 P2 — Post-launch polish

- Resend email integration (welcome, trial expiring, invoice, staff invite).
- Realtime "coin drop" sound + toast on new revenue.
- Owner-side loyalty points auto-accrual rules editor.
- Public café page — customer reviews with moderation queue.
- Tournament bracket live spectator mode.
- Admin analytics: cohort retention, MRR waterfall.
- Playwright smoke suite in CI.

### 4.4 Known glitches / paper cuts

| # | Where | Symptom | Suggested fix |
|---|-------|---------|---------------|
| G1 | All dashboards | Empty on first paint | See §4.1 auth-attacher rewrite |
| G2 | Mobile nav | Double-tap required | AnimatePresence mode change |
| G3 | Café public page editor | Theme save sometimes needs refresh to show on `/c/$slug` | Emit a Supabase realtime `cafe_pages:UPDATE` and the public page will already re-render (broadcast trigger present, verify `REPLICA IDENTITY FULL` on `cafe_pages`) |
| G4 | Discover | Search filter debounces at 300ms — feels slow on desktop | Drop to 120ms on desktop, keep 300ms on mobile |
| G5 | NotificationBell | Occasional duplicate on Fast Refresh | Already fixed with channel-id randomisation; watch for regressions |
| G6 | Sign-out | Rare 401 storm as cached queries refetch | Ensure `queryClient.cancelQueries()` runs *before* `signOut()` (already done in `ConsoleShell`, mirror in idle logout) |
| G7 | Cloudflare | Env vars must be **Plaintext**, not Secrets, for build-time `VITE_*` | Documented in `DEPLOY.md`; re-verify before launch |

---

## 5. Database — what to add next

Everything below is safe to run as **`supabase-migration-v23.sql`**. It adds messaging, payment verification queue, booking lifecycle helpers, and no-show handling. Copy verbatim.

```sql
-- =========================================================
-- CoreCade v23 — Messaging, Payment Verification, Booking Ops
-- =========================================================

-- 1. Admin ↔ Owner conversations ---------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  cafe_id  uuid references public.cafes(id) on delete set null,
  last_message_at timestamptz not null default now(),
  admin_unread int not null default 0,
  owner_unread int not null default 0,
  created_at timestamptz not null default now(),
  unique (admin_id, owner_id)
);

grant select, insert, update on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;

create policy "conversation_participants_read" on public.conversations
  for select to authenticated
  using (admin_id = auth.uid() or owner_id = auth.uid());

create policy "admin_can_create_conversation" on public.conversations
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'super_admin') and admin_id = auth.uid());

-- 2. Messages ----------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create index if not exists idx_messages_conv_created on public.messages(conversation_id, created_at desc);

create policy "participants_read_messages" on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.admin_id = auth.uid() or c.owner_id = auth.uid())
  ));

create policy "participants_send_messages" on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.admin_id = auth.uid() or c.owner_id = auth.uid())
  ));

-- Bump conversation counters on new message
create or replace function public.tg_conversation_bump()
returns trigger language plpgsql security definer set search_path = public as $$
declare c public.conversations;
begin
  select * into c from public.conversations where id = new.conversation_id;
  update public.conversations set
    last_message_at = now(),
    admin_unread = case when new.sender_id = c.owner_id then admin_unread + 1 else admin_unread end,
    owner_unread = case when new.sender_id = c.admin_id then owner_unread + 1 else owner_unread end
  where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_conversation_bump on public.messages;
create trigger trg_conversation_bump
  after insert on public.messages
  for each row execute function public.tg_conversation_bump();

alter table public.messages replica identity full;
alter table public.conversations replica identity full;

-- 3. Booking lifecycle additions ---------------------------------
alter table public.bookings
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','refunded','void')),
  add column if not exists payment_method text
    check (payment_method in ('upi','cash','card','wallet','counter')),
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by_staff uuid references auth.users(id),
  add column if not exists no_show boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists ends_at timestamptz;

create index if not exists idx_bookings_cafe_ends on public.bookings(cafe_id, ends_at)
  where deleted_at is null;

-- Verification queue view for owners
create or replace view public.v_payment_queue as
  select b.*, c.name as customer_name, d.label as device_label
  from public.bookings b
  left join public.customers c on c.id = b.customer_id
  left join public.devices d on d.id = b.device_id
  where b.payment_status = 'pending' and b.deleted_at is null;

grant select on public.v_payment_queue to authenticated;

-- RPC: owner marks paid
create or replace function public.mark_booking_paid(
  _booking_id uuid, _method text
) returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = _booking_id;
  if b.id is null then raise exception 'Booking not found'; end if;
  if not exists (
    select 1 from public.cafe_members m
    where m.cafe_id = b.cafe_id and m.user_id = auth.uid()
      and m.role in ('owner','manager','staff')
  ) then raise exception 'Forbidden'; end if;

  update public.bookings set
    payment_status = 'paid',
    payment_method = _method,
    paid_at = now(),
    paid_by_staff = auth.uid()
  where id = _booking_id;

  insert into public.audit_log(cafe_id, actor_id, action, target_type, target_id, meta)
  values (b.cafe_id, auth.uid(), 'booking.payment.marked', 'booking', b.id,
          jsonb_build_object('method', _method));
end $$;

-- RPC: owner deletes no-show
create or replace function public.mark_booking_no_show(_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = _booking_id;
  if b.id is null then raise exception 'Booking not found'; end if;
  if not exists (
    select 1 from public.cafe_members m
    where m.cafe_id = b.cafe_id and m.user_id = auth.uid()
      and m.role in ('owner','manager')
  ) then raise exception 'Forbidden'; end if;

  update public.bookings set
    no_show = true, deleted_at = now(), payment_status = 'void'
  where id = _booking_id;

  insert into public.audit_log(cafe_id, actor_id, action, target_type, target_id)
  values (b.cafe_id, auth.uid(), 'booking.no_show', 'booking', b.id);
end $$;

-- 4. Admin subscription extension --------------------------------
create or replace function public.admin_extend_subscription(
  _cafe_id uuid, _new_end timestamptz, _reason text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Forbidden';
  end if;
  update public.cafes set subscription_ends_at = _new_end, updated_at = now()
   where id = _cafe_id;
  insert into public.audit_log(cafe_id, actor_id, action, target_type, target_id, meta)
  values (_cafe_id, auth.uid(), 'subscription.extended', 'cafe', _cafe_id,
          jsonb_build_object('new_end', _new_end, 'reason', _reason));
end $$;

-- 5. Reminders: bookings ending soon -----------------------------
-- pg_cron: every minute, insert a notification for bookings ending in 5 min
create or replace function public.tick_booking_reminders()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(user_id, cafe_id, kind, title, body, meta)
  select m.user_id, b.cafe_id, 'booking.ending_soon',
         'Booking ending in 5 min',
         coalesce(cu.name,'Customer') || ' on ' || coalesce(d.label,'device'),
         jsonb_build_object('booking_id', b.id)
  from public.bookings b
  join public.cafe_members m on m.cafe_id = b.cafe_id and m.role in ('owner','manager','staff')
  left join public.customers cu on cu.id = b.customer_id
  left join public.devices d on d.id = b.device_id
  where b.deleted_at is null
    and b.ends_at between now() + interval '4 minutes 30 seconds'
                     and now() + interval '5 minutes 30 seconds'
  on conflict do nothing;
end $$;

select cron.schedule('booking_reminders', '* * * * *',
  $$ select public.tick_booking_reminders(); $$)
where not exists (select 1 from cron.job where jobname = 'booking_reminders');
```

Follow-up server functions to add (mirroring the RPCs): `src/lib/messages.functions.ts`, `src/lib/bookings.functions.ts` (extend), `src/lib/admin.functions.ts` (extend `adminExtendSubscription`).

---

## 6. Launch checklist (24 hours)

**T-24h**
- [ ] Run `supabase-migration-v23.sql`
- [ ] Ship auth-attacher rewrite (§4.1 first bug)
- [ ] Ship AnimatePresence fix (§4.1 second bug)
- [ ] Ship messaging tables + minimal UI (admin inbox, owner single thread)

**T-12h**
- [ ] Ship admin "Extend subscription" calendar modal
- [ ] Ship UPI QR at checkout + owner "Mark paid" queue
- [ ] Ship booking detail drawer + no-show delete
- [ ] Mount `TrialBanner` in owner layout

**T-6h**
- [ ] Cloudflare env vars verified (Plaintext for VITE_*, Secret for service role)
- [ ] Supabase Auth → Site URL and Redirect URLs include prod domain
- [ ] Manual smoke: sign up → sign in → book → pay → owner marks paid → session ends → reminder fires

**T-2h**
- [ ] Publish
- [ ] Announce
- [ ] Watch `admin.health` for 15 min

---

## 7. Feature ideas worth adding (post-launch, ranked by impact)

1. **Auto-generated invoices** (PDF) emailed to café owners monthly.
2. **Staff mobile PWA** stripped down to floor + POS + payment queue.
3. **Customer wallet top-up** via UPI intent — reduces per-session friction.
4. **Tournament live leaderboard** with WebSocket updates + spectator page.
5. **Owner mobile push notifications** (via web-push, no native app needed).
6. **AI concierge**: chat widget on public café page ("book me 2 hours on a PS5 tonight").
7. **Heatmap of station usage** so owners know what to upgrade.
8. **Referral leaderboard** — public wall of top referrers per city.
9. **Google Reviews sync** on public café page.
10. **Multi-language** (Hindi + English toggle) — India-first market.

---

## 8. Contact matrix for handoff

- **Frontend entry:** `src/router.tsx`, `src/routes/__root.tsx`
- **Auth:** `src/lib/auth-routing.ts`, `src/lib/supabase/auth-middleware.ts`, `src/lib/supabase/auth-attacher.ts`, `src/routes/_authenticated/route.tsx`
- **Server functions:** every `src/lib/*.functions.ts`
- **Admin-only server helpers:** `src/lib/supabase/client.server.ts` (never import at module scope in a `.functions.ts` — lazy-load inside the handler)
- **SQL history:** `supabase-migration.sql` … `supabase-migration-v22.sql` (add v23 from §5)
- **Deploy:** `DEPLOY.md`, `wrangler.toml`, `src/server.ts`

---

*End of report. If anything is unclear, grep the file paths — every claim above maps to a concrete file.*
