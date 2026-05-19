import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, id, ...rest }, ref) => (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wider text-text-muted"
        >
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={id}
        className={cn(
          "h-11 w-full rounded-lg border bg-surface px-3 text-sm text-text placeholder:text-text-dim",
          "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
          error ? "border-danger" : "border-border",
          className,
        )}
        {...rest}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-dim">{hint}</p>
      ) : null}
    </div>
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    hint?: string;
    error?: string;
  }
>(({ className, label, hint, error, id, ...rest }, ref) => (
  <div className="space-y-1.5">
    {label ? (
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wider text-text-muted"
      >
        {label}
      </label>
    ) : null}
    <textarea
      ref={ref}
      id={id}
      className={cn(
        "min-h-[100px] w-full rounded-lg border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-dim",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
        error ? "border-danger" : "border-border",
        className,
      )}
      {...rest}
    />
    {error ? (
      <p className="text-xs text-danger">{error}</p>
    ) : hint ? (
      <p className="text-xs text-text-dim">{hint}</p>
    ) : null}
  </div>
));
Textarea.displayName = "Textarea";
