-- A player sets their own headshot. The file itself goes to the private "media" bucket
-- under {org_id}/profiles/ (storage policy in the previous migration); this records the
-- path on the member row, which players cannot write directly.

create or replace function public.set_profile_photo(p_registration uuid, p_path text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reg public.registrations := public.my_open_registration(p_registration);
  v_path text := nullif(trim(coalesce(p_path, '')), '');
begin
  -- only inside this org's profiles folder, and only this player's own file
  if v_path is not null and v_path not like v_reg.org_id::text || '/profiles/%' then
    raise exception 'that is not a profile photo path';
  end if;

  update public.members set photo_path = v_path where id = v_reg.member_id;
end;
$$;

revoke execute on function public.set_profile_photo(uuid, text) from public, anon, authenticated;
grant execute on function public.set_profile_photo(uuid, text) to authenticated;
