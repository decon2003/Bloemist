import { NextResponse } from 'next/server'
import db from '@/lib/server/db'
import { ApiError } from '@/lib/server/data-store'
import { handleRouteError, readJsonBody } from '@/lib/server/route-helpers'
import { hashPassword, validateNewPassword } from '@/lib/server/password'
import { toVnd } from '@/lib/server/money'
import { MANAGER_ROLES, isManager, requireUser } from '@/lib/server/session'
import { audit, diff } from '@/lib/server/audit'
import { parseAllowances } from '@/lib/server/payroll'
import {
    PAY_TYPES,
    PRIVILEGED_USER_SELECT,
    PUBLIC_USER_SELECT,
    USER_ROLES,
    USER_STATUSES,
    assertOneOf,
    normalizeEmail,
    parseCommissionRate,
    requireNonBlank,
} from '@/lib/server/validation'


interface RouteContext {
    params: Promise<{ userId: string }>
}

// GET: Get single user
export async function GET(request: Request, context: RouteContext) {
    try {
        const me = await requireUser(request)
        const { userId } = await context.params
        if (userId !== me.id && !isManager(me)) {
            throw new ApiError(403, 'Bạn không có quyền xem thông tin này')
        }
        const user = await db.user.findUnique({
            where: { id: userId },
            select: isManager(me) ? PRIVILEGED_USER_SELECT : PUBLIC_USER_SELECT,
        })

        if (!user) {
            return NextResponse.json({ error: 'Không tìm thấy nhân viên' }, { status: 404 })
        }

        return NextResponse.json({
            ...user,
            createdAt: user.createdAt.toISOString()
        })
    } catch (error) {
        return handleRouteError(error)
    }
}

// PATCH: Update user
//
// Every field is validated rather than spread straight into Prisma. The previous
// `...(field && { field })` form silently dropped legitimate falsy values -
// baseSalary: 0 or avatar: "" returned 200 with nothing changed - and accepted
// arbitrary role strings, negative commission rates and NaN.
export async function PATCH(request: Request, context: RouteContext) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const { userId } = await context.params
        const body = await readJsonBody(request)

        const data: Record<string, unknown> = {}

        if (body.name !== undefined) data.name = requireNonBlank(body.name, 'name', 120)
        if (body.email !== undefined) data.email = normalizeEmail(body.email)
        if (body.phone !== undefined) data.phone = requireNonBlank(body.phone, 'phone', 32)
        if (body.role !== undefined) data.role = assertOneOf(body.role, USER_ROLES, 'role')
        if (body.status !== undefined) data.status = assertOneOf(body.status, USER_STATUSES, 'status')
        if (body.avatar !== undefined) data.avatar = requireNonBlank(body.avatar, 'avatar', 64)
        if (body.baseSalary !== undefined) data.baseSalary = toVnd(body.baseSalary, 'baseSalary') ?? 0
        if (body.commissionRate !== undefined) data.commissionRate = parseCommissionRate(body.commissionRate)
        if (body.salesCommissionRate !== undefined) data.salesCommissionRate = parseCommissionRate(body.salesCommissionRate, 'salesCommissionRate')
        if (body.payType !== undefined) data.payType = assertOneOf(body.payType, PAY_TYPES, 'payType')
        if (body.hourlyRate !== undefined) data.hourlyRate = toVnd(body.hourlyRate, 'hourlyRate') ?? 0
        if (body.holidayHourlyRate !== undefined) {
            data.holidayHourlyRate = body.holidayHourlyRate === null || body.holidayHourlyRate === '' ? null : toVnd(body.holidayHourlyRate, 'holidayHourlyRate')
        }
        if (body.onlineHourlyRate !== undefined) {
            data.onlineHourlyRate = body.onlineHourlyRate === null || body.onlineHourlyRate === '' ? null : toVnd(body.onlineHourlyRate, 'onlineHourlyRate')
        }
        if (body.otHourlyRate !== undefined) {
            data.otHourlyRate = body.otHourlyRate === null || body.otHourlyRate === '' ? null : toVnd(body.otHourlyRate, 'otHourlyRate')
        }
        if (body.allowances !== undefined) data.allowances = parseAllowances(body.allowances)
        if (body.daysOffPerMonth !== undefined) {
            const days = Number(body.daysOffPerMonth)
            if (!Number.isInteger(days) || days < 0 || days > 15) throw new ApiError(400, 'Số ngày nghỉ phải từ 0 đến 15')
            data.daysOffPerMonth = days
        }
        // Password reset by a manager: issue a new temporary password, force a
        // change on next login and sign the user out everywhere.
        if (body.password !== undefined && body.password !== '') {
            data.passwordHash = await hashPassword(validateNewPassword(body.password))
            data.mustChangePassword = userId !== me.id
            data.sessionVersion = { increment: 1 }
            data.failedLoginCount = 0
            data.lockedUntil = null
        }

        if (Object.keys(data).length === 0) {
            throw new ApiError(400, 'Không có gì để lưu')
        }

        const existing = await db.user.findUnique({ where: { id: userId } })
        if (!existing) {
            throw new ApiError(404, 'Không tìm thấy nhân viên')
        }

        const roleChanges = data.role !== undefined && data.role !== existing.role
        const statusChanges = data.status !== undefined && data.status !== existing.status
        // There is one admin account: the shop owner's. It cannot be demoted or
        // stopped (its name, e-mail and password can change), and nobody else
        // can be made admin.
        if (existing.role === 'admin' && (roleChanges || statusChanges)) {
            throw new ApiError(403, 'Không đổi được vai trò hoặc trạng thái của tài khoản chủ cửa hàng')
        }
        if (roleChanges && data.role === 'admin') {
            throw new ApiError(403, 'Chỉ có một tài khoản chủ cửa hàng')
        }
        if (userId === me.id && (roleChanges || statusChanges)) {
            throw new ApiError(403, 'Không tự đổi vai trò hoặc ngừng tài khoản của chính mình')
        }
        const deactivating = statusChanges && data.status !== 'active'
        // A leaver is signed out everywhere at once.
        if (deactivating) data.sessionVersion = { increment: 1 }

        const user = await db.user.update({
            where: { id: userId },
            data,
            select: PRIVILEGED_USER_SELECT,
        })
        // Products they had not made yet go back to "Chưa có người làm".
        if (deactivating) {
            await db.task.updateMany({
                where: { assigneeId: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
                data: { assigneeId: null, assigneeName: null, status: 'UNASSIGNED', lastAssigneeName: existing.name, lastAssignedAt: new Date() },
            })
        }

        const changes = diff(existing, user, ['name', 'email', 'phone', 'role', 'status', 'avatar', 'payType', 'baseSalary', 'hourlyRate', 'holidayHourlyRate', 'onlineHourlyRate', 'otHourlyRate', 'allowances', 'daysOffPerMonth', 'commissionRate', 'salesCommissionRate'])
        const passwordReset = data.passwordHash !== undefined
        if (changes || passwordReset) {
            await audit(me, {
                action: passwordReset ? 'user.password_reset' : 'user.update',
                entity: 'user',
                entityId: userId,
                summary: passwordReset ? `${user.name}: cấp lại mật khẩu tạm` : user.name,
                changes,
            })
        }

        return NextResponse.json({
            ...user,
            createdAt: user.createdAt.toISOString()
        })
    } catch (error) {
        return handleRouteError(error)
    }
}

