"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/Button";

/**
 * Self check-in action (nút "Xác nhận check-in" trên vé).
 *
 * Không tự render trạng thái "đã check-in": ghi xong thì gọi `router.refresh()`,
 * trang force-dynamic đọc lại row và SERVER dựng lại vé ở trạng thái đã check-in
 * (QR mờ + dấu). Một nguồn sự thật duy nhất cho phần "đã check-in", không nhân
 * đôi giao diện ở client. Nút giữ trạng thái "loading" tới khi server thay nó
 * bằng phần xác nhận — reconcile xong là nút biến mất.
 */
export function CheckinButton({ code }: { code: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
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
      router.refresh();
    } catch {
      setMsg("Không kết nối được. Vui lòng thử lại.");
      setState("error");
    }
  }

  return (
    <div>
      {state === "error" && (
        <p role="alert" className="mb-3 text-center text-sm text-danger">
          {msg}
        </p>
      )}
      <Button onClick={confirm} disabled={state === "loading"} className="w-full">
        {state === "loading" ? "Đang xác nhận..." : "Xác nhận check-in"}
      </Button>
    </div>
  );
}
