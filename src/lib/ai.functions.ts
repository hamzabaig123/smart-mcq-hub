import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GeneratedMcq = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correct_index: z.number().int().min(0),
  explanation: z.string().optional().default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).optional().default("medium"),
  tags: z.array(z.string()).optional().default([]),
});

export type GeneratedMcq = z.infer<typeof GeneratedMcq>;

const Input = z.object({
  kind: z.enum(["text", "image", "pdf"]),
  text: z.string().optional(),
  fileDataUrl: z.string().optional(),
  fileName: z.string().optional(),
  count: z.number().int().min(1).max(20).default(8),
  topic: z.string().optional(),
});

const SYSTEM = `You are an exam-question author. Convert the supplied study material into high quality multiple choice questions.
Rules:
- Each question must be answerable from the material.
- Exactly one correct option. 4 options unless the material demands otherwise.
- Vary difficulty. Add a one-sentence explanation for the correct answer.
- Add 1-3 short lowercase topic tags per question.
Return ONLY JSON of the form {"mcqs":[{"question":"","options":["",""],"correct_index":0,"explanation":"","difficulty":"medium","tags":[""]}]}`;

export const generateMcqs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project yet.");

    const userContent: Record<string, unknown>[] = [
      {
        type: "text",
        text: `Create ${data.count} MCQs${data.topic ? ` about "${data.topic}"` : ""} from this material.${
          data.kind === "text" ? `\n\nMATERIAL:\n${(data.text ?? "").slice(0, 60000)}` : ""
        }`,
      },
    ];

    if (data.kind !== "text") {
      if (!data.fileDataUrl) throw new Error("No file was provided.");
      if (data.kind === "image") {
        userContent.push({ type: "image_url", image_url: { url: data.fileDataUrl } });
      } else {
        userContent.push({
          type: "file",
          file: { filename: data.fileName ?? "document.pdf", file_data: data.fileDataUrl },
        });
      }
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI rate limit reached — try again in a minute.");
      if (res.status === 402)
        throw new Error("AI credits are exhausted for this workspace. Add credits in Lovable to continue.");
      throw new Error(`AI request failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { mcqs: [] };
    }

    const list = (parsed as { mcqs?: unknown[] }).mcqs ?? [];
    const mcqs = list
      .map((item) => GeneratedMcq.safeParse(item))
      .filter((r): r is { success: true; data: GeneratedMcq } => r.success)
      .map((r) => r.data)
      .filter((m) => m.correct_index < m.options.length);

    if (!mcqs.length) throw new Error("The AI could not extract questions from that material.");
    return { mcqs };
  });
