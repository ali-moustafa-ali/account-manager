import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <div>
      {label ? (
        <label htmlFor={inputId} className="block text-sm font-medium text-ink-1 mb-2">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        {...props}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={hint || error ? `${inputId}-desc` : undefined}
        className={cn(
          "w-full rounded-card border bg-white px-4 py-2.5 text-ink-1 outline-none focus:ring-2 focus:ring-ink-1/30",
          error ? "border-status-overdue-bg" : "border-line focus:border-ink-1/30",
          className,
        )}
      />
      {error ? (
        <p id={`${inputId}-desc`} className="text-sm mt-2 text-status-overdue-bg font-medium">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-desc`} className="text-sm mt-2 text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
