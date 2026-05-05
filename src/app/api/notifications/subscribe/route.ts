export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, subscription } = await req.json();

    if (!userId || !subscription) {
      return NextResponse.json(
        { error: 'userId and subscription required' },
        { status: 400 },
      );
    }

    const db = getAdminDb();

    // Store subscription under the user — use endpoint as unique key
    const subId = Buffer.from(subscription.endpoint).toString('base64url').slice(0, 64);

    await db
      .collection('pushSubscriptions')
      .doc(`${userId}_${subId}`)
      .set({
        userId,
        subscription,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error saving push subscription:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