// DELETE: Delete user
export async function DELETE(request: Request, context: RouteContext) {
    try {
        const me = await requireUser(request, MANAGER_ROLES)
        const { userId } = await context.params

        if (userId === me.id) {
            throw new ApiError(403, 'Không thể tự xoá tài khoản của chính mình')
        }

        const user = await db.user.findUnique({ where: { id: userId } })
        if (!user) {
            throw new ApiError(404, 'Không tìm thấy nhân viên')
        }

        // The owner's account is never deleted.
        if (user.role === 'admin') {
            throw new ApiError(403, 'Không xoá được tài khoản chủ cửa hàng')
        }

        // Deleting a user who still owns tasks, orders or check-ins raises an FK
        // violation; report it as a conflict the caller can act on rather than
        // letting it surface as an opaque 500.
        const [assignedTasks, createdOrders, assignedOrders, soldOrders, checkIns] = await Promise.all([
            db.task.count({ where: { assigneeId: userId } }),
            db.order.count({ where: { createdById: userId } }),
            db.order.count({ where: { assigneeId: userId } }),
            db.order.count({ where: { salespersonId: userId } }),
            db.staffCheckIn.count({ where: { staffId: userId } }),
        ])

        if (assignedTasks || createdOrders || assignedOrders || soldOrders || checkIns) {
            throw new ApiError(
                409,
                'Nhân viên này đã có đơn hàng, sản phẩm hoặc chấm công nên không xoá được. Hãy chuyển trạng thái sang "Đã nghỉ việc".',
            )
        }

        await db.user.delete({ where: { id: userId } })
        await audit(me, { action: 'user.delete', entity: 'user', entityId: userId, summary: `${user.name} (${user.role})` })
        return new NextResponse(null, { status: 204 })
    } catch (error) {
        return handleRouteError(error)
    }
}
