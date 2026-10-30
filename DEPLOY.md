# Triển khai Bloemist Ops

## Môi trường

| | Devtest (hiện có) | Production (sẽ dựng) |
|---|---|---|
| Mục đích | Thử nghiệm, được sửa hoặc xoá dữ liệu | Dữ liệu thật của cửa hàng |
| Domain | `devtest.bloemistflorals.com` (xem [mục 3](#3-domain-của-devtest)) | `noibo.bloemistflorals.com` |
| Vercel project | project hiện tại | project mới, cùng repo |
| Neon | project `bloemist` (Singapore) | project mới, Singapore |
| R2 bucket | `bloemist-photos` | bucket mới, token mới |
| Secret | bộ hiện tại | **bộ mới hoàn toàn**, không dùng lại của devtest |

Cả hai đều dùng gói miễn phí:

| Thành phần | Dịch vụ | Ghi chú |
|---|---|---|
| Chạy app | Vercel Hobby | region `sin1` (`vercel.json`) |
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

> **Việc cần làm ngay trên devtest:** mật khẩu Neon và khoá R2 hiện tại từng bị dán vào chat. Hãy đổi cả hai theo hai bước trên.

---

## 2. Hiện trạng devtest

Dựng ngày 05/10/2026:

- Neon project `bloemist`: AWS ap-southeast-1 (Singapore), Postgres 17.
- R2 bucket `bloemist-photos`, riêng tư.
- Vercel: functions ở `sin1`, đủ biến môi trường ở mục 1.

Migration tự chạy khi build production (`scripts/migrate-if-production.mjs`, chỉ khi `VERCEL_ENV=production`), nên database luôn khớp với code đã deploy.

**Cấp tài khoản nhân viên:** vào **Cài đặt → Quản lý nhân sự**.
- Khi thêm hoặc sửa nhân viên, điền mật khẩu tạm rồi đưa trực tiếp cho người đó. Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu.
- Quên mật khẩu: quản lý cấp lại mật khẩu tạm theo cách trên.
- Sai mật khẩu 5 lần thì tài khoản bị khoá 15 phút.
- Khoá một nhân viên thì người đó bị đăng xuất ngay, và các việc chưa xong của họ được trả về chưa giao.

---

## 3. Domain của devtest

Quyết định ngày 30/10/2026: **`noibo.bloemistflorals.com` dành cho production, `devtest.bloemistflorals.com` dành cho devtest.**

Cho tới khi dựng xong production, devtest vẫn đang chạy ở `noibo`. Đến ngày chuyển (mục 5, bước 7). Code không gắn cứng domain nào, nên chỉ cần thao tác trên Vercel và DNS:

1. Project devtest: **Settings → Domains → Add** `devtest.bloemistflorals.com`, thêm bản ghi DNS mà Vercel hiện ra. Làm việc này trước, để devtest có địa chỉ mới ngay.
2. Project devtest: gỡ `noibo.bloemistflorals.com`.
3. Project production: **Settings → Domains → Add** `noibo.bloemistflorals.com`.

Ghi chú:
- Khi gỡ domain, chỉ gỡ khỏi project. **Không** xoá `bloemistflorals.com` ở trang Domains của team.
- Cookie đăng nhập gắn theo từng domain, nên khi đổi domain mọi người phải đăng nhập lại.

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

## 5. Dựng bản production

Làm khi bản devtest đã ổn. **Mọi thứ đều mới, không dùng lại secret, database hay bucket của devtest.**

1. **Neon:** tạo project mới, region Singapore, Postgres 17. Lấy cả chuỗi pooled và chuỗi direct.
2. **R2:** tạo bucket mới (ví dụ `bloemist-prod-photos`) và token mới chỉ có quyền trên bucket này (mục 4), kèm lifecycle rule cho `backups/`.
3. **Vercel:** chọn **Add New → Project**, import cùng repo.
   - Điền đủ biến ở mục 1, với giá trị mới. Chỉ chọn môi trường **Production**, không chọn *Preview*, để link preview không bao giờ chạm vào dữ liệu thật.
   - Bật **Settings → Deployment Protection** cho các bản preview.
4. **Nhánh deploy** (để thử trên devtest trước khi lên production):
   - Project production lấy nhánh `main`.
   - Project devtest đổi *Production Branch* sang nhánh `devtest` (**Settings → Git**).
   - Quy trình: push lên `devtest`, thử trên devtest, rồi merge vào `main`.
5. **Deploy lần đầu.** Bước build tự chạy migration lên database mới.
6. **Tạo tài khoản quản lý đầu tiên.** Chạy trên máy; chuỗi direct của production chỉ đặt trong terminal, **không ghi vào `.env`**, và đóng terminal khi xong. Ví dụ với PowerShell:

   ```powershell
   $env:DATABASE_URL = "<chuỗi direct của production>"
   npx tsx prisma/seed.ts                     # admin@bloemist.com (id ngẫu nhiên) + địa điểm cửa hàng
   node scripts/set-password.mjs admin@bloemist.com '<mat-khau-tam>' --temporary
   ```

   Sau đó đăng nhập, đổi email/tên admin cho đúng người thật, rồi tạo tài khoản cho nhân viên ở **Cài đặt**.
7. **Domain:**
   - thêm `devtest.bloemistflorals.com` vào project devtest (mục 3);
   - gỡ `noibo.bloemistflorals.com` khỏi project devtest, rồi thêm vào project production (**Settings → Domains**);
   - nếu Vercel yêu cầu thêm bản ghi DNS thì làm theo hướng dẫn trên màn hình.
8. **Kiểm tra:**
   - `https://noibo.bloemistflorals.com/api/health?db=1` trả về ok.
   - Đăng nhập được.
   - Thử tạo một đơn, rồi huỷ nó.
   - Ngày hôm sau, tìm `Backup written` trong Logs.
9. **Cài đặt cửa hàng:** giờ mở cửa, ngày lễ, hồ sơ lương từng người (lương cứng, đơn giá giờ, giờ lễ, giờ online, % hoa hồng).

**Nếu muốn mang dữ liệu devtest sang:**
- Khôi phục bản sao lưu devtest vào database production đang trống (mục 6).
- Copy thêm các thư mục `proofs/` và `samples/` từ bucket devtest sang bucket production, ví dụ bằng `rclone`. Nếu không copy, ảnh cũ sẽ không hiện.

Thường thì nên bắt đầu production với dữ liệu trống.

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
  - **Không chạy `prisma migrate dev` khi `DATABASE_URL` trỏ tới devtest hay production**, vì lệnh này có thể đề nghị xoá sạch database.
- Bản build production tự chạy `prisma migrate deploy` **trước khi** code mới thay code cũ (khoảng 1 phút). Vì vậy:
  - **Thêm** cột hoặc bảng: làm thẳng được.
  - **Đổi kiểu** hoặc **xoá** cột: chia làm hai lần deploy. Lần 1 thêm cột mới và cho code ghi vào cả hai cột; lần 2 mới bỏ cột cũ.
  - Nếu bắt buộc đổi trực tiếp, làm ngoài giờ bán và chạy sao lưu trước.
- Bản Preview không bao giờ chạy migration.
  - Trên devtest, Preview dùng chung database devtest: thao tác trên link preview là sửa dữ liệu devtest.
  - Trên production, Preview không có biến môi trường (mục 5, bước 3).

---

## 8. Giám sát

**Trang còn sống không:** tạo monitor HTTP(s) miễn phí trên [UptimeRobot](https://uptimerobot.com) cho từng môi trường, ít nhất là production:

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
