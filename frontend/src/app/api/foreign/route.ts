import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AssetRepository } from '@/lib/repositories/AssetRepository'
import { AssetService } from '@/lib/services/AssetService'
import { EncryptionService } from '@/lib/services/EncryptionService'
import { sessionService } from '@/lib/services/SessionService'
import { UnauthorizedError } from '@/lib/errors'
import type { ForeignHolding } from '@/lib/types'

const service = new AssetService<ForeignHolding>(
  new AssetRepository(prisma.foreignHolding),
  new EncryptionService()
)

export async function GET() {
  try {
    const session = await sessionService.requireVault()
    const data = await service.getAll(session.userId!, session.encryptionKey!)
    return NextResponse.json({ data, total: data.length })
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await sessionService.requireVault()
    const body = await req.json()
    const { id, createdAt, updatedAt, ...fields } = body
    void id; void createdAt; void updatedAt
    const created = await service.create(session.userId!, session.encryptionKey!, fields)
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
