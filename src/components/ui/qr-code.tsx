import { useMemo } from "react";
import { encode } from "uqr";

import { cn } from "@/lib/utils";

type QrCodeProps = {
  value: string;
  label: string;
  className?: string;
};

// Dark modules on white whatever the theme: phone cameras read that most reliably.
function QrCode({ value, label, className }: QrCodeProps) {
  const code = useMemo(() => {
    try {
      const qr = encode(value, { ecc: "L", border: 0 });
      let path = "";
      qr.data.forEach((row, y) =>
        row.forEach((dark, x) => {
          if (dark) path += `M${x} ${y}h1v1h-1z`;
        }),
      );
      return { size: qr.size, path };
    } catch {
      // Too much data for the largest QR code (a category with around a thousand words).
      return null;
    }
  }, [value]);

  if (!code) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-[24px] bg-secondary p-6 text-center text-[15px] text-muted-foreground",
          className,
        )}
      >
        Too many words for a QR code. Send the link instead.
      </div>
    );
  }

  const { size, path } = code;
  return (
    <div className={cn("rounded-[24px] bg-white p-4", className)}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="crispEdges"
        className="block aspect-square w-full"
      >
        <path d={path} fill="#15111f" />
      </svg>
    </div>
  );
}

export { QrCode };
