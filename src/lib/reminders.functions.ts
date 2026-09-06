import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sends the daily study reminder to the signed-in user.
 * Email delivery runs through the user's connected Gmail account; until that
 * connection exists we fail loudly instead of pretending an email was sent.
 */
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

    const clientKey = process.env['GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientKey) {
      throw new Error("Gmail is not connected yet, so reminder emails cannot be sent.");
    }

    throw new Error("Gmail is connected but this account has not authorised sending yet.");
  });
