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
  company: "MamaOi",
  email: "info@mamaoi.com",
  phone: "+8499.999.999",
} as const;

/** Agency credit in the footer bottom bar. */
export const BUILT_BY = "Built by Digital Unicorn";

export const EVENT = {
  name: "Mama Ơi Day – Hành trình 1 năm đầu đời cùng con",
  shortName: "Mama Ơi Day",
  dateLabel: "Chủ Nhật, 30/08/2026",
  dateISO: "2026-08-30",
  venue: "ThiSkyHall Sala",
  address: "10 Mai Chí Thọ, Thủ Thiêm, TP. Thủ Đức, TP.HCM",
  capacity: "500 mẹ bỉm",
  registrationOpens: "25/07/2026",
} as const;

/**
 * Headline numbers from the event key visual — all numeric so the row reads as
 * one consistent set.
 *
 * `plus` adds a "+" to counts that mean "at least this many" (500+, 1.000+,
 * 20+). It stays off for "1 ngày": the event is exactly one day, so "1+
 * memorable day" would be wrong — a deliberate, client-approved exception.
 *
 * NOTE: 20 (thương hiệu) is a client-supplied figure. Update it if the real
 * partner count changes.
 */
export const EVENT_STATS = [
  { value: 500, plus: true, label: "mẹ bỉm" },
  { value: 1000, plus: true, label: "phần quà hấp dẫn" },
  { value: 20, plus: true, label: "thương hiệu mẹ và bé" },
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
export const EVENT_SPEAKERS = [
  {
    name: "Ngô Thanh Vân",
    role: "Khách mời đặc biệt",
    photo: "/images/speaker-ngo-thanh-van.webp",
  },
  { name: "Bác sĩ Nhi khoa", role: "Đang cập nhật", photo: null },
  { name: "Dược sĩ", role: "Đang cập nhật", photo: null },
  { name: "Khách mời", role: "Đang cập nhật", photo: null },
] as const;

export const EVENT_HIGHLIGHTS = [
  {
    title: "Chuyên gia đầu ngành",
    description: "Bác sĩ, dược sĩ và chuyên gia hàng đầu về mẹ và bé.",
  },
  {
    title: "Hoạt động trải nghiệm",
    description: "Workshop, Cooking Show và các hoạt động tương tác cùng con.",
  },
  {
    title: "Quà tặng giá trị",
    description: "Welcome Kit, Passport Event và quà từ các nhãn hàng uy tín.",
  },
  {
    title: "Cộng đồng mẹ bỉm",
    description: "Gặp gỡ những gia đình có con cùng giai đoạn phát triển.",
  },
] as const;

export const EVENT_TIMELINE = [
  { time: "08:00", title: "Check-in", description: "Nhận Welcome Kit và Passport Event." },
  { time: "09:00", title: "Talkshow", description: "Chia sẻ từ chị Vân và các chuyên gia." },
  { time: "10:30", title: "Tea Break", description: "Nghỉ giải lao, giao lưu cùng các mẹ." },
  { time: "11:00", title: "Cooking Show", description: "Hướng dẫn nấu ăn dặm cho bé." },
  { time: "14:00", title: "Lucky Draw", description: "Bốc thăm trúng thưởng." },
  { time: "15:30", title: "Bế mạc", description: "Chụp ảnh lưu niệm cùng bé Gạo." },
] as const;

export const EVENT_GIFTS = [
  { title: "Welcome Kit", description: "Túi quà chào mừng dành riêng cho mỗi mẹ khi check-in." },
  { title: "Passport Event", description: "Sổ tay đóng dấu từng hoạt động — hoàn thành để nhận quà." },
  { title: "Quà từ đối tác", description: "Sản phẩm từ các thương hiệu mẹ và bé đồng hành." },
  { title: "Lucky Draw", description: "Bốc thăm trúng thưởng với hàng ngàn phần quà." },
] as const;

export const EVENT_FAQ = [
  {
    q: "Tham dự sự kiện có mất phí không?",
    a: "Không. Sự kiện hoàn toàn miễn phí cho 500 mẹ đăng ký sớm nhất. Mỗi mẹ chỉ cần đăng ký một lần.",
  },
  {
    q: "Mẹ có được mang bé theo không?",
    a: "Có. Mama Ơi Day là sự kiện dành cho cả mẹ và bé. Ban tổ chức có khu vực riêng để mẹ chăm bé trong suốt chương trình.",
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

export const CHU_DE_VALUES = CHU_DE_QUAN_TAM.map((c) => c.value) as readonly string[];
export const NGUON_VALUES = NGUON_BIET_DEN.map((n) => n.value) as readonly string[];

const CHU_DE_MAP = new Map<string, string>(
  CHU_DE_QUAN_TAM.map((c) => [c.value, c.label]),
);
const NGUON_MAP = new Map<string, string>(
  NGUON_BIET_DEN.map((n) => [n.value, n.label]),
);

/** Giá trị lạ trả về chính nó — export không bao giờ được nuốt mất dữ liệu. */
export function chuDeLabel(value: string): string {
  return CHU_DE_MAP.get(value) ?? value;
}

export function nguonBietDenLabel(value: string): string {
  return NGUON_MAP.get(value) ?? value;
}
