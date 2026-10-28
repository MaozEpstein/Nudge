// Supabase Edge Function: sends Web Push for due reminders. Runs every minute via pg_cron (see supabase/push-cron.sql).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

Deno.serve(async req => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('unauthorized', { status: 401 })
  }

  const { data: due, error } = await supabase
    .from('tasks')
    .select('id,title,user_id')
    .eq('done', false)
    .is('reminded_at', null)
    .not('remind_at', 'is', null)
    .lte('remind_at', new Date().toISOString())
    .limit(200)
  if (error) return new Response(error.message, { status: 500 })
  if (!due?.length) return Response.json({ sent: 0 })

  const userIds = [...new Set(due.map(t => t.user_id))]
  const { data: subs } = await supabase.from('push_subscriptions').select('*').in('user_id', userIds)

  let sent = 0
  for (const task of due) {
    const payload = JSON.stringify({ title: 'תזכורת – Nudge', body: task.title, taskId: task.id })
    for (const sub of (subs ?? []).filter(s => s.user_id === task.user_id)) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
        sent++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        // subscription expired or unsubscribed
        if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
    await supabase.from('tasks').update({ reminded_at: new Date().toISOString() }).eq('id', task.id)
  }
  return Response.json({ sent, tasks: due.length })
})
