import { useMemo } from "react";
import { encode } from "uqr";

import { cn } from "@/lib/utils";

type QrCodeProps = {
  value: string;
  label: string;
  className?: string;
};

const INK = "#15111f";
const PINK = "#d81b74";

// A w×h rectangle at (x, y) with its own radius per corner (top-left, top-right, bottom-right,
// bottom-left), as SVG path data.
const roundedRect = (
  x: number,
  y: number,
  w: number,
  h: number,
  [tl, tr, br, bl]: [number, number, number, number],
) =>
  `M${x + tl} ${y}H${x + w - tr}` +
  (tr ? `A${tr} ${tr} 0 0 1 ${x + w} ${y + tr}` : "") +
  `V${y + h - br}` +
  (br ? `A${br} ${br} 0 0 1 ${x + w - br} ${y + h}` : "") +
  `H${x + bl}` +
  (bl ? `A${bl} ${bl} 0 0 1 ${x} ${y + h - bl}` : "") +
  `V${y + tl}` +
  (tl ? `A${tl} ${tl} 0 0 1 ${x + tl} ${y}` : "") +
  "Z";

// Modules that touch merge into one shape and only their outer corners are rounded, so a lone
// module is a dot and a run is a pill. The three finder squares are drawn separately as rounded
// rings with a pink centre.
const drawCode = (data: boolean[][]) => {
  const size = data.length;
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  const isModule = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size && data[y][x] && !inFinder(x, y);

  let modules = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isModule(x, y)) continue;
      const up = isModule(x, y - 1);
      const down = isModule(x, y + 1);
      const left = isModule(x - 1, y);
      const right = isModule(x + 1, y);
      modules += roundedRect(x, y, 1, 1, [
        !up && !left ? 0.5 : 0,
        !up && !right ? 0.5 : 0,
        !down && !right ? 0.5 : 0,
        !down && !left ? 0.5 : 0,
      ]);
    }
  }

  let rings = "";
  let centres = "";
  for (const [x, y] of [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ]) {
    rings +=
      roundedRect(x, y, 7, 7, [2.6, 2.6, 2.6, 2.6]) +
      roundedRect(x + 1, y + 1, 5, 5, [1.6, 1.6, 1.6, 1.6]);
    centres += roundedRect(x + 2, y + 2, 3, 3, [1.2, 1.2, 1.2, 1.2]);
  }
  return { size, modules, rings, centres };
};

// Ink on a white card whatever the theme: phone cameras read dark-on-white most reliably.
function QrCode({ value, label, className }: QrCodeProps) {
  const code = useMemo(() => {
    try {
      return drawCode(encode(value, { ecc: "L", border: 0 }).data);
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
        Too many words for a QR code.
      </div>
    );
  }

  const { size, modules, rings, centres } = code;
  return (
    <div
      className={cn(
        "rounded-[28px] border-[1.5px] border-border bg-white p-[18px] shadow-[8px_8px_0_var(--pink)] dark:border-white",
        className,
      )}
    >
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${size} ${size}`}
        className="block aspect-square w-full"
      >
        <path d={modules} fill={INK} />
        <path d={rings} fill={INK} fillRule="evenodd" />
        <path d={centres} fill={PINK} />
      </svg>
    </div>
  );
}

export { QrCode };
