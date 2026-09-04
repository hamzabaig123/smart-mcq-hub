import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app/AppShell";
import { Ring } from "@/components/app/Ring";
import { Panel, Stat, Empty, Btn, Tag } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import {
  subjectsQuery,
  chaptersQuery,
  mcqsQuery,
  attemptsQuery,
  sessionsQuery,
  profileQuery,
  computeStreak,
  colorStroke,
} from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Oblique Study OS" },
      {
        name: "description",
        content:
          "Track accuracy, streaks, subject mastery and pending AI questions across your whole MCQ syllabus.",
      },
      { property: "og:title", content: "Dashboard — Oblique Study OS" },
      {
        property: "og:description",
        content: "Your daily study command centre: accuracy, streaks and subject mastery at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { data: profile } = useQuery(profileQuery(user?.id));
  const { data: subjects = [] } = useQuery({ ...subjectsQuery(), enabled: !!user });
  const { data: chapters = [] } = useQuery({ ...chaptersQuery(), enabled: !!user });
  const { data: mcqs = [] } = useQuery({ ...mcqsQuery(), enabled: !!user });
  const { data: attempts = [] } = useQuery({ ...attemptsQuery(), enabled: !!user });
  const { data: sessions = [] } = useQuery({ ...sessionsQuery(), enabled: !!user });

  const approved = mcqs.filter((m) => m.status === "approved");
  const pending = mcqs.filter((m) => m.status === "pending");
  const accuracy = attempts.length
    ? Math.round((attempts.filter((a) => a.is_correct).length / attempts.length) * 100)
    : 0;
  const streak = computeStreak(attempts.map((a) => a.created_at));
  const today = new Date().toISOString().slice(0, 10);
  const todayAttempts = attempts.filter((a) => a.created_at.slice(0, 10) === today);
  const goal = 30;
  const dayProgress = Math.min(100, Math.round((todayAttempts.length / goal) * 100));

  const perSubject = subjects.map((s) => {
    const items = approved.filter((m) => m.subject_id === s.id);
    const chapterCount = chapters.filter((c) => c.subject_id === s.id).length;
    const covered = approved.length ? Math.round((items.length / Math.max(1, approved.length)) * 100) : 0;
    return { ...s, count: items.length, chapterCount, covered };
  });

  const firstName = (profile?.display_name ?? user?.email ?? "there").split(/[\s@]/)[0];

  return (
    <AppShell
      title="Dashboard"
      subtitle={profile?.exam_name ? `Preparing for ${profile.exam_name}` : "Your study command centre"}
      actions={
        <Link to="/practice">
          <Btn>Start practice</Btn>
        </Link>
      }
    >
      <div className="space-y-6">
        <Panel className="rise relative overflow-hidden">
          <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative grid shrink-0 place-items-center">
              <Ring value={dayProgress} size={124} stroke={9} />
              <div className="absolute text-center">
                <p className="text-2xl font-semibold tracking-tight">{dayProgress}%</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">today</p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
                Welcome back, {firstName}.
              </h1>
              <p className="mt-2 max-w-lg text-sm text-muted">
                {todayAttempts.length
                  ? `${todayAttempts.length} of ${goal} questions answered today. Keep the run alive.`
                  : `You have ${approved.length} approved questions ready. Answer ${goal} today to hit your target.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/practice">
                  <Btn>Practice now</Btn>
                </Link>
                <Link to="/ai-studio">
                  <Btn variant="outline">
                    AI Studio{pending.length ? ` · ${pending.length} pending` : ""}
                  </Btn>
                </Link>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Stat label="Accuracy" value={`${accuracy}%`} hint={`${attempts.length} attempts logged`} />
          <Stat label="Streak" value={`${streak}d`} hint="consecutive study days" />
          <Stat label="Question bank" value={approved.length} hint={`${pending.length} awaiting review`} />
          <Stat label="Subjects" value={subjects.length} hint={`${chapters.length} chapters`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Panel>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">Subject mastery</h2>
              <Link to="/syllabus" className="font-mono text-[11px] text-accent hover:underline">
                Manage syllabus →
              </Link>
            </div>
            {perSubject.length === 0 ? (
              <div className="mt-4">
                <Empty
                  title="No subjects yet"
                  body="Create your six exam subjects, then add chapters and sources under each one."
                  action={
                    <Link to="/syllabus">
                      <Btn>Build syllabus</Btn>
                    </Link>
                  }
                />
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {perSubject.map((s) => (
                  <Link
                    key={s.id}
                    to="/syllabus"
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-3.5 transition-colors hover:border-border-2 hover:bg-surface-2/50"
                  >
                    <div className="relative grid place-items-center">
                      <Ring value={s.covered} size={46} stroke={4} color={colorStroke(s.color)} />
                      <span className="absolute font-mono text-[10px]">{s.count}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                        {s.chapterCount} chapters · {s.count} MCQs
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <h2 className="text-base font-semibold tracking-tight">Recent sessions</h2>
            {sessions.length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                No sessions yet — your practice and test results will appear here.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {sessions.slice(0, 6).map((s) => {
                  const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface/50 px-3 py-2.5"
                    >
                      <Tag tone={s.mode === "test" ? "amber" : "accent"}>{s.mode}</Tag>
                      <div className="min-w-0">
                        <p className="text-sm">
                          {s.correct}/{s.total} correct
                        </p>
                        <p className="font-mono text-[10px] text-faint">
                          {new Date(s.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span
                        className={`ml-auto font-mono text-sm ${pct >= 70 ? "text-accent" : pct >= 40 ? "text-amber" : "text-rose"}`}
                      >
                        {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
