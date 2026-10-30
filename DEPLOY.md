# Triển khai Bloemist Ops

## Môi trường

Quyết định ngày 30/10/2026: chỉ chủ cửa hàng phát triển và thử nghiệm, nhân viên chỉ dùng bản production. Vì vậy **devtest chạy trên máy**, không còn một bản devtest trên mạng.

| | Devtest | Production |
|---|---|---|
| Ở đâu | Máy của chủ cửa hàng: `npm run devtest` (mục 3) | `https://noibo.bloemistflorals.com` |
| Dữ liệu | Database Postgres riêng trong `.devtest/`, tài khoản mẫu | Dữ liệu thật của cửa hàng |
| Vercel | không dùng | project hiện tại (nhánh `main`) |
| Neon | không dùng | project `bloemist` hiện tại (Singapore), xoá dữ liệu thử (mục 5) |
| R2 | không dùng (ảnh lưu trong database trên máy) | bucket `bloemist-photos` hiện tại, đổi khoá (mục 5) |
| Secret | tự tạo trong `.devtest/` | **đổi mới hết** (mục 5) |

Dịch vụ của production:

| Thành phần | Dịch vụ | Ghi chú |
|---|---|---|
| Chạy app | Vercel (Hobby; nên lên Pro vì Hobby không cho dùng thương mại) | region `sin1` (`vercel.json`) |
| Cơ sở dữ liệu | Neon Postgres Free | 0.5 GB, chỉ chứa dữ liệu chữ |
| Ảnh và bản sao lưu | Cloudflare R2 Free | 10 GB, bucket riêng tư |
| Việc chạy hằng đêm | Vercel Cron | 02:00 giờ VN: đóng ca quên chấm ra, rồi sao lưu |

---

## 1. Biến môi trường

Đặt trong **Vercel → Project → Settings → Environment Variables**:

| Biến | Bắt buộc | Giá trị |
|---|---|---|
| `DATABASE_URL` | ✅ | Chuỗi kết nối Neon **loại pooled** (host có chữ `-pooler`). Migration tự đổi sang chuỗi direct. |
| `AUTH_SECRET` | ✅ | Chuỗi ngẫu nhiên ≥ 32 ký tự. Thiếu biến này, bản production không đăng nhập được. |
| `CRON_SECRET` | ✅ | Chuỗi ngẫu nhiên. Vercel gửi kèm khi gọi cron; thiếu biến này thì việc chạy hằng đêm bị từ chối. |
| `R2_ACCOUNT_ID` | ✅ | Account ID của Cloudflare |
| `R2_ACCESS_KEY_ID` | ✅ | Từ API token R2 |
| `R2_SECRET_ACCESS_KEY` | ✅ | Từ API token R2 |
| `R2_BUCKET` | ✅ | Tên bucket của môi trường đó |

Tạo chuỗi ngẫu nhiên:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- Đổi `AUTH_SECRET` sẽ đăng xuất tất cả mọi người.
- Nếu chưa cấu hình R2, ảnh được lưu thẳng trong database. App vẫn chạy, nhưng database sẽ đầy nhanh.
- **Không dán secret vào chat, tài liệu hay commit.** Secret chỉ nằm trên Vercel và (nếu cần chạy script) trong biến môi trường của terminal.

**Đổi mật khẩu database:**
1. Vào Neon, chọn **Branches → main → Roles → `neondb_owner` → Reset password**.
2. Cập nhật `DATABASE_URL` trên Vercel.
3. Bấm Redeploy.

**Đổi khoá R2:**
1. Vào Cloudflare, chọn **R2 → Manage API Tokens**, chọn token, bấm **Roll**.
2. Cập nhật hai biến `R2_ACCESS_KEY_ID` và `R2_SECRET_ACCESS_KEY` trên Vercel.
3. Bấm Redeploy.

> Mật khẩu Neon và khoá R2 đang dùng (dữ liệu thử) từng bị dán vào chat. Ngày lên production chúng được thay hẳn bằng database, bucket và khoá mới (mục 5); trước đó, nếu còn dùng lâu, hãy đổi theo hai bước trên.

