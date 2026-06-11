import { useEffect } from "react";

export type ReceiptOrder = {
  id: string;
  receipt_no: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  gst_rate: number;
  payment_method: string | null;
  refund_amount: number;
  paid_at: string | null;
  created_at: string;
  order_items: { name: string; qty: number; unit_price: number }[];
  customers: { full_name?: string; phone?: string } | null;
  cafes: { name?: string; address?: string; city?: string; phone?: string; gst_no?: string } | null;
};

export function PrintableReceipt({ order, onClose }: { order: ReceiptOrder; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 200);
    return () => clearTimeout(id);
  }, []);

  const cafe = order.cafes ?? {};
  const cust = order.customers ?? {};
  const total = order.total_amount || order.subtotal;
  const dt = new Date(order.paid_at ?? order.created_at);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/80 p-6 print:static print:bg-white print:p-0">
      <div className="no-print fixed right-4 top-4 z-[101] flex gap-2">
        <button onClick={() => window.print()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground">Print</button>
        <button onClick={onClose} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm">Close</button>
      </div>
      <div
        id="receipt-print"
        className="mx-auto w-[78mm] rounded-md bg-white p-3 text-[11px] leading-tight text-black shadow-2xl print:shadow-none"
        style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
      >
        <div className="text-center">
          <div className="text-base font-extrabold uppercase tracking-wider">{cafe.name ?? "Café"}</div>
          {cafe.address && <div>{cafe.address}{cafe.city ? `, ${cafe.city}` : ""}</div>}
          {cafe.phone && <div>Ph: {cafe.phone}</div>}
          {cafe.gst_no && <div>GSTIN: {cafe.gst_no}</div>}
        </div>
        <div className="my-2 border-t border-dashed border-black/60" />
        <div className="flex justify-between"><span>Receipt</span><span className="font-bold">{order.receipt_no ?? order.id.slice(0, 8)}</span></div>
        <div className="flex justify-between"><span>Date</span><span>{dt.toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span></div>
        {cust.full_name && <div className="flex justify-between"><span>Customer</span><span>{cust.full_name}</span></div>}
        <div className="my-2 border-t border-dashed border-black/60" />
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/40 text-left">
              <th className="pb-1">Item</th>
              <th className="pb-1 text-center">Qty</th>
              <th className="pb-1 text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map((it, i) => (
              <tr key={i}>
                <td className="py-0.5">{it.name}</td>
                <td className="py-0.5 text-center">{it.qty}</td>
                <td className="py-0.5 text-right">₹{it.unit_price * it.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="my-2 border-t border-dashed border-black/60" />
        <Row k="Subtotal" v={`₹${order.subtotal}`} />
        {order.discount_amount > 0 && <Row k="Discount" v={`-₹${order.discount_amount}`} />}
        {order.tax_amount > 0 && <Row k={`GST (${order.gst_rate}%)`} v={`₹${order.tax_amount}`} />}
        <div className="mt-1 border-t border-black pt-1 text-sm font-extrabold">
          <Row k="TOTAL" v={`₹${total}`} />
        </div>
        {order.refund_amount > 0 && (
          <div className="mt-1 text-rose-700">
            <Row k="Refunded" v={`-₹${order.refund_amount}`} />
          </div>
        )}
        <div className="mt-1">
          <Row k="Paid by" v={(order.payment_method ?? "—").toUpperCase()} />
        </div>
        <div className="mt-3 text-center">— THANK YOU —</div>
        <div className="text-center text-[9px] opacity-70">Powered by CoreCade</div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-print, #receipt-print * { visibility: visible !important; }
          #receipt-print { position: absolute; left: 0; top: 0; width: 78mm; box-shadow: none; }
          .no-print { display: none !important; }
          @page { margin: 4mm; size: 80mm auto; }
        }
      `}</style>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span>{k}</span><span>{v}</span></div>;
}
