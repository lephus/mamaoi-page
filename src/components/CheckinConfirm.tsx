"use client";

import { useState } from "react";
import { formatCheckinTime } from "@/lib/time";
import { Button } from "./ui/Button";

export function CheckinConfirm({ code, name }: { code: string; name: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [time, setTime] = useState("");
  const [already, setAlready] = useState(false);
  const [msg, setMsg] = useState("");

  async function confirm() {
    setState("loading");
    setMsg("");
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Có lỗi xảy ra");
        setState("error");
        return;
      }
      setTime(data.time);
      setAlready(Boolean(data.alreadyCheckedIn));
      setState("done");
    } catch {
      setMsg("Không kết nối được. Vui lòng thử lại.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-3xl border border-success bg-white px-8 py-10 shadow-card">
        <div className="text-5xl">✅</div>
        <h1 className="mt-3 text-2xl font-extrabold text-ink">
          {already ? "Mẹ đã check-in rồi" : "Check-in thành công!"}
        </h1>
        <p className="mt-3 text-base leading-7 text-ink-faded">
          Chào chị <strong className="text-ink">{name}</strong>,{" "}
          {already ? "mẹ đã check-in" : "check-in"} lúc{" "}
          <strong className="text-ink">{formatCheckinTime(time)}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-white px-8 py-10 shadow-card">
      <h1 className="text-2xl font-extrabold text-ink">Chào chị {name} 💛</h1>
      <p className="mt-3 text-base leading-7 text-ink-faded">
        Nhấn nút bên dưới để xác nhận check-in tại Mama Ơi Day.
      </p>
      {state === "error" && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {msg}
        </p>
      )}
      <Button onClick={confirm} disabled={state === "loading"} className="mt-6 w-full">
        {state === "loading" ? "Đang xác nhận..." : "Xác nhận check-in"}
      </Button>
    </div>
  );
}