---

## 2. Hiện trạng (trước khi lên production)

Project Vercel hiện tại đang chạy ở `noibo`, nối với database và bucket dựng ngày 05/10/2026, hiện chứa **dữ liệu thử**:

- Neon project `bloemist`: AWS ap-southeast-1 (Singapore), Postgres 17.
- R2 bucket `bloemist-photos`, riêng tư.

Ngày lên production (mục 5), dữ liệu thử bị xoá, cấu hình được giữ, và mọi khoá được đổi.

Migration tự chạy khi build production (`scripts/migrate-if-production.mjs`, chỉ khi `VERCEL_ENV=production`), nên database luôn khớp với code đã deploy.

**Cấp tài khoản nhân viên:** vào **Cài đặt → Quản lý nhân sự**.
- Khi thêm hoặc sửa nhân viên, điền mật khẩu tạm rồi đưa trực tiếp cho người đó. Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu.
- Quên mật khẩu: quản lý cấp lại mật khẩu tạm theo cách trên.
- Sai mật khẩu 5 lần thì tài khoản bị khoá 15 phút.
- Khoá một nhân viên thì người đó bị đăng xuất ngay, và các việc chưa xong của họ được trả về chưa giao.

---

## 3. Devtest trên máy

```bash
npm install
npm run devtest              # dữ liệu được giữ giữa các lần chạy
npm run devtest -- --reset   # xoá sạch, làm lại từ database trống
```

Lệnh này:
- bật một Postgres riêng trong thư mục `.devtest/` (không đẩy lên GitHub, không bao giờ là database thật);
- chạy migration, lần đầu tạo sẵn tài khoản mẫu (in ra màn hình): `admin@devtest.local`, `sale@devtest.local`, `tho@devtest.local`, `tho2@devtest.local`;
- chạy app ở chế độ phát triển: sửa code là màn hình cập nhật ngay.

Mở ở `http://localhost:3000`. **Thử trên điện thoại:** cho điện thoại vào cùng Wi-Fi rồi mở địa chỉ `http://<IP máy>:3000` mà lệnh in ra.

Ghi chú:
- Biến môi trường của devtest được đặt sẵn trong lệnh và luôn thắng `.env`, nên dù `.env` có chuỗi kết nối nào, devtest cũng không chạm vào database thật.
- Ảnh lưu thẳng trong database trên máy (không dùng R2). Việc chạy hằng đêm và sao lưu chỉ kiểm tra được trên production.

---

## 4. Cloudflare R2 (ảnh và sao lưu)

1. Vào **R2 → Create bucket**, location *Asia-Pacific*. **Không** bật public access.
2. Vào **R2 → Manage API tokens → Create API token**:
   - Quyền: *Object Read & Write*.
   - Phạm vi: **chỉ bucket đó**.
   - Ghi lại *Access Key ID* và *Secret Access Key*. Secret chỉ hiện một lần.
3. Điền 4 biến `R2_*` trên Vercel, rồi bấm **Redeploy**.
4. Thêm quy tắc tự xoá bản sao lưu cũ: vào bucket, chọn **Settings → Object lifecycle rules → Add rule**, prefix `backups/`, xoá sau **60 ngày**.

Ảnh được đọc qua `/api/photos/...`. Route này yêu cầu đăng nhập, chỉ chấp nhận key ảnh hợp lệ (không đọc được `backups/`) và trả về link ký sống 5 phút.

Chuyển ảnh base64 kiểu cũ sang R2 (chỉ khi còn ảnh kiểu cũ):

```bash
node scripts/migrate-photos-to-r2.mjs          # chạy thử: chỉ đếm
node scripts/migrate-photos-to-r2.mjs --apply  # chuyển thật, chạy lại nhiều lần vẫn an toàn
```

---

## 5. Lên production

