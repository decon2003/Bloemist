import type { OrderListFilters } from '@/lib/server/data-store'
import { ORDER_STATUSES, assertOneOf } from '@/lib/server/validation'

/** &assigneeId= / &salespersonId= (a user id, or 'none') and &status=. */
export function orderFiltersFrom(params: URLSearchParams): OrderListFilters {
  const status = params.get('status')
  if (status) assertOneOf(status, ORDER_STATUSES, 'status')
  return {
    assigneeId: params.get('assigneeId'),
    salespersonId: params.get('salespersonId'),
    status,
  }
}
