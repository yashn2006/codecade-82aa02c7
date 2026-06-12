import { useEffect } from "react";

export type StatementTx = {
  id: string;
  amount: number;
  kind: string;
  note: string | null;
  created_at: string;
};

export function PrintableStatement({
  cafeName, customerName, customerPhone, balance, transactions, onClose,
}: {
  cafeName: string;
  customerName: string;
  customerPhone?: string | null;
  balance: number;
  transactions: StatementTx[];
  onClose: () => void;
}) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 250);
    return () => clearTimeout(id);
  }, []);

  const credits = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const debits  = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/80 p-6 print:static print:bg-white print:p-0">
      <div className="no-print fixed right-4 top-4 z-[101] flex gap-2">
        <button onClick={() => window.print()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Print / Save PDF</button>
        <button onClick={onClose} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm">Close</button>
      </div>

      <div id="statement-print" className="mx-auto w-[210mm] max-w-full rounded-md bg-white p-8 text-[12px] leading-snug text-black shadow-2xl print:shadow-none">
        <div className="flex items-start justify-between border-b border-black/40 pb-4">
          <div>
            <div className="text-xl font-extrabold uppercase tracking-wider">{cafeName}</div>
            <div className="text-[11px] opacity-70">Wallet Statement</div>
          </div>
          <div className="text-right text-[11px]">
            <div>Generated</div>
            <div className="font-mono">{new Date().toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-60">Customer</div>
            <div className="font-bold">{customerName}</div>
            {customerPhone && <div className="font-mono text-[11px]">{customerPhone}</div>}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider opacity-60">Current Balance</div>
            <div className="font-mono text-2xl font-extrabold">₹{balance}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded border border-black/30 p-2 text-center text-[11px]">
          <div><div className="opacity-60">Transactions</div><div className="font-mono text-base font-bold">{transactions.length}</div></div>
          <div><div className="opacity-60">Total credits</div><div className="font-mono text-base font-bold text-emerald-700">+₹{credits}</div></div>
          <div><div className="opacity-60">Total debits</div><div className="font-mono text-base font-bold text-rose-700">-₹{debits}</div></div>
        </div>

        <table className="mt-4 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1">Date &amp; Time</th>
              <th className="py-1">Type</th>
              <th className="py-1">Description</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr><td colSpan={4} className="py-4 text-center opacity-60">No transactions in this period.</td></tr>
            ) : transactions.map((t) => (
              <tr key={t.id} className="border-b border-black/15">
                <td className="py-1 font-mono">{new Date(t.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="py-1 uppercase">{t.kind}</td>
                <td className="py-1">{t.note ?? "—"}</td>
                <td className={`py-1 text-right font-mono font-bold ${t.amount > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {t.amount > 0 ? "+" : ""}₹{t.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 border-t border-black/30 pt-2 text-center text-[10px] opacity-60">
          This statement is computer-generated and does not require a signature. · Powered by CoreCade
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #statement-print, #statement-print * { visibility: visible !important; }
          #statement-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; padding: 12mm; }
          .no-print { display: none !important; }
          @page { margin: 8mm; size: A4; }
        }
      `}</style>
    </div>
  );
}
