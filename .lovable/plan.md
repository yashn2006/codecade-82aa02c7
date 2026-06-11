# Phase 3 — The Gaming Café Operating System

Phase 1 = foundation. Phase 2 = sessions/bookings/wallet/memberships. Phase 3 turns CoreCade into a complete operating system for gaming cafés — the things that actually drive daily revenue and customer love.

Razorpay is parked until tomorrow. Everything below ships without it.

---

## 3A — F&B / POS (snacks, drinks, combos)

Most café revenue isn't from PCs — it's from Maggi, cold drinks, and combos. Operators need a tap-to-bill counter that attaches charges to a live session or settles in cash/wallet.

- `menu_categories`, `menu_items` (name, price, sku, stock, image, veg flag, active)
- `orders`, `order_items` (status: open / paid / void, payment_method, attached_session_id)
- Server functions: menu CRUD, create order, add/remove items, attach to session, settle (cash / wallet / add-to-session-tab)
- **Counter screen** `/cafe/$slug/pos` — large tap tiles by category, running cart, attach to active session dropdown, settle modal
- **Menu manager** `/cafe/$slug/menu` — CRUD with image upload to Supabase storage, stock toggles, low-stock badges
- Auto-deduct stock on settle. Daily F&B revenue feeds the existing ledger sparkline.

## 3B — Tournaments & Leaderboards

The growth lever for a gaming café. Owners run weekend BGMI / Valorant / FIFA tournaments; customers see them on the public page and register.

- `tournaments` (cafe_id, title, game, format, entry_fee, prize_pool, starts_at, capacity, status, banner_url)
- `tournament_registrations` (tournament_id, customer_id, team_name, paid, seat_no, placement)
- `leaderboards` materialized from `sessions` + `tournament_registrations` (top players by hours / wins / spend, weekly + all-time)
- Owner screen `/cafe/$slug/tournaments` — create, manage bracket seeding, mark winners, auto-credit prize to wallet
- Public listing on café page + portal

## 3C — Customer App (real portal, not a stub)

Today `/portal` only discovers. Make it the actual customer home.

- **Home**: nearest café card, active session live timer (if any), wallet balance, next booking
- **Book**: device picker → calendar → confirm (cash-at-counter for now; Razorpay slot reserved)
- **My stuff**: bookings (upcoming/past), session history, wallet ledger, memberships, tournament entries
- **Profile**: name, phone, avatar upload, favourite café
- **Notifications bell** powered by Supabase Realtime — session ending in 10 min, booking reminder, tournament starts soon

## 3D — Public Café Pages (`/c/$slug`)

Every café gets a real, shareable, SEO-perfect landing page — the marketing surface that converts walk-ins.

- Hero with café banner, name, city, "Book now" CTA
- Live availability ribbon (X PCs / Y consoles free right now) — polled every 15 s
- Pricing strip from devices table
- Upcoming tournaments
- Menu highlights
- Photo gallery (upload from owner console)
- Reviews placeholder (Phase 4)
- Per-route `head()` with proper title / description / og:image (hero banner)

Owner can edit hero, tagline, banner, gallery, contact, hours, social links via `/cafe/$slug/page`.

## 3E — Realtime + Notifications Plumbing

- `notifications` table + Supabase Realtime channel per user
- Server triggers: session about-to-end (T-10), booking T-30, tournament T-60, wallet low
- Toast + bell badge + optional browser push (Phase 4)

## 3F — Polish / UX Sweep

- **Command palette ⌘K** across every console — jump to café, customer, session, page
- **Mobile shells** for owner & staff consoles (drawer nav, bottom action bar) — most café staff use phones
- **Empty states with real CTAs** everywhere (no more "no data" deserts)
- **Page transitions** via `framer-motion` `AnimatePresence`
- **Toasts**: success / error consistent across all mutations
- Fix any lingering SSR hydration warnings (auth page client island)

## 3G — Reports & Exports

- `/admin/reports` and `/cafe/$slug/reports`: date range picker, revenue split (sessions / F&B / memberships / tournaments), top devices, top customers, peak-hour heatmap
- CSV export for every table view

---

## Schema additions (single migration: `supabase-migration-v3.sql`)

```text
menu_categories, menu_items, orders, order_items,
tournaments, tournament_registrations,
cafe_pages (banner, tagline, gallery jsonb, hours jsonb, socials jsonb),
notifications,
+ indexes, + RLS, + GRANTs (authenticated + service_role; anon SELECT only on
  menu_items, tournaments, cafe_pages for public pages)
```

I will write this file at repo root. You paste it into Supabase SQL editor when ready — same drill as v1 / v2.

---

## Sequencing

1. Migration v3 file written first.
2. 3A POS → 3D public pages → 3B tournaments → 3C customer app → 3E realtime → 3F polish → 3G reports.
3. After 3D the café is already publicly shareable, which is the biggest morale win — I'll surface a "share your café" CTA the moment it lands.

## What I need from you

Nothing. Approve and I ship. Razorpay slots are already wired with stubs that say "Pay at counter" until you drop the keys tomorrow.
