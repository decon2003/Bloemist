import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ApiError } from './api-error'

/** Map a Prisma error code to the HTTP status it actually represents.
 *  Without this every not-found, duplicate and FK conflict collapsed into a
 *  generic 500, so callers could not tell "does not exist" from "server down". */
const PRISMA_STATUS: Record<string, { status: number; message: string }> = {
  P2025: { status: 404, message: 'Record not found' },
  P2002: { status: 409, message: 'A record with this value already exists' },
  P2003: { status: 409, message: 'Record is still referenced by other records' },
  P2000: { status: 400, message: 'Value too long for one of the fields' },
  P2011: { status: 400, message: 'A required field was null' },
}

export const handleRouteError = (error: unknown) => {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  // Malformed or absent JSON body is a client error, not a server fault.
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = PRISMA_STATUS[error.code]
    if (mapped) {
      return NextResponse.json({ error: mapped.message }, { status: mapped.status })
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    // Never echo the validation text - it contains model and column names.
    console.error(error)
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
  }

  console.error(error)
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
}

/** Parse a JSON request body, converting a malformed body into a 400 instead of
 *  letting SyntaxError escape as a 500. */
export const readJsonBody = async <T = any>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
}
