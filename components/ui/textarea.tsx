import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Same visual language as <Input> (transparent, bottom-border only, mono
 * type) rather than a boxed textarea — reusing the exact input treatment
 * already established elsewhere on the site is what makes this read as
 * "always part of the website" rather than a bolted-on form widget.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "flex min-h-[96px] w-full resize-y border-0 border-b border-border-strong bg-transparent px-0.5 py-1.5 font-mono text-[13.5px] text-ink outline-none transition-colors duration-200 ease-out-expo placeholder:text-ink-faint focus:border-accent disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
