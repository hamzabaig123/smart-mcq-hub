import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Panel, Btn, Input, Select, Field, Tag } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import { useTheme, THEMES, type ThemeId } from "@/lib/theme";
import { profileQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { sendReminderNow } from "@/lib/reminders.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Oblique Study OS" },
      {
        name: "description",
        content:
          "Manage your account details, exam name, appearance theme and daily study reminder emails.",
      },
      { property: "og:title", content: "Settings — Oblique Study OS" },
      {
        property: "og:description",
        content: "Account, themes and daily reminder preferences for your study workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const { data: profile } = useQuery(profileQuery(user?.id));

  const [displayName, setDisplayName] = useState("");
  const [examName, setExamName] = useState("");
  const [reminder, setReminder] = useState(false);
  const [time, setTime] = useState("19:00");
  const [reminderEmail, setReminderEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setExamName(profile.exam_name ?? "");
    setReminder(profile.daily_reminder);
    setTime((profile.reminder_time ?? "19:00").slice(0, 5));
    setReminderEmail(profile.reminder_email ?? profile.email ?? "");
  }, [profile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        exam_name: examName.trim() || null,
        theme,
        daily_reminder: reminder,
        reminder_time: `${time}:00`,
        reminder_email: reminderEmail.trim() || null,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Settings saved");
  };

  const testEmail = async () => {
    setSending(true);
    try {
      await sendReminderNow({ data: {} });
      toast.success("Reminder sent — check your inbox.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the reminder.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell title="Settings" subtitle="Account, appearance and reminders">
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <h2 className="text-lg font-semibold tracking-tight">Account</h2>
          <p className="mt-1 text-sm text-muted">Signed in as {user?.email}</p>
          <div className="mt-4 space-y-3">
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
            </Field>
            <Field label="Exam you are preparing for">
              <Input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g. MDCAT 2026" />
            </Field>
            <div className="flex flex-wrap gap-2 pt-1">
              <Btn onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Btn>
              <Btn variant="danger" onClick={() => signOut()}>
                Sign out
              </Btn>
            </div>
          </div>
        </Panel>

        <Panel>
          <h2 className="text-lg font-semibold tracking-tight">Appearance</h2>
          <p className="mt-1 text-sm text-muted">Three hand-tuned themes. Applies instantly.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as ThemeId)}
                className={
                  theme === t.id
                    ? "rounded-xl border border-accent/50 bg-accent/10 px-3 py-3 text-left"
                    : "rounded-xl border border-border-2 px-3 py-3 text-left transition-colors hover:bg-surface-2"
                }
              >
                <p className="text-sm font-medium">{t.label}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{t.hint}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Daily reminder</h2>
              <p className="mt-1 text-sm text-muted">
                A short email each day nudging you to run a practice test.
              </p>
            </div>
            <Tag tone={reminder ? "accent" : "muted"}>{reminder ? "On" : "Off"}</Tag>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label="Reminders">
              <Select value={reminder ? "on" : "off"} onChange={(e) => setReminder(e.target.value === "on")}>
                <option value="off">Off</option>
                <option value="on">On</option>
              </Select>
            </Field>
            <Field label="Time of day">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Send to">
              <Input
                value={reminderEmail}
                onChange={(e) => setReminderEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Btn onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save reminder settings"}
            </Btn>
            <Btn variant="ghost" onClick={testEmail} disabled={sending}>
              {sending ? "Sending…" : "Send me one now"}
            </Btn>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
