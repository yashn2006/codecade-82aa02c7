import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { submitContact } from "@/lib/contact.functions";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

type Field = "name" | "email" | "phone" | "message";
const FIELDS: { key: Field; label: string; type: string; required: boolean; placeholder: string }[] = [
  { key: "name", label: "name", type: "text", required: true, placeholder: "your full name" },
  { key: "email", label: "email", type: "email", required: true, placeholder: "you@cafe.in" },
  { key: "phone", label: "phone", type: "tel", required: false, placeholder: "+91 · optional" },
  { key: "message", label: "message", type: "text", required: true, placeholder: "what are you building?" },
];

/**
 * macOS-style terminal contact form. Each prompt animates in, the cursor
 * blinks, and the form submits when the user types `:send`. Falls back
 * to a regular submit button for accessibility.
 */
export function TerminalContact() {
  const submit = useServerFn(submitContact);
  const [step, setStep] = useState(0); // index in FIELDS
  const [values, setValues] = useState<Record<Field, string>>({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boot, setBoot] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Boot sequence
  useEffect(() => {
    const lines = [
      "corecade-cli v3.14.2 · secure tunnel established",
      "encrypting channel · TLS 1.3 · AES-256-GCM",
      "↳ ready. type to begin. press [enter] to advance, [:send] to transmit.",
    ];
    let i = 0;
    const id = setInterval(() => {
      setBoot((b) => [...b, lines[i]]);
      i++;
      if (i >= lines.length) clearInterval(id);
    }, 350);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, [step]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [values, step, boot, done]);

  const current = FIELDS[Math.min(step, FIELDS.length - 1)];
  const allFilled = FIELDS.every((f) => !f.required || values[f.key].trim().length > 0);

  async function transmit(override?: Partial<Record<Field, string>>) {
    const data = { ...values, ...(override || {}) };
    const filled = FIELDS.every((f) => !f.required || data[f.key].trim().length > 0);
    if (!filled) {
      toast.error("Fill in name, email and message first.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      // 1) Formspree (email notification)
      const fd = new FormData();
      fd.append("name", data.name);
      fd.append("email", data.email);
      fd.append("phone", data.phone || "");
      fd.append("message", data.message);
      fd.append("_subject", `New CoreCade lead · ${data.name}`);
      const res = await fetch("https://formspree.io/f/mpqebaak", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      if (!res.ok) throw new Error(`Formspree responded ${res.status}`);

      // 2) Persist to our backend (best-effort, don't block success)
      try {
        await submit({
          data: {
            name: data.name,
            email: data.email,
            phone: data.phone || null,
            message: data.message,
          },
        });
      } catch (innerErr) {
        console.warn("Backend persist failed (email still sent):", innerErr);
      }

      setDone(true);
      toast.success("Transmission successful.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Transmission failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  function retry() {
    setError(null);
    transmit();
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const raw = (e.currentTarget.value ?? "").trim();
    if (raw === ":send") return transmit();
    if (raw === ":clear") {
      setValues({ name: "", email: "", phone: "", message: "" });
      setStep(0);
      return;
    }
    const next = { ...values, [current.key]: raw };
    setValues(next);
    e.currentTarget.value = "";
    if (step < FIELDS.length - 1) {
      setStep(step + 1);
    } else {
      // Last field: auto-transmit with the freshly captured value
      transmit({ [current.key]: raw });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="border-conic glass-strong relative rounded-2xl p-1.5 shadow-[0_40px_120px_-30px_oklch(0.6_0.28_335/0.5)]"
    >
      <div className="rounded-[14px] bg-[#0a0a14]/95 overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
            ~/corecade/contact — zsh
          </div>
          <div className="w-12" />
        </div>

        <div
          ref={scrollRef}
          onClick={() => inputRef.current?.focus()}
          className="h-[440px] cursor-text overflow-y-auto px-4 py-4 font-mono text-[13px] leading-relaxed text-emerald-200/90"
        >
          {/* Boot */}
          {boot.map((l, i) => (
            <div key={i} className="text-white/40">
              <span className="text-emerald-400">$</span> {l}
            </div>
          ))}

          {/* Filled answers */}
          {FIELDS.slice(0, step).map((f) => (
            <div key={f.key} className="mt-1.5">
              <div className="text-white/40">
                <span className="text-fuchsia-300">corecade</span>
                <span className="text-white/30"> :: </span>
                <span className="text-violet-300">{f.label}</span>
                <span className="text-white/30"> › </span>
              </div>
              <div className="pl-3 text-emerald-200">
                {values[f.key] || <span className="text-white/30 italic">(skipped)</span>}
              </div>
            </div>
          ))}

          {/* Active prompt */}
          {!done && (
            <div className="mt-3">
              <div className="text-white/50">
                <span className="text-fuchsia-300">corecade</span>
                <span className="text-white/30"> :: </span>
                <span className="text-violet-300">{current.label}</span>
                {current.required && <span className="text-rose-400">*</span>}
                <span className="text-white/30"> › </span>
                <span className="text-white/30 italic">{current.placeholder}</span>
              </div>
              <div className="mt-1 flex items-center">
                <span className="mr-2 select-none text-emerald-400">›</span>
                <input
                  ref={inputRef}
                  type={current.type}
                  onKeyDown={handleKey}
                  className="flex-1 border-0 bg-transparent p-0 text-[13px] text-emerald-100 outline-none ring-0 placeholder:text-white/20 focus:outline-none focus:ring-0"
                  placeholder=""
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-emerald-300" />
              </div>
              <div className="mt-2 text-[11px] text-white/30">
                [enter] next · type <span className="text-emerald-300">:send</span> to transmit · <span className="text-rose-300">:clear</span> to reset
              </div>
            </div>
          )}

          <AnimatePresence>
            {sending && (
              <motion.div
                key="sending"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 flex items-center gap-3 rounded-md border border-sky-400/30 bg-sky-400/5 p-3"
              >
                <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
                <div>
                  <div className="text-sky-200">transmitting packet · TLS handshake → relay → inbox</div>
                  <div className="mt-0.5 flex gap-1 text-[11px] text-white/40">
                    {["dns", "tcp", "tls", "auth", "send"].map((s, i) => (
                      <motion.span
                        key={s}
                        initial={{ opacity: 0.2 }}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                      >
                        ▸{s}
                      </motion.span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {error && !sending && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 rounded-md border border-rose-400/40 bg-rose-400/5 p-3"
              >
                <div className="flex items-center gap-2 text-rose-300">
                  <AlertTriangle className="h-4 w-4" /> transmission failed · {error}
                </div>
                <div className="mt-1 text-white/40">stderr: connection reset · no data persisted</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={retry}
                    className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/40 bg-rose-400/10 px-3 py-1 font-mono text-[11px] text-rose-200 transition hover:bg-rose-400/20"
                  >
                    <RefreshCw className="h-3 w-3" /> retry :send
                  </button>
                  <button
                    onClick={() => { setError(null); setStep(0); setValues({ name: "", email: "", phone: "", message: "" }); }}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-white/60 transition hover:bg-white/10"
                  >
                    :clear &amp; restart
                  </button>
                </div>
              </motion.div>
            )}

            {done && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
                className="mt-4 overflow-hidden rounded-md border border-emerald-400/40 bg-emerald-400/5 p-3"
              >
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> transmission complete · we reply within 24h IST
                </div>
                <div className="mt-1 text-white/40">connection closed. socket released.</div>
                <motion.div
                  initial={{ width: 0 }} animate={{ width: "100%" }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="mt-2 h-0.5 rounded-full bg-gradient-to-r from-emerald-400 via-sky-300 to-fuchsia-400"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer / fallback button */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 bg-white/[0.02] px-4 py-2.5 text-[11px]">
          <div className="flex items-center gap-3 font-mono text-white/40">
            <span><span className="text-emerald-300">●</span> connected</span>
            <span>step {Math.min(step + 1, FIELDS.length)}/{FIELDS.length}</span>
          </div>
          <button
            type="button"
            onClick={() => transmit()}
            disabled={sending || done || !allFilled}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending && <Loader2 className="h-3 w-3 animate-spin" />}
            {sending ? "transmitting…" : done ? "sent ✓" : error ? "retry :send" : "▸ :send"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
