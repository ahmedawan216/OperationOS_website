import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "border-accent bg-accent text-white hover:border-accent-hover hover:bg-accent-hover hover:shadow-lift",
        secondary:
          "border-border-strong bg-surface text-ink hover:border-ink-dim hover:bg-surface-2",
        quiet:
          "border-transparent bg-transparent text-ink-dim hover:bg-surface-2 hover:text-ink",
        ghost:
          "border-border-strong bg-transparent text-ink-dim hover:border-ink-dim hover:bg-surface-2 hover:text-ink",
        terminal:
          "border-accent bg-accent text-white hover:border-accent-hover hover:bg-accent-hover",
        destructive:
          "border-danger bg-danger text-white hover:brightness-90",
      },
      size: {
        default: "px-5 py-2.5",
        sm: "min-h-10 px-4 py-2 text-[13px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
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
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
