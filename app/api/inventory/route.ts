import { NextResponse } from 'next/server'

// Inventory table is not yet defined in schema.prisma
// Returning empty list for now to prevent crashes.

export async function GET() {
    return NextResponse.json([])
}

export async function POST(request: Request) {
    // Stub implementation
    const body = await request.json()
    return NextResponse.json({
        id: body.id || `item-${Date.now()}`,
        ...body,
        lastUpdated: new Date()
    })
}
