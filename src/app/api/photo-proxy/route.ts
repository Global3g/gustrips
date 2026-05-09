/* Server-side photo proxy.
   Firebase Storage download URLs don't expose CORS by default, which
   blocks the browser-side migration's getBlob/fetch. Proxying through
   our own origin sidesteps that — the response gets ACAO from us. */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('url');
  if (!target) {
    return NextResponse.json({ ok: false, error: 'Missing url' }, { status: 400 });
  }

  // Only allow Firebase Storage URLs to avoid open-proxy abuse
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid url' }, { status: 400 });
  }
  if (parsed.host !== 'firebasestorage.googleapis.com') {
    return NextResponse.json({ ok: false, error: 'Host not allowed' }, { status: 403 });
  }

  try {
    const upstream = await fetch(target, {
      // forward only safe headers; pass through the auth token in URL
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(60_000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: `Upstream ${upstream.status}` },
        { status: 502 },
      );
    }
    const buf = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
