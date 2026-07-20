import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { EVENT, SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description:
    "Điều khoản sử dụng ứng dụng Mama Ơi và website mamaoi.vn, bao gồm quy định tham dự sự kiện Mama Ơi Day.",
};

/**
 * Written to be true rather than maximally protective.
 *
 * The section that matters most is 6: Mama Ơi tracks a baby's health data and
 * surfaces developmental milestones, which mothers will inevitably read as
 * medical guidance. Saying plainly that it is not — and that a worried mother
 * should call a doctor, not open an app — is both the honest position and the
 * one that protects the client.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="Điều khoản sử dụng"
      intro={`Khi mẹ sử dụng ứng dụng Mama Ơi hoặc website này, mẹ đồng ý với các điều khoản dưới đây. Mong mẹ dành vài phút đọc qua — đặc biệt là mục 6 về giới hạn y tế.`}
    >
      <LegalSection n={1} title="Về dịch vụ">
        <p>
          Mama Ơi là ứng dụng giúp cha mẹ theo dõi hành trình lớn lên của con: cữ bú, giấc
          ngủ, lần thay bỉm, sức khoẻ và các mốc phát triển. Dịch vụ được cung cấp bởi{" "}
          <strong>{SITE.company}</strong>.
        </p>
        <p>
          Ứng dụng hiện được cung cấp <strong>miễn phí</strong>. Nếu sau này có tính năng
          trả phí, chúng tôi sẽ thông báo rõ ràng trước khi mẹ phải trả bất kỳ khoản nào.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Tài khoản của mẹ">
        <ul>
          <li>Mẹ cần cung cấp thông tin chính xác khi tạo tài khoản</li>
          <li>Mẹ chịu trách nhiệm giữ bí mật mật khẩu của mình</li>
          <li>Mỗi tài khoản có thể quản lý tối đa 2 hồ sơ bé</li>
          <li>
            Mẹ có thể yêu cầu xoá tài khoản bất cứ lúc nào — xem{" "}
            <Link href="/privacy-policy">Chính sách bảo mật</Link>
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={3} title="Mẹ đồng ý không">
        <ul>
          <li>Dùng dịch vụ vào mục đích trái pháp luật</li>
          <li>Cố gắng truy cập trái phép vào hệ thống hoặc dữ liệu của người khác</li>
          <li>Sao chép, phát tán hoặc bán lại nội dung của Mama Ơi khi chưa được phép</li>
          <li>Tải lên nội dung vi phạm pháp luật hoặc xâm phạm quyền của người khác</li>
        </ul>
      </LegalSection>

      <LegalSection n={4} title="Dữ liệu của mẹ thuộc về mẹ">
        <p>
          Nhật ký chăm sóc, ảnh và mọi thông tin mẹ nhập vào ứng dụng đều{" "}
          <strong>thuộc về mẹ</strong>. Chúng tôi chỉ lưu giữ và xử lý chúng để cung cấp
          dịch vụ cho mẹ, theo đúng <Link href="/privacy-policy">Chính sách bảo mật</Link>.
        </p>
        <p>Chúng tôi không sở hữu, không bán và không dùng dữ liệu của mẹ cho mục đích khác.</p>
      </LegalSection>

      <LegalSection n={5} title="Sự kiện Mama Ơi Day">
        <p>Với các mẹ đăng ký tham dự {EVENT.shortName}:</p>
        <ul>
          <li>
            Sự kiện <strong>miễn phí</strong>, giới hạn {EVENT.capacity}. Đăng ký được xác
            nhận theo thứ tự và theo số chỗ còn lại
          </li>
          <li>Mỗi mẹ chỉ đăng ký một lần. Mã check-in không được chuyển nhượng</li>
          <li>Mẹ vui lòng mang theo mã QR trong email xác nhận để check-in</li>
          <li>
            Lịch trình, diễn giả và quà tặng có thể thay đổi. Chúng tôi sẽ thông báo qua
            email nếu có thay đổi lớn
          </li>
          <li>
            Nếu sự kiện phải hoãn hoặc huỷ vì lý do bất khả kháng, chúng tôi sẽ thông báo
            sớm nhất có thể. Vì sự kiện miễn phí nên không phát sinh hoàn tiền
          </li>
          <li>
            Trong sự kiện có thể có chụp ảnh và quay phim phục vụ truyền thông. Nếu mẹ
            không muốn xuất hiện, vui lòng báo ban tổ chức tại quầy check-in
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={6} title="Mama Ơi không thay thế bác sĩ">
        <p>
          Đây là điều quan trọng nhất trong toàn bộ tài liệu này, nên chúng tôi nói thẳng:
        </p>
        <p>
          Mama Ơi là <strong>công cụ ghi chép</strong>, không phải thiết bị y tế. Mọi nội
          dung trong ứng dụng — bao gồm các mốc phát triển, thông tin Wonder Week, gợi ý
          hoạt động và bài viết từ chuyên gia — chỉ mang tính{" "}
          <strong>tham khảo chung</strong>.
        </p>
        <p>
          Mỗi em bé phát triển theo nhịp riêng. Việc bé chưa đạt một cột mốc nào đó trong
          ứng dụng <strong>không</strong> có nghĩa là bé có vấn đề, và việc bé đạt đủ mọi
          cột mốc <strong>không</strong> đảm bảo bé hoàn toàn khoẻ mạnh.
        </p>
        <p>
          <strong>
            Nếu mẹ lo lắng về sức khoẻ của bé, hãy gọi cho bác sĩ — đừng mở ứng dụng.
          </strong>{" "}
          Không bao giờ trì hoãn việc đi khám vì những gì mẹ đọc được ở đây.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Giới hạn trách nhiệm">
        <p>
          Chúng tôi nỗ lực để dịch vụ hoạt động ổn định và chính xác, nhưng cung cấp dịch
          vụ &quot;như hiện có&quot;. Chúng tôi không chịu trách nhiệm với những thiệt hại
          gián tiếp phát sinh từ việc sử dụng ứng dụng, trong phạm vi pháp luật cho phép.
        </p>
        <p>
          Mẹ nên sao lưu những dữ liệu quan trọng với mình. Chúng tôi có tính năng sao lưu,
          nhưng không thể đảm bảo tuyệt đối không bao giờ mất dữ liệu.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Thay đổi điều khoản">
        <p>
          Chúng tôi có thể cập nhật điều khoản này. Khi có thay đổi lớn, chúng tôi sẽ thông
          báo qua email hoặc trong ứng dụng trước khi áp dụng. Việc mẹ tiếp tục sử dụng
          dịch vụ sau đó đồng nghĩa với việc mẹ chấp nhận điều khoản mới.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Luật áp dụng và liên hệ">
        <p>
          Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Mọi tranh chấp sẽ được ưu
          tiên giải quyết thông qua thương lượng.
        </p>
        <p>
          Mọi câu hỏi, mẹ liên hệ <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
