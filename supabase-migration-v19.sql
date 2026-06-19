-- v19: Trial countdown notifications (3 days, 1 day, expired) + payment receipts.
-- Adds a daily job that inserts "trial_ending" / "trial_expiring_today" notifications
-- and a helper to insert a receipt notification on wallet topup / booking payment.

-- ---------- Trial countdown notifier ----------
create or replace function public.notify_trial_countdown()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r record;
  v_days int;
  v_kind text;
  v_title text;
begin
  for r in
    select c.id, c.slug, c.name, c.owner_id, c.trial_ends_at
    from public.cafes c
    where c.subscription_status = 'trialing'
      and c.trial_ends_at is not null
      and c.trial_ends_at > now()
      and c.trial_ends_at <= now() + interval '3 days'
  loop
    v_days := greatest(0, ceil(extract(epoch from (r.trial_ends_at - now())) / 86400)::int);
    v_kind := case when v_days <= 1 then 'trial_expiring_today' else 'trial_ending_soon' end;
    v_title := case
      when v_days <= 1 then 'Trial ends today — upgrade ' || r.name
      else 'Trial ends in ' || v_days || ' days — ' || r.name
    end;

    -- dedupe: skip if already sent today for this cafe + kind
    if not exists (
      select 1 from public.notifications
      where cafe_id = r.id and kind = v_kind and created_at::date = current_date
    ) then
      insert into public.notifications (user_id, cafe_id, kind, title, body, link)
      values (
        r.owner_id, r.id, v_kind, v_title,
        'Add a payment method to keep your café active without interruption.',
        '/cafe/' || r.slug || '/support'
      );
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.notify_trial_countdown() to service_role;

-- Schedule daily 07:00 UTC (run BEFORE expire_lapsed_trials at 08:00)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job where jobname = 'notify-trial-countdown';
    perform cron.schedule(
      'notify-trial-countdown',
      '0 7 * * *',
      $cmd$ select public.notify_trial_countdown(); $cmd$
    );
  end if;
end$$;

-- ---------- Receipt helper (callable from app on successful payment) ----------
create or replace function public.insert_payment_receipt(
  _user_id uuid,
  _cafe_id uuid,
  _amount int,
  _kind text,            -- 'topup' | 'booking'
  _reference text        -- razorpay payment id
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  select slug into v_slug from public.cafes where id = _cafe_id;
  insert into public.notifications (user_id, cafe_id, kind, title, body, link)
  values (
    _user_id, _cafe_id, 'payment_receipt',
    'Receipt — ₹' || _amount || ' ' || _kind,
    'Payment ' || _reference || ' confirmed. Tap to view ledger.',
    '/cafe/' || coalesce(v_slug, '') || '/ledger'
  );
end;
$$;

grant execute on function public.insert_payment_receipt(uuid, uuid, int, text, text) to authenticated, service_role;
