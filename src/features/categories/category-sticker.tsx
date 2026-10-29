import type { CategoryTag } from "@/game/categories";
import { cn } from "@/lib/utils";

// Tags read as little stickers slapped on the corner of a card.
const CategorySticker = ({
  tag,
  onPrimary = false,
  className,
}: {
  tag: CategoryTag;
  onPrimary?: boolean;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-full px-2 text-[10px] leading-4 font-bold",
      tag === "new" ? "rotate-6" : "rotate-[5deg]",
      tag === "new" && !onPrimary && "bg-pink text-pink-foreground",
      tag === "new" && onPrimary && "bg-primary-foreground text-[#ff4fa3]",
      tag === "updated" &&
        (onPrimary
          ? "border-[1.5px] border-primary-foreground text-primary-foreground"
          : "border-[1.5px] border-pink bg-card text-pink"),
      className,
    )}
  >
    {tag}
  </span>
);

export { CategorySticker };
