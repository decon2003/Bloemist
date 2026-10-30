# Bloemist Ops

Hệ thống quản lý vận hành nội bộ của tiệm hoa Bloemist.

| Môi trường | Địa chỉ | Trạng thái |
|---|---|---|
| **Devtest** | Trên máy: `npm run devtest` | Chỉ chủ cửa hàng thử nghiệm; database riêng trên máy |
| **Production** | `noibo.bloemistflorals.com` | Nhân viên dùng. Hiện vẫn nối với database thử cho tới ngày lên production (xem [DEPLOY.md](DEPLOY.md#5-dựng-bản-production)) |

## Chức năng

- **Đơn hàng**
  - Tạo đơn: thông tin khách có thể bổ sung sau; có ô "người nhận là khách".
  - Tính tiền: phí ship hoặc freeship, VAT chỉ khi nhập (mặc định 0%), tiền cọc.
  - Bán tại cửa hàng (khách lẻ trả tiền và lấy hoa luôn): chọn "Bán tại cửa hàng" ở đầu màn Tạo đơn. Chỉ nhập sản phẩm, giá và thợ đã làm; đơn được ghi là đã thanh toán đủ, đã giao, tính doanh thu, KPI ca hiện tại, hoa hồng sale và hoa hồng làm đơn như đơn thường.
  - Thu tiền: tiền cọc lúc tạo đơn là lần thu đầu (tích "Khách đã thanh toán đủ" nếu khách trả hết); khách trả nốt sau đó thì sale bấm "Ghi nhận khách trả thêm" (chỉ để theo dõi công nợ, không tính KPI). "Đã thu" và "Còn phải thu" tự cập nhật; chỉ quản lý xoá được một khoản thu.
  - Lời thiệp và ghi chú đặc biệt nhập riêng.
  - Huỷ đơn: đơn huỷ không tính doanh thu và hoa hồng. Chỉ quản lý được xoá đơn.
- **Nhân viên phụ trách đơn**
  - Khi tạo đơn, sale có thể chọn nhân viên phụ trách hoặc để trống.
  - Thợ tự bấm "Nhận đơn" ngay trên màn Đơn hàng, hoặc đổi nhân viên phụ trách trong trang đơn. Ai cũng đổi được, và mọi lần đổi đều ghi lịch sử.
  - Nhân viên phụ trách mới nhận luôn các sản phẩm chưa làm của người cũ (hoặc chưa ai làm). Sản phẩm đã giao riêng cho thợ khác vẫn giữ nguyên.
- **Sản phẩm của đơn**
  - Mỗi sản phẩm là một việc. Thợ bấm "Nhận làm", rồi "Hoàn tất" ngay trên trang đơn (không cần ảnh).
  - **Ảnh thành phẩm do sale chụp:** sale bấm "Thêm ảnh thành phẩm" trên sản phẩm đã hoàn tất.
  - Làm xong hết sản phẩm thì đơn tự chuyển "Sẵn sàng".
- **Trạng thái đơn**
  - Thợ chuyển được đơn tới "Sẵn sàng". "Đã giao" và huỷ đơn do sale hoặc quản lý làm.
  - Chuyển đơn sang "Sẵn sàng" thì các sản phẩm còn mở được tính là đã làm xong: người làm là thợ của sản phẩm, hoặc nhân viên phụ trách nếu sản phẩm chưa có thợ. Nhờ vậy hoa hồng làm đơn không bị mất.
- **Ai thấy gì**
  - Sale và quản lý thấy toàn bộ đơn.
  - Thợ (florist) thấy thông tin để làm hoa: giá hoa, ship, thiệp, ghi chú, ngày giờ giao, tên và địa chỉ. **Số điện thoại và chi tiết thanh toán bị ẩn ngay từ máy chủ.**
- **Khách hàng** (chỉ quản lý)
  - Tự nhận khách cũ theo SĐT người đặt.
  - Ghi chú, nguồn khách, lịch sử đơn và người nhận.
  - Tìm theo tên hoặc SĐT của người đặt, người nhận, người tặng.
- **Chấm công**
  - Vào/ra tại cửa hàng; sale có thêm ca **Online** (làm tại nhà, không tính OT).
  - Ca qua nửa đêm được, tối đa 16 tiếng.
  - Quên chấm ra thì tính 0 giờ cho tới khi sửa. Nhân viên tự sửa trong 3 ngày.
- **Bảng lương**
  - Lương cứng chia theo ngày công, không vượt lương đủ tháng (mặc định nghỉ 4 ngày/tháng).
  - Lương giờ: đơn giá riêng cho ngày lễ (không áp dụng cho sale) và cho giờ online.
  - Tăng ca (không áp dụng cho sale; mọi giờ của sale tính lương giờ): giờ ngoài khung giờ mở cửa, từ 10 phút trở lên tính theo phút; chỉ trả khi quản lý duyệt. Mỗi người có đơn giá tăng ca riêng trong hồ sơ lương (trống = như đơn giá giờ). Ca gấp tính toàn bộ là tăng ca.
  - Phụ cấp cố định (ăn uống, xăng xe...) trong hồ sơ lương, trả đủ mỗi tháng.
  - Hoa hồng: hoa hồng sale; hoa hồng làm đơn chỉ cho thợ.
  - KPI sale theo ca (sáng, chiều, tối): tiền hoa khách chuyển ngay trong ca sale tạo đơn, lúc sale đang chấm công; tiền trả nốt ở ca khác chỉ tính hoa hồng; không tính VAT và ship; thưởng mức cao nhất đạt được. Ca và mức thưởng cài ở Cài đặt.
  - Chỉ chốt được sau khi hết tháng. Nhân viên xem lương của mình ở mục "Thu nhập".
- **Dashboard** (quản lý): doanh thu tháng/tuần theo ngày đặt, đơn đang xử lý.
- **Hiển thị**: giờ theo chuẩn 24h, ngày dạng dd/mm/yyyy, múi giờ Việt Nam (+07:00).

Vai trò: `admin` (quản lý), `sales`, `florist`. Mọi quyền đều được kiểm tra ở máy chủ (`lib/server/session.ts`); danh sách API và quyền nằm ở [docs/api-endpoints.md](docs/api-endpoints.md).

## Công nghệ

Next.js 16 (App Router), Prisma 5 với Postgres (Neon, Singapore), ảnh và bản sao lưu trên Cloudflare R2 (bucket riêng tư), triển khai trên Vercel (`sin1`).

## Chạy trên máy

```bash
npm install
npm run devtest              # http://localhost:3000, và http://<IP máy>:3000 cho điện thoại cùng Wi-Fi
npm run devtest -- --reset   # xoá sạch dữ liệu thử, làm lại từ đầu
```

Lệnh này tự bật một database riêng trong `.devtest/`, chạy migration và tạo tài khoản mẫu (in ra màn hình). Nó **không bao giờ** dùng database trong `.env`. Chi tiết: [DEPLOY.md, mục 3](DEPLOY.md#3-devtest-trên-máy).

## Triển khai, sao lưu, khôi phục

Xem [DEPLOY.md](DEPLOY.md).
