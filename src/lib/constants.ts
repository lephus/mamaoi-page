/**
 * Every fixed string on the site lives here.
 *
 * The event facts are client-approved wording from the brief — do not reword
 * them. The app features are distilled from the WBS epics.
 */

export const SITE = {
  name: "Mama Ơi",
  tagline: "Theo dõi hành trình lớn lên của bé mỗi ngày",
  url: "https://mamaoi.vn",
  company: "Mama Ơi",
  email: "talentagent@bonggao.vn",
} as const;

/** Agency credit in the footer bottom bar. */
export const BUILT_BY = "Built by Digital Unicorn";
export const BUILT_BY_URL = "https://digitalunicorn.fr";

export const EVENT = {
  name: "Mama Ơi Day – Hành trình 1 năm đầu đời cùng con",
  shortName: "Mama Ơi Day",
  dateLabel: "Chủ Nhật, 30/08/2026",
  /**
   * Khung giờ diễn ra, hiện ngay dưới ngày ở hero (feedback khách 24/07/2026).
   * Giữ nguyên văn "sáng/chiều" của khách — pill giờ trong lịch trình mới là chỗ
   * dùng dạng 24h cho gọn.
   */
  timeLabel: "8:00 sáng – 3:00 chiều",
  dateISO: "2026-08-30",
  venue: "ThiSkyHall Sala",
  address: "10 Mai Chí Thọ, Thủ Thiêm, Thủ Đức, TP.HCM",
  capacity: "500 mẹ bỉm",
  registrationOpens: "25/07/2026",
  /**
   * Hạn đóng đăng ký: HẾT ngày 30/08/2026 giờ VN, tức 00:00 ngày 31/08 (UTC+7).
   *
   * Là cuối NGÀY sự kiện chứ không phải giờ sự kiện bắt đầu — khách nhận đăng ký
   * tại chỗ suốt ngày 30/08.
   *
   * Viết dạng UTC có `Z` chứ KHÔNG "2026-08-30T23:59": server Vercel chạy UTC nên
   * chuỗi không mang múi giờ bị đọc thành 23:59 UTC = 06:59 sáng 31/08 giờ VN —
   * server đóng trễ 7 tiếng và lệch hẳn với đồng hồ trên máy mẹ.
   */
  dongDangKyISO: "2026-08-30T17:00:00.000Z",
  /**
   * Giờ MỞ check-in: 00:00 ngày 30/08/2026 giờ VN (UTC+7), tức đầu ngày sự kiện.
   *
   * Có mốc này vì mẹ nhận email kèm mã QR ngay sau khi đăng ký — trước sự kiện
   * hơn một tháng. Không khoá thì mẹ mở link ngày hôm đó là tự check-in xong,
   * và tới cổng vé đã mang dấu "đã check-in" trong khi mẹ chưa hề tới nơi.
   *
   * Mở từ ĐẦU ngày chứ không phải 8:00 (giờ đón khách): ban tổ chức cần chạy thử
   * và mở cổng sớm, khoá tới đúng 8:00 là tự trói mình.
   *
   * Viết dạng UTC có `Z` — xem `dongDangKyISO` ngay trên để biết vì sao chuỗi
   * không mang múi giờ làm lệch 7 tiếng.
   */
  moCheckinISO: "2026-08-29T17:00:00.000Z",
  /** Ngày mở check-in, dạng ngắn cho nhãn nút. */
  moCheckinLabel: "30/08/2026",
} as const;

/**
 * Sức chứa sự kiện, dạng SỐ.
 *
 * `EVENT.capacity` ở trên là chuỗi hiển thị (chữ khách duyệt) — đừng parse nó
 * để lấy số: đổi copy thành "Giới hạn 500 mẹ" là parseInt trả NaN và chỗ dùng
 * hỏng im lặng.
 *
 * Đây chỉ là MẶC ĐỊNH. Con số đang thực sự áp dụng lấy qua `sucChua()` trong
 * `suc-chua.ts`, có thể nâng bằng biến môi trường `EVENT_CAPACITY` mà không cần
 * deploy lại (khách hay chốt "mở thêm 50 chỗ" ngay trong ngày mở đăng ký).
 */
export const SUC_CHUA_MAC_DINH = 500;

/**
 * Màn hình mẹ thấy khi đã hết chỗ. Nhận số chỗ làm tham số chứ không gõ "500"
 * vào câu chữ — ops nâng `EVENT_CAPACITY` lên 550 mà câu vẫn đọc 500 thì thông
 * báo từ chối nói sai ngay trên mặt mẹ.
 *
 * CHƯA được khách duyệt (mọi wording khác trên trang đều là chữ khách duyệt).
 * Khách sửa chữ thì sửa ở đây, không đụng logic.
 */
