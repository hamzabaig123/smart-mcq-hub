import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Panel, Btn, Select, Field, Empty, Tag, Stat } from "@/components/app/kit";
import { Ring } from "@/components/app/Ring";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { subjectsQuery, chaptersQuery, mcqsQuery, type Mcq } from "@/lib/queries";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Practice & Test — Oblique Study OS" },
      {
        name: "description",
        content:
          "Run untimed practice with instant explanations or a timed mock test across any subject or chapter.",
      },
      { property: "og:title", content: "Practice & Test — Oblique Study OS" },
      {
        property: "og:description",
        content: "Answer your own MCQ bank in practice or exam mode and track every attempt.",
      },
    ],
  }),
  component: Practice,
});

type Mode = "practice" | "test";

function shuffle<T>(list: T[]) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function Practice() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: subjects = [] } = useQuery({ ...subjectsQuery(), enabled: !!user });
  const { data: chapters = [] } = useQuery({ ...chaptersQuery(), enabled: !!user });
  const { data: bank = [] } = useQuery({ ...mcqsQuery({ status: "approved" }), enabled: !!user });

  const [mode, setMode] = useState<Mode>("practice");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [count, setCount] = useState(10);
  const [minutes, setMinutes] = useState(10);

  const [queue, setQueue] = useState<Mcq[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [finished, setFinished] = useState(false);
  const startedAt = useRef<number>(0);

  const pool = useMemo(
    () =>
      bank.filter(
        (m) =>
          (!subjectId || m.subject_id === subjectId) && (!chapterId || m.chapter_id === chapterId),
      ),
    [bank, subjectId, chapterId],
  );

  useEffect(() => {
    if (mode !== "test" || !queue || finished) return;
    if (secondsLeft <= 0) {
      setFinished(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, queue, finished, secondsLeft]);

  const start = () => {
    if (!pool.length) {
      toast.error("No approved questions match that selection yet.");
      return;
    }
    setQueue(shuffle(pool).slice(0, Math.min(count, pool.length)));
    setIndex(0);
    setAnswers({});
    setRevealed(false);
    setFinished(false);
    setSecondsLeft(minutes * 60);
    startedAt.current = Date.now();
  };

  const current = queue?.[index] ?? null;
  const correctCount = queue
    ? queue.filter((q) => answers[q.id] === q.correct_index).length
    : 0;

  const choose = (i: number) => {
    if (!current) return;
    if (mode === "practice" && revealed) return;
    setAnswers((a) => ({ ...a, [current.id]: i }));
    if (mode === "practice") setRevealed(true);
  };

  const next = () => {
    if (!queue) return;
    if (index + 1 >= queue.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setRevealed(false);
  };

  useEffect(() => {
    if (!finished || !queue || !user) return;
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    void (async () => {
      const { data: session, error } = await supabase
        .from("study_sessions")
        .insert({
          user_id: user.id,
          mode,
          subject_id: subjectId || null,
          chapter_id: chapterId || null,
          total: queue.length,
          correct: queue.filter((q) => answers[q.id] === q.correct_index).length,
          duration_sec: durationSec,
        })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      const rows = queue
        .filter((q) => answers[q.id] !== undefined)
        .map((q) => ({
          user_id: user.id,
          mcq_id: q.id,
          session_id: session.id,
          selected_index: answers[q.id],
          is_correct: answers[q.id] === q.correct_index,
          mode,
        }));
      if (rows.length) await supabase.from("attempts").insert(rows);
      qc.invalidateQueries({ queryKey: ["attempts"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <AppShell
      title="Practice & Test"
      subtitle={queue && !finished ? `Question ${index + 1} of ${queue.length}` : "Build a session from your bank"}
      actions={
        queue && !finished && mode === "test" ? (
          <span className="rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-sm text-amber ring-1 ring-border-2">
            {mmss}
          </span>
        ) : null
      }
    >
      {!queue && (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel>
            <h2 className="text-lg font-semibold tracking-tight">New session</h2>
            <p className="mt-1 text-sm text-muted">
              Practice reveals the answer instantly. Test hides everything until the timer ends.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {(["practice", "test"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={
                    mode === m
                      ? "rounded-xl border border-accent/50 bg-accent/10 px-4 py-3 text-left"
                      : "rounded-xl border border-border-2 px-4 py-3 text-left transition-colors hover:bg-surface-2"
                  }
                >
                  <p className="text-sm font-semibold capitalize">{m}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {m === "practice" ? "Instant feedback" : "Timed, scored at the end"}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Subject">
                <Select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setChapterId("");
                  }}
                >
                  <option value="">All subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Chapter">
                <Select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                  <option value="">All chapters</option>
                  {chapters
                    .filter((c) => !subjectId || c.subject_id === subjectId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Questions">
                <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
                  {[5, 10, 20, 30, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              {mode === "test" && (
                <Field label="Time limit">
                  <Select value={String(minutes)} onChange={(e) => setMinutes(Number(e.target.value))}>
                    {[5, 10, 20, 30, 60].map((n) => (
                      <option key={n} value={n}>
                        {n} minutes
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>

            <Btn className="mt-5 w-full" onClick={start} disabled={!pool.length}>
              Start {mode}
            </Btn>
          </Panel>

          <Panel>
            <h2 className="text-lg font-semibold tracking-tight">Available pool</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat label="Matching" value={pool.length} hint="approved questions" />
              <Stat label="Whole bank" value={bank.length} hint="approved total" />
            </div>
            {!pool.length && (
              <div className="mt-4">
                <Empty
                  title="Nothing to answer yet"
                  body="Add questions from the Syllabus page or generate them in AI Studio, then approve them."
                />
              </div>
            )}
          </Panel>
        </div>
      )}

      {queue && !finished && current && (
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${((index + 1) / queue.length) * 100}%` }}
            />
          </div>

          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone="accent">{current.difficulty}</Tag>
              {current.tags.slice(0, 3).map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
            <p className="mt-3 text-lg font-medium leading-relaxed tracking-tight">{current.question}</p>

            <div className="mt-5 space-y-2">
              {current.options.map((opt, i) => {
                const picked = answers[current.id] === i;
                const isCorrect = i === current.correct_index;
                const show = mode === "practice" && revealed;
                const cls = show
                  ? isCorrect
                    ? "border-accent/60 bg-accent/10"
                    : picked
                      ? "border-rose/60 bg-rose/10"
                      : "border-border-2"
                  : picked
                    ? "border-accent/60 bg-accent/10"
                    : "border-border-2 hover:bg-surface-2";
                return (
                  <button
                    key={i}
                    onClick={() => choose(i)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${cls}`}
                  >
                    <span className="font-mono text-xs text-faint">{String.fromCharCode(65 + i)}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            {mode === "practice" && revealed && current.explanation && (
              <p className="mt-4 rounded-xl border border-border bg-surface-2/50 p-3.5 text-sm text-muted">
                {current.explanation}
              </p>
            )}

            <div className="mt-5 flex items-center gap-2">
              <Btn onClick={next} disabled={mode === "practice" && !revealed}>
                {index + 1 >= queue.length ? "Finish" : "Next question"}
              </Btn>
              <Btn variant="ghost" onClick={() => setFinished(true)}>
                End session
              </Btn>
            </div>
          </Panel>
        </div>
      )}

      {queue && finished && (
        <div className="mx-auto max-w-3xl space-y-5">
          <Panel className="flex flex-col items-center gap-5 sm:flex-row">
            <Ring value={Math.round((correctCount / queue.length) * 100)} size={128} />
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Session complete</h2>
              <p className="mt-1 text-sm text-muted">
                {correctCount} correct out of {queue.length} in {mode} mode.
              </p>
              <div className="mt-4 flex gap-2">
                <Btn onClick={() => setQueue(null)}>New session</Btn>
                <Btn variant="outline" onClick={start}>
                  Retry same set
                </Btn>
              </div>
            </div>
          </Panel>

          <Panel>
            <h3 className="text-sm font-semibold">Review</h3>
            <div className="mt-3 space-y-3">
              {queue.map((q, qi) => {
                const picked = answers[q.id];
                const ok = picked === q.correct_index;
                return (
                  <div key={q.id} className="rounded-xl border border-border p-3.5">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-xs text-faint">{qi + 1}</span>
                      <p className="text-sm font-medium">{q.question}</p>
                      <span className="ml-auto shrink-0">
                        <Tag tone={ok ? "accent" : "rose"}>{ok ? "correct" : "missed"}</Tag>
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Answer: {q.options[q.correct_index]}
                      {picked !== undefined && !ok && ` · you chose: ${q.options[picked]}`}
                    </p>
                    {q.explanation && <p className="mt-1 text-xs text-faint">{q.explanation}</p>}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}
    </AppShell>
  );
}
