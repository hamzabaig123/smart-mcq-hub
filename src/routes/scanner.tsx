import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Panel, Btn, Select, Field, Textarea, Empty, Tag } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { subjectsQuery, chaptersQuery } from "@/lib/queries";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "QR Scanner — Oblique Study OS" },
      {
        name: "description",
        content:
          "Scan a QR code with your camera or an image to import shared MCQ sets straight into a chapter.",
      },
      { property: "og:title", content: "QR Scanner — Oblique Study OS" },
      {
        property: "og:description",
        content: "Import question sets or study links by scanning a QR code.",
      },
    ],
  }),
  component: Scanner,
});

type Parsed = {
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
  difficulty?: string;
  tags?: string[];
};

function parsePayload(raw: string): Parsed[] | null {
  try {
    const data = JSON.parse(raw) as unknown;
    const list = Array.isArray(data)
      ? data
      : ((data as { mcqs?: unknown[] }).mcqs ?? [data]);
    const out = (list as Parsed[]).filter(
      (m) => m && typeof m.question === "string" && Array.isArray(m.options) && m.options.length >= 2,
    );
    return out.length ? out : null;
  } catch {
    return null;
  }
}

function Scanner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [raw, setRaw] = useState("");
  const [chapterId, setChapterId] = useState("");

  const { data: subjects = [] } = useQuery({ ...subjectsQuery(), enabled: !!user });
  const { data: chapters = [] } = useQuery({ ...chaptersQuery(), enabled: !!user });

  const stop = () => {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    try {
      const QrScanner = (await import("qr-scanner")).default;
      if (!videoRef.current) return;
      const instance = new QrScanner(
        videoRef.current,
        (result: { data: string }) => {
          setRaw(result.data);
          toast.success("QR code captured");
          stop();
        },
        { highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 },
      );
      scannerRef.current = instance as unknown as { stop: () => void; destroy: () => void };
      await instance.start();
      setScanning(true);
    } catch {
      toast.error("Camera unavailable — allow access or scan an image instead.");
    }
  };

  const scanImage = async (file: File) => {
    try {
      const QrScanner = (await import("qr-scanner")).default;
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      setRaw(result.data);
      toast.success("QR code read from image");
    } catch {
      toast.error("No QR code found in that image.");
    }
  };

  const parsed = raw ? parsePayload(raw) : null;
  const isUrl = /^https?:\/\//i.test(raw.trim());

  const importSet = async () => {
    if (!user || !parsed) return;
    if (!chapterId) {
      toast.error("Pick a chapter to import into.");
      return;
    }
    const subjectId = chapters.find((c) => c.id === chapterId)?.subject_id ?? null;
    const rows = parsed.map((m) => ({
      user_id: user.id,
      chapter_id: chapterId,
      subject_id: subjectId,
      question: m.question,
      options: m.options,
      correct_index: Math.min(m.correct_index ?? 0, m.options.length - 1),
      explanation: m.explanation ?? null,
      difficulty: m.difficulty ?? "medium",
      tags: m.tags ?? [],
      status: "pending",
      origin: "qr",
    }));
    const { error } = await supabase.from("mcqs").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["mcqs"] });
    toast.success(`${rows.length} question(s) queued for review in AI Studio`);
    setRaw("");
  };

  return (
    <AppShell title="QR Scanner" subtitle="Import shared question sets in seconds">
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <h2 className="text-lg font-semibold tracking-tight">Camera</h2>
          <p className="mt-1 text-sm text-muted">
            Point at a QR code holding MCQ JSON, or upload a photo of one.
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-border-2 bg-surface-2/40">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {scanning ? (
              <Btn variant="danger" onClick={stop}>
                Stop camera
              </Btn>
            ) : (
              <Btn onClick={start}>Start camera</Btn>
            )}
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-border-2 px-3.5 py-2 text-sm font-medium transition-colors hover:bg-surface-2">
              Scan an image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void scanImage(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold tracking-tight">Payload</h2>
          <p className="mt-1 text-sm text-muted">
            Paste or edit the scanned content before importing.
          </p>

          <div className="mt-4 space-y-3">
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder='{"mcqs":[{"question":"…","options":["A","B"],"correct_index":0}]}'
              className="min-h-40 font-mono text-xs"
            />

            {!raw && (
              <Empty title="Nothing scanned yet" body="Scan a code or paste JSON to preview what will be imported." />
            )}

            {raw && isUrl && (
              <div className="rounded-xl border border-border p-3.5 text-sm">
                <Tag tone="amber">link</Tag>
                <p className="mt-2 break-all text-muted">{raw}</p>
                <a
                  href={raw}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-block text-sm font-medium text-accent"
                >
                  Open link →
                </a>
              </div>
            )}

            {raw && parsed && (
              <>
                <Field label="Import into chapter">
                  <Select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                    <option value="">Choose a chapter…</option>
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
                <p className="text-sm text-muted">
                  {parsed.length} question(s) detected — they land in the review queue as pending.
                </p>
                <Btn onClick={importSet} className="w-full">
                  Import {parsed.length} question(s)
                </Btn>
              </>
            )}

            {raw && !parsed && !isUrl && (
              <p className="text-sm text-rose">That content isn&apos;t a valid question set.</p>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
