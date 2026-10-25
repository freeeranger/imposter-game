import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";

import { haptic } from "@/lib/native";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RollingNumber } from "@/components/ui/rolling-number";

type NumberStepperProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  // Tapping the number opens a picker; typing into a field is clumsy on phones.
  onPick?: () => void;
  suffix?: ReactNode;
  size?: "lg" | "sm";
  valueClassName?: string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function NumberStepper({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onPick,
  suffix,
  size = "lg",
  valueClassName,
}: NumberStepperProps) {
  const updateValue = (nextValue: number) => {
    const clamped = clamp(nextValue, min, max);
    if (clamped === value) return;
    haptic.tap();
    onChange(clamped);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        size === "lg" ? "w-full justify-between" : "shrink-0",
      )}
    >
      <Button
        type="button"
        variant={size === "lg" ? "outline" : "ghost"}
        size="icon"
        onClick={() => updateValue(value - step)}
        disabled={value <= min}
        aria-label={`Fewer ${label}`}
      >
        <Minus className="size-5 stroke-[2.5]" />
      </Button>
      <button
        id={id}
        type="button"
        onClick={onPick}
        aria-haspopup="dialog"
        aria-label={`${label}: ${value}${suffix ?? ""}. Pick a value`}
        // A fixed width for the small stepper keeps its buttons still as the digit count changes.
        style={
          size === "sm"
            ? { width: `${String(max).length + (suffix ? 1 : 0) + 0.4}ch` }
            : undefined
        }
        className={cn(
          "flex cursor-pointer items-baseline justify-center rounded-xl font-display font-extrabold leading-none tabular-nums outline-none transition-[font-size,scale] duration-200 focus-visible:ring-[3px] focus-visible:ring-ring/60 active:scale-95",
          size === "lg"
            ? cn(
                // Fixed height so the row doesn't jump when two digits shrink the type.
                "h-14 min-w-0 flex-1 items-center",
                value >= 10 ? "text-[32px]" : "text-[50px]",
              )
            : "text-[17px]",
          valueClassName,
        )}
      >
        <RollingNumber value={value} />
        {suffix && (
          <span className={size === "lg" ? "text-2xl" : "-ml-0.5 text-base"}>
            {suffix}
          </span>
        )}
      </button>
      <Button
        type="button"
        variant={size === "lg" ? "outline" : "ghost"}
        size="icon"
        onClick={() => updateValue(value + step)}
        disabled={value >= max}
        aria-label={`More ${label}`}
      >
        <Plus className="size-5 stroke-[2.5]" />
      </Button>
    </div>
  );
}

export { NumberStepper };
