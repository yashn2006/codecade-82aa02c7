import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gamepad2, MousePointerClick, SearchX } from "lucide-react";
import { toast } from "sonner";
import { getCafeBySlug } from "@/lib/cafes.functions";
import { listDevices, setDeviceStatus } from "@/lib/devices.functions";
import {
  listSessions, startSession, endSession, extendSession, suspendSession, resumeSession, assignSessionCustomer,
} from "@/lib/sessions.functions";
import { listBookings, createBookingForCustomer, updateBookingStatus } from "@/lib/bookings.functions";
import { listCustomers, createCustomer } from "@/lib/customers.functions";
import { supabase } from "@/lib/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FloorStats, StationToolbar, type FloorView } from "@/components/livefloor/FloorHeader";
import { FloorScene } from "@/components/livefloor/FloorScene";
import { FloorFooter } from "@/components/livefloor/FloorFooter";
import { StationPanel } from "@/components/livefloor/StationPanel";
import { StationCard, StationRow, type StationAction } from "@/components/livefloor/StationCard";
import { BookingDialog, type BookingSubmit } from "@/components/livefloor/BookingDialog";
import { MaintenanceDialog } from "@/components/livefloor/MaintenanceDialog";
import type { CustomerDraft, FloorCustomer } from "@/components/livefloor/CustomerSelector";
import {
  MAINT_PREFIX, countByStatus, filterStations, sortStations, stationCodes, normalizeStatus,
  type FloorBooking, type FloorDevice, type FloorSession, type SortKey, type StatusFilter,
} from "@/lib/live-floor";

