import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-200 [transition-timing-function:cubic-bezier(.16,1,.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border border-transparent bg-aurora text-white shadow-[0_4px_24px_rgba(110,107,255,.4)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(110,107,255,.55)]",
        ghost:
          "border border-line bg-overlay text-ink hover:-translate-y-0.5 hover:border-line-strong",
        outline:
          "border border-line-strong bg-transparent text-ink hover:border-accent/50 hover:bg-overlay",
      },
      size: {
        sm: "px-4 py-2 text-sm",
        md: "px-[18px] py-[9px] text-sm",
        lg: "px-7 py-[13px] text-[15px]",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