export const HET_CHO = {
  tieuDe: (soCho: number) => `Rất tiếc, sự kiện đã đủ ${soCho} mẹ.`,
  mo: "Mẹ để lại email để Mama Ơi báo ngay khi có chỗ trống nhé.",
  nut: "Đăng ký nhận tin ứng dụng",
  /**
   * Chữ trên các nút CTA "Đăng ký ngay" khi đã hết chỗ — đối xứng với
   * `DA_DONG.nut`. Ngắn vì phải vừa một nút, kể cả nút trên header điện thoại.
   */
  nutCta: (soCho: number) => `Đã đủ ${soCho} mẹ`,
} as const;

/**
 * Màn hình mẹ thấy sau khi hết hạn đăng ký (`EVENT.dongDangKyISO`).
 *
 * Khác `HET_CHO` ở chỗ không còn đường vào: hết chỗ là "đợt này đủ rồi", còn ở
 * đây là sự kiện đã qua — nên câu mời hướng sang sự kiện SAU chứ không phải chờ
 * chỗ trống của sự kiện này.
 *
 * CHƯA được khách duyệt (mọi wording khác trên trang đều là chữ khách duyệt).
 * Khách sửa chữ thì sửa ở đây, không đụng logic.
 */
export const DA_DONG = {
  /** Thay chỗ widget đếm ngược ở hero. */
  badge: "Mama Ơi Day đã kết thúc",
  /** Chữ trên ba nút CTA khi đã đóng. */
  nut: "Đã đóng đăng ký",
  tieuDe: "Đã đóng đăng ký Mama Ơi Day.",
  mo: "Mẹ để lại email để Mama Ơi báo khi có sự kiện tiếp theo nhé.",
  nutTin: "Đăng ký nhận tin ứng dụng",
} as const;

/**
 * Chữ mẹ thấy khi mở vé TRƯỚC ngày sự kiện (xem `EVENT.moCheckinISO`).
 *
 * Nói rõ "vé đã sẵn sàng" trước khi nói "chưa mở": mẹ mở link từ email và thấy
 * một cái nút xám sẽ nghĩ vé mình hỏng, chứ không tự hiểu là mình tới sớm.
 *
 * CHƯA được khách duyệt (mọi wording khác trên trang đều là chữ khách duyệt).
 * Khách sửa chữ thì sửa ở đây, không đụng logic.
 */
export const CHUA_MO_CHECKIN = {
  nut: `Check-in mở ngày ${EVENT.moCheckinLabel}`,
  mo: "Vé của mẹ đã sẵn sàng. Mẹ giữ lại mã QR này và đưa cho nhân viên tại quầy vào ngày sự kiện nhé.",
  /** Câu API trả về khi có người gọi thẳng endpoint trước giờ mở. */
  loi: `Check-in chỉ mở từ ngày ${EVENT.moCheckinLabel}. Mẹ giữ mã QR và đưa cho nhân viên tại quầy nhé.`,
} as const;

/**
 * Headline numbers from the event key visual — all numeric so the row reads as
 * one consistent set.
 *
 * `plus` adds a "+" to counts that mean "at least this many" (500+, 10+). It
 * stays off for "1 ngày": the event is exactly one day, so "1+ memorable day"
 * would be wrong — a deliberate, client-approved exception.
 *
 * NOTE: cả 500 (phần quà) lẫn 10 (thương hiệu) là figure khách cấp — feedback
 * 24/07/2026 hạ từ "1.000+ phần quà / 20+ thương hiệu" xuống. Khách đã được báo
 * là "500+ phần quà" đứng ngay cạnh "500+ mẹ bỉm" trong cùng hàng số liệu và
 * vẫn chốt giữ; đừng "sửa cho đỡ trùng".
 */
export const EVENT_STATS = [
  { value: 500, plus: true, label: "mẹ bỉm" },
  { value: 500, plus: true, label: "phần quà hấp dẫn" },
  { value: 10, plus: true, label: "thương hiệu Mẹ và Bé" },
  { value: 1, plus: false, label: "ngày đáng nhớ" },
] as const;

/**
 * App features — one per WBS epic that a parent actually feels.
 *
 * Both the icon and the `color` are taken from the app's own Recent Activities
 * cards, so a mother who saw the app in a Facebook ad recognises the same
 * pictures here. The icons were pulled from Figma by card order, NOT by the
 * layer names, which are stale (the "Next Event Image" layer is a nappy).
 */
