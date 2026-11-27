# Hướng dẫn thiết kế Mobile / Tablet — Vista Admin

Chuẩn rút ra từ trang **Lịch làm việc nhân viên** (`/schedule`). Dùng làm mẫu khi thiết kế/làm lại layout mobile cho các page khác.

File tham khảo:
- `src/pages/StaffSchedule/page.tsx` — tiêu đề + tab bar
- `src/mobile-ui.css` — CSS dùng chung (class `.mobile-ui`)
- `src/pages/schedule/schedule-mobile.css` — style riêng trang lịch (alert tím, modal, toast)
- `src/pages/schedule/mobile/MobileWeekView.tsx` — thanh chọn tuần, nút tạo, chọn ngày, card
- `src/pages/schedule/mobile/MobileStates.tsx` — card Đang tải / Lỗi / Trống
- `src/pages/schedule/DayOffTab.tsx` — toolbar 2 nút + card dạng label:value
- `src/components/base/MobileCards.tsx`, `.mobile-card*` trong `src/index.css`

---

## 0. Cách áp dụng cho 1 trang

1. **Mọi trang (trừ Dashboard) đã tự được bọc `<MobileUI>`** ở `src/layouts/AdminLayout.tsx` — trang mới không cần bọc thêm.
   Component `src/components/base/MobileUI.tsx` (nhận thêm `className`) vẫn có thể dùng riêng nếu cần bọc một vùng khác.
   Dưới 1024px component này:
   - bật token antd qua `ConfigProvider`: `controlHeight: 44`, `borderRadius: 8` → **mọi** Button, Input, Input.Search, Select,
     DatePicker, Segmented… (kể cả trong modal/popover mở từ trang) cao đúng 44px, chữ căn giữa;
     size small/large giữ 30/50px nên nút nhỏ trong card không đổi;
   - gắn class `mobile-ui` (`src/mobile-ui.css`): khoảng cách 12px, bo góc 8px cho phần tử không phải antd;
     trong toolbar (`.page-title-controls`, `.toolbar-row`): nút không bold, không đổ bóng, icon 14px, nút icon vuông 44×44.
   - **Không** chỉnh chiều cao control bằng CSS `height`/`min-height` (antd v6 Select tính chiều cao từ padding, ép bằng CSS sẽ lệch chữ).
2. Toolbar trong tab dùng `ToolbarRow` (đã có class `toolbar-row`); toolbar tự viết thì thêm class `toolbar-row`.
3. Nút cần giữ chữ trên mobile (<768px) thêm class `keep-label` (mặc định nút có icon chỉ còn icon).
4. Bo góc tự viết luôn là 8px ở mọi bề rộng (`rounded-lg`) — xem mục 3.

Đã áp dụng: **toàn bộ trang trong admin, trừ Dashboard** (bọc ở layout + chỉnh toolbar/bo góc từng trang theo mục 6.2.1).
Khi thêm trang mới: chỉ cần làm toolbar theo 6.2.1, bo góc tự viết dùng `rounded-lg`, không ép style tab.

**Trang dạng form / card (không có toolbar lọc):** nút hành động đôi trong card (vd. Kiểm tra kết nối | Lưu cấu hình)
xếp `grid grid-cols-2` trên mobile, có icon + tên; card cách nhau 12px (`max-lg:mb-3`, `Row gutter={[{ xs: 12, lg: 20 }, …]}`);
nút lưu duy nhất trên tiêu đề trang full width có icon + tên (`keep-label max-md:col-span-full`).

---

## 1. Breakpoint

| Tên | Bề rộng | Ghi chú |
|---|---|---|
| Mobile | < 768px | 1 cột, các control xếp dọc |
| Tablet | 768–1023px | Hàng điều hướng + nút tạo nằm chung 1 hàng |
| Desktop | ≥ 1024px | Giữ layout desktop, **không** áp style trong tài liệu này |

- Mốc compact: `max-width: 1023px` (cùng `.mobile-only` / `.desktop-only` trong `index.css`).
- JS: `useCompactLayout()` (`src/pages/schedule/useCompactLayout.ts`).
- Mọi CSS mobile phải nằm trong `@media (max-width: 1023px)` hoặc dùng tiền tố `lg:` để trả lại giá trị desktop.

## 2. Khoảng cách (Spacing)

**Quy tắc chính: các khối lớn xếp dọc cách nhau đều 12px.**

