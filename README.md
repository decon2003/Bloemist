# Bloemist Ops

Hệ thống quản lý vận hành nội bộ của tiệm hoa Bloemist.

| Môi trường | Địa chỉ | Trạng thái |
|---|---|---|
| **Devtest** | https://noibo.bloemistflorals.com | Đang chạy; dùng để thử nghiệm, được sửa dữ liệu |
| **Production** | `noibo.bloemistflorals.com` | Chưa dựng. Khi lên production, domain này chuyển sang bản production (xem [DEPLOY.md](DEPLOY.md#5-dựng-bản-production)) |

## Chức năng

- **Đơn hàng**
  - Tạo đơn: thông tin khách có thể bổ sung sau; có ô "người nhận là khách".
  - Tính tiền: phí ship hoặc freeship, VAT chỉ khi nhập (mặc định 0%), tiền cọc.
  - Thu tiền: mỗi lần khách chuyển tiền, sale bấm "Ghi nhận tiền khách chuyển" (tiền cọc lúc tạo đơn là lần đầu). "Đã thu" và "Còn phải thu" tự cập nhật; chỉ quản lý xoá được một khoản thu.
  - Lời thiệp và ghi chú đặc biệt nhập riêng.
  - Huỷ đơn: đơn huỷ không tính doanh thu và hoa hồng. Chỉ quản lý được xoá đơn.
- **Người phụ trách đơn**
  - Khi tạo đơn, sale có thể chọn người phụ trách hoặc để trống.
  - Thợ tự bấm "Nhận đơn" ngay trên màn Đơn hàng, hoặc đổi người phụ trách trong trang đơn. Ai cũng đổi được, và mọi lần đổi đều ghi lịch sử.
  - Người phụ trách mới nhận luôn các sản phẩm chưa làm của người cũ (hoặc chưa ai làm). Sản phẩm đã giao riêng cho thợ khác vẫn giữ nguyên.
- **Sản phẩm của đơn**
  - Mỗi sản phẩm là một việc. Thợ bấm "Nhận làm", rồi "Hoàn tất" ngay trên trang đơn (không cần ảnh).
  - **Ảnh thành phẩm do sale chụp:** sale bấm "Thêm ảnh thành phẩm" trên sản phẩm đã hoàn tất.
  - Làm xong hết sản phẩm thì đơn tự chuyển "Sẵn sàng".
- **Trạng thái đơn**
  - Thợ chuyển được đơn tới "Sẵn sàng". "Đã giao" và huỷ đơn do sale hoặc quản lý làm.
  - Chuyển đơn sang "Sẵn sàng" thì các sản phẩm còn mở được tính là đã làm xong: người làm là thợ của sản phẩm, hoặc người phụ trách nếu sản phẩm chưa có thợ. Nhờ vậy hoa hồng làm đơn không bị mất.
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
  - Tăng ca: giờ ngoài khung giờ mở cửa, từ 10 phút trở lên tính theo phút; chỉ trả khi quản lý duyệt. Mỗi người có đơn giá tăng ca riêng (trống = đơn giá giờ × hệ số). Ca gấp tính toàn bộ là tăng ca.
  - Phụ cấp cố định (ăn uống, xăng xe...) trong hồ sơ lương, trả đủ mỗi tháng.
  - Hoa hồng: hoa hồng sale; hoa hồng làm đơn chỉ cho thợ.
  - KPI sale theo ca (sáng, chiều, tối): tiền hoa khách chuyển cho đơn của sale lúc sale đang chấm công, không tính VAT và ship; thưởng mức cao nhất đạt được. Ca và mức thưởng cài ở Cài đặt.
  - Chỉ chốt được sau khi hết tháng. Nhân viên xem lương của mình ở mục "Thu nhập".
- **Dashboard** (quản lý): doanh thu tháng/tuần theo ngày đặt, đơn đang xử lý.
- **Hiển thị**: giờ theo chuẩn 24h, ngày dạng dd/mm/yyyy, múi giờ Việt Nam (+07:00).

Vai trò: `admin` (quản lý), `sales`, `florist`. Mọi quyền đều được kiểm tra ở máy chủ (`lib/server/session.ts`); danh sách API và quyền nằm ở [docs/api-endpoints.md](docs/api-endpoints.md).

## Công nghệ

Next.js 16 (App Router), Prisma 5 với Postgres (Neon, Singapore), ảnh và bản sao lưu trên Cloudflare R2 (bucket riêng tư), triển khai trên Vercel (`sin1`).

## Chạy trên máy

**Không trỏ `.env` vào database của devtest hay production.** Dùng một database riêng: Postgres cài trên máy, hoặc một branch Neon tạo riêng cho việc này.

```bash
cp .env.example .env   # điền DATABASE_URL của database thử; để trống các biến R2_*
npm install
npx prisma migrate deploy
npx tsx --env-file=.env prisma/seed.ts
node scripts/set-password.mjs admin@bloemist.com '<mat-khau>'
npm run dev            # http://localhost:3000 (chỉ máy này truy cập được)
```

- Không có `AUTH_SECRET` thì khi chạy dev, app tự tạo một khoá ngẫu nhiên. Khởi động lại server sẽ phải đăng nhập lại.
- Để trống `R2_*` thì ảnh được lưu thẳng trong database.

## Triển khai, sao lưu, khôi phục

Xem [DEPLOY.md](DEPLOY.md).
