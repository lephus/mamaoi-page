import Image from "next/image";
import Link from "next/link";
import { BUILT_BY, SITE } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line/60 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 md:grid-cols-3">
        <div>
          <Image
            src="/images/logo-lockup.png"
            alt="Mama Ơi — Đồng hành cùng mẹ mỗi ngày"
            width={1095}
            height={261}
            className="h-16 w-auto"
          />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">Khám phá</h2>
          <ul className="space-y-2 text-sm text-ink-faded">
            {/* TẠM ẨN: trang chủ `/` đang bị redirect sang /su-kien (xem
                next.config.ts), để lại link này thì bấm vào chỉ đi lòng vòng.
                Bỏ comment để hiện lại, cùng lúc với việc mở lại trang chủ. */}
            {/* <li>
              <Link href="/" className="hover:text-primary">
                Ứng dụng Mama Ơi
              </Link>
            </li> */}
            <li>
              <Link href="/su-kien" className="hover:text-primary">
                Sự kiện Mama Ơi Day
              </Link>
            </li>
            <li>
              <Link href="/privacy-policy" className="hover:text-primary">
                Chính sách bảo mật
              </Link>
            </li>
            <li>
              <Link href="/terms-conditions" className="hover:text-primary">
                Điều khoản sử dụng
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold text-ink">Liên hệ</h2>
          <ul className="space-y-2 text-sm text-ink-faded">
            <li>{SITE.company}</li>
            <li>
              <a href={`mailto:${SITE.email}`} className="hover:text-primary">
                {SITE.email}
              </a>
            </li>
            <li>
              <a href={`tel:${SITE.phone}`} className="hover:text-primary">
                {SITE.phone}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line/60 py-5 text-center text-xs text-ink-faded">
        <p>© {new Date().getFullYear()} {SITE.company}. Bảo lưu mọi quyền.</p>
        <p className="mt-1">{BUILT_BY}</p>
      </div>
    </footer>
  );
}
