import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  createTicket,
  listCustomerBookingCafes,
  listMyTickets,
} from "@/lib/tickets.functions";
import { supabase } from "@/lib/supabase/client";
import {
  TicketChatWorkspace,
  type WorkspaceTicket,
} from "@/components/TicketChatWorkspace";

type TicketRole = "owner" | "customer";

export type BookingSupportPrefill = {
  key: number;
  cafeId?: string | null;
  cafeName?: string | null;
  bookingId?: string | null;
  bookingRef?: string | null;
  bookingSummary?: string | null;
  subject?: string;
  category?: "general" | "billing" | "bookings" | "hardware" | "account" | "bug" | "feature";
  description?: string;
};

export function SupportTickets({
  role = "owner",
  cafeId,
  bookingPrefill,
  bookings = [],
}: {
  role?: TicketRole;
  cafeId?: string | null;
  bookingPrefill?: BookingSupportPrefill | null;
  bookings?: Array<{
    id: string;
    cafe_id?: string | null;
    scheduled_at: string;
    duration_minutes: number;
    cafes?: { id?: string; name?: string | null } | null;
    devices?: { name?: string | null } | null;
  }>;
}) {
  const fetchFn = useServerFn(listMyTickets);
  const fetchCafesFn = useServerFn(listCustomerBookingCafes);

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (bookingPrefill?.key) {
      setOpen(true);
    }
  }, [bookingPrefill?.key]);

  const q = useQuery({
    queryKey: ["my-tickets", role, cafeId ?? "all"],
    queryFn: () => fetchFn() as Promise<WorkspaceTicket[]>,
    refetchInterval: 6_000,
  });

  const cafesQ = useQuery({
    queryKey: ["customer-support-cafes"],
    queryFn: () => fetchCafesFn(),
    enabled: role === "customer",
    staleTime: 120_000,
  });

  const allTickets = q.data ?? [];
  const scopedTickets = allTickets.filter((t) => {
    if (t.role !== role) return false;
    if (role === "owner" && cafeId && t.cafe_id && t.cafe_id !== cafeId) return false;
    return true;
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {role === "customer" ? "Booking & Arena Support" : "CoreCade Support Desk"}
          </div>
          <h3 className="font-display text-2xl font-extrabold tracking-tight text-white">
            {role === "customer" ? "Message your café directly" : "Your support conversations"}
          </h3>
        </div>
      </div>

      <TicketChatWorkspace
        tickets={scopedTickets}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        viewerRole={role}
        viewerUserId={userId}
        queryKeysToInvalidate={[["my-tickets"]]}
        selectedId={selectedId}
        onSelectId={setSelectedId}
        realtimeTableFilter={userId ? `user_id=eq.${userId}` : undefined}
        emptyTitle={role === "customer" ? "No booking support chats yet" : "No support tickets yet"}
        emptyDescription={
          role === "customer"
            ? "Need to cancel a booking, change your time slot, or ask about a deposit? Create a ticket and chat directly with the café."
            : "Stuck on something? Create a ticket and chat live with the CoreCade engineering & ops team."
        }
        headerAction={
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-[40px] gap-2 rounded-xl font-bold text-white"
            style={{ background: "var(--gradient-brand-hot)" }}
          >
            <Plus className="h-4 w-4" /> Create Ticket
          </Button>
        }
        emptyAction={
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-1 gap-2 rounded-xl font-bold text-white"
            style={{ background: "var(--gradient-brand-hot)" }}
          >
            <Plus className="h-4 w-4" /> Create Ticket
          </Button>
        }
      />

      <NewTicketModal
        open={open}
        onOpenChange={setOpen}
        role={role}
        defaultCafeId={cafeId ?? null}
        cafes={cafesQ.data ?? []}
        bookings={bookings}
        prefill={bookingPrefill ?? null}
        onCreated={(id) => setSelectedId(id)}
      />
    </section>
  );
}

