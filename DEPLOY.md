
# Hướng dẫn Deploy lên Vercel + Neon (Postgres)

Phiên bản này đã được nâng cấp để sử dụng **Prisma ORM** và Database **Postgres** (cụ thể là Neon.tech), giúp dữ liệu được lưu trữ vĩnh viễn trên Cloud và ứng dụng hoạt động ổn định trên Vercel.

## 1. Chuẩn bị Database (Neon)
1. Truy cập [Neon.tech](https://neon.tech) và tạo tài khoản Free.
2. Tạo một Project mới.
3. Copy **Connection String** (dạng `postgresql://user:password@ep-xyz.aws.neon.tech/neondb...`).

## 2. Deploy lên Vercel
1. Đẩy code này lên GitHub/GitLab của bạn.
2. Vào [Vercel](https://vercel.com), chọn **Add New Project** -> Import từ Git.
3. Tại phần **Environment Variables**, thêm biến sau:
   - Name: `DATABASE_URL`
   - Value: (Dán Connection String bạn vừa copy ở bước 1)
4. Bấm **Deploy**.

## 3. Khởi tạo Database (Lần đầu)
Sau khi deploy xong, bạn cần chạy lệnh để tạo bảng và nạp dữ liệu mẫu vào Neon.
Cách đơn giản nhất là chạy từ máy tính của bạn (cần cài Node.js):

1. Tạo file `.env` ở thư mục gốc code trên máy bạn:
   ```env
   DATABASE_URL="postgresql://..." (Link Neon của bạn)
   ```
2. Chạy lệnh để đồng bộ cấu trúc bảng:
   ```bash
   npx prisma db push
   ```
3. Chạy lệnh để nạp dữ liệu mẫu (User, Đơn hàng demo...):
   ```bash
   npx prisma db seed
   ```

*Lưu ý: Nếu bạn không muốn cài đặt ở máy, bạn có thể chỉnh Build Command trên Vercel thành `npx prisma db push && next build` để nó tự chạy mỗi lần deploy (cẩn thận với dữ liệu thật).*
