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
  - Lời thiệp và ghi chú đặc biệt nhập riêng.
  - Huỷ đơn: đơn huỷ không tính doanh thu và hoa hồng. Chỉ quản lý được xoá đơn.
- **Sản phẩm của đơn**
  - Mỗi sản phẩm là một việc. Thợ bấm "Nhận làm", rồi "Hoàn tất" kèm ảnh thành phẩm, ngay trên trang đơn.
  - Làm xong hết sản phẩm thì đơn tự chuyển "Sẵn sàng".
- **Công việc** (thợ và quản lý)
  - Một danh sách sản phẩm theo giờ giao, nhóm theo ngày; việc quá hạn chưa xong luôn đứng đầu.
  - Thợ thấy sản phẩm được giao cho mình; quản lý thấy cả tiệm và lọc theo thợ hoặc "Chưa giao".
  - Bấm một dòng để xem ảnh mẫu, thiệp, ghi chú và "Hoàn tất" kèm ảnh ngay tại đó.
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
  - OT ngoài giờ: bỏ qua lệch dưới 15 phút, quản lý duyệt. Ca gấp tính toàn bộ là OT.
  - Hoa hồng: hoa hồng sale; hoa hồng làm đơn chỉ cho thợ.
  - Chỉ chốt được sau khi hết tháng. Nhân viên xem lương của mình ở mục "Thu nhập".
- **Dashboard** (quản lý): doanh thu tháng/tuần theo ngày đặt, đơn đang xử lý.
- **Hiển thị**: giờ theo chuẩn 24h, ngày dạng dd/mm/yyyy, múi giờ Việt Nam (+07:00).

Vai trò: `boss` và `admin` (quản lý), `sales`, `florist`. Mọi quyền đều được kiểm tra ở máy chủ (`lib/server/session.ts`); danh sách API và quyền nằm ở [docs/api-endpoints.md](docs/api-endpoints.md).

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
