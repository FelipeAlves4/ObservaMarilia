-- Kept separate from the administrative schema migration because PostgreSQL
-- requires a newly added enum value to be committed before dependent policy
-- and function expressions can use it.
alter type public.app_role add value if not exists 'admin';
