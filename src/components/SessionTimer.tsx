import { useEffect, useState } from "react";

export function SessionTimer({ startedAt, hourlyRate }: { startedAt: string; hourlyRate: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, now - new Date(startedAt).getTime());
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const minutes = Math.ceil(ms / 60000);
  const amount = Math.ceil((hourlyRate * minutes) / 60);
  return (
    <div className="flex items-center justify-between font-mono text-sm">
      <span className="tabular-nums text-primary">
        {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
      <span className="text-azure">₹{amount}</span>
    </div>
  );
}
