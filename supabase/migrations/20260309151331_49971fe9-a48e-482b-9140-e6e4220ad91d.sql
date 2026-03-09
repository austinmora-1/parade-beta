
DROP FUNCTION public.get_profile_by_share_code(text);

CREATE OR REPLACE FUNCTION public.get_profile_by_share_code(p_share_code text)
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text, current_vibe text, custom_vibe_tags text[], location_status text, show_availability boolean, show_vibe_status boolean, show_location boolean, allow_all_hang_requests boolean, allowed_hang_request_friend_ids uuid[], default_work_days text[], default_work_start_hour numeric, default_work_end_hour numeric, default_availability_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.user_id,
    p.display_name,
    p.avatar_url,
    p.current_vibe,
    p.custom_vibe_tags,
    p.location_status,
    p.show_availability,
    p.show_vibe_status,
    p.show_location,
    p.allow_all_hang_requests,
    p.allowed_hang_request_friend_ids,
    p.default_work_days,
    p.default_work_start_hour,
    p.default_work_end_hour,
    p.default_availability_status
  FROM public.profiles p
  WHERE p.share_code = p_share_code
    AND p.show_availability = true
  LIMIT 1;
$function$;
