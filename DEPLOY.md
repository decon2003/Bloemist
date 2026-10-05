# Triển khai Bloemist Ops

Hạ tầng (toàn bộ gói miễn phí):

| Thành phần | Dịch vụ | Ghi chú |
|---|---|---|
| Chạy app | Vercel Hobby | `noibo.bloemistflorals.com` |
| Cơ sở dữ liệu | Neon Postgres Free | 0.5 GB, chỉ chứa dữ liệu chữ |
| Ảnh + bản sao lưu | Cloudflare R2 Free | 10 GB, bucket riêng tư |
| Sao lưu tự động | GitHub Actions | 02:00 mỗi đêm |

---

## 1. Biến môi trường

Đặt trong **Vercel → Project → Settings → Environment Variables** (môi trường *Production* và *Preview*):

| Biến | Bắt buộc | Giá trị |
|---|---|---|
| `DATABASE_URL` | ✅ | Chuỗi kết nối Neon **loại pooled** (host có chữ `-pooler`) |
| `AUTH_SECRET` | ✅ | Chuỗi ngẫu nhiên ≥ 32 ký tự (cách tạo ở dưới). **Thiếu biến này app sẽ không đăng nhập được.** |
| `R2_ACCOUNT_ID` | khi bật R2 | Account ID của Cloudflare |
| `R2_ACCESS_KEY_ID` | khi bật R2 | Từ API token R2 |
| `R2_SECRET_ACCESS_KEY` | khi bật R2 | Từ API token R2 |
| `R2_BUCKET` | khi bật R2 | Ví dụ `bloemist-photos` |

Tạo `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Đổi `AUTH_SECRET` sẽ đăng xuất tất cả mọi người, nên chỉ đổi khi nghi bị lộ.

Khi chưa cấu hình R2, ảnh mới vẫn được lưu vào cơ sở dữ liệu như cũ, nên app vẫn chạy. Tuy vậy, nên bật R2 sớm.

---

## 2. Lần triển khai đầu tiên sau bản cập nhật này (làm đúng thứ tự)

Bản cập nhật thêm cột mới vào cơ sở dữ liệu (mật khẩu, khách hàng). Vì vậy **phải cập nhật cơ sở dữ liệu trước, rồi mới đẩy code lên**.

Nếu lỡ đẩy code trước cũng không sao: bước build trên Vercel sẽ thất bại, và Vercel giữ nguyên bản đang chạy.

### 2.1. Tạo bản lưu dự phòng

Vào Neon, mở **Branches**, tạo branch mới từ `main`, đặt tên ví dụ `truoc-cap-nhat-2026-10`. Branch này là bản chụp dữ liệu ngay lúc đó. Nếu có sự cố, có thể khôi phục từ đây.

### 2.2. Cập nhật cơ sở dữ liệu (chạy trên máy tính)

Tạo file `.env` ở thư mục gốc. File này đã có trong `.gitignore`, **không bao giờ commit**:

```env
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
```

Dùng chuỗi kết nối **direct** (không có `-pooler`) cho các lệnh sau:

```bash
npm install

# Đánh dấu cấu trúc bảng hiện có là "điểm xuất phát" (chỉ làm MỘT lần)
npx prisma migrate resolve --applied 0_init

# Thêm cột mật khẩu, bảng khách hàng, và tạo khách từ các đơn cũ
npx prisma migrate deploy

# Kiểm tra cơ sở dữ liệu đã khớp với code: phải in ra "No difference detected."
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
```

Nếu lệnh cuối in ra danh sách thay đổi, **dừng lại**. Cơ sở dữ liệu thật khác với dự kiến, cần xem kỹ trước khi đi tiếp.

### 2.3. Đặt mật khẩu cho tài khoản quản lý đầu tiên

Sau khi cập nhật, **chưa ai có mật khẩu**, kể cả quản lý. Đặt mật khẩu cho một tài khoản boss/admin:

```bash
node scripts/set-password.mjs email-cua-ban@... 'MatKhauManh123'
```

Muốn xem danh sách email đang có: `node scripts/list-users.js`.

### 2.4. Đẩy code lên

1. Thêm `AUTH_SECRET` trên Vercel (mục 1).
2. `git push origin main`. Vercel tự build và deploy.
3. Mở `https://noibo.bloemistflorals.com` và đăng nhập bằng tài khoản ở bước 2.3.