export const APP_FEATURES = [
  {
    title: "Ăn & bú",
    description:
      "Ghi lại bú mẹ, bú bình và ăn dặm. Một chạm là xong, kể cả khi đang bế bé một tay.",
    icon: "/images/icon-an.png",
    color: "primary",
  },
  {
    title: "Hút sữa",
    description:
      "Theo dõi lượng sữa mỗi cữ hút và tổng lượng trong ngày, không cần nhớ trong đầu.",
    icon: "/images/icon-hut-sua.png",
    color: "warning",
  },
  {
    title: "Giấc ngủ",
    description:
      "Bấm khi bé ngủ, bấm khi bé dậy. Xem bé đã ngủ đủ chưa theo từng ngày.",
    icon: "/images/icon-ngu.png",
    color: "secondary",
  },
  {
    title: "Bỉm",
    description:
      "Số lần thay và tình trạng bỉm — dấu hiệu sớm về tiêu hoá mà mẹ dễ bỏ qua.",
    icon: "/images/icon-bim.png",
    color: "violet",
  },
  {
    title: "Sức khoẻ",
    description:
      "Nhiệt độ, thuốc, lịch vaccine, cân nặng và chiều cao — gọn trong một hồ sơ.",
    icon: "/images/icon-suc-khoe.png",
    color: "teal",
  },
  {
    title: "Nhắc nhở",
    description:
      "Đến cữ bú, đến giờ uống vitamin, sắp tới lịch tiêm — app nhắc để mẹ không phải nhớ.",
    icon: "/images/icon-nhac-nho.png",
    color: "info",
  },
] as const;

/**
 * Speakers. Only chị Vân has a supplied photo and a confirmed role; the rest
 * are placeholders the client must fill before launch. `photo: null` renders a
 * neutral frame rather than a stock face — a fake portrait next to a real one
 * reads as a lie about who is actually turning up.
 */
/** Khách mời được dành riêng một card spotlight ở đầu section diễn giả. */
export const EVENT_SPEAKERS = [
  {
    name: "Ngô Thanh Vân",
    role: "Host",
    photo: "/images/speaker-ngo-thanh-van.jpg",
  },
] as const;

/**
 * Chuyên gia chuyên môn — tách khỏi EVENT_SPEAKERS vì hiển thị khác hẳn: lưới
 * ba cột kèm tiểu sử mở/đóng, không phải card spotlight.
 *
 * `bio` là nguyên văn hồ sơ khách gửi, tách theo đoạn. Đoạn đầu hiện sẵn, đoạn
 * sau nằm sau nút "Xem thêm" — cắt bớt chữ của khách là việc không được phép,
 * nên phần thừa được giấu đi chứ không bị xoá.
 *
 * `role` là MẢNG dòng, không phải một chuỗi: khách chốt (feedback 24/07/2026)
 * chức danh của Helen Nguyễn phải xuống dòng thành hai vế. Người khác chỉ có một
 * dòng nhưng vẫn viết dạng mảng — hai kiểu dữ liệu cho cùng một trường là chỗ
 * sinh lỗi, và card render mảng thì không cần biết ai có mấy dòng.
 */
