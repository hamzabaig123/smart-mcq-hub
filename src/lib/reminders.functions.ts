import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends the daily study reminder to the signed-in user through the connected Gmail account. */
export const sendReminderNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => (input ?? {}) as Record<string, never>)
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("reminder_email, email, display_name, exam_name")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const to = profile?.reminder_email ?? profile?.email;
    if (!to) throw new Error("Add an email address for reminders first.");

    const { sendGmail, reminderEmail } = await import("./gmail.server");
    const { reminderStats } = await import("./reminder-stats.server");
    const stats = await reminderStats(supabase as never, userId);
    const { subject, html } = reminderEmail({
      name: profile?.display_name ?? null,
      examName: profile?.exam_name ?? null,
      ...stats,
    });

    await sendGmail(to, subject, html);
    return { sent: true, to };
  });
