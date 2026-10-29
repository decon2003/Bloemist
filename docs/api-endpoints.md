# API endpoints

All routes live under `app/api/*`. Requests and responses are JSON unless noted.

Every route except `auth/login`, `auth/logout`, `health` and the cron routes requires the `bloemist_session` cookie. Permissions are enforced on the server (`requireUser` in `lib/server/session.ts`). Error messages are in Vietnamese.

Who can call a route:
- **any**: any signed-in user.
- **writers**: `boss`, `admin` and `sales` (`ORDER_WRITE_ROLES`).
- **managers**: `boss` and `admin` (`MANAGER_ROLES`).

Data returned to florists is redacted on the server. `redactOrderFor` and `redactTaskFor` blank phone numbers, `customerId` and payment fields (VAT, selling price, deposit, remaining balance, total). Searches made by a florist do not match phone numbers.

## Auth

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | public | `{ email, password }`. After 5 failures the account is locked for 15 minutes. |
| POST | `/api/auth/logout` | public | Clears the cookie. |
| GET | `/api/auth/me` | any | Also allowed while a password change is pending. |
| POST | `/api/auth/change-password` | any | `{ currentPassword, newPassword }`. Bumps `sessionVersion`, which signs out other sessions. |

## Orders and products (tasks)

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/orders` | any | List, with search, status and date filters. Redacted for florists. |
| POST | `/api/orders` | writers | Create. `requestId` makes the call idempotent. Creates one task per product. |
| GET | `/api/orders/:orderId` | any | Redacted for florists. |
| PATCH | `/api/orders/:orderId` | any | Writers can change the allow-listed fields; money totals are recomputed on the server. Florists can change only `status` (NEW, IN_PROGRESS or READY, and only on an open order) and `assigneeId`. `assigneeId` sets the person in charge (`''` clears it): their open products move to the new person, and a NEW order becomes IN_PROGRESS. Setting READY completes every open product (maker = the product's assignee, or else the person in charge; a florist with nobody in charge becomes the person in charge). |
| DELETE | `/api/orders/:orderId` | managers | |
| GET | `/api/tasks` | any | `?orderId=`, `?mine=1`. Redacted for florists. |
| POST | `/api/tasks` | writers | Add a product to an order. Not allowed on a cancelled order. |
| GET / PATCH | `/api/tasks/:taskId` | any | Florists may change `notes` only. |
| PATCH | `/api/tasks/:taskId/status` | any | Florists may change their own tasks only. Only managers cancel a task or reopen a completed one. |
| PATCH | `/api/tasks/:taskId/notes` | any | `{ notes }` |
| POST | `/api/tasks/:taskId/assign` | any | `{ userId }`. Florists may only claim an unassigned task for themselves. Only managers reassign a completed task. |
| POST | `/api/tasks/:taskId/unassign` | any | Your own task, or writers for any task. Not allowed once completed. |
| POST | `/api/tasks/:taskId/complete` | any | Form data with an optional `photo`. Florists may complete their own task, or an unassigned one, which then becomes theirs. Writers must pick a maker first. When every product is done, the order becomes READY. |
| POST | `/api/tasks/:taskId/proof` | writers | Form data with `photo`: the finished-product photo, taken by sales. Only for a completed product. |
| GET | `/api/bouquets` | writers | Bouquet name suggestions. |
| GET | `/api/florists` | any | People that work can be assigned to. |

## Customers

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/customers` | managers | Search by name or phone of the customer, receiver or sender. |
| GET / PATCH | `/api/customers/:customerId` | managers | Notes and source. |
| GET | `/api/customers/lookup` | writers | Finds a returning customer by phone while an order is being created. |

## Attendance

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/checkins` | any | `?month=`. Your own shifts; managers see everyone's. |
| POST | `/api/checkins` | any | Check in now. `{ workMode?: 'SHOP' \| 'ONLINE' }`. ONLINE is for sales. |
| PATCH | `/api/checkins/:checkInId` | any | Check out of your own open shift. |
| DELETE | `/api/checkins/:checkInId` | managers | `{ reason }`. Removes a shift created by mistake. |
| POST | `/api/checkins/correct` | any | Fix check-in/out times. Staff can fix their own shifts within 3 days; managers can fix anyone's. Not allowed in a locked month. |

## Pay

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/payroll` | managers | `?month=YYYY-MM` |
| POST | `/api/payroll` | managers | `{ month }`. Creates or refreshes the draft. Manual edits are kept. |
| PATCH | `/api/payroll/:payrollId` | managers | |
| POST | `/api/payroll/:payrollId/lock` | managers | Only after the month has ended, and only with no OT pending approval. |
| DELETE | `/api/payroll/:payrollId/lock` | managers | Unlock. |
| PATCH | `/api/payroll/lines/:lineId` | managers | Rates, adjustments, OT decisions. |
| GET | `/api/payroll/export` | managers | `?month=`. CSV, protected against formula injection. |
| GET | `/api/me/pay` | any | `?month=`. Always the caller's own pay. |

## Reports, users, settings

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/reports/dashboard` | managers | Revenue counted by booking date. Cancelled orders are excluded. |
| GET | `/api/reports/staff` | managers | `?month=` |
| GET | `/api/users` | any | Managers get full profiles. Everyone else gets a directory with no email or phone. |
| POST | `/api/users` | managers | |
| GET | `/api/users/:userId` | any | Yourself, or anyone if you are a manager. |
| PATCH | `/api/users/:userId` | managers | Managers cannot change their own role or status, and the last manager cannot be removed. |
| DELETE | `/api/users/:userId` | managers | Deactivates the user, signs them out and unassigns their open tasks. |
| GET | `/api/settings` | any | |
| PATCH | `/api/settings` | managers | `{ workingHours: { start, end }, holidays }` |
| GET | `/api/audit` | managers | Activity log. |

## Files

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/uploads` | any | Image upload (no SVG or HTML) with a size limit. Keys are generated on the server. |
| GET | `/api/photos/:key*` | any | 302 to a 5-minute signed R2 URL. Keys must match the photo whitelist, so `backups/` is never reachable. |
| GET | `/api/legacy-photos` | any | Serves old inline photos. Image types only, with `nosniff` and a sandbox CSP. |

## Operations

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/health` | public | Does not touch the database. `?db=1` also checks the database. |
| GET | `/api/cron/nightly` | `Bearer CRON_SECRET` | Vercel Cron at 02:00 Vietnam time. Closes forgotten shifts, then writes a backup to R2. |
| GET | `/api/cron/backup` | `Bearer CRON_SECRET` | Backup only. |
