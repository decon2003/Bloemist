import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/server/route-helpers'
import { MANAGER_ROLES, requireUser } from '@/lib/server/session'
import { listCustomers, type CustomerSort } from '@/lib/server/customers'

const SORTS: CustomerSort[] = ['spend', 'recent', 'orders']

// The full customer list (names, phones, spend) is for managers only.
export async function GET(request: Request) {
    try {
        await requireUser(request, MANAGER_ROLES)
        const params = new URL(request.url).searchParams
        const sort = SORTS.includes(params.get('sort') as CustomerSort) ? (params.get('sort') as CustomerSort) : 'spend'
        const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(params.get('pageSize') ?? '30', 10) || 30))
        const result = await listCustomers({ q: params.get('q') ?? '', sort, page, pageSize })
        return NextResponse.json(result)
    } catch (error) {
        return handleRouteError(error)
    }
}
