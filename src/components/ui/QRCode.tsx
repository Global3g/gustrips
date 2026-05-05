'use client';

interface QRCodeProps {
  url: string;
  size?: number;
  caption?: string;
}

/**
 * Simple QR code component using an external API to generate QR images.
 * Renders a centered QR with optional caption text below.
 */
export default function QRCode({ url, size = 200, caption }: QRCodeProps) {
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=1e293b&color=ffffff&format=svg`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl overflow-hidden bg-white p-3">
        <img
          src={qrSrc}
          alt="Codigo QR para compartir"
          width={size}
          height={size}
          className="block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      {caption && (
        <p className="text-white/40 text-xs text-center">{caption}</p>
      )}
    </div>
  );
}
