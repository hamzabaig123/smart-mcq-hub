import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Panel, Btn, Input, Textarea, Field, Empty, Tag, Stat } from "@/components/app/kit";
import { supabase } from "@/integrations/supabase/client";
import {
  chaptersQuery,
  examQuestionsQuery,
  examsQuery,
  mcqsQuery,
  subjectsQuery,
  type Exam,
} from "@/lib/queries";

export const Route = createFileRoute("/exams")({
  head: () => ({
    meta: [
      { title: "Exams — Oblique Study OS" },
      {
        name: "description",
        content:
          "Create exams from chosen subjects and chapters, attach the exact questions each paper covers and watch the countdown to exam day.",
      },
      { property: "og:title", content: "Exams — Oblique Study OS" },
      {
        property: "og:description",
        content: "Build exam papers from your question bank and track what each one covers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamsPage,
});

function ExamsPage() {
  const qc = useQueryClient();
  const { data: subjects = [] } = useQuery(subjectsQuery());
  const { data: chapters = [] } = useQuery(chaptersQuery());
  const { data: exams = [] } = useQuery(examsQuery());
  const { data: examQuestions = [] } = useQuery(examQuestionsQuery());
  const { data: mcqs = [] } = useQuery(mcqsQuery({ status: "approved" }));

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["exams"] });
    qc.invalidateQueries({ queryKey: ["exam-questions"] });
  };

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const createExam = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Give the exam a name.");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("exams").insert({
        user_id: auth.user.id,
        name: name.trim(),
        exam_date: date || null,
        note: note.trim() || null,
        subject_ids: subjectIds,
        chapter_ids: chapterIds,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setName("");
      setDate("");
      setNote("");
      setSubjectIds([]);
      setChapterIds([]);
      invalidate();
      toast.success("Exam created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteExam = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exams").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Exam deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setQuestion = useMutation({
    mutationFn: async ({ exam, mcqId, add }: { exam: Exam; mcqId: string; add: boolean }) => {
      if (add) {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error("Not signed in");
        const { error } = await supabase
          .from("exam_questions")
          .insert({ user_id: auth.user.id, exam_id: exam.id, mcq_id: mcqId });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("exam_questions")
          .delete()
          .eq("exam_id", exam.id)
          .eq("mcq_id", mcqId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exam-questions"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addAllMatching = useMutation({
    mutationFn: async (exam: Exam) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const already = new Set(examQuestions.filter((q) => q.exam_id === exam.id).map((q) => q.mcq_id));
      const rows = matchingMcqs(exam)
        .filter((m) => !already.has(m.id))
        .map((m) => ({ user_id: auth.user!.id, exam_id: exam.id, mcq_id: m.id }));
      if (!rows.length) throw new Error("Every matching question is already in this exam.");
      const { error } = await supabase.from("exam_questions").insert(rows);
      if (error) throw new Error(error.message);
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["exam-questions"] });
      toast.success(`${n} question${n === 1 ? "" : "s"} added`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const matchingMcqs = useMemo(
    () => (exam: Exam) =>
      mcqs.filter((m) => {
        const subjectOk = !exam.subject_ids.length || (m.subject_id && exam.subject_ids.includes(m.subject_id));
        const chapterOk = !exam.chapter_ids.length || (m.chapter_id && exam.chapter_ids.includes(m.chapter_id));
        return subjectOk && chapterOk;
      }),
    [mcqs],
  );

  const chapterOptions = subjectIds.length
    ? chapters.filter((c) => subjectIds.includes(c.subject_id))
    : chapters;

  const daysTo = (d: string | null) =>
    d ? Math.ceil((new Date(`${d}T00:00:00`).getTime() - Date.now()) / 86400000) : null;

  return (
    <AppShell title="Exams" subtitle="Build papers from your question bank">
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Exams" value={exams.length} />
            <Stat label="Questions assigned" value={examQuestions.length} />
            <Stat label="Approved bank" value={mcqs.length} />
          </div>

          {exams.length === 0 && (
            <Empty title="No exams yet" body="Create your first exam on the right, then attach the questions it covers." />
          )}

          {exams.map((exam) => {
            const assigned = examQuestions.filter((q) => q.exam_id === exam.id);
            const assignedIds = new Set(assigned.map((q) => q.mcq_id));
            const pool = matchingMcqs(exam);
            const days = daysTo(exam.exam_date);
            const open = openId === exam.id;
            return (
              <Panel key={exam.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold tracking-tight">{exam.name}</h2>
                    <p className="mt-0.5 font-mono text-[11px] text-faint">
                      {exam.exam_date ? new Date(`${exam.exam_date}T00:00:00`).toDateString() : "No date set"}
                      {days !== null && ` · ${days >= 0 ? `${days} day${days === 1 ? "" : "s"} to go` : "past"}`}
                    </p>
                    {exam.note && <p className="mt-2 text-sm text-muted">{exam.note}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone="accent">{assigned.length} questions</Tag>
                    <Btn variant="outline" onClick={() => setOpenId(open ? null : exam.id)}>
                      {open ? "Close" : "Manage questions"}
                    </Btn>
                    <Btn variant="danger" onClick={() => deleteExam.mutate(exam.id)}>
                      Delete
                    </Btn>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {exam.subject_ids.map((id) => (
                    <Tag key={id}>{subjects.find((s) => s.id === id)?.name ?? "subject"}</Tag>
                  ))}
                  {exam.chapter_ids.map((id) => (
                    <Tag key={id} tone="amber">
                      {chapters.find((c) => c.id === id)?.name ?? "chapter"}
                    </Tag>
                  ))}
                  {!exam.subject_ids.length && !exam.chapter_ids.length && <Tag>Whole syllabus</Tag>}
                </div>

                {open && (
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
                        {pool.length} matching question{pool.length === 1 ? "" : "s"}
                      </p>
                      <Btn variant="outline" onClick={() => addAllMatching.mutate(exam)}>
                        Add all matching
                      </Btn>
                    </div>
                    {pool.length === 0 ? (
                      <p className="mt-3 text-sm text-muted">
                        No approved questions match this exam's subjects and chapters yet.
                      </p>
                    ) : (
                      <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
                        {pool.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 px-3.5 py-3"
                          >
                            <input
                              type="checkbox"
                              checked={assignedIds.has(m.id)}
                              onChange={(e) =>
                                setQuestion.mutate({ exam, mcqId: m.id, add: e.target.checked })
                              }
                              className="mt-0.5 size-4 accent-[var(--accent)]"
                              aria-label="Include question in exam"
                            />
                            <div className="min-w-0">
                              <p className="text-sm">{m.question}</p>
                              <p className="mt-0.5 font-mono text-[11px] text-faint">
                                {chapters.find((c) => c.id === m.chapter_id)?.name ?? "unfiled"} · {m.difficulty}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>

        <Panel className="h-fit">
          <h2 className="text-lg font-semibold tracking-tight">New exam</h2>
          <div className="mt-4 space-y-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mock Test 3" />
            </Field>
            <Field label="Exam date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Note">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What this paper focuses on" />
            </Field>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Subjects</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSubjectIds((v) => toggle(v, s.id))}
                    className={
                      subjectIds.includes(s.id)
                        ? "rounded-full border border-accent/50 bg-accent/12 px-2.5 py-1 text-xs text-accent"
                        : "rounded-full border border-border-2 px-2.5 py-1 text-xs text-muted hover:bg-surface-2"
                    }
                  >
                    {s.name}
                  </button>
                ))}
                {!subjects.length && <p className="text-sm text-muted">Add subjects in the syllabus first.</p>}
              </div>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Chapters</p>
              <div className="mt-2 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
                {chapterOptions.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setChapterIds((v) => toggle(v, c.id))}
                    className={
                      chapterIds.includes(c.id)
                        ? "rounded-full border border-amber/50 bg-amber/12 px-2.5 py-1 text-xs text-amber"
                        : "rounded-full border border-border-2 px-2.5 py-1 text-xs text-muted hover:bg-surface-2"
                    }
                  >
                    {c.name}
                  </button>
                ))}
                {!chapterOptions.length && <p className="text-sm text-muted">No chapters yet.</p>}
              </div>
            </div>

            <Btn onClick={() => createExam.mutate()} disabled={createExam.isPending}>
              {createExam.isPending ? "Creating…" : "Create exam"}
            </Btn>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
