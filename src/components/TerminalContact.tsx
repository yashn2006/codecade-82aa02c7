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

  async function transmit() {
    if (!allFilled) {
      toast.error("Fill in name, email and message first.");
      return;
    }
    setSending(true);
    try {
      await submit({
        data: {
          name: values.name,
          email: values.email,
          phone: values.phone || null,
          message: values.message,
        },
      });
      setDone(true);
      toast.success("Transmission successful.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transmission failed.");
    } finally {
      setSending(false);
    }
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
    setValues((v) => ({ ...v, [current.key]: raw }));
    if (step < FIELDS.length - 1) setStep(step + 1);
    e.currentTarget.value = "";
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

          {done && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/5 p-3"
            >
              <div className="text-emerald-300">
                <span className="text-emerald-400">✓</span> transmission complete · we reply within 24h IST
              </div>
              <div className="mt-1 text-white/40">connection closed. you can close this window.</div>
            </motion.div>
          )}
        </div>

        {/* Footer / fallback button */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 bg-white/[0.02] px-4 py-2.5 text-[11px]">
          <div className="flex items-center gap-3 font-mono text-white/40">
            <span><span className="text-emerald-300">●</span> connected</span>
            <span>step {Math.min(step + 1, FIELDS.length)}/{FIELDS.length}</span>
          </div>
          <button
            type="button"
            onClick={transmit}
            disabled={sending || done || !allFilled}
            className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "transmitting…" : done ? "sent ✓" : "▸ :send"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