Bản đang chạy ở `noibo` **trở thành production luôn**: giữ project Vercel, database Neon và bucket R2 hiện tại, chỉ xoá dữ liệu thử và đổi khoá. Làm ngoài giờ bán.

1. **Xoá dữ liệu thử, giữ cấu hình.** Trong terminal, đặt `DATABASE_URL` là chuỗi **direct** của Neon (không ghi vào `.env`):

   ```powershell
   $env:DATABASE_URL = "<chuỗi direct của Neon>"
   node scripts/reset-for-production.mjs            # chạy thử: chỉ đếm
   node scripts/reset-for-production.mjs --apply    # xoá thật
   Remove-Item Env:DATABASE_URL
   ```

   - Xoá: đơn, sản phẩm, khoản thu, khách hàng, chấm công, bảng lương, lịch sử, bộ đếm mã đơn, tài khoản test (`@x.vn`, `PENTEST…`).
   - Giữ: tài khoản thật kèm hồ sơ lương, cài đặt, KPI, ngày lễ, địa điểm cửa hàng.
   - Mọi người bị đăng xuất. **Admin giữ mật khẩu.** Mỗi nhân viên được một mật khẩu tạm và phải đổi ở lần đăng nhập đầu; danh sách nằm trong `.devtest/staff-temporary-passwords.txt` (chỉ trên máy, không in ra, không commit). Đưa trực tiếp cho từng người rồi xoá file.
   - Trước khi xoá, script lưu một bản sao vào `.devtest/before-reset-….json`.
2. **Đổi khoá** (khoá cũ từng bị dán vào chat):
   - Neon: **Reset password** (mục 1) → cập nhật `DATABASE_URL` trên Vercel.
   - R2: **Roll** token (mục 1) → cập nhật `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
   - Tạo `AUTH_SECRET` và `CRON_SECRET` mới (lệnh ở mục 1).
3. **Vercel → Settings → Environment Variables:**
   - Mọi biến chỉ áp cho **Production**; xoá các giá trị của *Preview*, để bản preview không bao giờ chạm vào dữ liệu thật.
   - Xoá `GEMINI_API_KEY`, `GEMINI_MODEL`, `TELEGRAM_WEBHOOK_SECRET` (và thu hồi khoá Gemini).
   - **Settings → Deployment Protection:** bật cho bản preview.
4. **Redeploy** (không dùng build cache). Log phải có `No pending migrations to apply`; mở `https://noibo.bloemistflorals.com/api/health?db=1` phải thấy `"ok":true`.
5. **Kiểm tra:** đăng nhập admin; tạo một đơn đặt hoa, ghi tiền khách trả thêm, tạo một đơn bán tại cửa hàng, chấm công vào/ra; rồi xoá các đơn thử và bấm **Cập nhật dữ liệu mới** ở Bảng lương.
6. **Sáng hôm sau:** tìm `Backup written` trong Logs; thêm monitor UptimeRobot (mục 8).

**Nếu có sự cố sau khi deploy:** Vercel → Deployments → bản trước → **Instant Rollback**.

---

## 6. Sao lưu và khôi phục

Mỗi đêm khoảng **02:00 giờ Việt Nam**, Vercel gọi `/api/cron/nightly` (lịch nằm trong `vercel.json`; gói Hobby có thể lệch trong vòng 1 tiếng). Việc này:

1. Đóng các ca quên chấm ra. Những ca này tính 0 giờ cho tới khi được sửa.
2. Xuất toàn bộ bảng ra JSON, nén lại, rồi lưu vào R2 tại `backups/bloemist-YYYY-MM-DD.json.gz`.

Ghi chú:
- Kiểm tra lần chạy gần nhất ở **Vercel → Settings → Cron Jobs**, hoặc tìm dòng `Backup written` trong Logs.
- Muốn chạy ngay một lần: vào **Cron Jobs → Run**.
- `/api/cron/backup` chỉ sao lưu, không đóng ca.
- Workflow `.github/workflows/db-backup.yml` (dùng `pg_dump`) chỉ chạy thủ công, vì GitHub Actions của tài khoản đang bị khoá do thanh toán.