### 2.5. Cấp mật khẩu cho nhân viên

Vào **Cài đặt → Quản lý nhân sự**. Với từng người, bấm *Chỉnh sửa*, điền **Cấp lại mật khẩu tạm**, rồi đưa trực tiếp cho nhân viên. Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu tiên.

Nhân viên quên mật khẩu: quản lý cấp lại mật khẩu tạm theo cách trên.

Tài khoản bị khoá 15 phút sau 5 lần nhập sai mật khẩu.

---

## 3. Bật Cloudflare R2 (lưu ảnh)

1. Vào Cloudflare, mở **R2 → Create bucket**, đặt tên `bloemist-photos`, location *Asia-Pacific*. **Không** bật public access.
2. Vào **R2 → Manage API tokens → Create API token**:
   - Quyền: *Object Read & Write*
   - Phạm vi: chỉ bucket `bloemist-photos`
   - Ghi lại *Access Key ID* và *Secret Access Key*. Secret chỉ hiện một lần.
3. Điền 4 biến `R2_*` trên Vercel (mục 1), rồi **Redeploy**.
4. Chuyển ảnh cũ từ cơ sở dữ liệu sang R2 (chạy trên máy, thêm 4 biến `R2_*` vào `.env`):

   ```bash
   node scripts/migrate-photos-to-r2.mjs          # chạy thử: chỉ đếm, không ghi gì
   node scripts/migrate-photos-to-r2.mjs --apply  # chuyển thật
   ```

   Chạy lại nhiều lần cũng an toàn.
5. Tạo quy tắc tự xoá bản sao lưu cũ: vào bucket, mở **Settings → Object lifecycle rules → Add rule**:
   - Prefix: `backups/`
   - Hành động: xoá sau **60 ngày**

---

## 4. Sao lưu tự động (GitHub Actions)

Vào GitHub, mở **Settings → Secrets and variables → Actions → New repository secret**, thêm:

| Secret | Giá trị |
|---|---|
| `DATABASE_URL` | Chuỗi Neon **direct** (không `-pooler`) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Như trên Vercel |

Sau đó vào **Actions → Database backup → Run workflow** để chạy thử một lần. Kiểm tra trong R2 thấy file `backups/bloemist-YYYY-MM-DD.dump` là được. Từ đó workflow tự chạy lúc 02:00 mỗi đêm.

### Khôi phục từ bản sao lưu

1. Tải file `.dump` từ R2 về.
2. Tạo một branch Neon trống (hoặc một database mới).
3. Chạy:

   ```bash
   pg_restore --no-owner --no-privileges -d "<chuỗi kết nối đích>" bloemist-YYYY-MM-DD.dump
   ```

4. Kiểm tra dữ liệu rồi mới trỏ `DATABASE_URL` của Vercel sang.

Nên thử khôi phục mỗi vài tháng một lần, để chắc bản sao lưu dùng được.

---

## 5. Giảm độ trễ: đặt máy chủ cùng khu vực với Neon

1. Xem region của Neon trong **Project settings**, ví dụ `aws-ap-southeast-1` (Singapore).
2. Trên Vercel, vào **Settings → Functions → Function Region**, chọn region tương ứng (Singapore là `sin1`).

---

## 6. Các bản cập nhật sau

- Thay đổi cấu trúc bảng: sửa `prisma/schema.prisma`, chạy `npx prisma migrate dev --name ten-thay-doi` với một cơ sở dữ liệu thử, rồi commit thư mục `prisma/migrations/`.
- Khi push lên `main`, bản build production tự chạy `prisma migrate deploy`. Bản Preview (các nhánh khác) **không bao giờ** đụng vào cơ sở dữ liệu.
- **Lưu ý:** Preview dùng chung cơ sở dữ liệu với bản thật (gói Neon miễn phí). Thao tác trên link preview là sửa dữ liệu thật.

---

## 7. Theo dõi giới hạn miễn phí

| Dịch vụ | Xem ở đâu | Ngưỡng cần chú ý |
|---|---|---|
| Neon | Dashboard → Usage | Dung lượng > 400 MB |
| R2 | Cloudflare → R2 → Overview | Dung lượng > 8 GB |
| Vercel | Usage | Băng thông hoặc lượt gọi > 80% |
| GitHub Actions | Settings → Billing | > 1.500 phút/tháng |
