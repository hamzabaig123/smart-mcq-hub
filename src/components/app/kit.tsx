import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("panel p-5 sm:p-6", className)}>{children}</section>;
}

export function Btn({
  variant = "solid",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "ghost" | "outline" | "danger" }) {
  const styles = {
    solid: "bg-accent text-accent-foreground hover:opacity-90",
    outline: "border border-border-2 text-foreground hover:bg-surface-2",
    ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
    danger: "border border-rose/40 text-rose hover:bg-rose/10",
  }[variant];
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
        styles,
        className,
      )}
    />
  );
}

const fieldBase =
  "w-full rounded-lg border border-border-2 bg-surface-2/60 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-faint focus:border-accent/60";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldBase, className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldBase, "min-h-24 resize-y", className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldBase, "appearance-none pr-8", className)} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{label}</span>
      {children}
    </label>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border-2 px-6 py-12 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "accent" | "amber" | "rose" }) {
  const tones = {
    muted: "bg-surface-2 text-muted",
    accent: "bg-accent/12 text-accent",
    amber: "bg-amber/12 text-amber",
    rose: "bg-rose/12 text-rose",
  }[tone];
  return (
    <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]", tones)}>
      {children}
    </span>
  );
}
