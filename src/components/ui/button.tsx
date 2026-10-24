import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[transform,background-color,color,opacity] duration-150 cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:brightness-105",
        pink: "bg-pink text-pink-foreground hover:brightness-105",
        secondary: "bg-card text-card-foreground hover:bg-secondary",
        raised: "bg-secondary text-secondary-foreground hover:brightness-110",
        outline:
          "border-[1.5px] border-border text-foreground hover:bg-secondary/60",
        ghost: "text-muted-foreground hover:text-foreground",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 gap-1.5 px-3",
        lg: "h-16 px-7 font-display text-lg font-extrabold",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
