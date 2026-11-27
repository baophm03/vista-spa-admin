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

1. Bọc toàn bộ nội dung trang bằng `<MobileUI>…</MobileUI>` (`src/components/base/MobileUI.tsx`, nhận thêm `className`).
   Dưới 1024px component này:
   - bật token antd qua `ConfigProvider`: `controlHeight: 44`, `borderRadius: 8` → **mọi** Button, Input, Input.Search, Select,
     DatePicker, Segmented… (kể cả trong modal/popover mở từ trang) cao đúng 44px, chữ căn giữa;
     size small/large giữ 30/50px nên nút nhỏ trong card không đổi;
   - gắn class `mobile-ui` (`src/mobile-ui.css`): khoảng cách 12px, tab chia đều, bo góc 8px cho phần tử không phải antd;
     trong toolbar (`.page-title-controls`, `.toolbar-row`): nút không bold, không đổ bóng, icon 14px, nút icon vuông 44×44.
   - **Không** chỉnh chiều cao control bằng CSS `height`/`min-height` (antd v6 Select tính chiều cao từ padding, ép bằng CSS sẽ lệch chữ).
2. Toolbar trong tab dùng `ToolbarRow` (đã có class `toolbar-row`); toolbar tự viết thì thêm class `toolbar-row`.
3. Nút cần giữ chữ trên mobile (<768px) thêm class `keep-label` (mặc định nút có icon chỉ còn icon).
4. Class Tailwind bo góc riêng (`rounded-xl`, `rounded-[10px]`…) không bị CSS chung đè → thêm `max-lg:rounded-lg`
   (hoặc đổi thẳng nếu component chỉ dùng cho mobile).

Đã áp dụng: Lịch làm việc, Bài viết App, Video App, Cơ sở, Danh mục chọn, Thương hiệu, Thông báo, Nhật ký.

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

## 3. Bo góc (Radius)

**Tất cả nội dung bên trong tab dùng chung 1 bo góc: 8px** (`rounded-lg`).

| Thành phần | Radius |
|---|---|
| Card, card trạng thái (tải/lỗi/trống) | 8px |
| Nút (chính, phụ, icon, xóa) | 8px |
| Input, Select, DatePicker, Alert, Tag | 8px |
| Ô chọn ngày, dòng ca, chip ngày | 8px |
| Tab bar | Không bo (tab gạch chân) |

- Theme antd mặc định `borderRadius: 12` → không sửa theme/`.mobile-card` global; class `.mobile-ui` (`src/mobile-ui.css`) override về 8px trong phạm vi trang. Nhóm ghép (Input.Search, Space.Compact) chỉ bo 2 góc ngoài.

- Popover/Modal render qua portal không nằm trong selector trên → thêm `rounded-lg!` trực tiếp vào nút.

## 4. Kích thước & chữ

| Thành phần | Kích thước |
|---|---|
| **Mọi control trên toolbar** (nút, nút icon, ô tìm kiếm, select, date picker, segmented) | **Cùng cao 44px** — do token `<MobileUI>`, không tự đặt height. Nút icon vuông 44×44. Chiều rộng co giãn theo màn hình (grid/flex), chiều cao cố định |
| Nút/control tự vẽ (không phải antd) | `h-11` (44px) để khớp |
| **Icon trong toolbar** (kính lúp, mũi tên select, nút xóa ✕, icon lịch, icon trên nút: +, lọc, làm mới…) | **Cùng 14px** — `mobile-ui.css` tự đặt, không truyền `style={{ fontSize }}` riêng cho icon |
| Nút icon (mobile <768px) | Nút có icon + chữ tự thành nút vuông **44×44** chỉ còn icon; muốn giữ chữ thêm `keep-label` |
| Bóng đổ nút toolbar | Không có (`box-shadow: none`) — bóng làm nút chính trông cao hơn input bên cạnh |
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
Tab bar gạch chân (full width, tab chia đều)
   ↕ 12px
[Alert nếu có]
   ↕ 12px
Toolbar: điều hướng / bộ lọc  +  nút tạo
   (mobile: 2 hàng hoặc grid 2 cột; tablet: 1 hàng)
   ↕ 12–16px
Nội dung: danh sách card
```

### 6.1 Tab bar
Dùng `Tabs` antd mặc định như các trang khác (Quà đổi điểm, Điểm, Dashboard) — **không** dùng kiểu segmented.
- Nằm dưới tiêu đề, full width; tab `flex: 1` chia đều, chữ căn giữa, không xuống dòng.
- Tab active: chữ màu chính + gạch chân (ink-bar), có đường kẻ mảnh dưới thanh tab.
- Nút phụ cạnh tab (`tabBarExtraContent`, vd. Làm mới): chỉ hiện icon trên mobile.

### 6.2 Toolbar
- Nút cao 44px, radius 8px, full width trong ô grid, chữ thường (không bold).
- 2 nút ngang nhau: `grid grid-cols-2 gap-2` (vd. Bộ lọc | Đăng ký nghỉ).
- Điều hướng kỳ: `grid-cols-[44px_1fr_44px] gap-2` — nút ‹ / nút khoảng ngày có icon lịch / nút ›.
- Tablet: điều hướng + nút tạo chung hàng: `md:grid-cols-[minmax(0,1fr)_158px]`.

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

### 6.4 Trạng thái
Dùng `MobileLoadingCards`, `MobileErrorCard`, `MobileEmptyCard` — không dùng Alert/Empty mặc định của antd trên mobile.

## 7. Checklist khi làm page mới

- [ ] Bọc trang bằng `<MobileUI>`
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
