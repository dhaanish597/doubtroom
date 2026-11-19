import { Check, CheckCheck } from "lucide-react";

export type TickState = "sent" | "delivered" | "read";

const labels: Record<TickState, string> = { sent: "Sent", delivered: "Delivered", read: "Read" };

export function ReadTicks({ state }: { state: TickState }) {
  const Icon = state === "sent" ? Check : CheckCheck;
  return <Icon role="img" aria-label={labels[state]} className={`size-3.5 ${state === "read" ? "text-indigo-600" : "text-muted-foreground"}`} />;
}
