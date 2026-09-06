import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Panel, Btn, Input, Select, Field, Textarea, Empty, Tag, Stat } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { subjectsQuery, chaptersQuery, mcqsQuery } from "@/lib/queries";
import { generateMcqs } from "@/lib/ai.functions";

export const Route = createFileRoute("/ai-studio")({
  head: () => ({
    meta: [
      { title: "AI Studio — Oblique Study OS" },
      {
        name: "description",
        content:
          "Turn a PDF, image or pasted notes into exam-ready MCQs, then approve or reject each one into a chapter.",
      },
      { property: "og:title", content: "AI Studio — Oblique Study OS" },
      {
        property: "og:description",
        content: "Generate multiple choice questions from your own study material and review them.",
      },
    ],
  }),
  component: AiStudio,
});

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });

function AiStudio() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [kind, setKind] = useState<"text" | "image" | "pdf">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [chapterId, setChapterId] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: subjects = [] } = useQuery({ ...subjectsQuery(), enabled: !!user });
  const { data: chapters = [] } = useQuery({ ...chaptersQuery(), enabled: !!user });
  const { data: pending = [] } = useQuery({ ...mcqsQuery({ status: "pending" }), enabled: !!user });

  const generate = async () => {
    if (!user) return;
    if (kind === "text" && text.trim().length < 40) {
      toast.error("Paste a little more material to work from.");
      return;
    }
    if (kind !== "text" && !file) {
      toast.error("Choose a file first.");
      return;
    }
    setBusy(true);
    try {
      const fileDataUrl = file ? await readAsDataUrl(file) : undefined;
      const result = await generateMcqs({
        data: {
          kind,
          count,
          ...(text.trim() ? { text: text.trim() } : {}),
          ...(topic.trim() ? { topic: topic.trim() } : {}),
          ...(fileDataUrl ? { fileDataUrl } : {}),
          ...(file ? { fileName: file.name } : {}),
        },
      });
      const subjectId = chapters.find((c) => c.id === chapterId)?.subject_id ?? null;
      const rows = result.mcqs.map((m) => ({
        user_id: user.id,
        chapter_id: chapterId || null,
        subject_id: subjectId,
        question: m.question,
        options: m.options,
        correct_index: m.correct_index,
        explanation: m.explanation || null,
        difficulty: m.difficulty,
        tags: m.tags,
        status: "pending",
        origin: "ai",
      }));
      const { error } = await supabase.from("mcqs").insert(rows);
      if (error) throw new Error(error.message);
      qc.invalidateQueries({ queryKey: ["mcqs"] });
      toast.success(`${rows.length} question(s) ready for review`);
      setText("");
      setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: string, status: "approved" | "rejected", target?: string) => {
    const subjectId = target ? (chapters.find((c) => c.id === target)?.subject_id ?? null) : null;
    const patch = target
      ? { status, chapter_id: target, subject_id: subjectId }
      : { status };
    const { error } = await supabase.from("mcqs").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["mcqs"] });
  };

  return (
    <AppShell
      title="AI Studio"
      subtitle="Material in, reviewed questions out"
      actions={<Tag tone="accent">{pending.length} pending</Tag>}
    >
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <h2 className="text-lg font-semibold tracking-tight">Generate</h2>
          <p className="mt-1 text-sm text-muted">
            Upload a PDF or image of your notes, or paste text directly.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {(["text", "image", "pdf"] as const).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k);
                  setFile(null);
                }}
                className={
                  kind === k
                    ? "rounded-xl border border-accent/50 bg-accent/10 px-3 py-2.5 text-sm font-medium capitalize"
                    : "rounded-xl border border-border-2 px-3 py-2.5 text-sm capitalize text-muted transition-colors hover:bg-surface-2"
                }
              >
                {k}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {kind === "text" ? (
              <Field label="Study material">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste your notes, a summary or a chapter extract…"
                  className="min-h-44"
                />
              </Field>
            ) : (
              <Field label={kind === "pdf" ? "PDF file" : "Image file"}>
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-border-2 px-3.5 py-6 text-sm text-muted transition-colors hover:bg-surface-2">
                  <span className="truncate">{file ? file.name : `Choose a ${kind} to upload`}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">Browse</span>
                  <input
                    type="file"
                    accept={kind === "pdf" ? "application/pdf" : "image/*"}
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </Field>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Topic hint (optional)">
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Enzyme kinetics" />
              </Field>
              <Field label="How many">
                <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
                  {[5, 8, 12, 16, 20].map((n) => (
                    <option key={n} value={n}>
                      {n} questions
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="File into chapter (optional)">
              <Select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                <option value="">Decide during review</option>
                {subjects.map((s) => (
                  <optgroup key={s.id} label={s.name}>
                    {chapters
                      .filter((c) => c.subject_id === s.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </Field>

            <Btn className="w-full" onClick={generate} disabled={busy}>
              {busy ? "Reading your material…" : "Generate questions"}
            </Btn>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Review queue</h2>
            <Stat label="Pending" value={pending.length} />
          </div>

          <div className="mt-4 space-y-3">
            {!pending.length && (
              <Empty
                title="Queue is clear"
                body="Everything you generated has been reviewed. Add new material to keep the bank growing."
              />
            )}

            {pending.map((m) => (
              <ReviewCard
                key={m.id}
                mcq={m}
                subjects={subjects}
                chapters={chapters}
                onDecide={decide}
              />
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function ReviewCard({
  mcq,
  subjects,
  chapters,
  onDecide,
}: {
  mcq: {
    id: string;
    question: string;
    options: string[];
    correct_index: number;
    explanation: string | null;
    difficulty: string;
    tags: string[];
    chapter_id: string | null;
  };
  subjects: { id: string; name: string }[];
  chapters: { id: string; name: string; subject_id: string }[];
  onDecide: (id: string, status: "approved" | "rejected", target?: string) => void;
}) {
  const [target, setTarget] = useState(mcq.chapter_id ?? "");

  return (
    <div className="rounded-xl border border-border bg-surface-2/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="amber">{mcq.difficulty}</Tag>
        {mcq.tags.slice(0, 3).map((t) => (
          <Tag key={t}>{t}</Tag>
        ))}
      </div>
      <p className="mt-2.5 text-sm font-medium leading-relaxed">{mcq.question}</p>
      <ul className="mt-2.5 space-y-1 text-sm">
        {mcq.options.map((o, i) => (
          <li
            key={i}
            className={i === mcq.correct_index ? "font-medium text-accent" : "text-muted"}
          >
            <span className="font-mono text-xs text-faint">{String.fromCharCode(65 + i)} </span>
            {o}
          </li>
        ))}
      </ul>
      {mcq.explanation && <p className="mt-2 text-xs text-faint">{mcq.explanation}</p>}

      <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="sm:flex-1">
          <option value="">Unfiled</option>
          {subjects.map((s) => (
            <optgroup key={s.id} label={s.name}>
              {chapters
                .filter((c) => c.subject_id === s.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
        <div className="flex gap-2">
          <Btn onClick={() => onDecide(mcq.id, "approved", target || undefined)}>Approve</Btn>
          <Btn variant="danger" onClick={() => onDecide(mcq.id, "rejected")}>
            Reject
          </Btn>
        </div>
      </div>
    </div>
  );
}
