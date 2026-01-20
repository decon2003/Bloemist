import { NextResponse } from 'next/server'
import { createOrder, listOrders } from '@/lib/server/data-store'
import { handleRouteError } from '@/lib/server/route-helpers'

export async function GET() {
  try {
    const orders = await listOrders()
    return NextResponse.json(orders)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const created = await createOrder(body)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
