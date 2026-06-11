# Phase 2 — Operating System for the Floor

I'm splitting Phase 2 in two so we ship value fast and don't block on payment keys.

## Phase 2A — Ships now (no extra keys needed)

### Super Admin Console
- **Cafés CRUD** — list, create, edit, archive. Fields: name, slug, city, address, contact, status, owner (assign existing user as `cafe_owner`).
- **Users & Roles** — search users by email, grant/revoke `super_admin` / `cafe_owner` / `cafe_staff`, assign cafe scope.
- **Leads inbox** — view `contacts` submissions, mark resolved.
- **Live network map** — every café as a card with live device count + active sessions (polled every 10s, realtime later).

### Café Owner Console (`/cafe/$slug`)
- **Devices CRUD** — PCs / consoles / VR rigs. Fields: label, type, hourly rate, status (free/in-use/maintenance).
- **Live sessions board** — visual grid of every device. Tap a free device → start session (walk-in or known customer, duration or open-ended). Tap an active device → see timer, accrued cost, end session. Mobile-first.
- **Bookings** — calendar view (day / week). Create a booking for a device + time slot + customer. Conflict detection.
- **Customers** — list + quick add (name, phone, email). Wallet balance, membership badge.
- **Today's tape** — running ledger of sessions + bookings + revenue.

### Staff Console (`/cafe/$slug/staff`)
- Subset of owner: live sessions + bookings + customer quick-add. No CRUD on devices / rates.

### Customer Portal (`/portal`)
- **Discover cafés** — list with city filter.
- **Book a slot** — pick café → device type → date → time slot. Creates a `bookings` row in `pending` status.
- **My bookings** — upcoming + past.
- **Profile** — name, phone, avatar.

### Cross-cutting
- All server logic via `createServerFn` with `requireSupabaseAuth` + `has_role` checks. Admin ops use `supabaseAdmin` loaded inside handlers.
- TanStack Query everywhere — `ensureQueryData` in loaders, `useSuspenseQuery` in components, `invalidateQueries` on mutations.
- Optimistic UI for session start/stop and booking create.
- All forms: `react-hook-form` + `zod` shared schemas, inline errors, toasts via `sonner`.
- Empty / loading / error states designed (not default text). Skeletons match final layout.

### Design upgrades shipping with 2A
- New components: `DataTable` (sortable, searchable, virtualized for 1k+ rows), `StatCard`, `SessionTile` (animated timer ring), `BookingCalendar`, `Sheet`-based mobile editors, `CommandPalette` (⌘K) for power users on admin / owner consoles.
- Page transitions via `framer-motion` `AnimatePresence` in `__root.tsx`.
- Fix the `/auth` SSR hydration warning (wrap the `ssr:false` route body in a deferred client island).

## Phase 2B — Razorpay (needs your keys)

Triggered after you give me:
- `RAZORPAY_KEY_ID` (public, prefixed `rzp_test_` or `rzp_live_`)
- `RAZORPAY_KEY_SECRET` (server-only)
- `RAZORPAY_WEBHOOK_SECRET`

I'll wire:
- **Booking checkout** — customer pays advance / full → Razorpay Order created via server fn → checkout widget → webhook at `/api/public/webhooks/razorpay` verifies signature, marks booking `confirmed`, writes `payments` row.
- **Wallet top-ups** for customers.
- **Café subscription billing** — owners on monthly plan; webhook updates `subscriptions`.
- **Refunds** from owner console.

## Schema additions (one migration file you'll paste)
- `payments` (id, booking_id, customer_id, cafe_id, amount_inr, razorpay_order_id, razorpay_payment_id, status, raw)
- `subscriptions` (cafe_id, plan, status, current_period_end, razorpay_subscription_id)
- Indexes on (`sessions.cafe_id`, `started_at desc`), (`bookings.cafe_id`, `slot_start`), `cafes.slug`
- Tighten RLS: cafe_owner/staff can only see their cafe's rows (via `get_user_cafe_id()`).

## What I need from you
1. **Right now** — say "go" and I start 2A. Nothing else needed.
2. **Before 2B** — paste Razorpay test keys into the secrets form I'll trigger.

Approving this kicks off 2A immediately.