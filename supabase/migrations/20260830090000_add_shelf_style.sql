alter table public.profiles add column if not exists shelf_style text not null default 'none';

alter table public.profiles drop constraint if exists profiles_shelf_style_check;
alter table public.profiles add constraint profiles_shelf_style_check
  check (shelf_style in ('none', 'wood', 'retro', 'neon', 'comic', 'minimal'));

notify pgrst, 'reload schema';
