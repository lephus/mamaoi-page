import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Chính sách bảo mật",
  description:
    "Chính sách bảo mật của ứng dụng Mama Ơi và website mamaoi.vn — chúng tôi thu thập gì, dùng để làm gì, và mẹ có quyền gì.",
};

/**
 * This is NOT the generic template rewritten in Vietnamese.
 *
 * The template supplied covered a nameless app collecting "name, email, gender,
 * location, pictures". Mama Ơi collects a phone number, a Facebook profile, a
 * pregnancy status and a baby's age, weight, height, temperature, medicines and
 * vaccination history — health data about a child, which Vietnam's Nghị định
 * 13/2023/NĐ-CP treats as sensitive personal data with stricter obligations.
 *
 * A privacy policy that under-describes what is actually collected is worse
 * than none: it is a false statement to the user and to the app stores, both of
 * which cross-check the policy against the app's declared data practices.
 * Keep this document in step with the data the product actually touches.
 */
export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Chính sách bảo mật"
      intro={`Chính sách này giải thích ${SITE.company} thu thập những thông tin gì khi mẹ sử dụng ứng dụng Mama Ơi và website này, chúng tôi dùng chúng để làm gì, và mẹ có những quyền gì đối với dữ liệu của mình.`}
    >
      <LegalSection n={1} title="Chúng tôi là ai">
        <p>
          Ứng dụng và website Mama Ơi được vận hành bởi <strong>{SITE.company}</strong>.
          Mọi câu hỏi về dữ liệu cá nhân, mẹ có thể liên hệ:
        </p>
        <ul>
          <li>
            Email: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection n={2} title="Thông tin chúng tôi thu thập">
        <h3>2.1. Thông tin mẹ chủ động cung cấp</h3>
        <p>Khi mẹ đăng ký sự kiện hoặc nhận tin trên website:</p>
        <ul>
          <li>Họ tên, email, số điện thoại</li>
          <li>Tài khoản Facebook (nếu mẹ cung cấp)</li>
          <li>Tỉnh/thành đang sinh sống</li>
          <li>
            Tình trạng hiện tại: <strong>chuẩn bị mang thai</strong>,{" "}
            <strong>IVF</strong>, <strong>đang mang thai</strong> hoặc{" "}
            <strong>bé đã chào đời</strong>, và số tháng tuổi của bé (nếu có)
          </li>
          <li>Việc mẹ có đi cùng chồng hay không</li>
        </ul>

        <h3>2.2. Thông tin trong ứng dụng Mama Ơi</h3>
        <p>
          Khi mẹ sử dụng ứng dụng để theo dõi bé, chúng tôi lưu những dữ liệu mẹ nhập vào:
        </p>
        <ul>
          <li>Hồ sơ bé: tên, giới tính, ngày sinh hoặc ngày dự sinh, ảnh đại diện</li>
          <li>Nhật ký chăm sóc: cữ bú, giấc ngủ, lần thay bỉm, bữa ăn dặm</li>
          <li>
            Dữ liệu sức khoẻ của bé: cân nặng, chiều cao, nhiệt độ, thuốc đã dùng, lịch
            tiêm vaccine
          </li>
          <li>Cột mốc phát triển và ảnh kỷ niệm mẹ tự thêm vào</li>
        </ul>
        <p>
          Chúng tôi hiểu rằng đây là <strong>thông tin sức khoẻ của một đứa trẻ</strong> —
          thuộc nhóm dữ liệu cá nhân nhạy cảm theo Nghị định 13/2023/NĐ-CP. Chúng tôi chỉ
          thu thập những gì cần thiết để ứng dụng hoạt động, và không bao giờ bán chúng.
        </p>

        <h3>2.3. Thông tin thu thập tự động</h3>
        <ul>
          <li>Loại thiết bị, hệ điều hành, phiên bản ứng dụng</li>
          <li>
            Dữ liệu sử dụng ẩn danh qua Google Analytics và Meta Pixel, để hiểu mẹ tìm
            đến chúng tôi từ đâu và phần nào của trang chưa rõ ràng
          </li>
        </ul>
        <p>
          Ứng dụng <strong>không</strong> truy cập vị trí GPS, danh bạ hay tin nhắn của mẹ.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Chúng tôi dùng thông tin để làm gì">
        <ul>
          <li>Xác nhận đăng ký sự kiện, gửi email xác nhận và mã QR check-in</li>
          <li>
            Gửi đúng nội dung với giai đoạn của mẹ và bé — một người mẹ đang mang thai và
            một người mẹ có bé 10 tháng cần những thông tin rất khác nhau
          </li>
          <li>Tính toán các mốc phát triển (Wonder Week) từ ngày dự sinh của bé</li>
          <li>Hiển thị thống kê và biểu đồ về thói quen sinh hoạt của bé</li>
          <li>
            Tạo sẵn hồ sơ trên ứng dụng Mama Ơi để mẹ không phải nhập lại thông tin đã
            cung cấp khi đăng ký sự kiện
          </li>
          <li>Cải thiện sản phẩm và khắc phục lỗi</li>
        </ul>
        <p>
          Chúng tôi chỉ gửi email quảng bá cho mẹ khi mẹ đã <strong>chủ động đồng ý</strong>{" "}
          tại thời điểm đăng ký. Mẹ có thể huỷ đăng ký bất cứ lúc nào bằng liên kết ở cuối
          mỗi email.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Chúng tôi chia sẻ với ai">
        <p>
          Chúng tôi <strong>không bán</strong> dữ liệu cá nhân của mẹ cho bất kỳ ai. Chúng
          tôi chỉ chia sẻ với những nhà cung cấp dịch vụ cần thiết để vận hành:
        </p>
        <ul>
          <li>
            <strong>Brevo</strong> — lưu trữ danh bạ và gửi email xác nhận
          </li>
          <li>
            <strong>Google (Sheets, Analytics)</strong> — quản lý danh sách tham dự và đo
            lường lưu lượng truy cập
          </li>
          <li>
            <strong>Meta</strong> — đo lường hiệu quả quảng cáo qua Meta Pixel
          </li>
          <li>
            <strong>Vercel</strong> — vận hành hạ tầng website
          </li>
        </ul>
        <p>
          Các đơn vị này chỉ được xử lý dữ liệu theo yêu cầu của chúng tôi và không được
          dùng cho mục đích riêng. Ngoài ra, chúng tôi chỉ tiết lộ thông tin khi có yêu cầu
          hợp pháp từ cơ quan nhà nước có thẩm quyền.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Quyền của mẹ">
        <p>Theo Nghị định 13/2023/NĐ-CP, mẹ có quyền:</p>
        <ul>
          <li>Biết chúng tôi đang lưu những thông tin gì về mẹ và bé</li>
          <li>Yêu cầu sửa thông tin sai</li>
          <li>
            <strong>Yêu cầu xoá toàn bộ dữ liệu</strong> — bao gồm cả hồ sơ bé và nhật ký
            chăm sóc
          </li>
          <li>Rút lại sự đồng ý đã cho, bất cứ lúc nào</li>
          <li>Yêu cầu ngừng xử lý dữ liệu của mẹ</li>
        </ul>
        <p>
          Để thực hiện các quyền trên, mẹ gửi email tới{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>. Chúng tôi sẽ phản hồi trong
          vòng 72 giờ.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Lưu trữ và bảo mật">
        <p>
          Dữ liệu được truyền qua kết nối mã hoá (HTTPS) và lưu trên hạ tầng của các nhà
          cung cấp nêu tại mục 4. Chúng tôi giới hạn số người có quyền truy cập ở mức tối
          thiểu cần thiết.
        </p>
        <p>
          Chúng tôi lưu dữ liệu chừng nào tài khoản của mẹ còn hoạt động. Khi mẹ yêu cầu
          xoá, dữ liệu sẽ được xoá khỏi hệ thống trong vòng 30 ngày.
        </p>
        <p>
          Chúng tôi nói thật với mẹ: không có hệ thống nào an toàn tuyệt đối. Chúng tôi
          dùng các biện pháp bảo vệ hợp lý theo tiêu chuẩn ngành, nhưng không thể cam kết
          rủi ro bằng không.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Trẻ em">
        <p>
          Ứng dụng Mama Ơi dành cho <strong>người lớn</strong> — cha mẹ và người chăm sóc.
          Chúng tôi không cho phép trẻ em dưới 16 tuổi tự tạo tài khoản.
        </p>
        <p>
          Dữ liệu về em bé trong ứng dụng là do <strong>chính cha mẹ nhập vào</strong> về
          con mình. Cha mẹ toàn quyền xem, sửa và xoá những dữ liệu này bất cứ lúc nào.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Thay đổi chính sách">
        <p>
          Khi có thay đổi, chúng tôi sẽ cập nhật trang này và đổi ngày &quot;Cập nhật lần
          cuối&quot; ở đầu trang. Với những thay đổi lớn ảnh hưởng đến quyền của mẹ, chúng
          tôi sẽ thông báo qua email hoặc trong ứng dụng.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