export const Route = createFileRoute("/_authenticated/cafe/$slug/")({
  head: () => ({
    meta: [
      { title: "Live Floor — CoreCade" },
      { name: "description", content: "Immersive real-time map of every station, player and running bill on your café floor." },
      { property: "og:title", content: "Live Floor — CoreCade" },
      { property: "og:description", content: "Immersive real-time map of every station, player and running bill on your café floor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveFloor,
});

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1280px)");
    const f = () => setWide(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return wide;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function LiveFloor() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const wide = useWide();

  const getCafe = useServerFn(getCafeBySlug);
  const { data: cafe } = useQuery({ queryKey: ["cafe", slug], queryFn: () => getCafe({ data: { slug } }) });
  const cafeId = cafe?.id as string | undefined;

  const lDev = useServerFn(listDevices);
  const lSes = useServerFn(listSessions);
  const lBk = useServerFn(listBookings);
  const lCus = useServerFn(listCustomers);

  const devicesQ = useQuery({
    queryKey: ["devices", cafeId], queryFn: () => lDev({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId, refetchInterval: 10000,
  });
  const sessionsQ = useQuery({
    queryKey: ["sessions", cafeId], queryFn: () => lSes({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId, refetchInterval: 10000,
  });
  const bookingsQ = useQuery({
    queryKey: ["bookings", cafeId], queryFn: () => lBk({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId, refetchInterval: 30000,
  });
  const customersQ = useQuery({
    queryKey: ["customers", cafeId], queryFn: () => lCus({ data: { cafe_id: cafeId! } }),
    enabled: !!cafeId,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["devices", cafeId] });
    qc.invalidateQueries({ queryKey: ["sessions", cafeId] });
    qc.invalidateQueries({ queryKey: ["bookings", cafeId] });
  }, [qc, cafeId]);

  // Instant refresh when anything on the floor changes (falls back to polling if realtime is off).
  useEffect(() => {
    if (!cafeId) return;
    const ch = supabase.channel(`lf:${cafeId}:${Math.random().toString(36).slice(2, 8)}`);
    for (const table of ["devices", "sessions", "bookings"]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `cafe_id=eq.${cafeId}` }, () => invalidate());
    }
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cafeId, invalidate]);

  const start = useServerFn(startSession);
  const end = useServerFn(endSession);
  const extend = useServerFn(extendSession);
  const suspend = useServerFn(suspendSession);
  const resume = useServerFn(resumeSession);
  const assign = useServerFn(assignSessionCustomer);
  const setStatus = useServerFn(setDeviceStatus);
  const book = useServerFn(createBookingForCustomer);
  const setBooking = useServerFn(updateBookingStatus);
  const addCust = useServerFn(createCustomer);

  const devices = (devicesQ.data ?? []) as unknown as FloorDevice[];
  const sessions = (sessionsQ.data ?? []) as unknown as (FloorSession & { ended_at?: string | null; amount?: number | null })[];
  const bookings = (bookingsQ.data ?? []) as unknown as FloorBooking[];
  const customers = (customersQ.data ?? []) as unknown as FloorCustomer[];

  const codes = useMemo(() => stationCodes(devices), [devices]);
  const counts = useMemo(() => countByStatus(devices), [devices]);

  const sessionsByDevice = useMemo(() => {
    const m = new Map<string, FloorSession>();
    for (const s of sessions) {
      if ((s.status === "active" || s.status === "paused") && !s.ended_at && !m.has(s.device_id)) m.set(s.device_id, s);
    }
    return m;
  }, [sessions]);

  const bookingsByDevice = useMemo(() => {
    const now = Date.now();
    const m = new Map<string, FloorBooking>();
    const live = bookings
      .filter((b) => (b.status === "pending" || b.status === "confirmed") &&
        new Date(b.scheduled_at).getTime() + b.duration_minutes * 60000 > now)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    for (const b of live) if (!m.has(b.device_id)) m.set(b.device_id, b);
    return m;
  }, [bookings]);

  const playingOn = useMemo(() => {
    const m = new Map<string, string>();
    for (const [deviceId, s] of sessionsByDevice) {
      if (s.customer_id) m.set(s.customer_id, codes.get(deviceId) ?? "");
    }
    return m;
  }, [sessionsByDevice, codes]);

  const revenueToday = useMemo(() => {
    const today = new Date().toDateString();
    return sessions.reduce((sum, s) =>
      sum + (s.ended_at && new Date(s.ended_at).toDateString() === today ? Number(s.amount ?? 0) : 0), 0);
  }, [sessions]);

  // ---- filters / view ----
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<FloorView>("floor");
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const v = window.localStorage.getItem("lf:view");
    if (v === "floor" || v === "grid" || v === "list") setView(v);
  }, []);
  const changeView = useCallback((v: FloorView) => {
    setView(v);
    window.localStorage.setItem("lf:view", v);
  }, []);

  const types = useMemo(() => [...new Set(devices.map((d) => d.type))], [devices]);
  const visible = useMemo(
    () => sortStations(filterStations(devices, { status: filter, type, query, codes, sessionsByDevice }), sort, codes),
    [devices, filter, type, query, codes, sessionsByDevice, sort],
  );

  // ---- selection: undefined = auto-pick on wide screens, null = closed ----
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  const effectiveId = selectedId === undefined ? (wide ? visible[0]?.id ?? null : null) : selectedId;
  const selected = devices.find((d) => d.id === effectiveId) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- actions ----
  const [busy, setBusy] = useState(false);
  const [bookingFor, setBookingFor] = useState<string | null>(null);
  const [maintFor, setMaintFor] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<string | void>) => {
    setBusy(true);
    try {
      const msg = await fn();
      if (msg) toast.success(msg);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      invalidate();
    }
  }, [invalidate]);

  const resolveCustomer = useCallback(async (draft: Exclude<CustomerDraft, null>): Promise<string> => {
    if (draft.kind === "existing") return draft.customer.id;
    const c = await addCust({ data: { cafe_id: cafeId!, full_name: draft.full_name.trim(), phone: draft.phone.trim() || null, email: null } });
    qc.invalidateQueries({ queryKey: ["customers", cafeId] });
    if (!c?.id) throw new Error("Could not add the customer");
    return c.id as string;
  }, [addCust, cafeId, qc]);

  const codeOf = useCallback((id: string) => codes.get(id) ?? "Station", [codes]);

  const ops = useMemo(() => ({
    start: (deviceId: string, draft: Exclude<CustomerDraft, null> | null, minutes: number) => run(async () => {
      const customerId = draft ? await resolveCustomer(draft) : undefined;
      await start({ data: {
        cafe_id: cafeId!, device_id: deviceId, customer_id: customerId ?? null,
        planned_minutes: minutes > 0 ? minutes : null,
        package_name: minutes > 0 ? `${minutes} min` : null,
        payment_method: "counter",
      } });
      return `Session started on ${codeOf(deviceId)}`;
    }),
    assign: (deviceId: string, draft: Exclude<CustomerDraft, null>) => run(async () => {
      const s = sessionsByDevice.get(deviceId);
      if (!s) throw new Error("No session is running here");
      const customerId = await resolveCustomer(draft);
      await assign({ data: { id: s.id, customer_id: customerId } });
      return "Player updated";
    }),
    extend: (deviceId: string) => run(async () => {
      const s = sessionsByDevice.get(deviceId);
      if (!s) throw new Error("No session is running here");
      await extend({ data: { id: s.id, add_minutes: 30 } });
      return "+30 minutes added";
    }),
    pause: (deviceId: string) => run(async () => {
      const s = sessionsByDevice.get(deviceId);
      if (s) { await suspend({ data: { id: s.id } }); return "Session paused"; }
      await setStatus({ data: { id: deviceId, status: "suspended" } });
      return `${codeOf(deviceId)} paused`;
    }),
    resume: (deviceId: string) => run(async () => {
      const s = sessionsByDevice.get(deviceId);
      if (!s) throw new Error("No paused session here");
      await resume({ data: { id: s.id } });
      return "Session resumed";
    }),
    end: (deviceId: string) => run(async () => {
      const s = sessionsByDevice.get(deviceId);
      if (!s) throw new Error("No session is running here");
      const r = await end({ data: { id: s.id } });
      return `Session ended · ${r.minutes} min · ₹${r.amount}${r.due > 0 ? ` (₹${r.due} due)` : ""}`;
    }),
    available: (deviceId: string) => run(async () => {
      const d = devices.find((x) => x.id === deviceId);
      await setStatus({ data: { id: deviceId, status: "available", ...((d?.notes ?? "").startsWith(MAINT_PREFIX) ? { notes: "" } : {}) } });
      return `${codeOf(deviceId)} is available`;
    }),
    checkIn: (deviceId: string) => run(async () => {
      const b = bookingsByDevice.get(deviceId);
      await start({ data: {
        cafe_id: cafeId!, device_id: deviceId, customer_id: b?.customer_id ?? null,
        planned_minutes: b?.duration_minutes ?? null,
        package_name: b ? `Booking · ${b.duration_minutes} min` : null,
        payment_method: "counter",
      } });
      if (b) await setBooking({ data: { id: b.id, status: "completed" } });
      return `Checked in on ${codeOf(deviceId)}`;
    }),
    cancelBooking: (deviceId: string) => run(async () => {
      const b = bookingsByDevice.get(deviceId);
      if (b) await setBooking({ data: { id: b.id, status: "cancelled" } });
      await setStatus({ data: { id: deviceId, status: "available" } });
      return b ? "Booking cancelled" : `${codeOf(deviceId)} released`;
    }),
  }), [run, resolveCustomer, start, assign, extend, suspend, resume, end, setStatus, setBooking,
    cafeId, codeOf, sessionsByDevice, bookingsByDevice, devices]);

  const opsRef = useRef(ops);
  opsRef.current = ops;

  const onSelect = useCallback((id: string) => setSelectedId(id), []);
  const onCardAction = useCallback((id: string, a: StationAction) => {
    const o = opsRef.current;
    if (a === "start" || a === "details") setSelectedId(id);
    else if (a === "book") setBookingFor(id);
    else if (a === "extend") o.extend(id);
    else if (a === "checkin") o.checkIn(id);
    else if (a === "resolve") o.available(id);
    else if (a === "resume") o.resume(id);
    else if (a === "maintenance") setMaintFor(id);
  }, []);

  const quickStart = useCallback(() => {
    const free = devices.find((d) => normalizeStatus(d.status) === "available");
    if (free) { setSelectedId(free.id); setFilter("all"); }
  }, [devices]);

  const submitBooking = (v: BookingSubmit) => {
    const deviceId = bookingFor;
    if (!deviceId || !v.draft) return;
    const draft = v.draft;
    run(async () => {
      const customerId = await resolveCustomer(draft);
      await book({ data: { cafe_id: cafeId!, device_id: deviceId, customer_id: customerId, scheduled_at: v.scheduledAt, duration_minutes: v.minutes } });
      const soon = new Date(v.scheduledAt).getTime() - Date.now() <= 30 * 60000;
      const d = devices.find((x) => x.id === deviceId);
      if (soon && normalizeStatus(d?.status) === "available") {
        await setStatus({ data: { id: deviceId, status: "reserved" } });
      }
      setBookingFor(null);
      return `${codeOf(deviceId)} booked`;
    });
  };

  const confirmMaintenance = (v: { notes: string; endSession: boolean }) => {
    const deviceId = maintFor;
    if (!deviceId) return;
    run(async () => {
      const s = sessionsByDevice.get(deviceId);
      if (v.endSession && s) await end({ data: { id: s.id } });
      await setStatus({ data: { id: deviceId, status: "maintenance", notes: v.notes } });
      setMaintFor(null);
      return `${codeOf(deviceId)} sent to maintenance`;
    });
  };

  // ---- render ----
  if (!cafeId || devicesQ.isLoading) {
    return (
      <div className="lf-root space-y-3">
        <div className="lf-panel h-[86px] animate-pulse" />
        <div className="lf-panel h-[52px] animate-pulse" />
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="lf-scene animate-pulse" />
          <div className="lf-side hidden h-[560px] animate-pulse xl:block" />
        </div>
      </div>
    );
  }

  const panel = selected ? (
    <StationPanel
      key={selected.id}
      slug={slug}
      device={selected}
      code={codeOf(selected.id)}
      session={sessionsByDevice.get(selected.id)}
      booking={bookingsByDevice.get(selected.id)}
      customers={customers}
      playingOn={playingOn}
      busy={busy}
      handlers={{
        onClose: () => setSelectedId(null),
        onStart: (draft, minutes) => ops.start(selected.id, draft, minutes),
        onAssign: (draft) => ops.assign(selected.id, draft),
        onExtend: () => ops.extend(selected.id),
        onPause: () => ops.pause(selected.id),
        onResume: () => ops.resume(selected.id),
        onEnd: () => ops.end(selected.id),
        onBook: () => setBookingFor(selected.id),
        onMaintenance: () => setMaintFor(selected.id),
        onAvailable: () => ops.available(selected.id),
        onCheckIn: () => ops.checkIn(selected.id),
        onCancelBooking: () => ops.cancelBooking(selected.id),
      }}
    />
  ) : null;

  const bookingDevice = devices.find((d) => d.id === bookingFor) ?? null;
  const maintDevice = devices.find((d) => d.id === maintFor) ?? null;
  const healthy = !devicesQ.isError && !sessionsQ.isError;

  return (
    <div className="lf-root space-y-3">
      <FloorStats
        counts={counts}
        devices={devices}
        sessionsByDevice={sessionsByDevice}
        revenueToday={revenueToday}
        onQuickStart={quickStart}
      />
      <StationToolbar
        counts={counts}
        filter={filter}
        onFilter={setFilter}
        onQuery={setQuery}
        sort={sort}
        onSort={setSort}
        view={view}
        onView={changeView}
        type={type}
        onType={setType}
        types={types}
        searchRef={searchRef}
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {devices.length === 0 ? (
            <EmptyState icon={Gamepad2} title="No stations yet" description="Head to Devices to add your first PC, console, or VR rig." />
          ) : visible.length === 0 ? (
            <div className="lf-panel grid min-h-[320px] place-items-center p-8 text-center">
              <div>
                <SearchX className="mx-auto h-8 w-8 text-lf-dim" />
                <div className="mt-2 text-[14px] font-semibold">No stations match</div>
                <button type="button" className="lf-btn mt-3" onClick={() => { setFilter("all"); setType("all"); setQuery(""); }}>
                  Clear filters
                </button>
              </div>
            </div>
          ) : view === "floor" ? (
            <FloorScene
              devices={visible}
              codes={codes}
              sessionsByDevice={sessionsByDevice}
              bookingsByDevice={bookingsByDevice}
              selectedId={effectiveId}
              onSelect={onSelect}
            />
          ) : view === "grid" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3">
              {visible.map((d) => (
                <StationCard
                  key={d.id}
                  device={d}
                  code={codeOf(d.id)}
                  session={sessionsByDevice.get(d.id)}
                  booking={bookingsByDevice.get(d.id)}
                  selected={effectiveId === d.id}
                  onSelect={onSelect}
                  onAction={onCardAction}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {visible.map((d) => (
                <StationRow
                  key={d.id}
                  device={d}
                  code={codeOf(d.id)}
                  session={sessionsByDevice.get(d.id)}
                  booking={bookingsByDevice.get(d.id)}
                  selected={effectiveId === d.id}
                  onSelect={onSelect}
                  onAction={onCardAction}
                />
              ))}
            </div>
          )}
        </div>

        {wide && (
          <div className="sticky top-[68px] self-start">
            {panel ?? (
              <div className="lf-side grid min-h-[420px] place-items-center p-8 text-center">
                <div>
                  <MousePointerClick className="mx-auto h-8 w-8 text-lf-violet" />
                  <div className="mt-2 text-[14px] font-semibold">Select a station</div>
                  <p className="mt-1 text-[12px] text-lf-dim">Click any desk on the floor to see who's playing and take action.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <FloorFooter counts={counts} sessions={sessions} healthy={healthy} now={Date.now()} />

      {!wide && (
        <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelectedId(null); }}>
          <SheetContent side="bottom" className="lf-sheet lf-scroll max-h-[90vh] overflow-y-auto [&>button]:hidden">
            <SheetTitle className="sr-only">{selected ? `${codeOf(selected.id)} details` : "Station details"}</SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      )}

      <BookingDialog
        open={!!bookingDevice}
        device={bookingDevice}
        code={bookingDevice ? codeOf(bookingDevice.id) : ""}
        customers={customers}
        bookings={bookings}
        busy={busy}
        onClose={() => setBookingFor(null)}
        onSubmit={submitBooking}
      />
      <MaintenanceDialog
        open={!!maintDevice}
        code={maintDevice ? codeOf(maintDevice.id) : ""}
        name={maintDevice?.name ?? ""}
        hasSession={!!(maintDevice && sessionsByDevice.get(maintDevice.id))}
        busy={busy}
        onClose={() => setMaintFor(null)}
        onConfirm={confirmMaintenance}
      />
    </div>
  );
}
