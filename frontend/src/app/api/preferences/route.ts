import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const DEFAULTS = { country: 'US', locale: 'en-US', theme: 'dark', colorTheme: 'warm' }
const ALLOWED = ['country', 'locale', 'theme', 'colorTheme']

export async function GET() {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({}, { status: 401 })

  const rows = await prisma.appConfig.findMany({ where: { userId: session.userId, key: { in: ALLOWED } } })
  const prefs = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) }
  return NextResponse.json(prefs)
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({}, { status: 401 })

  const { key, value } = await req.json()
  if (!ALLOWED.includes(key)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 })

  await prisma.appConfig.upsert({
    where:  { userId_key: { userId: session.userId, key } },
    update: { value },
    create: { userId: session.userId, key, value },
  })
  return NextResponse.json({ success: true })
}
