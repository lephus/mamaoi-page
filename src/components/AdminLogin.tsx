"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/Button";

const input =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink " +
  "placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary";

export function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Đăng nhập thất bại");
        setLoading(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Không kết nối được. Vui lòng thử lại.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-3xl border border-line bg-white px-8 py-10 shadow-card"
    >
      <h1 className="text-2xl font-extrabold text-ink">Đăng nhập Admin</h1>
      <p className="mt-2 text-sm text-ink-faded">Quản lý check-in Mama Ơi Day</p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-primary-faded px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 space-y-4">
        <input name="email" type="email" autoComplete="username" placeholder="Email" className={input} required />
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Mật khẩu"
          className={input}
          required
        />
      </div>
      <Button type="submit" disabled={loading} className="mt-6 w-full">
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>
    </form>
  );
}
