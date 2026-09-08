import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { profileQuery, mcqsQuery } from "@/lib/queries";

const WORKSPACE: { to: string; label: string; badgeKey?: string }[] = [
  { to: "/", label: "Dashboard" },
  { to: "/syllabus", label: "Syllabus" },
  { to: "/plan", label: "Study Plan" },
  { to: "/exams", label: "Exams" },
  { to: "/practice", label: "Practice & Test" },
  { to: "/scanner", label: "QR Scanner" },
  { to: "/ai-studio", label: "AI Studio", badgeKey: "pending" },
];

export function AppShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const { data: profile } = useQuery(profileQuery(user?.id));
  const { data: pending } = useQuery({ ...mcqsQuery({ status: "pending" }), enabled: !!user });

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-faint">Loading workspace…</p>
      </div>
    );
  }

  const initials = (profile?.display_name ?? user.email ?? "??")
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  const nav = (
    <>
      <div className="flex items-center gap-3 px-2">
        <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-surface-3 to-surface ring-1 ring-border-2">
          <span className="font-mono text-sm font-medium text-accent">◈</span>
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight">Oblique</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Study OS</p>
        </div>
      </div>

      <p className="mt-7 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Workspace</p>
      <nav className="mt-2 flex flex-col gap-0.5">
        {WORKSPACE.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                active
                  ? "flex items-center gap-3 rounded-lg bg-surface-2/70 px-3 py-2 text-sm font-medium ring-1 ring-border-2"
                  : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2/50 hover:text-foreground"
              }
            >
              {active && <span className="size-1.5 rounded-full bg-accent" />}
              {item.label}
              {item.badgeKey === "pending" && !!pending?.length && (
                <span className="ml-auto rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                  {pending.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <p className="mt-6 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">Account</p>
      <nav className="mt-2 flex flex-col gap-0.5">
        <Link
          to="/settings"
          className={
            pathname.startsWith("/settings")
              ? "flex items-center gap-3 rounded-lg bg-surface-2/70 px-3 py-2 text-sm font-medium ring-1 ring-border-2"
              : "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2/50 hover:text-foreground"
          }
        >
          Settings
        </Link>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-2/50 hover:text-foreground"
        >
          Sign out
        </button>
      </nav>

      <div className="mt-auto rounded-xl border border-border bg-gradient-to-b from-surface-2 to-surface p-3.5">
        <p className="text-sm font-semibold tracking-tight">{profile?.exam_name ?? "My Exam"}</p>
        <p className="mt-0.5 font-mono text-[11px] text-faint">
          {profile?.daily_reminder ? `Reminder ${profile.reminder_time?.slice(0, 5)}` : "Reminders off"}
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background font-body text-foreground antialiased">
      <div className="mx-auto flex max-w-[1520px]">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface/40 px-4 py-5 lg:flex">
          {nav}
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Close menu"
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative flex h-full w-64 flex-col border-r border-border bg-surface px-4 py-5">
              {nav}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background/80 px-4 py-4 backdrop-blur-md sm:px-8">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 font-mono text-sm text-accent ring-1 ring-border-2 lg:hidden"
            >
              ◈
            </button>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight">{title}</p>
              {subtitle && <p className="truncate font-mono text-[11px] text-faint">{subtitle}</p>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {actions}
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-surface-3 to-surface-2 ring-1 ring-border-2">
                <span className="text-xs font-semibold">{initials}</span>
              </div>
            </div>
          </header>

          <div className="px-4 py-6 sm:px-8 sm:py-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
