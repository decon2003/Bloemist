import { NextResponse } from 'next/server'
import { ApiError } from './data-store'

export const handleRouteError = (error: unknown) => {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error(error)
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
}
