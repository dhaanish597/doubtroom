"use client";

import { CONNECTION_CODE } from "@/lib/nexconn/codes";
import { useConnection } from "@/lib/stores/connection";

export function ConnectionBanner({ onReconnect }: { onReconnect: () => void }) {
  const status = useConnection((state) => state.status);
  const code = useConnection((state) => state.code);
  const error = useConnection((state) => state.error);

  if (status === "idle") return null;
  if (status === "connecting") return <p role="status">Connecting…</p>;
  if (status === "connected") return <p role="status">Connected</p>;

  const kicked = code === CONNECTION_CODE.KICKED;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p role="status">{kicked ? "Opened in another tab or device" : error ?? "Offline"}</p>
      <button type="button" className="underline" onClick={onReconnect}>
        {kicked ? "Use here" : "Reconnect"}
      </button>
    </div>
  );
}
