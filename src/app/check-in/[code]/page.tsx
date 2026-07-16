import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { CheckinConfirm } from "@/components/CheckinConfirm";
import { findByCode, type RegistrationRow } from "@/lib/supabase";
import { formatCheckinTime } from "@/lib/time";
import { isValidCheckinCode } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Check-in — Mama Ơi Day",
  robots: { index: false, follow: false },
};

// Đọc DB theo từng request; không bao giờ được cache trạng thái "đã check-in".
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex flex-1 items-center px-5 py-16">
        <div className="mx-auto w-full max-w-md text-center">{children}</div>
      </main>
      <Footer />
    </>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white px-8 py-10 shadow-card">
      <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
      <p className="mt-3 text-base leading-7 text-ink-faded">{body}</p>
    </div>
  );
}

export default async function CheckinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).trim().toUpperCase();

  if (!isValidCheckinCode(code)) {
    return (
      <Shell>
        <Message
          title="Mã không hợp lệ"
          body="Đường dẫn check-in không đúng. Mẹ vui lòng kiểm tra lại email xác nhận."
        />
      </Shell>
    );
  }

  // Only the DB read sits inside the try. Building JSX in here would be a lie:
  // React renders the element later, so a render error could never reach this
  // catch — an error boundary is the tool for that.
  let row: RegistrationRow | null;
  try {
    row = await findByCode(code);
  } catch {
    return (
      <Shell>
        <Message
          title="Hệ thống tạm lỗi"
          body="Không kết nối được lúc này. Mẹ vui lòng báo nhân viên tại quầy check-in."
        />
      </Shell>
    );
  }

  if (!row) {
    return (
      <Shell>
        <Message
          title="Không tìm thấy mã"
          body="Mã này chưa có trong hệ thống. Mẹ vui lòng tới quầy để nhân viên hỗ trợ."
        />
      </Shell>
    );
  }

  if (row.checked_in) {
    return (
      <Shell>
        <Message
          title="Mẹ đã check-in rồi 💛"
          body={`Chào chị ${row.ho_ten}, mẹ đã check-in lúc ${formatCheckinTime(
            row.checked_in_at ?? "",
          )}.`}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <CheckinConfirm code={code} name={row.ho_ten} />
    </Shell>
  );
}
