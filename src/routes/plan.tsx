import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Panel, Btn, Input, Select, Field, Empty, Tag, Stat } from "@/components/app/kit";
import { Ring } from "@/components/app/Ring";
import { supabase } from "@/integrations/supabase/client";
import {
  WEEKDAYS,
  chaptersQuery,
  colorStroke,
  planSlotsQuery,
  sourcesQuery,
  subjectsQuery,
  attemptsQuery,
} from "@/lib/queries";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Study Plan — Oblique Study OS" },
      {
        name: "description",
        content:
          "Map your subjects, chapters and sources onto a weekly study schedule and track how much of each week you have completed.",
      },
      { property: "og:title", content: "Study Plan — Oblique Study OS" },
      {
        property: "og:description",
        content: "A weekly timetable built from your own syllabus, with per-day progress tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage;
});

function PlanPage() {
  const qc = useQueryClient();
  const { data: subjects = [] } = useQuery(subjectsQuery());
  const { data: chapters = [] } = useQuery(chaptersQuery());
  const { data: sources = [] } = useQuery(sourcesQuery());
  const { data: slots = [] } = useQuery(planSlotsQuery());
  const { data: attempts = [] } = useQuery(attemptsQuery());

  const [weekday, setWeekday] = useState(0);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [startTime, setStartTime] = useState("18:00");
  const [duration, setDuration] = useState(45);
  const [target, setTarget] = useState(20);
  const [note, setNote] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["plan-slots"] });

  const addSlot = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("study_plan_slots").insert({
        user_id: auth.user.id,
        weekday,
        subject_id: subjectId || null,
        chapter_id: chapterId || null,
        source_id: sourceId || null,
        start_time: `${startTime}:00`,
        duration_min: duration,
        target_questions: target,
        note: note.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNote("");
      invalidate();
      toast.success("Block added to your week");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDone = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("study_plan_slots").update({ done }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("study_plan_slots").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Block removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetWeek = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("study_plan_slots").update({ done: false }).neq("done", false);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Week reset");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chapterOptions = useMemo(
    () => (subjectId ? chapters.filter((c) => c.subject_id === subjectId) : chapters),
    [chapters, subjectId],
  );
  const sourceOptions = useMemo(
    () => (chapterId ? sources.filter((s) => s.chapter_id === chapterId) : []),
    [sources, chapterId],
  );

  const subjectOf = (id: string | null) => subjects.find((s) => s.id === id);
  const chapterOf = (id: string | null) => chapters.find((c) => c.id === id);
  const sourceOf = (id: string | null) => sources.find((s) => s.id === id);

  const doneCount = slots.filter((s) => s.done).length;
  const weekMinutes = slots.reduce((n, s) => n + s.duration_min, 0);
  const targetTotal = slots.reduce((n, s) => n + s.target_questions, 0);
  const completion = slots.length ? Math.round((doneCount / slots.length) * 100) : 0;
  const weekAttempts = attempts.filter(
    (a) => Date.now() - new Date(a.created_at).getTime() < 7 * 24 * 3600 * 1000,
  ).length;

  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <AppShell title="Study Plan" subtitle="Your syllabus, mapped onto a week">
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Panel>
            <div className="flex flex-wrap items-center gap-5">
              <Ring value={completion} stroke={colorStroke("accent")} label={`${completion}%`} />
              <div className="grid flex-1 gap-3 sm:grid-cols-3">
                <Stat label="Blocks done" value={`${doneCount}/${slots.length}`} hint="this week" />
                <Stat label="Planned time" value={`${Math.round(weekMinutes / 6) / 10}h`} hint="across the week" />
                <Stat label="Question target" value={targetTotal} hint={`${weekAttempts} answered in 7 days`} />
              </div>
            </div>
          </Panel>

          {WEEKDAYS.map((day, idx) => {
            const daySlots = slots.filter((s) => s.weekday === idx);
            return (
              <Panel key={day}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {day}
                    {idx === todayIdx && (
                      <span className="ml-2 align-middle">
                        <Tag tone="accent">Today</Tag>
                      </span>
                    )}
                  </h2>
                  <span className="font-mono text-[11px] text-faint">
                    {daySlots.length} block{daySlots.length === 1 ? "" : "s"}
                  </span>
                </div>

                {daySlots.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">Nothing scheduled — a good day for a timed test.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {daySlots.map((slot) => {
                      const subject = subjectOf(slot.subject_id);
                      const chapter = chapterOf(slot.chapter_id);
                      const source = sourceOf(slot.source_id);
                      return (
                        <li
                          key={slot.id}
                          className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/50 px-3.5 py-3"
                        >
                          <input
                            type="checkbox"
                            checked={slot.done}
                            onChange={(e) => toggleDone.mutate({ id: slot.id, done: e.target.checked })}
                            className="size-4 accent-[var(--accent)]"
                            aria-label="Mark block done"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={slot.done ? "text-sm line-through text-faint" : "text-sm font-medium"}>
                              {subject?.name ?? "General study"}
                              {chapter && <span className="text-muted"> · {chapter.name}</span>}
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-faint">
                              {slot.start_time.slice(0, 5)} · {slot.duration_min} min · {slot.target_questions} questions
                              {source ? ` · ${source.title}` : ""}
                            </p>
                            {slot.note && <p className="mt-1 text-xs text-muted">{slot.note}</p>}
                          </div>
                          <Btn variant="ghost" onClick={() => removeSlot.mutate(slot.id)}>
                            Remove
                          </Btn>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            );
          })}

          {slots.length === 0 && (
            <Empty title="No weekly plan yet" body="Add your first study block using the panel on the right." />
          )}
        </div>

        <div className="space-y-5">
          <Panel>
            <h2 className="text-lg font-semibold tracking-tight">Add a study block</h2>
            <div className="mt-4 space-y-3">
              <Field label="Day">
                <Select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Subject">
                <Select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setChapterId("");
                    setSourceId("");
                  }}
                >
                  <option value="">Any subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Chapter">
                <Select
                  value={chapterId}
                  onChange={(e) => {
                    setChapterId(e.target.value);
                    setSourceId("");
                  }}
                >
                  <option value="">Any chapter</option>
                  {chapterOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Source">
                <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                  <option value="">No specific source</option>
                  {sourceOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Start">
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </Field>
                <Field label="Minutes">
                  <Input
                    type="number"
                    min={10}
                    max={300}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </Field>
                <Field label="Questions">
                  <Input
                    type="number"
                    min={0}
                    max={200}
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                  />
                </Field>
              </div>
              <Field label="Note">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional focus for the block" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Btn onClick={() => addSlot.mutate()} disabled={addSlot.isPending}>
                  {addSlot.isPending ? "Adding…" : "Add block"}
                </Btn>
                <Btn variant="outline" onClick={() => resetWeek.mutate()} disabled={!slots.length}>
                  Reset week
                </Btn>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
