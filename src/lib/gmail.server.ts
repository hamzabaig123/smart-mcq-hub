/** Server-only Gmail helpers. Never import from client components. */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

const b64 = (s: string) =>
  btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));

const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);

function rawEmail(to: string, subject: string, html: string) {
  const message = [
    `To: ${to}`,
    `Subject: ${header(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");
  return b64(message).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendGmail(to: string, subject: string, html: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Gmail is not connected for this project yet.");
  }

  const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: rawEmail(to, subject, html) }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[gmail] send failed [${res.status}]: ${body}`);
    throw new Error(`Gmail send failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as { id?: string };
}

export function reminderEmail(input: {
  name?: string | null;
  examName?: string | null;
  remaining: number;
  bank: number;
  accuracy: number | null;
  streak: number;
}) {
  const exam = input.examName?.trim() || "your exam";
  const subject = `Daily practice reminder — ${exam}`;
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi there,";
  const line =
    input.remaining > 0
      ? `You still have <strong>${input.remaining}</strong> unattempted question${
          input.remaining === 1 ? "" : "s"
        } waiting in your bank of ${input.bank}.`
      : `You have practised every one of your ${input.bank} questions — time for a timed re-test to lock it in.`;

  const html = `<!doctype html>
<html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111827">
  <div style="max-width:560px;margin:0 auto;padding:28px 24px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#6b7280">Oblique Study OS</p>
    <h1 style="margin:0 0 16px;font-size:22px">Time for today's test</h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${greeting}</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6">This is your daily nudge for <strong>${exam}</strong>. ${line}</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      <tr>
        <td style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px">Remaining questions<br><strong style="font-size:20px">${input.remaining}</strong></td>
        <td style="width:10px"></td>
        <td style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px">Accuracy<br><strong style="font-size:20px">${
          input.accuracy === null ? "—" : `${input.accuracy}%`
        }</strong></td>
        <td style="width:10px"></td>
        <td style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px">Streak<br><strong style="font-size:20px">${input.streak}d</strong></td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563">Open the app and run a short timed test — 20 questions is enough to keep the streak alive.</p>
  </div>
</body></html>`;

  return { subject, html };
}
