export type ThreadRole = "customer" | "owner" | "admin";

export type ThreadMessage = {
  id: string;
  senderId: string | null;
  senderRole: ThreadRole;
  senderName: string;
  body: string;
  createdAt: string;
};

export type BookingThreadMeta = {
  bookingId?: string;
  bookingRef?: string;
  bookingSummary?: string;
  cafeName?: string;
};

export type ParsedTicketThread = {
  meta: BookingThreadMeta;
  messages: ThreadMessage[];
};

export const THREAD_PREFIX = "/*CC_THREAD_V1*/";

type StoredThreadPayload = {
  v: 1;
  bookingId?: string;
  bookingRef?: string;
  bookingSummary?: string;
  cafeName?: string;
  messages: ThreadMessage[];
};

export function formatTicketRef(id: string): string {
  return `#TK-${id.slice(0, 8).toUpperCase()}`;
}

export function encodeTicketThread(
  payload: Omit<StoredThreadPayload, "v">,
): string {
  const clean: StoredThreadPayload = {
    v: 1,
    ...(payload.bookingId ? { bookingId: payload.bookingId } : {}),
    ...(payload.bookingRef ? { bookingRef: payload.bookingRef } : {}),
    ...(payload.bookingSummary ? { bookingSummary: payload.bookingSummary } : {}),
    ...(payload.cafeName ? { cafeName: payload.cafeName } : {}),
    messages: payload.messages,
  };
  return `${THREAD_PREFIX}${JSON.stringify(clean)}`;
}

export function parseTicketThread(ticket: {
  id: string;
  user_id?: string;
  role?: string | null;
  description: string;
  admin_reply: string | null;
  replied_at: string | null;
  created_at: string;
  userName?: string | null;
  cafeName?: string | null;
}): ParsedTicketThread {
  const creatorRole: ThreadRole =
    ticket.role === "customer" ? "customer" : ticket.role === "admin" ? "admin" : "owner";
  const creatorName =
    ticket.userName?.trim() || (creatorRole === "customer" ? "Player" : "Café Owner");

  const openingMsg: ThreadMessage = {
    id: `open-${ticket.id}`,
    senderId: ticket.user_id ?? null,
    senderRole: creatorRole,
    senderName: creatorName,
    body: ticket.description,
    createdAt: ticket.created_at,
  };

  const raw = ticket.admin_reply?.trim() ?? "";
  if (!raw) {
    return {
      meta: ticket.cafeName ? { cafeName: ticket.cafeName } : {},
      messages: [openingMsg],
    };
  }

  if (raw.startsWith(THREAD_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(THREAD_PREFIX.length)) as Partial<StoredThreadPayload>;
      const storedMsgs = Array.isArray(parsed.messages)
        ? parsed.messages.filter(
            (m): m is ThreadMessage =>
              Boolean(m && typeof m.body === "string" && m.body.trim().length > 0),
          )
        : [];
      const firstStored = storedMsgs[0];
      const hasOpening =
        firstStored &&
        firstStored.body.trim() === ticket.description.trim() &&
        firstStored.senderRole === creatorRole;

      const messages = hasOpening ? storedMsgs : [openingMsg, ...storedMsgs];
      return {
        meta: {
          bookingId: parsed.bookingId,
          bookingRef: parsed.bookingRef,
          bookingSummary: parsed.bookingSummary,
          cafeName: parsed.cafeName ?? ticket.cafeName ?? undefined,
        },
        messages,
      };
    } catch {
      // Fallback cleanly to plain-text parsing if payload was malformed
    }
  }

  // Legacy plain-text `admin_reply`: render creator description + admin reply bubble
  return {
    meta: ticket.cafeName ? { cafeName: ticket.cafeName } : {},
    messages: [
      openingMsg,
      {
        id: `legacy-reply-${ticket.id}`,
        senderId: null,
        senderRole: "admin",
        senderName: "CoreCade Support",
        body: raw,
        createdAt: ticket.replied_at ?? ticket.created_at,
      },
    ],
  };
}

export function appendThreadMessage(
  ticket: {
    id: string;
    user_id?: string;
    role?: string | null;
    description: string;
    admin_reply: string | null;
    replied_at: string | null;
    created_at: string;
    userName?: string | null;
    cafeName?: string | null;
  },
  msg: Omit<ThreadMessage, "id" | "createdAt"> & { id?: string; createdAt?: string },
): string {
  const parsed = parseTicketThread(ticket);
  const nextMsg: ThreadMessage = {
    id: msg.id ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    senderId: msg.senderId,
    senderRole: msg.senderRole,
    senderName: msg.senderName,
    body: msg.body.trim(),
    createdAt: msg.createdAt ?? new Date().toISOString(),
  };

  return encodeTicketThread({
    ...parsed.meta,
    messages: [...parsed.messages, nextMsg],
  });
}

export type GamerProgression = {
  level: number;
  tier: string;
  xp: number;
  nextLevelXp: number;
  progressPct: number;
};

export function computeGamerProgression(summary?: {
  totalHours?: number;
  completed?: number;
  cafesVisited?: number;
} | null): GamerProgression {
  const hours = Math.max(0, summary?.totalHours ?? 0);
  const completed = Math.max(0, summary?.completed ?? 0);
  const cafes = Math.max(0, summary?.cafesVisited ?? 0);

  const xp = Math.round(hours * 120 + completed * 250 + cafes * 150);
  const perLevel = 500;
  const level = Math.max(1, Math.floor(xp / perLevel) + 1);
  const currentFloor = (level - 1) * perLevel;
  const inLevel = xp - currentFloor;
  const progressPct = Math.min(100, Math.max(4, Math.round((inLevel / perLevel) * 100)));

  const tier =
    level >= 20
      ? "APEX LEGEND"
      : level >= 12
        ? "DIAMOND VIP"
        : level >= 6
          ? "PLATINUM PRO"
          : level >= 3
            ? "GOLD CHALLENGER"
            : "ROOKIE PLAYER";

  return {
    level,
    tier,
    xp,
    nextLevelXp: level * perLevel,
    progressPct,
  };
}