export const EVENT_EXPERTS = [
  {
    name: "Huy Trần",
    role: ["Chef/CEO ChanChan"],
    photo: "/images/speaker-huy-tran.webp",
    bio: [
      "Huy Trần là một KOL, Chef Influencer và Doanh nhân Việt kiều Đức, đồng thời là chủ chuỗi nhà hàng thuần chay ChanChan.",
      "Những năm gần đây, bên cạnh công việc kinh doanh, anh dành trọn tâm huyết chăm sóc cho gia đình nhỏ: tự tay thiết kế thực đơn dinh dưỡng khoa học chu đáo cho bà xã Ngô Thanh Vân trong suốt thai kỳ, và đảm nhận vai trò “bếp trưởng gia đình” chăm chút từng bữa ăn dặm đầy đủ dưỡng chất cho con gái đầu lòng (bé Gạo).",
      "Tên tuổi của anh ngày càng nhận được nhiều sự yêu mến nhờ hình ảnh người chồng, người bố gắn liền với lối sống lành mạnh và niềm đam mê ẩm thực tinh tế.",
    ],
  },
  {
    name: "BS. Tăng Đức Cương",
    role: ["Giám đốc Bệnh viện Đông Đô"],
    photo: "/images/speaker-bs-tang-duc-cuong.webp",
    bio: [
      "Bác sĩ Tăng Đức Cương là chuyên gia với nhiều năm kinh nghiệm trong lĩnh vực sản phụ khoa và hỗ trợ sinh sản. Hiện ông là Giám đốc Bệnh viện Đông Đô, đơn vị y tế tiên phong trong chăm sóc sức khỏe sinh sản, thai sản và IVF tại Việt Nam.",
      "Với triết lý lấy người bệnh làm trung tâm, bác sĩ luôn đồng hành cùng hàng nghìn gia đình trên hành trình mang thai, sinh con và nuôi dưỡng những em bé khỏe mạnh. Những chia sẻ của ông sẽ mang đến góc nhìn khoa học, thực tiễn và đầy giá trị cho các bậc cha mẹ trong giai đoạn đầu đời của con.",
    ],
  },
  {
    name: "BS. Vũ Văn Phi",
    role: ["Trưởng khoa Nhi – Bệnh viện AIH"],
    photo: "/images/speaker-bs-vu-van-phi.webp",
    bio: [
      "Bác sĩ Vũ Văn Phi là chuyên gia Nhi khoa với nhiều năm kinh nghiệm trong lĩnh vực chăm sóc và điều trị trẻ sơ sinh, trẻ nhỏ. Hiện ông giữ vị trí Trưởng khoa Nhi tại Bệnh viện Quốc tế AIH, nơi áp dụng các tiêu chuẩn y khoa quốc tế trong chăm sóc sức khỏe trẻ em.",
      "Không chỉ được các gia đình tin tưởng bởi chuyên môn vững vàng, bác sĩ còn được yêu mến nhờ cách tư vấn gần gũi, dễ hiểu và luôn đặt sự phát triển toàn diện của trẻ lên hàng đầu. Tại sự kiện, bác sĩ sẽ chia sẻ những kiến thức thiết thực giúp ba mẹ tự tin đồng hành cùng con trong năm đầu đời.",
    ],
  },
  {
    // Tên, chức danh và tiểu sử thay TOÀN BỘ theo feedback khách 24/07/2026.
    name: "Ms. Helen Nguyễn",
    role: [
      "Doanh nhân & Chuyên gia Dinh dưỡng",
      "Gọi sữa Chuyên gia kích sữa & chăm sóc sau sinh",
    ],
    photo: "/images/speaker-ds-helen-nguyen.webp",
    bio: [
      "Được cộng đồng mẹ bỉm ví là “bàn tay vàng trong làng gọi sữa”, cô chuyên tư vấn, đồng hành cùng các mẹ bỉm sữa trong hành trình nuôi con bằng sữa mẹ và dinh dưỡng thai kỳ, sau sinh. 7 năm chia sẻ tới hơn 70.000 mẹ sữa. Cô là CEO & Co-Founder của các thương hiệu như Fresh and Fit, Yến sào Tuệ Tâm, đồng thời đảm nhiệm vị trí Trưởng ban Chăm sóc Bà mẹ và Trẻ em thuộc Viện Nghiên cứu và Đào tạo Y học Cộng đồng.",
    ],
  },
] as const;

/** Năm điểm nổi bật, chép theo KV chính thức để web nói cùng một giọng với truyền thông. */
export const EVENT_HIGHLIGHTS = [
  {
    title: "Quà tặng hấp dẫn",
    description:
      "Nhiều phần quà hấp dẫn và giá trị từ các thương hiệu uy tín trong lĩnh vực Mẹ và Bé.",
  },
  {
    title: "Hoạt động thú vị",
    description: "Các hoạt động tương tác, trải nghiệm và bốc thăm trúng thưởng.",
  },
  {
    title: "Tư vấn chuyên sâu",
    description: "Từ các bác sĩ, chuyên gia hàng đầu về mẹ và bé.",
  },
  {
    title: "Gặp gỡ giao lưu",
    description: "Kết nối cùng cộng đồng mẹ bỉm và các chuyên gia.",
  },
  {
    title: "Góc check-in xinh xắn",
    description: "Không gian đẹp lung linh — lưu giữ khoảnh khắc đáng nhớ.",
  },
] as const;

/**
 * Cột mốc phát triển 12 tháng đầu — chép nguyên văn từ infographic "Hành trình
 * 12 tháng đầu đời cùng Gạo". Desktop hiển thị chính tấm infographic; mảng này
 * dựng lại bản native cho mobile (ảnh rộng đọc không nổi trên điện thoại).
 */