| Vị trí | Giá trị | Cách làm |
|---|---|---|
| Tiêu đề trang → Tab bar | 12px | `gap-y-3 lg:gap-y-1` |
| Tab bar → khối đầu tiên của nội dung | 12px | `mb-3 lg:mb-2` |
| Thanh điều hướng → Nút tạo (mobile: dọc, tablet: ngang) | 12px | `gap-3` |
| Alert nằm giữa các khối | 12px | `marginBottom: 12` |
| Giữa các card trong danh sách | 12px | `gap-3` |
| Nút trong cùng 1 hàng (‹ ngày ›) | 8px | `gap-2` |
| Ô chọn ngày trong tuần | 4px | `gap-1` |
| Padding trong card | 12px | `px-3 pt-3 pb-3` / `.mobile-card` |
| Header card → nội dung | 8px | `pb-2` + `pt-2`, có divider |
| Giữa các dòng trong card | 7–8px | `.mobile-card-rows` / `gap-2` |

> **Lưu ý margin trên component antd:** style của antd không nằm trong `@layer` nên luôn thắng utility Tailwind (`@layer utilities`),
> và antd reset `margin: 0` cho Card, Alert, Steps, Tabs, Space… → `className="mb-4"` trên các component này **không có tác dụng**.
> Luôn dùng dạng `!`: `mb-4! max-lg:mb-3!` (desktop 16px, mobile/tablet 12px). Thẻ HTML thường (`div`, `section`) thì không cần `!`.

## 3. Bo góc (Radius) — thống nhất mọi bề rộng

**Toàn bộ admin (mobile, tablet, desktop) dùng chung 1 bo góc: 8px** (`rounded-lg`).

| Thành phần | Radius |
|---|---|
| Card, card trạng thái, bảng (`.ant-table-wrapper`), stat card | 8px |
| Nút, Input, Select, DatePicker, InputNumber, Alert, Tag, Segmented | 8px |
| Modal, popover, khung lọc, ô chọn ngày, thẻ lịch hẹn, chip | 8px |
| Menu sidebar (item đang chọn) | 8px |
| Mục con nằm trong khung 8px (vd. item Segmented trong nền tím) | 6px |
| Ngoại lệ giữ nguyên | hình tròn (`rounded-full`, `50%`, nút tròn `size-9` + `rounded-[18px]`), pill `999px`, màn quay thưởng `WheelSpinModal`, thẻ hạng `CustomerRankCard` |

Nguồn:
- **Theme antd** (`src/theme.ts`): `borderRadius` / `borderRadiusSM` / `borderRadiusLG` = 8; `Menu.itemBorderRadius`, `Card.borderRadiusLG`,
  `Table.borderRadiusLG` = 8 (Menu sidebar trong `AdminLayout.tsx` cũng 8).
- **`src/mobile-ui.css`**: rule bo góc 8px cho phần tử trong `.mobile-ui` áp ở mọi bề rộng (không còn nằm trong media query mobile).
- **Code tự viết**: chỉ dùng `rounded-lg` / `border-radius: 8px` / `borderRadius: 8`. **Không** dùng `rounded-xl`, `rounded-2xl`,
  `rounded-[10px…24px]`, `border-radius: 10–24px`; không cần cặp `rounded-xl max-lg:rounded-lg` nữa.
- Nhóm ghép (Input.Search, Space.Compact) chỉ bo 2 góc ngoài.

## 4. Kích thước & chữ

| Thành phần | Kích thước |
|---|---|
| **Mọi control trên toolbar** (nút, nút icon, ô tìm kiếm, select, date picker, segmented) | **Cùng cao 44px** — do token `<MobileUI>`, không tự đặt height. Nút icon vuông 44×44. Chiều rộng co giãn theo màn hình (grid/flex), chiều cao cố định |
| Nút/control tự vẽ (không phải antd) | `h-11` (44px) để khớp |
| **Chiều cao control toolbar theo bề rộng** | Mobile + tablet (<1024px) **44px** (token `<MobileUI>`), desktop **40px** (`controlHeight` trong `src/theme.ts`). Mọi control trong cùng toolbar luôn bằng nhau — kể cả toolbar lịch (`CalendarToolbar`): **không** đặt `h-8/h-9/h-10`, `w-*` hay `style={{ fontSize }}` cho icon; nút icon dùng `shape="circle"`/vuông theo chiều cao chuẩn |
| **Icon trong toolbar** (kính lúp, mũi tên select, nút xóa ✕, icon lịch, icon trên nút: +, lọc, làm mới…) | **Cùng 14px ở mọi bề rộng** — `mobile-ui.css` tự đặt, không truyền `style={{ fontSize }}` riêng cho icon |
| Nút icon (mobile <768px) | Nút có icon + chữ tự thành nút vuông **44×44** chỉ còn icon; muốn giữ chữ thêm `keep-label` |
| Bóng đổ nút | **Không có ở mọi bề rộng** — token `Button.primaryShadow/defaultShadow/dangerShadow: 'none'` trong `src/theme.ts`; không thêm `box-shadow` / `shadow-*` cho nút. Bóng làm nút chính trông cao hơn input bên cạnh |
| Tab trong tab bar | Mặc định antd |
| Ô chọn ngày | Cao 58px; nhãn thứ 11px; số ngày 16px semibold (`text-base leading-5`) |
| Dòng ca trong card | Cao tối thiểu 44px, chữ 14px |
| Tiêu đề card | 15px semibold/bold |
| Nhãn (label) trong card | 12px, màu `#655E71`, cột rộng 107px |
| Giá trị (value) trong card | 13px medium, màu `#282335` |
| Chữ phụ / mô tả | 12–13px, màu `#6F7071` |