function NewTicketModal({
  open,
  onOpenChange,
  role,
  defaultCafeId,
  cafes,
  bookings,
  prefill,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: TicketRole;
  defaultCafeId: string | null;
  cafes: { id: string; name: string; slug: string; city: string | null; visited?: boolean }[];
  bookings: Array<{
    id: string;
    cafe_id?: string | null;
    scheduled_at: string;
    duration_minutes: number;
    cafes?: { id?: string; name?: string | null } | null;
    devices?: { name?: string | null } | null;
  }>;
  prefill: BookingSupportPrefill | null;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createTicket);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<
    "general" | "billing" | "bookings" | "hardware" | "account" | "bug" | "feature"
  >(role === "customer" ? "bookings" : "general");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [selectedCafeId, setSelectedCafeId] = useState<string>(defaultCafeId ?? "");
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    if (prefill) {
      setSubject(prefill.subject ?? "");
      setCategory(prefill.category ?? (role === "customer" ? "bookings" : "general"));
      setSelectedCafeId(prefill.cafeId ?? defaultCafeId ?? cafes[0]?.id ?? "");
      setSelectedBookingId(prefill.bookingId ?? "");
      setDescription(prefill.description ?? "");
    } else {
      setSubject("");
      setCategory(role === "customer" ? "bookings" : "general");
      setPriority("normal");
      setSelectedCafeId(defaultCafeId ?? cafes[0]?.id ?? "");
      setSelectedBookingId("");
      setDescription("");
    }
  }, [open, prefill, defaultCafeId, role, cafes]);

  const m = useMutation({
    mutationFn: create,
    onSuccess: (res) => {
      toast.success(`Ticket #TK-${res.id.slice(0, 8).toUpperCase()} opened — chat is live.`);
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      qc.invalidateQueries({ queryKey: ["cafe-customer-tickets"] });
      onCreated(res.id);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create ticket"),
  });

  const matchedBooking = bookings.find((b) => b.id === selectedBookingId);
  const resolvedCafeId =
    role === "customer"
      ? selectedCafeId || matchedBooking?.cafe_id || matchedBooking?.cafes?.id || null
      : defaultCafeId;

  const bookingRef =
    prefill?.bookingRef ||
    (matchedBooking ? `#BK-${matchedBooking.id.slice(0, 8).toUpperCase()}` : undefined);

  const bookingSummary =
    prefill?.bookingSummary ||
    (matchedBooking
      ? `${matchedBooking.devices?.name ?? "Station"} · ${new Date(matchedBooking.scheduled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} (${matchedBooking.duration_minutes}m)`
      : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl sm:text-2xl">
            {role === "customer" ? "Create Booking Support Ticket" : "Create Support Ticket"}
          </DialogTitle>
          <DialogDescription>
            {role === "customer"
              ? "Pick your arena and booking to start a live chat with the café desk for cancellations, slot changes, or refunds."
              : "Describe the reason and details below — once submitted, open the ticket anytime for live back-and-forth chat with CoreCade."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (role === "customer" && !resolvedCafeId) {
              toast.error("Please select the café you want to message");
              return;
            }
            m.mutate({
              data: {
                subject: subject.trim(),
                description: description.trim(),
                category,
                priority,
                role,
                cafe_id: resolvedCafeId,
                booking_id: selectedBookingId || prefill?.bookingId || undefined,
                booking_ref: bookingRef,
                booking_summary: bookingSummary,
              },
            });
          }}
        >
          {role === "customer" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Select Café *</Label>
                <select
                  value={selectedCafeId}
                  onChange={(e) => setSelectedCafeId(e.target.value)}
                  required
                  className="field-select h-10 text-sm"
                >
                  <option value="">Choose a café…</option>
                  {cafes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.city ? ` (${c.city})` : ""}
                      {c.visited ? " ★" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Linked Booking (optional)</Label>
                <select
                  value={selectedBookingId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedBookingId(id);
                    const b = bookings.find((x) => x.id === id);
                    if (b?.cafe_id) setSelectedCafeId(b.cafe_id);
                    else if (b?.cafes?.id) setSelectedCafeId(b.cafes.id);
                    if (b && !subject.trim()) {
                      setSubject(`Booking #BK-${b.id.slice(0, 8).toUpperCase()} update / cancellation`);
                    }
                  }}
                  className="field-select h-10 text-sm"
                >
                  <option value="">General question</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      #BK-{b.id.slice(0, 8).toUpperCase()} · {b.cafes?.name ?? "Arena"} ·{" "}
                      {new Date(b.scheduled_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>Subject / Reason *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              minLength={2}
              maxLength={200}
              placeholder={
                role === "customer"
                  ? "Cancel or reschedule booking #BK-..."
                  : "POS receipt printer / billing / floor sync issue"
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Category</Label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as
                      | "general"
                      | "billing"
                      | "bookings"
                      | "hardware"
                      | "account"
                      | "bug"
                      | "feature",
                  )
                }
                className="field-select h-10 text-sm"
              >
                <option value="bookings">Bookings &amp; Slots</option>
                <option value="billing">Billing &amp; Refunds</option>
                <option value="general">General</option>
                <option value="hardware">Hardware / Rigs</option>
                <option value="account">Account</option>
                <option value="bug">Bug</option>
                <option value="feature">Feature request</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Priority</Label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "low" | "normal" | "high" | "urgent")
                }
                className="field-select h-10 text-sm"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Message *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={2}
              maxLength={4000}
              rows={5}
              placeholder={
                role === "customer"
                  ? "Tell the café what you need — e.g. cancel slot, shift time, or refund deposit."
                  : "Describe what happened and what you expected. You can keep chatting after submitting."
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <MessageSquare className="mr-1 inline h-3 w-3" />
              Live two-way chat + instant notifications
            </span>
            <Button
              type="submit"
              disabled={m.isPending}
              className="min-h-[44px] gap-2 rounded-xl px-5 font-bold text-white"
              style={{ background: "var(--gradient-brand-hot)" }}
            >
              {m.isPending ? "Opening Chat…" : "Open Ticket & Start Chat"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
