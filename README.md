# Bloemist Ops

Hệ thống quản lý vận hành nội bộ của tiệm hoa Bloemist: https://noibo.bloemistflorals.com

## Chức năng

- **Đơn hàng**: tạo đơn, tính tiền (giảm giá, phí ship, VAT, tiền cọc), giao đơn cho thợ, theo dõi trạng thái.
- **Công việc**: giao việc cắm hoa cho thợ, ảnh mẫu, hạn hoàn thành, ảnh chứng minh khi hoàn thành.
- **Khách hàng**: tự nhận khách cũ theo SĐT, ghi chú, nguồn khách, người nhận trước đây (chỉ quản lý xem danh sách).
- **Chấm công**: check-in/check-out, số giờ làm.
- **Nhân sự & lương**: lương cơ bản, % hoa hồng, báo cáo theo tháng.
- **Dashboard**: doanh thu tháng/tuần, đơn đang xử lý.

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