### Khôi phục

Chỉ khôi phục vào một database **trống** đã chạy migration; script từ chối ghi vào database đã có dữ liệu. Các biến môi trường đặt trong terminal, giống bước 6 ở mục 5:

```bash
# DATABASE_URL = database đích (ví dụ một branch Neon mới); R2_* = bucket chứa bản sao lưu
npx prisma migrate deploy
node scripts/restore-backup.mjs --list                     # xem các bản sao lưu
node scripts/restore-backup.mjs --latest                   # chạy thử: chỉ in số dòng
node scripts/restore-backup.mjs --date 2026-10-21 --apply  # khôi phục thật
```

- Database đích phải ở **cùng migration** với lúc sao lưu. Script sẽ kiểm tra và báo nếu lệch.
- Nên thử khôi phục mỗi vài tháng một lần, và bắt buộc làm trước mỗi đợt cao điểm.

---

## 7. Các bản cập nhật sau

- **Đổi cấu trúc bảng:** sửa `prisma/schema.prisma`, viết migration SQL trong `prisma/migrations/<số>_<tên>/migration.sql`, thử trên database local, rồi commit.
  - Thử bằng `npm run devtest` trước khi đẩy lên `main`.
  - **Không chạy `prisma migrate dev` khi `DATABASE_URL` trỏ tới production**, vì lệnh này có thể đề nghị xoá sạch database.
  - Tên thư mục migration phải có 2 chữ số đầu (`17_…`, `18_…`): Prisma chạy theo thứ tự tên.
- Bản build production tự chạy `prisma migrate deploy` **trước khi** code mới thay code cũ (khoảng 1 phút). Vì vậy:
  - **Thêm** cột hoặc bảng: làm thẳng được.
  - **Đổi kiểu** hoặc **xoá** cột: chia làm hai lần deploy. Lần 1 thêm cột mới và cho code ghi vào cả hai cột; lần 2 mới bỏ cột cũ.
  - Nếu bắt buộc đổi trực tiếp, làm ngoài giờ bán và chạy sao lưu trước.
- Bản Preview không bao giờ chạy migration, và không có biến môi trường của production (mục 5, bước 3).

---

## 8. Giám sát

**Trang còn sống không:** tạo monitor HTTP(s) miễn phí trên [UptimeRobot](https://uptimerobot.com) cho production:

- URL: `https://noibo.bloemistflorals.com/api/health`
- Chu kỳ: 5 phút, cảnh báo qua email hoặc app điện thoại.

`/api/health` **không** chạm vào database, để Neon được ngủ khi không có ai dùng. Một monitor gọi database mỗi 5 phút sẽ làm hết giờ chạy miễn phí. Khi cần kiểm tra database, mở tay `/api/health?db=1`.

**Ai làm gì:** quản lý xem ở **Cài đặt → Hoạt động gần đây** và ở cuối trang chi tiết từng đơn (**Lịch sử thay đổi**). Nhật ký ghi lại:
- tạo, sửa, xoá đơn, việc, nhân viên, khách hàng;
- mọi lần đăng nhập, kể cả đăng nhập sai.

**Lỗi máy chủ:** xem ở **Vercel → Project → Logs**. Gói Hobby chỉ giữ log trong thời gian ngắn, nên khi có lỗi hãy xem ngay.

---

## 9. Theo dõi giới hạn miễn phí

| Dịch vụ | Xem ở đâu | Ngưỡng cần chú ý |
|---|---|---|
| Neon | Dashboard → Usage | Dung lượng > 400 MB, hoặc giờ chạy (compute) > 80% |
| R2 | Cloudflare → R2 → Overview | Dung lượng > 8 GB |
| Vercel | Usage | Băng thông, lượt gọi hoặc thời gian chạy hàm > 80% |

Khi chạm ngưỡng, chuyển sang phương án A: Vercel Pro và Neon trả phí.
