import { useState } from "react";
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
  suffix,
  size = "lg",
  valueClassName,
}: NumberStepperProps) {
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const isEditing = draftValue !== null;

  const updateValue = (nextValue: number) => {
    const clamped = clamp(nextValue, min, max);
    haptic.tap();
    setDraftValue(null);
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
      <div
        className={cn(
          "flex items-baseline justify-center font-display font-extrabold leading-none",
          size === "lg" ? "min-w-0 flex-1 text-[3.125rem]" : "text-[17px]",
          valueClassName,
        )}
      >
        {/* The input stays for typing; while idle a rolling copy of the value sits on top of it. */}
        <span className="relative inline-flex">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={draftValue ?? String(value)}
            aria-label={label}
            onFocus={() => {
              if (draftValue === null) {
                setDraftValue(String(value));
              }
            }}
            onBlur={() => {
              const currentText = draftValue ?? String(value);
              const nextValue = Number.parseInt(currentText, 10);
              setDraftValue(null);

              if (currentText.trim() === "" || Number.isNaN(nextValue)) {
                return;
              }

              onChange(clamp(nextValue, min, max));
            }}
            onChange={(event) => {
              const nextText = event.target.value;
              setDraftValue(nextText);

              const nextValue = Number.parseInt(nextText, 10);
              if (nextText.trim() === "" || Number.isNaN(nextValue)) {
                return;
              }

              onChange(clamp(nextValue, min, max));
            }}
            style={{ width: `${(draftValue ?? String(value)).length}ch` }}
            className={cn(
              "rounded-lg bg-transparent text-center transition-[width] duration-200 tabular-nums outline-none [appearance:textfield] focus-visible:ring-[3px] focus-visible:ring-ring/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              !isEditing && "text-transparent caret-transparent",
            )}
          />
          {!isEditing && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <RollingNumber value={value} />
            </span>
          )}
        </span>
        {suffix && (
          <span className={size === "lg" ? "text-2xl" : "-ml-0.5 text-base"}>
            {suffix}
          </span>
        )}
      </div>
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