**Font weight của nút:** nút toolbar (Tạo/Đăng ký, Bộ lọc) dùng **weight thường**, không bold. Không thêm `font-semibold!`.

## 5. Màu

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--brand-primary` | `#8E63A9` (runtime có thể đổi) | Nút chính, chữ/viền đang chọn, ngày đang chọn |
| Viền nhạt | `#E9DDF0` | Viền card, nút outline, ô ngày |
| `--brand-border-soft` | — | Viền `.mobile-card` |
| Chip tím nhạt | `#F3E8F7` | Chip ngày trong header card |
| Dòng ca | nền `#EAF0FB`, chữ `#25407A` | Item trong card |
| Nút xóa | nền `#FDECEC`, `danger` | Icon thùng rác |
| Lỗi | viền `#F5C2C7`, nền `#FDF1F2`, chữ `#B42318` | Card lỗi |
| Chữ chính | `#292331` / `#282335` | Tiêu đề, giá trị |
| Chữ phụ | `#6F7071` / `#655E71` | Label, mô tả |

## 6. Cấu trúc trang (từ trên xuống)

```
Tiêu đề trang + subtitle
   ↕ 12px
Tab bar gạch chân (tab rộng theo chữ, vuốt ngang khi tràn)
   ↕ 12px
[Alert nếu có]
   ↕ 12px
Toolbar: điều hướng / bộ lọc  +  nút tạo
   (mobile: 2 hàng hoặc grid 2 cột; tablet: 1 hàng)
   ↕ 12–16px
Nội dung: danh sách card
```

### 6.1 Tab bar
Mẫu chuẩn: **`/customer-data-config`** — dùng `<Tabs>` antd **mặc định**, không tự style lại thanh tab.
- **Không** ép tab chia đều full width (`flex: 1`, `min-width: 100%`…) và **không** dùng kiểu segmented.
- Mỗi tab rộng theo chữ, khoảng cách tab mặc định antd (`tabBarGutter` không đặt), size mặc định (`middle`).
- Tab nhiều hơn bề ngang màn hình → **vuốt/kéo sang 2 bên** để xem tab bị khuất (antd tự hỗ trợ touch-drag),
  mép bị cắt có bóng mờ báo còn tab, nút "…" mở danh sách tab ẩn. Không xuống dòng, không rút gọn tên tab.
- Tab active: chữ màu chính + gạch chân (ink-bar), có đường kẻ mảnh dưới thanh tab.
- Tab bar nằm dưới tiêu đề, cách tiêu đề và nội dung 12px.
- Nút phụ cạnh tab (`tabBarExtraContent`, vd. Làm mới): chỉ hiện icon trên mobile để chừa chỗ cho tab.
- Trang tự vẽ tab bar (`renderTabBar`, vd. Lịch làm việc): style riêng của desktop phải để sau tiền tố `lg:`;
  dưới 1024px trả về `size="middle"`, bỏ `tabBarGutter`. Phần tử bọc thanh tab cần `min-w-0` để vuốt ngang được.

### 6.2 Toolbar
- Nút cao 44px, radius 8px, full width trong ô grid, chữ thường (không bold).
- 2 nút ngang nhau: `grid grid-cols-2 gap-2` (vd. Bộ lọc | Đăng ký nghỉ).
- Điều hướng kỳ: `grid-cols-[44px_1fr_44px] gap-2` — nút ‹ / nút khoảng ngày có icon lịch / nút ›.
- Tablet: điều hướng + nút tạo chung hàng: `md:grid-cols-[minmax(0,1fr)_158px]`.

