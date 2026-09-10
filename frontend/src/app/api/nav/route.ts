import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json([], { status: 401 })

  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country') ?? 'IN'

  let rows = await prisma.navConfig.findMany({
    where: { country },
    orderBy: { sortOrder: 'asc' },
  })

  // Only India is configured today; anyone whose country was IP-detected as
  // something else still gets a usable sidebar.
  if (rows.length === 0 && country !== 'IN') {
    rows = await prisma.navConfig.findMany({
      where: { country: 'IN' },
      orderBy: { sortOrder: 'asc' },
    })
  }

  return NextResponse.json(rows)
}