export const BABY_MILESTONES = [
  { month: 0, title: "Sơ sinh", desc: "Làm quen với thế giới mới" },
  { month: 1, title: "Nhìn & chú ý", desc: "Nhìn theo khuôn mặt, âm thanh" },
  { month: 2, title: "Ngẩng đầu", desc: "Ngẩng đầu khi nằm sấp, giữ đầu chắc hơn" },
  { month: 3, title: "Nâng ngực", desc: "Chống tay, nâng ngực khi nằm sấp" },
  { month: 4, title: "Lật người", desc: "Bắt đầu lật từ ngửa sang sấp" },
  { month: 5, title: "Bò trước", desc: "Bò trườn về phía trước, khám phá xung quanh" },
  { month: 6, title: "Ngồi vững", desc: "Ngồi không cần hỗ trợ, tay với lấy đồ vật" },
  { month: 7, title: "Tương tác", desc: "Vẫy tay, bập bẹ, hiểu cảm xúc hơn" },
  { month: 8, title: "Bò khỏe", desc: "Bò nhanh hơn, tự tin khám phá" },
  { month: 9, title: "Vin đứng", desc: "Vin đồ đứng lên, bước ngang" },
  { month: 10, title: "Đứng vững", desc: "Đứng vững hơn, chuyển động linh hoạt" },
  { month: 11, title: "Những bước đầu", desc: "Tập đi, bước đi những bước đầu tiên" },
  { month: 12, title: "Tự tin bước đi", desc: "Đi vững, tự tin khám phá thế giới rộng lớn" },
] as const;

/**
 * Một mốc trong lịch trình.
 *
 * `timeEnd` và `description` đều KHÔNG bắt buộc: khách gửi vài mốc chỉ có giờ
 * bắt đầu ("9:00 – Khai mạc") và vài mốc không kèm mô tả (Khai mạc, Tea Break).
 * Bịa mô tả cho đủ ô là tự viết chữ cho sự kiện của khách, nên card tự ẩn dòng
 * đó khi không có.
 */
export type TimelineItem = {
  /** Giờ bắt đầu, dạng 24h "HH:MM". */
  time: string;
  /** Giờ kết thúc — có thì pill hiện dạng khoảng "08:00 – 09:00". */
  timeEnd?: string;
  title: string;
  description?: string;
};

/**
 * Lịch trình chính thức — thay TOÀN BỘ theo feedback khách 24/07/2026 (bản cũ
 * có giờ lẻ 09:51/11:46/13:06 là số dựng tạm, sai hoàn toàn).
 *
 * Chữ giữ nguyên văn khách gửi, chỉ sửa đúng hai lỗi chính tả "chia sẽ" → "chia
 * sẻ". Giờ đổi sang 24h cho pill trong timeline; câu "8:00 sáng – 3:00 chiều"
 * của khách nằm ở `EVENT.timeLabel` trên hero.
 */
export const EVENT_TIMELINE: readonly TimelineItem[] = [
  {
    time: "08:00",
    timeEnd: "09:00",
    title: "Check in",
    description: "Nhận welcome kit và Mama Ơi passport.",
  },
  { time: "09:00", title: "Khai mạc Mama Ơi Day" },
  {
    time: "09:30",
    timeEnd: "10:30",
    title: "Hành trình IVF",
    description:
      "Câu chuyện tìm con bằng IVF được chia sẻ bởi Bác sĩ Tăng Đức Cương - Bệnh Viện Đông Đô.",
  },
  {
    time: "10:30",
    timeEnd: "11:30",
    title: "Khám thai và sinh nở",
    description:
      "Đồng hành cùng Mẹ từ thai kỳ đến ngày cuối vượt cạn, được chia sẻ bởi Bác sĩ Vũ Văn Phi - Bệnh Viện AIH.",
  },
  { time: "11:30", timeEnd: "12:00", title: "Tea Break" },
  {
    time: "12:00",
    timeEnd: "12:30",
    title: "Ra mắt App MAMA ƠI",
    description: "Chính thức giới thiệu ứng dụng MAMA ƠI bởi Ngô Thanh Vân.",
  },
  {
    time: "12:30",
    timeEnd: "13:30",
    title: "Nuôi con bằng sữa mẹ",
    description: "Bí quyết nuôi con bằng sữa mẹ bởi Cô Helen Nguyễn.",
  },
  {
    time: "13:30",
    timeEnd: "14:30",
    title: "Hành trình ăn dặm",
    description: "Cùng con bắt đầu hành trình ăn dặm với Chef Huy Trần và Ngô Thanh Vân.",
  },
  {
    time: "15:00",
    title: "Rút thăm trúng thưởng & Bế mạc",
    description: "Chụp ảnh lưu niệm, khép lại một ngày trọn vẹn.",
  },
];

/**
 * Giờ mở cửa check-in, in trên vé QR — lấy từ MỐC ĐẦU của lịch trình chính thức
 * chứ không gõ tay, để vé và trang không bao giờ nói hai giờ khác nhau.
 *
 * Mốc đầu ngày là lúc cửa mở, đúng theo mọi bản lịch trình khách từng gửi. Nếu
 * có bản lịch mở đầu bằng việc khác thì sửa ở đây.
 */
