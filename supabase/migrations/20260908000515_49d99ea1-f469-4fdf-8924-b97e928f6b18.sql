create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
select vault.create_secret('6bef0f1f13a50eb96a4aed2ef4ce43e35e1fbcbd62f80ac0', 'reminder_cron_token', 'token for daily reminder endpoint');
select cron.schedule(
  'daily-study-reminders',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://project--569f537a-694e-4448-912a-5b00e5812bc2.lovable.app/api/public/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_token')
    ),
    body := '{}'::jsonb
  );
  $$
);