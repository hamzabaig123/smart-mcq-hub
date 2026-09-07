/** Server-only: computes the numbers shown in the daily reminder email. */

type AnyClient = {
  from: (table: string) => any;
};

export async function reminderStats(client: AnyClient, userId: string) {
  const [{ data: mcqs }, { data: attempts }] = await Promise.all([
    client.from("mcqs").select("id").eq("user_id", userId).eq("status", "approved"),
    client.from("attempts").select("mcq_id,is_correct,created_at").eq("user_id", userId).limit(2000),
  ]);

  const bank = (mcqs ?? []).length;
  const attempted = new Set((attempts ?? []).map((a: { mcq_id: string }) => a.mcq_id));
  const remaining = (mcqs ?? []).filter((m: { id: string }) => !attempted.has(m.id)).length;

  const total = (attempts ?? []).length;
  const correct = (attempts ?? []).filter((a: { is_correct: boolean }) => a.is_correct).length;
  const accuracy = total ? Math.round((correct / total) * 100) : null;

  const days = new Set(
    (attempts ?? []).map((a: { created_at: string }) => new Date(a.created_at).toISOString().slice(0, 10)),
  );
  let streak = 0;
  const cursor = new Date();
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { bank, remaining, accuracy, streak };
}