export const GIO_MO_CHECK_IN = EVENT_TIMELINE[0].time;

/**
 * Ảnh quà tặng cho carousel ở section "Quà tặng" (component <GiftCarousel>).
 * Thứ tự: tổng thể bộ kit → passport → cận cảnh dây đeo. Passport dùng ảnh bìa
 * (mọi màn hình) vì bản trải hai trang co lại thì chữ không đọc nổi.
 */
export const EVENT_GIFT_GALLERY = [
  {
    src: "/images/welcome-kit.webp",
    alt: "Bộ Welcome Kit Mama Ơi Day — túi tote, dây đeo và thẻ, Mama Ơi Passport và bút",
    title: "Bộ Welcome Kit",
    caption:
      "Túi tote, dây đeo + thẻ, Mama Ơi Passport và bút — trao tận tay khi mẹ vừa check-in.",
  },
  {
    src: "/images/passport-mama-oi-bia.png",
    alt: "Mama Ơi Passport — bìa và trang thông tin thành viên",
    title: "Mama Ơi Passport",
    caption:
      "Mỗi mẹ một cuốn, ghi dấu cả ngày và mang về làm kỷ niệm ngày đầu tiên của hành trình.",
  },
  {
    src: "/images/welcome-kit-lanyard.webp",
    alt: "Dây đeo và thẻ tên Mama Ơi Day",
    title: "Dây đeo + Thẻ tên",
    caption: "Thẻ tên xinh xắn theo chân mẹ suốt Mama Ơi Day.",
  },
] as const;

export const EVENT_GIFTS = [
  {
    title: "Welcome Kit",
    description: "Túi quà chào mừng, trao tận tay mẹ ngay khi vừa check-in.",
  },
  {
    title: "Mama Ơi Passport",
    description: "Cuốn sổ ghi dấu cả ngày của mẹ và bé. Đóng đủ dấu, nhận quà.",
  },
  {
    title: "Quà từ nhãn hàng",
    description: "Sản phẩm thật từ các thương hiệu mẹ và bé đồng hành cùng chương trình.",
  },
  {
    title: "Bốc thăm may mắn",
    description: "Nhiều phần quà đang chờ các Mẹ tại ngày hội.",
  },
] as const;

/**
 * Đối tác đồng hành — logo khách gửi, nhóm theo hạng tài trợ (nguồn: thư mục
 * "LOGO ĐỐI TÁC"). Ảnh đã được trim nền trong suốt + resize, nằm ở
 * /public/images/partners. `name` dùng cho alt text.
 *
 * Thêm/bớt logo chỉ cần sửa mảng này — layout tự co giãn. Với AIH dùng bản logo
 * MÀU (không phải "version trang" nền trắng dành cho nền tối), vì card nền trắng.
 * NOTE: con số "10+ thương hiệu" ở EVENT_STATS là figure khách cấp, không tự đổi
 * theo số logo ở đây.
 */
export const PARTNER_TIERS = [
  {
    tier: "Kim cương",
    logos: [
      { name: "Bệnh viện Đông Đô – IVF Center", src: "/images/partners/dong-do-ivf.png" },
    ],
  },
  {
    tier: "Vàng",
    logos: [
      { name: "Hippy", src: "/images/partners/hippy.png" },
      { name: "BioGaia", src: "/images/partners/biogaia.png" },
    ],
  },
  {
    tier: "Bạc",
    logos: [
      { name: "Sebamed", src: "/images/partners/sebamed.png" },
    ],
  },
  {
    tier: "Tiêu chuẩn",
    logos: [
      {
        name: "American International Hospital (AIH) × Raffles Medical Group",
        src: "/images/partners/aih-rmg.png",
      },
      { name: "The Joyful Nest", src: "/images/partners/the-joyful-nest.png" },
      { name: "Mommy Spa & Skin Care", src: "/images/partners/mommy-spa.png" },
      { name: "Doppelherz", src: "/images/partners/doppelherz.png" },
      { name: "MOOIMOM", src: "/images/partners/mooimom.png" },
      { name: "Mugu Australia", src: "/images/partners/mugu.png" },
      { name: "Bimbosan", src: "/images/partners/bimbosan.png" },
    ],
  },
] as const;

