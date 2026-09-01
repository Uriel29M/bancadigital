-- Guria has no faction; her avatar uses the white staff-style border in the frontend.
update public.profiles
set faction_id = null, title = 'Guia', title_color = '#ffffff'
where username = 'guria' and is_bot and is_official;