- **Segmented trên toolbar** (vd. Ngày | Tuần, Lịch | Danh sách ở `/appointments`): nền tím nhạt
  (`color-mix(in srgb, var(--brand-primary) 6%, var(--brand-bg))`), viền `--brand-border-soft`, bo 8px, padding 3px → cao đúng 44px;
  mục đang chọn là ô trắng bo 6px, bóng nhẹ, chữ màu chính. Mẫu: `.appointment-mobile-segment` trong `src/pages/Appointments/appointments.css`.
- **Mẫu `/appointments` (mobile, cả chế độ Lịch và Danh sách):** `[Ngày|Tuần][Lịch|Danh sách]` · `[‹][📅 16/11 → 22/11][›]` · `[Chọn cơ sở][Tất cả]` · `[+ Thêm lịch hẹn]`.
  Bên dưới (chế độ Lịch): lưới giờ `AppointmentsMobileGrid` — header cùng màu nút chính `--brand-primary` (Giờ | T2 16/11 | …), cột Giờ 52px cố định,
  mỗi ngày 120px vuốt ngang (gợi ý "Vuốt ngang để xem các ngày còn lại"), mỗi giờ cao 56px; thẻ lịch hẹn nền màu trạng thái +
  viền trái màu nhấn, 3 dòng: trạng thái (10px) / tên khách (13px đậm) / SĐT (11px). Chế độ Ngày: 1 cột full width.
  **Tablet + desktop dùng cùng bảng màu thẻ** (`AppointmentsCalendar`): nền `STATUS_COLORS[status].bg`, viền trái 3px `accent`,
  chữ tối — màu chỉ theo trạng thái (không còn tô theo phân loại), chú giải chỉ còn nhóm Trạng thái.
  Chế độ Danh sách ẩn hẳn `Ngày | Tuần` (hàng 1 chỉ còn `Lịch | Danh sách` full width), tự xem theo tuần; danh sách lọc theo ngày/tuần đang chọn (chỉ mobile, desktop vẫn liệt kê toàn bộ).

- **Ô tìm kiếm luôn là `Input.Search` của antd** (ô nhập + nút kính lúp ghép bên phải), có `allowClear`, `onSearch` để Enter / bấm nút đều tìm.
  **Không** tự làm ô tìm bằng `<Input prefix={<SearchOutlined />}>`. Desktop: ô tìm + các select lọc nằm **cùng 1 hàng**, nút tạo ở cuối hàng.

#### 6.2.1 Quy tắc xếp hàng toolbar (mobile < 768px)

Tablet (768–1023px) giữ 1 hàng ngang, căn phải. Dưới 768px xếp theo quy tắc sau.

**Cách đếm:** `N` = số tool **không tính** ô tìm kiếm và nút tạo (Create). Tool = select, bộ lọc, date picker, segmented, nút phụ…

1. **Ô tìm kiếm luôn đứng riêng 1 hàng**, full width, nằm trên cùng.
2. **N = 2, có nút tạo** (giống `/content-posts`): 2 tool chia đều phần còn lại, nút tạo **thu nhỏ** thành nút icon vuông 44×44 ở cuối hàng.
3. **N chẵn > 2 (4, 6, 8)**: tool xếp **2 cái 1 hàng**. Có nút tạo thì **hàng cuối** làm như mục 2 (2 tool + nút tạo thu nhỏ).
4. **N lẻ (3, 5, 7)**: tool **cần nhiều chỗ nhất** (vd. date range, select tên dài) đứng **riêng 1 hàng**, còn lại xếp 2 cái 1 hàng. Có nút tạo thì nút tạo cũng **đứng riêng 1 hàng, full width** (hàng cuối).
   Mọi nút đứng riêng 1 hàng **bắt buộc có icon + tên** (thêm `keep-label`), không để nút chỉ có icon nằm trong ô rộng.

