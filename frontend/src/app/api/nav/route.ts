import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json([], { status: 401 })

  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country') ?? 'US'

  const rows = await prisma.navConfig.findMany({
    where: { country: { in: ['ALL', country] } },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json(rows)
}
