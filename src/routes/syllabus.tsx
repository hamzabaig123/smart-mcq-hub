import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Panel, Btn, Input, Textarea, Select, Field, Empty, Tag } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  subjectsQuery,
  chaptersQuery,
  sourcesQuery,
  mcqsQuery,
  SUBJECT_COLORS,
  colorClass,
} from "@/lib/queries";

export const Route = createFileRoute("/syllabus")({
  head: () => ({
    meta: [
      { title: "Syllabus — Oblique Study OS" },
      {
        name: "description",
        content:
          "Organise subjects, chapters, sources and tags, and curate the MCQ bank behind every chapter.",
      },
      { property: "og:title", content: "Syllabus — Oblique Study OS" },
      {
        property: "og:description",
        content: "Add, edit and remove subjects, chapters and study sources in one structured workspace.",
      },
    ],
  }),
  component: Syllabus,
});

function Syllabus() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);

  const { data: subjects = [] } = useQuery({ ...subjectsQuery(), enabled: !!user });
  const { data: chapters = [] } = useQuery({ ...chaptersQuery(), enabled: !!user });
  const { data: sources = [] } = useQuery({ ...sourcesQuery(), enabled: !!user });
  const { data: mcqs = [] } = useQuery({ ...mcqsQuery(), enabled: !!user });

  const activeSubject = subjects.find((s) => s.id === subjectId) ?? subjects[0] ?? null;
  const subjectChapters = useMemo(
    () => chapters.filter((c) => c.subject_id === activeSubject?.id),
    [chapters, activeSubject],
  );
  const activeChapter =
    subjectChapters.find((c) => c.id === chapterId) ?? subjectChapters[0] ?? null;
  const chapterSources = sources.filter((s) => s.chapter_id === activeChapter?.id);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["subjects"] });
    qc.invalidateQueries({ queryKey: ["chapters"] });
    qc.invalidateQueries({ queryKey: ["sources"] });
    qc.invalidateQueries({ queryKey: ["mcqs"] });
  };

  const run = useMutation({
    mutationFn: async (fn: () => Promise<{ error: { message: string } | null }>) => {
      const { error } = await fn();
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  /* ----- forms ----- */
  const [sName, setSName] = useState("");
  const [sColor, setSColor] = useState<string>("accent");
  const [cName, setCName] = useState("");
  const [srcTitle, setSrcTitle] = useState("");
  const [srcKind, setSrcKind] = useState("book");
  const [srcRef, setSrcRef] = useState("");
  const [srcTags, setSrcTags] = useState("");

  const addSubject = () => {
    if (!sName.trim() || !user) return;
    run.mutate(
      () =>
        supabase.from("subjects").insert({
          user_id: user.id,
          name: sName.trim(),
          color: sColor,
          position: subjects.length,
        }) as never,
      { onSuccess: () => { setSName(""); refresh(); toast.success("Subject added"); } },
    );
  };

  const addChapter = () => {
    if (!cName.trim() || !user || !activeSubject) return;
    run.mutate(
      () =>
        supabase.from("chapters").insert({
          user_id: user.id,
          subject_id: activeSubject.id,
          name: cName.trim(),
          position: subjectChapters.length,
        }) as never,
      { onSuccess: () => { setCName(""); refresh(); toast.success("Chapter added"); } },
    );
  };

  const addSource = () => {
    if (!srcTitle.trim() || !user || !activeChapter) return;
    run.mutate(
      () =>
        supabase.from("sources").insert({
          user_id: user.id,
          chapter_id: activeChapter.id,
          title: srcTitle.trim(),
          kind: srcKind,
          reference: srcRef.trim() || null,
          tags: srcTags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
        }) as never,
      {
        onSuccess: () => {
          setSrcTitle("");
          setSrcRef("");
          setSrcTags("");
          refresh();
          toast.success("Source added");
        },
      },
    );
  };

  const rename = (table: "subjects" | "chapters" | "sources", id: string, current: string) => {
    const next = window.prompt("New name", current);
    if (!next || next === current) return;
    const field = table === "sources" ? "title" : "name";
    const patch = { [field]: next } as Record<string, string>;
    run.mutate(() => (supabase.from(table) as never as { update: (v: unknown) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> } }).update(patch).eq("id", id), {
      onSuccess: () => { refresh(); toast.success("Renamed"); },
    });
  };

  const remove = (table: "subjects" | "chapters" | "sources", id: string, label: string) => {
    if (!window.confirm(`Delete "${label}"? Everything nested under it is removed too.`)) return;
    run.mutate(() => supabase.from(table).delete().eq("id", id) as never, {
      onSuccess: () => {
        if (table === "subjects" && id === activeSubject?.id) setSubjectId(null);
        if (table === "chapters" && id === activeChapter?.id) setChapterId(null);
        refresh();
        toast.success("Deleted");
      },
    });
  };

  return (
    <AppShell title="Syllabus" subtitle="Subjects → chapters → sources → questions">
      <div className="grid gap-5 xl:grid-cols-[280px_300px_1fr]">
        {/* Subjects */}
        <Panel className="h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Subjects</h2>
            <span className="font-mono text-[10px] text-faint">{subjects.length}</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {subjects.map((s) => {
              const active = s.id === activeSubject?.id;
              return (
                <li key={s.id}>
                  <div
                    className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors ${
                      active ? "bg-surface-2/70 ring-1 ring-border-2" : "hover:bg-surface-2/40"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSubjectId(s.id);
                        setChapterId(null);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span className={`size-2 shrink-0 rounded-full ${colorClass(s.color)}`} />
                      <span className="truncate text-sm">{s.name}</span>
                    </button>
                    <span className="font-mono text-[10px] text-faint">
                      {chapters.filter((c) => c.subject_id === s.id).length}
                    </span>
                    <button
                      onClick={() => rename("subjects", s.id, s.name)}
                      className="text-xs text-faint opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    >
                      edit
                    </button>
                    <button
                      onClick={() => remove("subjects", s.id, s.name)}
                      className="text-xs text-faint opacity-0 transition-opacity hover:text-rose group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <Input
              value={sName}
              onChange={(e) => setSName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSubject()}
              placeholder="New subject name"
            />
            <div className="flex gap-2">
              <Select value={sColor} onChange={(e) => setSColor(e.target.value)}>
                {SUBJECT_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Btn onClick={addSubject} className="shrink-0">
                Add
              </Btn>
            </div>
          </div>
        </Panel>

        {/* Chapters */}
        <Panel className="h-fit">
          <h2 className="text-sm font-semibold tracking-tight">
            Chapters {activeSubject && <span className="text-faint">· {activeSubject.name}</span>}
          </h2>
          {!activeSubject ? (
            <p className="mt-3 text-sm text-muted">Create a subject first.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-1.5">
                {subjectChapters.map((c) => {
                  const active = c.id === activeChapter?.id;
                  return (
                    <li key={c.id}>
                      <div
                        className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                          active ? "bg-surface-2/70 ring-1 ring-border-2" : "hover:bg-surface-2/40"
                        }`}
                      >
                        <button
                          onClick={() => setChapterId(c.id)}
                          className="min-w-0 flex-1 truncate text-left text-sm"
                        >
                          {c.name}
                        </button>
                        <span className="font-mono text-[10px] text-faint">
                          {mcqs.filter((m) => m.chapter_id === c.id).length}
                        </span>
                        <button
                          onClick={() => rename("chapters", c.id, c.name)}
                          className="text-xs text-faint opacity-0 hover:text-foreground group-hover:opacity-100"
                        >
                          edit
                        </button>
                        <button
                          onClick={() => remove("chapters", c.id, c.name)}
                          className="text-xs text-faint opacity-0 hover:text-rose group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
                {subjectChapters.length === 0 && (
                  <li className="px-1 py-2 text-sm text-muted">No chapters yet.</li>
                )}
              </ul>
              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                <Input
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addChapter()}
                  placeholder="New chapter"
                />
                <Btn onClick={addChapter} className="shrink-0">
                  Add
                </Btn>
              </div>
            </>
          )}
        </Panel>

        {/* Sources + questions */}
        <div className="space-y-5">
          <Panel>
            <h2 className="text-sm font-semibold tracking-tight">
              Sources {activeChapter && <span className="text-faint">· {activeChapter.name}</span>}
            </h2>
            {!activeChapter ? (
              <p className="mt-3 text-sm text-muted">Pick a chapter to manage its sources.</p>
            ) : (
              <>
                {chapterSources.length === 0 ? (
                  <div className="mt-3">
                    <Empty title="No sources" body="Add the books, notes or lectures this chapter draws from." />
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {chapterSources.map((s) => (
                      <li
                        key={s.id}
                        className="group flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2.5"
                      >
                        <Tag tone="accent">{s.kind}</Tag>
                        <span className="text-sm font-medium">{s.title}</span>
                        {s.reference && <span className="font-mono text-[11px] text-faint">{s.reference}</span>}
                        {s.tags.map((t) => (
                          <Tag key={t}>#{t}</Tag>
                        ))}
                        <span className="ml-auto flex gap-2">
                          <button
                            onClick={() => rename("sources", s.id, s.title)}
                            className="text-xs text-faint hover:text-foreground"
                          >
                            edit
                          </button>
                          <button
                            onClick={() => remove("sources", s.id, s.title)}
                            className="text-xs text-faint hover:text-rose"
                          >
                            delete
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                  <Field label="Title">
                    <Input value={srcTitle} onChange={(e) => setSrcTitle(e.target.value)} placeholder="Chapter 4 — Kinematics" />
                  </Field>
                  <Field label="Kind">
                    <Select value={srcKind} onChange={(e) => setSrcKind(e.target.value)}>
                      {["book", "notes", "lecture", "paper", "video", "other"].map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Reference">
                    <Input value={srcRef} onChange={(e) => setSrcRef(e.target.value)} placeholder="pp. 88–120" />
                  </Field>
                  <Field label="Tags (comma separated)">
                    <Input value={srcTags} onChange={(e) => setSrcTags(e.target.value)} placeholder="motion, graphs" />
                  </Field>
                  <div className="sm:col-span-2">
                    <Btn onClick={addSource}>Add source</Btn>
                  </div>
                </div>
              </>
            )}
          </Panel>

          {activeChapter && (
            <ChapterQuestions chapterId={activeChapter.id} subjectName={activeSubject?.name ?? ""} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ChapterQuestions({ chapterId, subjectName }: { chapterId: string; subjectName: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: mcqs = [] } = useQuery(mcqsQuery({ chapterId }));
  const { data: sources = [] } = useQuery(sourcesQuery([chapterId]));
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [tags, setTags] = useState("");
  const [sourceId, setSourceId] = useState("");

  const { data: chapters = [] } = useQuery(chaptersQuery());
  const subjectId = chapters.find((c) => c.id === chapterId)?.subject_id ?? null;

  const save = async () => {
    if (!user || !question.trim() || options.filter((o) => o.trim()).length < 2) {
      toast.error("Add a question and at least two options.");
      return;
    }
    const { error } = await supabase.from("mcqs").insert({
      user_id: user.id,
      chapter_id: chapterId,
      subject_id: subjectId,
      source_id: sourceId || null,
      question: question.trim(),
      options: options.filter((o) => o.trim()),
      correct_index: correct,
      explanation: explanation.trim() || null,
      difficulty,
      status: "approved",
      origin: "manual",
      tags: tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Question added");
    setQuestion("");
    setOptions(["", "", "", ""]);
    setExplanation("");
    setTags("");
    setCorrect(0);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["mcqs"] });
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("mcqs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["mcqs"] });
  };

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">
          Questions <span className="text-faint">· {mcqs.length}</span>
        </h2>
        <Btn variant={open ? "ghost" : "outline"} onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Add MCQ"}
        </Btn>
      </div>

      {open && (
        <div className="mt-4 space-y-3 rounded-xl border border-border-2 bg-surface-2/40 p-4">
          <Field label={`Question (${subjectName})`}>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Write the question stem…" />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => setCorrect(i)}
                  aria-label={`Mark option ${i + 1} correct`}
                  className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-[11px] transition-colors ${
                    correct === i ? "bg-accent text-accent-foreground" : "bg-surface-3 text-muted"
                  }`}
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <Input
                  value={o}
                  onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Difficulty">
              <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                {["easy", "medium", "hard"].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Source">
              <Select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                <option value="">None</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tags">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="formula, recall" />
            </Field>
          </div>
          <Field label="Explanation">
            <Input value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Why is this the answer?" />
          </Field>
          <Btn onClick={save}>Save question</Btn>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {mcqs.map((m) => (
          <li key={m.id} className="rounded-lg border border-border bg-surface/50 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={m.status === "approved" ? "accent" : m.status === "pending" ? "amber" : "rose"}>
                {m.status}
              </Tag>
              <Tag>{m.difficulty}</Tag>
              <p className="min-w-0 flex-1 text-sm">{m.question}</p>
              <button onClick={() => del(m.id)} className="text-xs text-faint hover:text-rose">
                delete
              </button>
            </div>
            <p className="mt-1 font-mono text-[11px] text-faint">
              Answer: {m.options[m.correct_index] ?? "—"}
            </p>
          </li>
        ))}
        {mcqs.length === 0 && <li className="text-sm text-muted">No questions in this chapter yet.</li>}
      </ul>
    </Panel>
  );
}