| N | Có nút tạo | Bố cục (mỗi dòng = 1 hàng) |
|---|---|---|
| 0 | Có | `[ Tìm kiếm ]` · `[ + Tạo … ]` |
| 1 | Có | `[ Tìm kiếm ]` · `[ A ][+]` |
| 2 | Có | `[ Tìm kiếm ]` · `[ A ][ B ][+]` |
| 2 | Không | `[ Tìm kiếm ]` · `[ A ][ B ]` |
| 3 | Có | `[ Tìm kiếm ]` · `[ A (rộng) ]` · `[ B ][ C ]` · `[ + Tạo … ]` |
| 3 | Không | `[ Tìm kiếm ]` · `[ A (rộng) ]` · `[ B ][ C ]` |
| 4 | Có | `[ Tìm kiếm ]` · `[ A ][ B ]` · `[ C ][ D ][+]` |
| 5 | Có | `[ Tìm kiếm ]` · `[ A (rộng) ]` · `[ B ][ C ]` · `[ D ][ E ]` · `[ + Tạo … ]` |
| 6 | Có | `[ Tìm kiếm ]` · `[ A ][ B ]` · `[ C ][ D ]` · `[ E ][ F ][+]` |

`[+]` = nút tạo thu nhỏ (icon, 44×44). `[ + Tạo … ]` = nút tạo full width, có icon + tên.

**Code mẫu** (mỗi hàng 1 grid; khoảng cách giữa control 8px, giữa các hàng 8px):

```tsx
<ToolbarRow className="max-md:grid max-md:grid-cols-1">
  {/* Hàng 1: tìm kiếm */}
  <Input className="w-full! md:w-[220px]!" prefix={<SearchOutlined />} placeholder="Tìm…" />

  {/* Hàng thường: 2 tool / hàng */}
  <div className="grid grid-cols-2 gap-2 md:contents">
    <Select className="w-full md:w-[160px]" />
    <Select className="w-full md:w-[160px]" />
  </div>

  {/* Hàng cuối có nút tạo thu nhỏ (N chẵn) */}
  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-2 md:contents">
    <Select className="w-full md:w-[160px]" />
    <Select className="w-full md:w-[160px]" />
    <Button type="primary" icon={<PlusOutlined />}>Tạo</Button>  {/* tự thành nút vuông 44×44 */}
  </div>

  {/* N lẻ: tool rộng / nút tạo đứng riêng 1 hàng, có icon + tên */}
  <DatePicker.RangePicker className="w-full md:w-auto" />
  <Button type="primary" className="keep-label" icon={<PlusOutlined />}>Tạo bài viết</Button>
</ToolbarRow>
```

- `md:contents` để từ tablet các hàng con "tan" ra, tất cả về lại 1 hàng ngang của `ToolbarRow`.
- Nút tạo thu nhỏ: **không** thêm `keep-label` → `mobile-ui.css` tự ẩn chữ, thành nút vuông 44×44.
- Nút đứng riêng hàng: **phải** có `keep-label` + `icon`.

### 6.3 Card danh sách
- Header: tiêu đề (tên) bên trái, Tag trạng thái / chip bên phải, divider dưới.
- Body: các dòng **label : value** (`MobileCardRow`). Thông tin chính (ngày, thời gian, lý do…) đặt **trong body thành từng dòng riêng**, không dồn vào subtitle header.
  - Ví dụ Ngày nghỉ: `Ngày nghỉ:` / `Thời gian nghỉ:` / `Lý do:`
- Actions (nếu có): hàng dưới cùng, căn phải, divider nét đứt (`.mobile-card-actions`).

### 6.3b Phân trang (`ListPagination`)
- Mobile/tablet: **bỏ dòng "Hiển thị x – y trong n …"**, chỉ còn cụm nút **căn giữa**, cách danh sách 16px.
- Mobile (<768px): mọi nút (‹, số trang, ›) cùng cỡ **36×36**, cách nhau **8px**, bo 8px, nền `#F0EBF2`; trang hiện tại nền màu chính chữ trắng;
  trang xa rút gọn bằng `…` (luôn hiện trang đầu/cuối và 2 trang kề trang hiện tại).
- Tablet (768–1023px): `Pagination` antd, ẩn dòng đếm, căn giữa (`.list-pagination` trong `index.css`).

### 6.4 Trạng thái
Dùng `MobileLoadingCards`, `MobileErrorCard`, `MobileEmptyCard` — không dùng Alert/Empty mặc định của antd trên mobile.

## 7. Checklist khi làm page mới