export const EVENT_FAQ = [
  {
    q: "Tham dự sự kiện có mất phí không?",
    a: "Không. Sự kiện hoàn toàn miễn phí cho 500 mẹ đăng ký sớm nhất. Mỗi mẹ chỉ cần đăng ký một lần.",
  },
  {
    q: "Mẹ có được mang bé theo không?",
    // Khách gõ "Mama Day Ơi" trong feedback 24/07; viết đúng tên sự kiện ở đây.
    a: "Có. Mama Ơi Day là sự kiện dành cho cả Mẹ và Bé. Ban Tổ Chức có khu vực thay tã riêng để Mẹ chăm sóc Bé dễ dàng hơn.",
  },
  {
    q: "Gửi xe ở đâu?",
    a: "ThiSkyHall Sala có hầm gửi xe máy và ô tô ngay tại toà nhà. Mẹ xuất trình vé check-in để được hỗ trợ.",
  },
  {
    q: "Quy trình check-in như thế nào?",
    a: "Sau khi đăng ký, mẹ nhận email xác nhận kèm mã QR. Đến sự kiện chỉ cần đưa mã QR để check-in nhanh và nhận Welcome Kit.",
  },
  {
    q: "Đi cùng chồng có được không?",
    a: "Được. Mẹ vui lòng tick vào ô \"Đi cùng chồng\" trong form đăng ký để ban tổ chức chuẩn bị đủ chỗ.",
  },
] as const;

/**
 * Luật mã QR — đặt ngay trên form đăng ký để mẹ đọc TRƯỚC khi điền, vì hai
 * dòng giữa quyết định mẹ tick "Đi cùng chồng" hay bảo người đi cùng đăng ký
 * riêng. Wording khách duyệt, giữ nguyên từng chữ.
 */
export const QUY_DINH_MA_QR = [
  "Mỗi mã QR tương ứng với 01 người tham dự và chỉ sử dụng một lần.",
  "Ba của bé được chào đón tham gia cùng Mẹ (chung 01 mã QR của Mẹ đã đăng ký). Nếu đi cùng ba, các Mẹ nhớ tích chọn mục “Đi cùng chồng” trong form đăng ký để Ban Tổ Chức chuẩn bị chu đáo.",
  "Nếu đi cùng ông bà, chị em, bạn bè (ngoài Ba của bé), người đi cùng vui lòng đăng ký riêng để nhận mã QR của mình.",
  "Mỗi email/số điện thoại đăng ký được 01 mã QR duy nhất.",
] as const;

/** 63 tỉnh/thành — used by the Tỉnh/Thành select on the registration form. */
export const PROVINCES = [
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh",
  "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau",
  "Cần Thơ", "Cao Bằng", "Đà Nẵng", "Đắk Lắk", "Đắk Nông", "Điện Biên",
  "Đồng Nai", "Đồng Tháp", "Gia Lai", "Hà Giang", "Hà Nam", "Hà Nội",
  "Hà Tĩnh", "Hải Dương", "Hải Phòng", "Hậu Giang", "Hòa Bình", "Hưng Yên",
  "Khánh Hòa", "Kiên Giang", "Kon Tum", "Lai Châu", "Lâm Đồng", "Lạng Sơn",
  "Lào Cai", "Long An", "Nam Định", "Nghệ An", "Ninh Bình", "Ninh Thuận",
  "Phú Thọ", "Phú Yên", "Quảng Bình", "Quảng Nam", "Quảng Ngãi", "Quảng Ninh",
  "Quảng Trị", "Sóc Trăng", "Sơn La", "Tây Ninh", "Thái Bình", "Thái Nguyên",
  "Thanh Hóa", "Thừa Thiên Huế", "Tiền Giang", "TP. Hồ Chí Minh", "Trà Vinh",
  "Tuyên Quang", "Vĩnh Long", "Vĩnh Phúc", "Yên Bái",
] as const;

/** Last updated date shown on the legal pages. */
export const LEGAL_UPDATED = "15/07/2026";

/**
 * Chủ đề quan tâm — chọn nhiều. `value` là thứ lưu xuống DB và gửi Brevo;
 * `label` là chữ hiện trên form (wording khách duyệt, đừng sửa).
 */
export const CHU_DE_QUAN_TAM = [
  { value: "thai_ky", label: "Thai kỳ" },
  { value: "ivf", label: "IVF" },
  { value: "sinh_no", label: "Sinh nở" },
  { value: "an_dam", label: "Ăn dặm" },
  { value: "ngu", label: "Ngủ" },
  { value: "tiem_chung", label: "Tiêm chủng" },
  { value: "phat_trien_nao", label: "Phát triển não" },
  { value: "van_dong", label: "Vận động" },
  { value: "sua_me", label: "Nuôi con bằng sữa mẹ" },
  { value: "sau_sinh", label: "Sau sinh" },
] as const;

