import { cn } from "@/lib/utils/cn";

const variants = {
  primary: "bg-ink-1 text-surface-1 hover:bg-ink-2",
  secondary: "bg-surface-2 text-ink-1 border border-line hover:bg-white",
  ghost: "text-ink-1 hover:bg-surface-2",
  destructive: "bg-status-overdue-bg text-status-overdue-fg hover:opacity-90",
} as const;

export type ButtonVariant = keyof typeof variants;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-pill px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
