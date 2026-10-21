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

## 2. Hiện trạng và dựng lại từ đầu

**Đã dựng ngày 05/10/2026:**

- Neon project `bloemist`, region AWS ap-southeast-1 (Singapore), Postgres 17. Đã chạy toàn bộ migration và seed.
- Vercel đặt functions ở `sin1` (file `vercel.json`) và đã có đủ biến môi trường ở mục 1.
- R2 bucket `bloemist-photos`, riêng tư.

Nếu phải dựng lại trên một database **trống** (chạy trên máy, `.env` dùng chuỗi Neon **direct**):

```bash
npm install
npx prisma migrate deploy                                   # tạo toàn bộ bảng
npx tsx --env-file=.env prisma/seed.ts                      # tài khoản admin@bloemist.com + địa điểm cửa hàng
node scripts/set-password.mjs admin@bloemist.com 'MatKhauTam123' --temporary
```

Kiểm tra database khớp với code. Lệnh phải in ra "No difference detected.":

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code
```

**Cấp mật khẩu cho nhân viên:** vào **Cài đặt → Quản lý nhân sự**. Khi thêm hoặc sửa một nhân viên, điền mật khẩu tạm rồi đưa trực tiếp cho người đó. Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu tiên.

- Quên mật khẩu: quản lý cấp lại mật khẩu tạm theo cách trên.
- Sai mật khẩu 5 lần thì tài khoản bị khoá 15 phút.

**Đổi mật khẩu database:** vào Neon, chọn **Branches → main → Roles → `neondb_owner` → Reset password**. Sau đó cập nhật `DATABASE_URL` ở ba nơi: Vercel (Production và Preview, dùng chuỗi pooled), GitHub secret (dùng chuỗi direct), và file `.env`. Cuối cùng bấm Redeploy trên Vercel.

**Đổi khoá R2:** vào Cloudflare, chọn **R2 → Manage API Tokens → `bloemist-app` → Roll**. Sau đó cập nhật `R2_ACCESS_KEY_ID` và `R2_SECRET_ACCESS_KEY` trên Vercel, GitHub secret và file `.env`.

---

## 3. Bật Cloudflare R2 (lưu ảnh)

1. Vào Cloudflare, mở **R2 → Create bucket**, đặt tên `bloemist-photos`, location *Asia-Pacific*. **Không** bật public access.
2. Vào **R2 → Manage API tokens → Create API token**:
   - Quyền: *Object Read & Write*
   - Phạm vi: chỉ bucket `bloemist-photos`
   - Ghi lại *Access Key ID* và *Secret Access Key*. Secret chỉ hiện một lần.
3. Điền 4 biến `R2_*` trên Vercel (mục 1), rồi **Redeploy**.
4. Chỉ khi database đã có ảnh lưu kiểu cũ (base64), chuyển chúng sang R2. Chạy trên máy, với 4 biến `R2_*` trong `.env`:

   ```bash
   node scripts/migrate-photos-to-r2.mjs          # chạy thử: chỉ đếm, không ghi gì
   node scripts/migrate-photos-to-r2.mjs --apply  # chuyển thật
   ```

   Chạy lại nhiều lần cũng an toàn.
5. Tạo quy tắc tự xoá bản sao lưu cũ: vào bucket, mở **Settings → Object lifecycle rules → Add rule**:
   - Prefix: `backups/`
   - Hành động: xoá sau **60 ngày**

---

## 4. Sao lưu tự động (Vercel Cron → R2)

Mỗi đêm khoảng **02:00 giờ Việt Nam** (gói Hobby có thể lệch trong vòng 1 tiếng), Vercel gọi `/api/cron/backup`. API này xuất toàn bộ bảng ra JSON, nén lại và lưu vào R2 tại `backups/bloemist-YYYY-MM-DD.json.gz`. Lịch chạy nằm trong `vercel.json`.

- Cần biến `CRON_SECRET` trên Vercel (môi trường Production). Vercel tự gửi khoá này khi gọi; ai gọi mà không có khoá sẽ bị từ chối.
- Bản cũ hơn 60 ngày tự xoá nhờ quy tắc lifecycle trên bucket (prefix `backups/`, xem mục 3).
- Kiểm tra lần chạy gần nhất: vào **Vercel → Project → Settings → Cron Jobs**, hoặc xem Logs, tìm dòng `Backup written`.
- Chạy ngay một lần: vào Settings → Cron Jobs → **Run**.

Workflow `.github/workflows/db-backup.yml` (dùng `pg_dump`) chỉ còn chạy thủ công, vì tài khoản GitHub Actions đang bị khoá do thanh toán.

### Khôi phục

Khôi phục vào một database **trống**, đã chạy migration. Script từ chối ghi vào database đã có dữ liệu.

```bash
# .env: DATABASE_URL trỏ tới database đích (ví dụ một branch Neon mới) + các biến R2_*
npx prisma migrate deploy
node scripts/restore-backup.mjs --list                     # xem các bản sao lưu
node scripts/restore-backup.mjs --latest                   # chạy thử: chỉ in số dòng
node scripts/restore-backup.mjs --date 2026-10-21 --apply  # khôi phục thật
```

Database đích phải ở **cùng migration** với lúc sao lưu. Script kiểm tra điều này và báo nếu lệch.

Nên thử khôi phục mỗi vài tháng một lần, và bắt buộc làm trước mỗi đợt cao điểm.

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
