import { motion } from "motion/react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RollingNumber } from "@/components/ui/rolling-number";
import { SOFT_SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

const RoundProgress = ({
  current,
  total,
}: {
  current: number;
  total: number;
}) => (
  <div className="flex gap-1.5" aria-hidden="true">
    {Array.from({ length: total }, (_, index) => (
      <span
        key={index}
        className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
      >
        <motion.span
          className={cn(
            "absolute inset-0 origin-left rounded-full transition-colors duration-300",
            index + 1 === current ? "bg-primary" : "bg-muted-foreground",
          )}
          initial={false}
          animate={{ scaleX: index + 1 <= current ? 1 : 0 }}
          transition={SOFT_SPRING}
        />
      </span>
    ))}
  </div>
);

const RoundHeader = ({
  current,
  total,
  onEnd,
}: {
  current: number;
  total: number;
  onEnd: () => void;
}) => (
  <div className="flex flex-col gap-3.5">
    <div className="flex h-11 items-center justify-between">
      <Button
        variant="secondary"
        size="icon"
        onClick={onEnd}
        aria-label="End game"
      >
        <X className="size-[18px] stroke-[2.2]" />
      </Button>
      <span className="flex items-baseline gap-1 text-[15px] font-bold">
        player <RollingNumber value={current} />
        <span className="font-medium text-muted-foreground">of {total}</span>
      </span>
      <span className="size-11" aria-hidden="true" />
    </div>
    <div className="lg:mx-auto lg:w-full lg:max-w-[720px]">
      <RoundProgress current={current} total={total} />
    </div>
  </div>
);

export { RoundHeader };
