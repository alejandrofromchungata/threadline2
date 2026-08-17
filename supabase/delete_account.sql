-- Account deletion.
--
-- The App Store requires that an app offering account creation also offers
-- account deletion from inside the app.
--
-- Deleting a row from auth.users normally needs the service-role key, which
-- must never ship inside a client — anyone extracting it could delete any
-- account. Instead this runs as a security-definer function: it executes with
-- the definer's rights but can only ever act on auth.uid(), the caller's own
-- id, which the client cannot forge because it is derived from the signed JWT.
--
-- Every wardrobe table references auth.users with `on delete cascade`, so one
-- delete removes the profile, items, wear log, feedback, saved outfits and
-- settings with it. Nothing is left orphaned holding personal data.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
