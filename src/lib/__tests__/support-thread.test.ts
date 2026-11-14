import test from "node:test";
import assert from "node:assert/strict";
import {
  THREAD_PREFIX,
  appendThreadMessage,
  computeGamerProgression,
  encodeTicketThread,
  formatTicketRef,
  parseTicketThread,
} from "../support-thread";

test("formatTicketRef uppercases first 8 chars", () => {
  assert.equal(formatTicketRef("9b4fb998-1cd7-4ba6-b484-e7a2b95617af"), "#TK-9B4FB998");
});

test("parseTicketThread handles blank admin_reply with opening message", () => {
  const res = parseTicketThread({
    id: "t1",
    user_id: "u1",
    role: "owner",
    description: "Need help with POS printer",
    admin_reply: null,
    replied_at: null,
    created_at: "2026-11-10T10:00:00.000Z",
    userName: "Rakesh",
    cafeName: "Neo Grid",
  });
  assert.equal(res.meta.cafeName, "Neo Grid");
  assert.equal(res.messages.length, 1);
  assert.equal(res.messages[0].senderRole, "owner");
  assert.equal(res.messages[0].senderName, "Rakesh");
  assert.equal(res.messages[0].body, "Need help with POS printer");
});

test("parseTicketThread converts legacy plain-text admin_reply", () => {
  const res = parseTicketThread({
    id: "t2",
    user_id: "u2",
    role: "customer",
    description: "Can I shift my 5pm slot?",
    admin_reply: "Yes, moved to 6pm.",
    replied_at: "2026-11-10T10:15:00.000Z",
    created_at: "2026-11-10T10:00:00.000Z",
  });
  assert.equal(res.messages.length, 2);
  assert.equal(res.messages[0].senderRole, "customer");
  assert.equal(res.messages[1].senderRole, "admin");
  assert.equal(res.messages[1].body, "Yes, moved to 6pm.");
});

test("encode + appendTicketThread preserves booking metadata and multi-turn messages", () => {
  const initial = encodeTicketThread({
    bookingId: "bk-1234",
    bookingRef: "#BK-1234ABCD",
    bookingSummary: "PC-01 · 12 Nov, 6:00 PM (60m)",
    cafeName: "Rakesh Gaming Center",
    messages: [
      {
        id: "m1",
        senderId: "u-cust",
        senderRole: "customer",
        senderName: "Aarav",
        body: "Please cancel my booking if possible.",
        createdAt: "2026-11-12T10:00:00.000Z",
      },
    ],
  });
  assert.ok(initial.startsWith(THREAD_PREFIX));

  const nextEncoded = appendThreadMessage(
    {
      id: "t3",
      user_id: "u-cust",
      role: "customer",
      description: "Please cancel my booking if possible.",
      admin_reply: initial,
      replied_at: null,
      created_at: "2026-11-12T10:00:00.000Z",
    },
    {
      senderId: "u-owner",
      senderRole: "owner",
      senderName: "Rakesh Gaming Center",
      body: "Done! Refund credited to your wallet.",
      createdAt: "2026-11-12T10:05:00.000Z",
    },
  );

  const parsed = parseTicketThread({
    id: "t3",
    user_id: "u-cust",
    role: "customer",
    description: "Please cancel my booking if possible.",
    admin_reply: nextEncoded,
    replied_at: "2026-11-12T10:05:00.000Z",
    created_at: "2026-11-12T10:00:00.000Z",
  });

  assert.equal(parsed.meta.bookingRef, "#BK-1234ABCD");
  assert.equal(parsed.meta.cafeName, "Rakesh Gaming Center");
  assert.equal(parsed.messages.length, 2);
  assert.equal(parsed.messages[1].senderRole, "owner");
  assert.equal(parsed.messages[1].body, "Done! Refund credited to your wallet.");
});

test("computeGamerProgression scales deterministically from zero to high playtime", () => {
  const fresh = computeGamerProgression(null);
  assert.equal(fresh.level, 1);
  assert.equal(fresh.tier, "ROOKIE PLAYER");
  assert.equal(fresh.xp, 0);

  const vet = computeGamerProgression({ totalHours: 40, completed: 12, cafesVisited: 4 });
  assert.ok(vet.level >= 12);
  assert.equal(vet.tier, "DIAMOND VIP");
  assert.ok(vet.progressPct >= 4 && vet.progressPct <= 100);
});
