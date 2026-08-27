import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { LEGAL_EMAIL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư và xử lý dữ liệu cá nhân",
  description:
    "Chính sách quyền riêng tư của ứng dụng Mama Ơi và website mamaoi.vn: chúng tôi thu thập dữ liệu gì, xử lý vì mục đích gì, và Người dùng có những quyền nào.",
};

/**
 * Nội dung lấy NGUYÊN VĂN từ file "BẢO MẬT QUYỀN RIÊNG TƯ VÀ XỬ LÝ DỮ LIỆU CÁ
 * NHÂN.-MAMA ƠI docx.docx" do khách cung cấp (27/08/2026). Chỉ bỏ dòng "Điện
 * thoại" theo yêu cầu. Muốn sửa câu chữ phải sửa từ phía khách rồi đồng bộ lại
 * đây — đừng tự viết lại.
 *
 * Các store cross-check chính sách với data practices khai báo của app, nên tài
 * liệu này phải luôn đi cùng dữ liệu mà sản phẩm thực sự chạm tới.
 */
export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="CHÍNH SÁCH QUYỀN RIÊNG TƯ VÀ XỬ LÝ DỮ LIỆU CÁ NHÂN">
      <LegalSection n={1} title="CHÚNG TÔI LÀ AI">
        <p>
          Đơn vị sở hữu và vận hành Mama Ơi
          <br />
          Email: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
        </p>
        <p>
          Chúng tôi là bên quyết định mục đích và phương tiện xử lý dữ liệu cá nhân trong
          phạm vi Mama Ơi cung cấp Dịch vụ.
        </p>
        <p>
          Người dùng có thể liên hệ với chúng tôi qua email trên để thực hiện các quyền liên
          quan đến dữ liệu cá nhân hoặc gửi câu hỏi, yêu cầu và khiếu nại.
        </p>
      </LegalSection>

      <LegalSection n={2} title="DỮ LIỆU CHÚNG TÔI THU THẬP">
        <p>
          Tùy theo cách Người dùng sử dụng Mama Ơi, chúng tôi có thể thu thập và xử lý các
          nhóm dữ liệu cá nhân sau. Dữ liệu được phân loại và áp dụng biện pháp bảo vệ phù
          hợp theo quy định pháp luật Việt Nam.
        </p>

        <h3>2.1. Dữ liệu cá nhân cơ bản</h3>
        <p>Có thể bao gồm:</p>
        <ul>
          <li>Họ tên, email, số điện thoại;</li>
          <li>Thông tin tài khoản và thông tin đăng nhập;</li>
          <li>Thông tin hồ sơ của trẻ như tên, giới tính, ngày sinh hoặc ngày dự sinh;</li>
        </ul>

        <h3>2.2. Dữ liệu cá nhân nhạy cảm</h3>
        <p>
          Tùy thuộc vào nội dung Người dùng cung cấp và mục đích xử lý, có thể bao gồm các
          thông tin thuộc nhóm dữ liệu cá nhân nhạy cảm theo pháp luật, đặc biệt là thông
          tin về sức khỏe và đời tư có liên quan đến sức khỏe, sinh sản.
        </p>
        <p>Đối với Mama Ơi, nhóm dữ liệu này có thể bao gồm:</p>
        <ul>
          <li>Thông tin về tình trạng sức khỏe, bệnh, triệu chứng hoặc tình trạng điều trị;</li>
          <li>Cân nặng, chiều cao, nhiệt độ và các chỉ số sức khỏe của trẻ;</li>
          <li>Thông tin về thuốc, tiêm chủng và chăm sóc sức khỏe;</li>
          <li>Các thông tin khác mà pháp luật xác định là dữ liệu cá nhân nhạy cảm.</li>
        </ul>
        <p>
          Không phải mọi thông tin về trẻ hoặc mọi nội dung được nhập vào ứng dụng đều mặc
          nhiên là dữ liệu cá nhân nhạy cảm. Việc phân loại được xác định căn cứ vào bản
          chất của dữ liệu và quy định pháp luật tại từng thời điểm.
        </p>
        <p>
          Công ty áp dụng biện pháp bảo vệ ở mức dành cho dữ liệu cá nhân nhạy cảm đối với
          toàn bộ dữ liệu sức khỏe của trẻ.
        </p>

        <h3>2.3. Dữ liệu được thu thập tự động</h3>
        <p>
          Khi Người dùng truy cập website hoặc sử dụng ứng dụng, chúng tôi có thể thu thập
          một số thông tin kỹ thuật và dữ liệu sử dụng cần thiết cho việc vận hành, bảo mật,
          phân tích và cải thiện Dịch vụ.
        </p>
        <p>
          Website có thể sử dụng cookie và công nghệ tương tự. Các công cụ phân tích hoặc
          quảng cáo không thiết yếu, như Google Analytics hoặc Meta Pixel, được sử dụng theo
          lựa chọn của Người dùng và quy định pháp luật áp dụng.
        </p>
      </LegalSection>

      <LegalSection n={3} title="MỤC ĐÍCH VÀ CĂN CỨ XỬ LÝ">
        <p>Mama Ơi xử lý dữ liệu cá nhân trong phạm vi cần thiết để:</p>
        <ul>
          <li>Tạo và quản lý tài khoản;</li>
          <li>Cung cấp các tính năng theo dõi, ghi nhận và thống kê;</li>
          <li>Quản lý hồ sơ của trẻ;</li>
          <li>
            Tính toán và hiển thị các thông tin, mốc phát triển được cung cấp trong ứng dụng;
          </li>
          <li>Xác nhận đăng ký và tổ chức Mama Ơi Day;</li>
          <li>Gửi thông báo và thông tin liên quan đến Dịch vụ;</li>
          <li>Cải thiện sản phẩm, bảo mật hệ thống và khắc phục lỗi;</li>
          <li>Thực hiện nghĩa vụ theo quy định pháp luật;</li>
          <li>Thực hiện các mục đích khác đã được thông báo hợp pháp cho Người dùng.</li>
        </ul>
        <p>
          Tùy từng trường hợp, việc xử lý dữ liệu có thể dựa trên sự đồng ý của Người dùng
          hoặc căn cứ xử lý khác được pháp luật cho phép.
        </p>
        <p>
          Đối với hoạt động xử lý mà pháp luật yêu cầu phải có sự đồng ý, Mama Ơi sẽ cung
          cấp thông tin phù hợp và thực hiện việc lấy sự đồng ý theo đúng hình thức, điều
          kiện và phạm vi pháp luật quy định.
        </p>
        <p>
          Người dùng có thể rút lại sự đồng ý khi pháp luật cho phép. Việc rút lại sự đồng ý
          không ảnh hưởng đến tính hợp pháp của hoạt động xử lý đã được thực hiện trước thời
          điểm rút lại.
        </p>
      </LegalSection>

      <LegalSection n={4} title="DỮ LIỆU CỦA TRẺ EM">
        <p>
          Mama Ơi được thiết kế để cha mẹ, người giám hộ hoặc người chăm sóc trẻ sử dụng.
          Trẻ em không được tự tạo tài khoản để sử dụng Dịch vụ.
        </p>
        <p>
          Khi cung cấp thông tin của trẻ, Người dùng xác nhận mình là cha, mẹ, người giám hộ
          hoặc người có thẩm quyền hợp pháp để cung cấp và quản lý thông tin đó.
        </p>
        <p>
          Mama Ơi áp dụng các biện pháp bảo vệ phù hợp đối với dữ liệu cá nhân của trẻ theo
          quy định pháp luật.
        </p>
        <p>
          Cha mẹ hoặc người có thẩm quyền hợp pháp có thể yêu cầu truy cập, điều chỉnh hoặc
          xóa dữ liệu của trẻ trong phạm vi pháp luật cho phép.
        </p>
      </LegalSection>

      <LegalSection n={5} title="LƯU TRỮ VÀ CHUYỂN DỮ LIỆU RA NƯỚC NGOÀI">
        <p>
          Một số dữ liệu có thể được lưu trữ hoặc xử lý bởi nhà cung cấp dịch vụ ở ngoài Việt
          Nam, bao gồm hạ tầng Supabase tại Hàn Quốc.
        </p>
        <p>
          Trường hợp phát sinh hoạt động chuyển dữ liệu cá nhân xuyên biên giới, Công ty thực
          hiện các nghĩa vụ, biện pháp bảo vệ và hồ sơ cần thiết theo quy định pháp luật Việt
          Nam.
        </p>
        <p>
          Người dùng được thông báo về phạm vi chuyển dữ liệu và các bên liên quan thông qua
          Chính sách này hoặc thông báo xử lý dữ liệu tương ứng.
        </p>
      </LegalSection>

      <LegalSection n={6} title="BẢO MẬT, SỰ CỐ DỮ LIỆU VÀ THỜI HẠN LƯU TRỮ">
        <p>
          Công ty áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ dữ liệu cá
          nhân, bao gồm kiểm soát quyền truy cập, phân quyền, bảo mật đường truyền và các
          biện pháp bảo vệ phù hợp với tính chất của dữ liệu.
        </p>
        <p>
          Trong trường hợp xảy ra sự cố vi phạm, mất mát, rò rỉ hoặc truy cập trái phép vào
          dữ liệu cá nhân, Công ty sẽ:
        </p>
        <ul>
          <li>
            Chủ động phát hiện, đánh giá và áp dụng các biện pháp cần thiết để ngăn chặn,
            khắc phục và hạn chế hậu quả của sự cố;
          </li>
          <li>
            Thực hiện việc thông báo, báo cáo hoặc phối hợp với cơ quan nhà nước có thẩm
            quyền theo thời hạn, trình tự và điều kiện do pháp luật quy định;
          </li>
          <li>
            Thông báo cho Người dùng hoặc chủ thể dữ liệu bị ảnh hưởng khi pháp luật yêu cầu
            hoặc khi Công ty xác định việc thông báo là cần thiết để bảo vệ quyền và lợi ích
            hợp pháp của họ.
          </li>
        </ul>
        <p>
          Đối với sự cố liên quan đến dữ liệu của trẻ em hoặc dữ liệu cá nhân nhạy cảm, Công
          ty áp dụng các biện pháp xử lý và bảo vệ phù hợp với mức độ rủi ro và quy định
          pháp luật.
        </p>
        <p>
          Mama Ơi lưu dữ liệu cá nhân trong thời gian cần thiết để thực hiện mục đích xử lý,
          cung cấp và duy trì Dịch vụ, thực hiện nghĩa vụ pháp lý hoặc giải quyết các yêu
          cầu, tranh chấp liên quan. Khi mục đích xử lý kết thúc hoặc dữ liệu không còn cần
          thiết, chúng tôi sẽ thực hiện xóa, hủy hoặc khử nhận dạng dữ liệu theo quy định
          pháp luật, trừ trường hợp pháp luật cho phép hoặc yêu cầu tiếp tục lưu trữ.
        </p>
      </LegalSection>

      <LegalSection n={7} title="QUYỀN CỦA NGƯỜI DÙNG">
        <p>
          Trong phạm vi pháp luật quy định, Người dùng có các quyền đối với dữ liệu cá nhân
          của mình, bao gồm:
        </p>
        <ul>
          <li>Quyền được biết;</li>
          <li>Quyền đồng ý và rút lại sự đồng ý khi áp dụng;</li>
          <li>Quyền truy cập và yêu cầu chỉnh sửa;</li>
          <li>Quyền xóa dữ liệu;</li>
          <li>Quyền hạn chế hoặc phản đối việc xử lý;</li>
          <li>Quyền yêu cầu cung cấp dữ liệu hoặc thực hiện các quyền khác theo quy định;</li>
          <li>Quyền khiếu nại, tố cáo hoặc khởi kiện theo pháp luật.</li>
        </ul>
        <p>Để thực hiện quyền, Người dùng liên hệ:</p>
        <ul>
          <li>
            Email: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
          </li>
        </ul>
        <p>
          Công ty có thể yêu cầu thông tin cần thiết để xác minh danh tính và thẩm quyền của
          người yêu cầu nhằm bảo vệ dữ liệu cá nhân.
        </p>
        <p>Công ty sẽ tiếp nhận và xử lý yêu cầu trong thời hạn theo quy định pháp luật.</p>
      </LegalSection>

      <LegalSection n={8} title="THAY ĐỔI CHÍNH SÁCH VÀ LIÊN HỆ">
        <p>
          Công ty có thể cập nhật Chính sách này để phù hợp với thay đổi của Dịch vụ hoặc
          pháp luật.
        </p>
        <p>
          Phiên bản cập nhật sẽ được công bố trên Mama Ơi và ghi rõ ngày cập nhật. Trường
          hợp thay đổi quan trọng ảnh hưởng đến quyền của Người dùng, Công ty sẽ thực hiện
          thông báo và lấy sự đồng ý lại nếu pháp luật yêu cầu.
        </p>
        <p>Mọi câu hỏi hoặc yêu cầu liên quan đến dữ liệu cá nhân, vui lòng liên hệ:</p>
        <p>Đơn vị sở hữu và vận hành Mama Ơi, thông qua:</p>
        <ul>
          <li>
            Email: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
          </li>
        </ul>
      </LegalSection>

      <p>
        <strong>© 2026 Mama Ơi. Bảo lưu mọi quyền.</strong>
      </p>
    </LegalPage>
  );
}
