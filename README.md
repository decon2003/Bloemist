# Bloemist Ops

Hệ thống quản lý vận hành nội bộ của tiệm hoa Bloemist: https://noibo.bloemistflorals.com

## Chức năng

- **Đơn hàng**: tạo đơn (thông tin khách có thể bổ sung sau), tính tiền (phí ship/freeship, VAT khi có, tiền cọc), huỷ đơn (không tính doanh thu và hoa hồng), chỉ quản lý được xoá đơn.
- **Sản phẩm của đơn**: mỗi sản phẩm là một việc; thợ "Nhận làm" và "Hoàn tất" kèm ảnh thành phẩm ngay trên trang đơn; làm xong hết thì đơn tự chuyển "Sẵn sàng".
- **Khách hàng**: tự nhận khách cũ theo SĐT người đặt, ghi chú, nguồn khách, lịch sử đơn và người nhận (chỉ quản lý xem).
- **Chấm công**: vào/ra (ca qua nửa đêm, tối đa 16 tiếng); quên chấm ra tính 0 giờ cho tới khi sửa; nhân viên tự sửa trong 3 ngày.
- **Bảng lương**: lương cứng chia theo ngày công, lương giờ (đơn giá riêng ngày lễ), OT ngoài giờ (bỏ qua lệch dưới 15 phút, quản lý duyệt), ca gấp, hoa hồng sale và làm đơn; chốt sau khi hết tháng. Nhân viên xem mục "Thu nhập".
- **Dashboard**: doanh thu tháng/tuần theo ngày đặt, đơn đang xử lý.

Vai trò: `boss`, `admin` (quản lý), `sales`, `florist`. Quyền được kiểm tra ở máy chủ (`lib/server/session.ts`).

## Công nghệ

Next.js 16 · Prisma 5 + Postgres (Neon) · ảnh trên Cloudflare R2 · triển khai trên Vercel.

## Chạy trên máy

```bash
cp .env.example .env   # điền DATABASE_URL (một database thử, không dùng database thật)
npm install
npx prisma migrate deploy
npx tsx --env-file=.env prisma/seed.ts
node scripts/set-password.mjs admin@bloemist.com 'MatKhau123'
npm run dev
```

## Triển khai, sao lưu, khôi phục

Xem [DEPLOY.md](DEPLOY.md).
