import { useState } from "react";
import type { ReactNode } from "react";
import { type LucideIcon, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type NumberStepperProps = {
  id: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  icon?: LucideIcon;
  iconClassName?: string;
  suffix?: ReactNode;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function NumberStepper({
  id,
  value,
  min,
  max,
  step = 1,
  onChange,
  icon: Icon,
  iconClassName,
  suffix,
}: NumberStepperProps) {
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const displayValue = draftValue ?? String(value);

  const updateValue = (nextValue: number) => {
    const clamped = clamp(nextValue, min, max);
    setDraftValue(null);
    onChange(clamped);
  };

  return (
    <div className="flex items-center gap-2">
      {Icon && (
        <Icon className={cn("h-5 w-5 text-muted-foreground", iconClassName)} />
      )}
      <div className="flex flex-1 items-center gap-1 rounded-lg border bg-background p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md"
          onClick={() => updateValue(value - step)}
          disabled={value <= min}
          aria-label={`Decrease ${id}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="relative flex-1">
          <Input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            value={displayValue}
            onFocus={() => {
              if (draftValue === null) {
                setDraftValue(String(value));
              }
            }}
            onBlur={() => {
              const currentText = draftValue ?? String(value);

              if (currentText.trim() === "") {
                setDraftValue(null);
                return;
              }

              const nextValue = Number.parseInt(currentText, 10);
              if (Number.isNaN(nextValue)) {
                setDraftValue(null);
                return;
              }

              const clamped = clamp(nextValue, min, max);
              setDraftValue(null);
              onChange(clamped);
            }}
            onChange={(event) => {
              const nextText = event.target.value;
              setDraftValue(nextText);

              if (nextText.trim() === "") {
                return;
              }

              const nextValue = Number.parseInt(nextText, 10);
              if (Number.isNaN(nextValue)) {
                return;
              }

              onChange(clamp(nextValue, min, max));
            }}
            className={cn(
              "h-8 border-0 bg-transparent text-center text-sm shadow-none [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              suffix ? "pr-8" : undefined,
            )}
          />
          {suffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted-foreground">
              {suffix}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md"
          onClick={() => updateValue(value + step)}
          disabled={value >= max}
          aria-label={`Increase ${id}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export { NumberStepper };
