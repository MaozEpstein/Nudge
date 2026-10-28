-- מריץ את פונקציית התזכורות כל דקה. הרץ ב-SQL Editor אחרי פריסת הפונקציה.
-- החלף את YOUR-PROJECT-REF ואת YOUR-CRON-SECRET (אותו ערך שהגדרת כ-CRON_SECRET).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'nudge-send-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET'),
    body := '{}'::jsonb
  );
  $$
);

-- להסרה: select cron.unschedule('nudge-send-reminders');
