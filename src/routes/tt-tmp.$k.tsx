import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { ConsoleShell } from "@/components/ConsoleShell";

export const Route = createFileRoute("/tt-tmp/$k")({ ssr: false, component: P });

function P() {
  const { k } = Route.useParams();
  const q = useQuery({ queryKey: ["tt", k], queryFn: () => new Promise<string>((r) => setTimeout(() => r("DATA " + k), 1500)) });
  return (
    <ConsoleShell badge="T" title="T" nav={[{ label: "A", icon: Activity, to: "/tt-tmp/a" }, { label: "B", icon: Activity, to: "/tt-tmp/b" }]}>
      <div className="h-40 text-2xl">PAGE {k} :: {q.data ?? "empty"}</div>
      <Link to="/tt-tmp/$k" params={{ k: k === "a" ? "b" : "a" }} id="go">go</Link>
    </ConsoleShell>
  );
}
