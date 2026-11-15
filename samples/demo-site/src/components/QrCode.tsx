import { useMemo } from 'react';
import QRCode from 'qrcode';

/**
 * A QR code drawn as SVG from the module matrix: no innerHTML and no data: URL, so the page's
 * Content-Security-Policy needs nothing extra. Dark modules on white whatever the theme, which
 * every phone camera reads.
 */
export function QrCode({ value, size = 224, label }: { value: string; size?: number; label: string }) {
  const path = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    let d = '';
    for (let y = 0; y < modules.size; y++)
      for (let x = 0; x < modules.size; x++) if (modules.get(x, y)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
    return { d, extent: modules.size + 8 };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${path.extent} ${path.extent}`}
      shapeRendering="crispEdges"
      className="rounded-lg border border-line"
      data-testid="qr-code"
      data-value={value}
    >
      <rect width={path.extent} height={path.extent} fill="#ffffff" />
      <path d={path.d} fill="#0b1f3a" />
    </svg>
  );
}
