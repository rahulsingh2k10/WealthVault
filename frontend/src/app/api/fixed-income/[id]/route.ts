import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AssetRepository } from '@/lib/repositories/AssetRepository'
import { AssetService } from '@/lib/services/AssetService'
import { EncryptionService } from '@/lib/services/EncryptionService'
import { sessionService } from '@/lib/services/SessionService'
import { UnauthorizedError, NotFoundError } from '@/lib/errors'
import type { FixedIncomeHolding } from '@/lib/types'

const service = new AssetService<FixedIncomeHolding>(
  new AssetRepository(prisma.fixedIncomeHolding),
  new EncryptionService()
)

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await sessionService.requireVault()
    const body = await req.json()
    const { id, createdAt, updatedAt, ...fields } = body
    void id; void createdAt; void updatedAt
    const updated = await service.update(Number(params.id), session.userId!, session.encryptionKey!, fields)
    return NextResponse.json({ data: updated })
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (e instanceof NotFoundError)     return NextResponse.json({ error: 'Not found' }, { status: 404 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await sessionService.requireVault()
    await service.delete(Number(params.id), session.userId!)
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
