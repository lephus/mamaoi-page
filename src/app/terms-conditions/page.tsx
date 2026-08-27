import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { LEGAL_EMAIL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description:
    "Điều khoản sử dụng ứng dụng Mama Ơi và website mamaoi.vn: dịch vụ, tài khoản, dữ liệu của trẻ, giới hạn trách nhiệm và liên hệ.",
};

/**
 * Nội dung lấy NGUYÊN VĂN từ file "ĐIỀU KHOẢN SỬ DỤNG- MAMA ƠI.docx" do khách
 * cung cấp (27/08/2026). Chỉ bỏ dòng "Điện thoại" theo yêu cầu. Muốn sửa câu chữ
 * phải sửa từ phía khách rồi đồng bộ lại đây — đừng tự viết lại.
 */
export default function TermsPage() {
  return (
    <LegalPage
      title="ĐIỀU KHOẢN SỬ DỤNG"
      intro={
        <>
          <p>
            Chào mừng bạn đến với <strong>Mama Ơi</strong>,
          </p>
          <p>
            Khi truy cập, đăng ký hoặc sử dụng Mama Ơi (“<strong>Dịch vụ</strong>”),
            bạn xác nhận đã đọc, hiểu và đồng ý với Điều khoản sử dụng này (“
            <strong>Điều khoản</strong>”) của chúng tôi.
          </p>
        </>
      }
    >
      <LegalSection n={1} title="DỊCH VỤ VÀ TÀI KHOẢN">
        <p>
          Mama Ơi cung cấp các công cụ giúp cha mẹ, người giám hộ và người chăm sóc trẻ ghi
          nhận và theo dõi thông tin như lịch bú/ăn, giấc ngủ, thay bỉm, cân nặng, chiều cao,
          tiêm chủng, các mốc phát triển và nhật ký chăm sóc trẻ.
        </p>
        <p>
          Dịch vụ hiện được cung cấp miễn phí. Nếu có tính năng trả phí, chúng tôi sẽ thông
          báo rõ về giá và điều kiện áp dụng trước khi phát sinh thanh toán. Người dùng phải
          từ đủ 16 tuổi trở lên và có đầy đủ năng lực hành vi dân sự để tạo tài khoản. Khi
          tạo hồ sơ của trẻ, bạn xác nhận mình là cha, mẹ, người giám hộ hoặc người có thẩm
          quyền hợp pháp.
        </p>
        <p>Mỗi tài khoản có thể quản lý tối đa 2 hồ sơ trẻ.</p>
        <p>
          Bạn có trách nhiệm cung cấp thông tin chính xác và bảo mật thông tin đăng nhập của
          mình.
        </p>
      </LegalSection>

      <LegalSection n={2} title="QUYỀN VÀ NGHĨA VỤ CỦA NGƯỜI DÙNG">
        <p>Bạn được sử dụng Mama Ơi cho mục đích hợp pháp và phù hợp với Điều khoản này.</p>
        <p>Bạn không được:</p>
        <ul>
          <li>Sử dụng Dịch vụ để thực hiện hành vi trái pháp luật;</li>
          <li>
            Truy cập hoặc can thiệp trái phép vào hệ thống, tài khoản hoặc dữ liệu của người
            khác;
          </li>
          <li>Sao chép, bán lại, khai thác thương mại hoặc sửa đổi Dịch vụ khi chưa được phép;</li>
          <li>Tải lên nội dung vi phạm pháp luật hoặc xâm phạm quyền của người khác;</li>
          <li>
            Phát tán mã độc hoặc thực hiện hành vi gây ảnh hưởng đến hoạt động, an toàn của
            Dịch vụ.
          </li>
        </ul>
        <p>
          Bạn chịu trách nhiệm về nội dung do mình cung cấp và cam kết có quyền hợp pháp đối
          với nội dung đó.
        </p>
      </LegalSection>

      <LegalSection n={3} title="DỮ LIỆU CÁ NHÂN VÀ DỮ LIỆU CỦA TRẺ">
        <p>
          Việc thu thập, sử dụng, lưu trữ, chia sẻ và xử lý dữ liệu cá nhân được thực hiện
          theo “
          <strong>
            <Link href="/privacy-policy">Chính sách quyền riêng tư</Link>
          </strong>
          ” của Mama Ơi và pháp luật Việt Nam về bảo vệ dữ liệu cá nhân.
        </p>
        <p>
          Một số thông tin về trẻ, bao gồm thông tin sức khỏe, có thể thuộc nhóm dữ liệu cá
          nhân nhạy cảm theo pháp luật. Khi cung cấp thông tin của trẻ, bạn xác nhận mình có
          quyền và thẩm quyền hợp pháp để cung cấp và quản lý các thông tin đó.
        </p>
        <p>
          Để vận hành Dịch vụ, dữ liệu có thể được lưu trữ hoặc xử lý bởi các nhà cung cấp
          dịch vụ công nghệ tại Việt Nam hoặc nước ngoài, theo phạm vi và điều kiện được quy
          định trong Chính sách quyền riêng tư và pháp luật áp dụng.
        </p>
        <p>
          Bạn có thể yêu cầu truy cập, điều chỉnh hoặc xóa dữ liệu của mình theo “
          <Link href="/privacy-policy">Chính sách quyền riêng tư</Link>”, trừ trường hợp
          pháp luật cho phép hoặc yêu cầu tiếp tục lưu trữ.
        </p>
      </LegalSection>

      <LegalSection n={4} title="MAMA ƠI KHÔNG THAY THẾ BÁC SĨ">
        <p>
          Mama Ơi là công cụ hỗ trợ ghi nhận và quản lý thông tin chăm sóc trẻ, không phải
          thiết bị y tế và không thay thế bác sĩ hoặc chuyên gia y tế.
        </p>
        <p>
          Các bài viết, thông tin, biểu đồ tăng trưởng, mốc phát triển, Wonder Week, gợi ý
          hoạt động hoặc nội dung khác trên Mama Ơi chỉ nhằm mục đích tham khảo chung.
        </p>
        <p>
          Các nội dung này không phải là chẩn đoán, tư vấn hoặc chỉ định điều trị y tế và
          không nên được sử dụng để tự chẩn đoán hoặc quyết định điều trị cho trẻ.
        </p>
        <p>
          Mỗi trẻ có tốc độ phát triển khác nhau. Nếu bạn lo lắng về sức khỏe hoặc sự phát
          triển của trẻ, hãy tham khảo ý kiến bác sĩ hoặc cơ sở y tế phù hợp. Trong trường
          hợp khẩn cấp, hãy liên hệ ngay với dịch vụ y tế hoặc cấp cứu phù hợp.
        </p>
      </LegalSection>

      <LegalSection n={5} title="NỘI DUNG VÀ QUYỀN SỞ HỮU TRÍ TUỆ">
        <p>
          Thông tin, nhật ký, hình ảnh và nội dung do bạn cung cấp vẫn thuộc quyền của bạn
          hoặc chủ thể có quyền hợp pháp. Bạn cho phép Chúng tôi lưu trữ, xử lý và hiển thị
          các nội dung này trong phạm vi cần thiết để cung cấp, duy trì và bảo mật Dịch vụ
          theo “<Link href="/privacy-policy">Chính sách quyền riêng tư</Link>”.
        </p>
        <p>
          Phần mềm, mã nguồn, giao diện, thiết kế, logo, tên thương mại, nội dung và các tài
          sản trí tuệ khác của Mama Ơi thuộc quyền sở hữu hoặc quyền sử dụng hợp pháp của
          Chúng tôi và/hoặc bên cấp phép.
        </p>
        <p>
          Bạn không được sao chép, phân phối, sửa đổi, bán lại hoặc khai thác thương mại các
          tài sản này nếu chưa được phép, trừ trường hợp pháp luật có quy định khác.
        </p>
      </LegalSection>

      <LegalSection n={6} title="TÍNH KHẢ DỤNG VÀ GIỚI HẠN TRÁCH NHIỆM">
        <p>
          Chúng tôi nỗ lực duy trì Mama Ơi hoạt động ổn định và cung cấp thông tin có chất
          lượng. Tuy nhiên, Dịch vụ có thể tạm thời bị gián đoạn do bảo trì, lỗi kỹ thuật,
          sự cố mạng hoặc các nguyên nhân ngoài khả năng kiểm soát hợp lý của Chúng tôi.
        </p>
        <p>
          Trong phạm vi pháp luật cho phép, Chúng tôi không chịu trách nhiệm đối với các
          thiệt hại gián tiếp hoặc phát sinh do việc sử dụng Dịch vụ, mất dữ liệu không phải
          lỗi từ ứng dụng, nhà cung cấp hoặc gián đoạn dịch vụ.
        </p>
        <p>
          Quy định này không loại trừ hoặc hạn chế bất kỳ trách nhiệm nào mà pháp luật Việt
          Nam không cho phép loại trừ hoặc hạn chế.
        </p>
        <p>Bạn nên chủ động sao lưu những thông tin quan trọng của mình.</p>
      </LegalSection>

      <LegalSection n={7} title="TẠM NGỪNG, CHẤM DỨT VÀ XÓA TÀI KHOẢN">
        <p>Bạn có thể ngừng sử dụng hoặc yêu cầu xóa tài khoản bất cứ lúc nào.</p>
        <p>
          Chúng tôi có thể tạm ngừng hoặc chấm dứt tài khoản nếu bạn vi phạm nghiêm trọng
          Điều khoản, sử dụng Dịch vụ trái pháp luật, gây ảnh hưởng đến an toàn của hệ thống
          hoặc khi pháp luật yêu cầu.
        </p>
        <p>
          Khi tài khoản bị xóa, dữ liệu sẽ được xử lý theo “
          <strong>
            <Link href="/privacy-policy">Chính sách quyền riêng tư</Link>
          </strong>
          ” và quy định pháp luật hiện hành. Một số dữ liệu có thể tiếp tục được lưu trữ
          trong trường hợp pháp luật yêu cầu hoặc cho phép.
        </p>
      </LegalSection>

      <LegalSection n={8} title="THAY ĐỔI ĐIỀU KHOẢN">
        <p>
          Chúng tôi có thể cập nhật Điều khoản này để phù hợp với sự thay đổi của Dịch vụ
          hoặc pháp luật.
        </p>
        <p>
          Đối với những thay đổi quan trọng, Chúng tôi sẽ thông báo thông qua ứng dụng,
          website, email hoặc phương thức phù hợp trước hoặc tại thời điểm thay đổi có hiệu
          lực.
        </p>
        <p>
          Phiên bản mới sẽ được công bố trên Mama Ơi cùng ngày cập nhật. Nếu không đồng ý
          với Điều khoản mới, bạn có thể ngừng sử dụng Dịch vụ và yêu cầu xóa tài khoản.
        </p>
        <p>
          Việc tiếp tục sử dụng Dịch vụ sau khi Điều khoản mới có hiệu lực được xem là bạn
          chấp nhận các thay đổi trong phạm vi pháp luật cho phép.
        </p>
      </LegalSection>

      <LegalSection n={9} title="KHIẾU NẠI, LUẬT ÁP DỤNG VÀ LIÊN HỆ">
        <p>Bạn có thể gửi câu hỏi, phản hồi hoặc khiếu nại liên quan đến Dịch vụ tới:</p>
        <p>Đơn vị sở hữu và vận hành Mama Ơi, thông qua:</p>
        <ul>
          <li>
            Email: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
          </li>
        </ul>
        <p>
          Các tranh chấp phát sinh liên quan đến Dịch vụ trước hết được ưu tiên giải quyết
          bằng thương lượng.
        </p>
        <p>
          Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Nếu tranh chấp không thể
          giải quyết bằng thương lượng, tranh chấp sẽ được giải quyết tại Tòa án có thẩm
          quyền theo quy định pháp luật Việt Nam.
        </p>
      </LegalSection>

      <p>
        <strong>© 2026 Mama Ơi. Bảo lưu mọi quyền.</strong>
      </p>
    </LegalPage>
  );
}
