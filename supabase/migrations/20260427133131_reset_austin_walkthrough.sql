update public.profiles
set walkthrough_completed = false
where first_name ilike 'austin' or display_name ilike 'austin%';