/** Nguồn biết đến chương trình — chọn một. */
export const NGUON_BIET_DEN = [
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "ban_be", label: "Bạn bè" },
  { value: "khac", label: "Khác" },
] as const;

/**
 * Tình trạng hiện tại của mẹ — phân khúc chính, chọn một. `value` là thứ lưu
 * xuống DB (`trang_thai`) và gửi Brevo (`TRANG_THAI`); `label` là nhãn NGẮN cho
 * /admin và file Excel. Form đăng ký hiển thị nhãn DÀI riêng ("Đang mang thai",
 * "Bé đã chào đời") nên không map từ đây — nhưng `value` phải khớp từng chữ.
 */
export const TRANG_THAI = [
  { value: "chuan_bi_mang_thai", label: "Chuẩn bị mang thai" },
  { value: "ivf", label: "IVF" },
  { value: "mang_thai", label: "Mang thai" },
  { value: "da_sinh", label: "Đã sinh" },
] as const;

export const CHU_DE_VALUES = CHU_DE_QUAN_TAM.map((c) => c.value) as readonly string[];
export const NGUON_VALUES = NGUON_BIET_DEN.map((n) => n.value) as readonly string[];

const CHU_DE_MAP = new Map<string, string>(
  CHU_DE_QUAN_TAM.map((c) => [c.value, c.label]),
);
const NGUON_MAP = new Map<string, string>(
  NGUON_BIET_DEN.map((n) => [n.value, n.label]),
);
const TRANG_THAI_MAP = new Map<string, string>(
  TRANG_THAI.map((t) => [t.value, t.label]),
);

/**
 * Chỗ của một thông tin CHƯA HỎI, không phải một thông tin rỗng.
 *
 * Dùng cho đăng ký ops tạo tay ở /admin, khi trong tay chỉ có email + họ tên.
 * Hiện ra chứ không để trống: một ô trắng trong bảng 500 dòng đọc như lỗi hiển
 * thị, còn "--" nói rõ là chưa ai hỏi mẹ câu đó.
 */
export const THIEU = "--";

/** Giá trị lạ trả về chính nó — export không bao giờ được nuốt mất dữ liệu. */
export function chuDeLabel(value: string): string {
  return CHU_DE_MAP.get(value) ?? value;
}

/**
 * Cả mảng chủ đề thành một chuỗi. Mảng RỖNG thành `THIEU`, không thành chuỗi
 * rỗng: form đăng ký bắt buộc chọn ít nhất một chủ đề, nên rỗng chỉ xảy ra ở
 * dòng ops tạo tay — đúng nghĩa "chưa hỏi", không phải "mẹ không quan tâm gì".
 */
export function chuDeGopLabel(values: readonly string[]): string {
  if (values.length === 0) return THIEU;
  return values.map(chuDeLabel).join(", ");
}

/**
 * Hai hàm dưới nhận cả `null`: cột `nguon_biet_den` và `trang_thai` để trống ở
 * dòng ops tạo tay. Quy đổi thành `THIEU` NGAY TẠI ĐÂY chứ không ở từng nơi
 * hiển thị — bảng admin, modal chi tiết, vé check-in và file Excel đều kết thúc
 * bằng đúng hai hàm này, nên một chỗ sửa là cả bốn nói cùng một thứ.
 */
export function nguonBietDenLabel(value: string | null | undefined): string {
  if (!value) return THIEU;
  return NGUON_MAP.get(value) ?? value;
}

/** Nhãn ngắn của tình trạng cho /admin và Excel. Giá trị lạ trả về chính nó. */
export function trangThaiLabel(value: string | null | undefined): string {
  if (!value) return THIEU;
  return TRANG_THAI_MAP.get(value) ?? value;
}

/**
 * Nhãn cột "Nguồn check-in" — dùng chung cho file Excel, Google Sheet, bảng
 * /admin và modal chi tiết. Bốn nơi, một chỗ khai.
 *
 * KHÁC hai hàm ngay trên: `null` ở đây trả CHUỖI RỖNG chứ không phải `THIEU`.
 * "--" nghĩa là "có hỏi mà chưa có câu trả lời"; mẹ chưa check-in thì không có
 * gì để nói. Ô trống cũng đúng bằng ô mà `hangDbToSheetRow` ghi cho một dòng
 * vừa append (sheets.ts) — nhờ vậy "bỏ tick" trả Sheet về đúng trạng thái sạch.
 */
export function nguonCheckinLabel(
  value: "qr" | "admin" | null | undefined,
): string {
  if (value === "qr") return "(QR)";
  if (value === "admin") return "(Admin CheckIn)";
  return "";
}