- [ ] Trang nằm trong `AdminLayout` (tự có `<MobileUI>`); không phải Dashboard
- [ ] Tab bar mặc định antd như `/customer-data-config` (không chia đều, vuốt ngang khi tràn)
- [ ] Toolbar xếp hàng đúng mục 6.2.1 (tìm kiếm riêng hàng, 2 tool / hàng, nút tạo thu nhỏ hoặc full width có icon + tên)
- [ ] Mọi control trên toolbar cao bằng nhau 44px (không set height riêng cho control antd)
- [ ] Icon trong toolbar cùng 14px, nút chính không đổ bóng; nút icon vuông 44×44
- [ ] Desktop không đổi (mọi style nằm dưới 1024px hoặc có `lg:` trả về)
- [ ] Khoảng cách dọc giữa các khối = 12px
- [ ] Toàn bộ nội dung trong tab bo 8px (kể cả component antd, popover)
- [ ] Nút thao tác cao 44px, không bold
- [ ] Table desktop có class `desktop-only`, card mobile qua `MobileCards` (`mobile-only`)
- [ ] Card: thông tin chính dạng label:value trong body
- [ ] Có đủ 3 trạng thái Tải / Lỗi / Trống

## 8. Modal tạo / sửa (chuẩn theo "Thêm khách hàng" ở `/customers`)

Mẫu: `src/pages/Customers/components/CustomerProfileFormModal.tsx`.

**Khung modal**
- `<Modal>` antd mặc định (rộng 520px; form nhiều trường thì `width={720}` hoặc `min(880px, calc(100vw - 24px))`).
- Tiêu đề: `Thêm <đối tượng>` khi tạo, `Sửa <đối tượng>` khi sửa — cùng 1 modal cho cả 2.
- Footer mặc định của antd: `[Hủy] [Lưu]` căn phải — `okText="Lưu"`, `cancelText="Hủy"` cho **mọi form tạo/sửa**.
  Chỉ modal hành động mới dùng động từ riêng: Gửi, Thanh toán, Từ chối, Đổi quà, Gán hạng, Xuất bản, Tiếp nhận…
- **Không** tự style lại footer (không ép 2 nút full width, không đổi chiều cao/bo góc/đậm chữ) — chiều cao 44px và bo 8px
  trên mobile đã có từ `<MobileUI>` (modal mở từ trang vẫn nhận token). Form dài có thể thêm viền trên footer.
- `destroyOnHidden` để mở lại là form sạch.

**Form bên trong**
- `<Form layout="vertical">`, cách tiêu đề 12px (`className="mt-3"`).
- **Trường ngắn xếp 2 cột, kể cả trên mobile**: `<div className="grid grid-cols-2 gap-x-3">` (hoặc `Row gutter` + `Col span={12}`;
  CSS chung trong `index.css` giữ 2 cột trên mobile cho `.ant-modal .ant-row:not(.ant-form-item-row) > .ant-col`).
- **Mỗi `Form.Item` luôn full width ô chứa nó** — CSS chung đã loại trừ `.ant-form-item-row` (Row/Col nội bộ của antd cho nhãn + ô nhập);
  không cần thêm override `.ant-form-item-row > .ant-col { flex-basis: 100% }` cho từng modal nữa.
  Ví dụ cặp: Họ tên | SĐT, Email | Ngày sinh, Loại | Số tiền.
- **Trường dài 1 hàng full**: địa chỉ, ghi chú, mô tả, select danh sách dài, upload ảnh, rich text (`Col span={24}`).
- Ghi chú/mô tả: `Input.TextArea rows={2}`.
- Placeholder có ví dụ cụ thể: `VD: Nguyễn Thu Hà`, `0901234568`, `email@gmail.com`.
- Đúng bàn phím: SĐT `inputMode="tel"`, email `inputMode="email"`.
- Ngày: `DatePicker` full width (`style={{ width: '100%' }}`), `format="DD/MM/YYYY"`, chặn ngày không hợp lệ bằng `disabledDate`.
- Bắt buộc: `rules={[{ required: true, message: 'Nhập …' / 'Chọn …' }]}` — câu tiếng Việt ngắn.
- Trường tùy chỉnh (custom fields) đặt sau nhóm trường cơ bản, trước Địa chỉ / Ghi chú.

**Viền ô nhập**: mọi `.ant-modal .ant-form` (input, input number, select, date picker) có viền đậm hơn một chút
`color-mix(in srgb, var(--brand-dark) 22%, white)` khi chưa hover/focus — CSS chung trong `src/index.css`, không cần thêm class.

**Checklist modal**
- [ ] Tiêu đề Thêm/Sửa, footer `[Hủy] [Lưu]` mặc định
- [ ] Trường ngắn 2 cột (cả mobile), trường dài full width
- [ ] Placeholder có ví dụ, đúng `inputMode`, DatePicker full width `DD/MM/YYYY`
- [ ] Không CSS riêng cho footer / chiều cao nút trong modal
