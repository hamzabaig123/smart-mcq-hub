import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Called hourly by the scheduler. Sends the daily reminder to every user whose
 * reminder hour matches the current UTC hour and who has not been sent one today.
 */
export const Route = createFileRoute("/api/public/daily-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendGmail, reminderEmail } = await import("@/lib/gmail.server");
        const { reminderStats } = await import("@/lib/reminder-stats.server");

        const hour = new Date().getUTCHours();

        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select("id, email, display_name, exam_name, reminder_email, reminder_time, daily_reminder")
          .eq("daily_reminder", true);
        if (error) return new Response(error.message, { status: 500 });

        const due = (profiles ?? []).filter(
          (p) => Number((p.reminder_time ?? "08:00:00").slice(0, 2)) === hour,
        );

        let sent = 0;
        const failures: string[] = [];
        for (const p of due) {
          const to = p.reminder_email ?? p.email;
          if (!to) continue;
          try {
            const stats = await reminderStats(supabaseAdmin as never, p.id);
            const { subject, html } = reminderEmail({
              name: p.display_name,
              examName: p.exam_name,
              ...stats,
            });
            await sendGmail(to, subject, html);
            sent += 1;
          } catch (e) {
            failures.push(`${p.id}: ${e instanceof Error ? e.message : "unknown error"}`);
          }
        }

        return Response.json({ hour, due: due.length, sent, failures });
      },
    },
  },
});
