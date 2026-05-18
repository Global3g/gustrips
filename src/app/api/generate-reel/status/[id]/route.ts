/**
 * GET /api/generate-reel/status/[id]
 *
 * Polls Shotstack for the current state of a render. The client hits
 * this every few seconds until `status === 'done'` (or `failed`).
 *
 * When `SHOTSTACK_API_KEY` is missing or the id starts with `mock-`,
 * the route returns a fake-done response so the UI flow keeps working
 * for local development. To simulate the queue/render delay, mock ids
 * pretend to be `rendering` for the first ~3 seconds after creation.
 *
 * Mock id format: `mock-<base36 timestamp>` (set by the POST route).
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { pollRender, MissingKeyError, type ShotstackStatus } from '@/lib/shotstack';

const MOCK_VIDEO_URL =
  'https://shotstack-assets.s3.amazonaws.com/footage/beach-sample.mp4';

/** Returns a stand-in render-status payload for the local mock path. */
function mockStatus(id: string): { status: ShotstackStatus; url?: string } {
  // Parse the base36 timestamp embedded by the POST route. If the
  // id wasn't created by us, just report `done` immediately.
  const match = id.match(/^mock-(.+)$/);
  if (!match) return { status: 'done', url: MOCK_VIDEO_URL };
  const created = parseInt(match[1], 36);
  if (!Number.isFinite(created)) return { status: 'done', url: MOCK_VIDEO_URL };
  const elapsed = Date.now() - created;
  if (elapsed < 1500) return { status: 'queued' };
  if (elapsed < 3500) return { status: 'rendering' };
  return { status: 'done', url: MOCK_VIDEO_URL };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Falta el id' }, { status: 400 });
  }

  // Mock path: no key, or id was issued by the mock POST branch.
  if (!process.env.SHOTSTACK_API_KEY || id.startsWith('mock-')) {
    const m = mockStatus(id);
    return NextResponse.json({ ok: true, ...m });
  }

  try {
    const result = await pollRender(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    if (err instanceof MissingKeyError) {
      const m = mockStatus(id);
      return NextResponse.json({ ok: true, ...m });
    }
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[generate-reel/status] poll failed:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
