import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { EncryptionService } from '@/lib/services/EncryptionService'
import { validatePassphrase } from '@/lib/validation/passphraseValidation'

const encryptionService = new EncryptionService()

export async function POST(req: NextRequest) {
  try {
    const { passphrase } = await req.json()
    if (!passphrase) {
      return NextResponse.json({ error: 'Passphrase required' }, { status: 400 })
    }

    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const keyHex = encryptionService.deriveKey(passphrase)

    if (!user.verifier) {
      const validation = validatePassphrase(passphrase)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.errors[0] }, { status: 400 })
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { verifier: encryptionService.createVerifier(keyHex) },
      })
    } else {
      if (!encryptionService.verifyKey(keyHex, user.verifier)) {
        return NextResponse.json({ error: 'Invalid passphrase' }, { status: 401 })
      }
    }

    session.encryptionKey = keyHex
    await session.save()

    return NextResponse.json({ success: true, firstTime: !user.verifier })
  } catch (error) {
    console.error('Unlock error:', error)
    return NextResponse.json({ error: 'Failed to unlock' }, { status: 500 })
  }
}
