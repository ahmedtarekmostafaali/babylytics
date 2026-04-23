# Row Level Security

Every table has RLS enabled. Access is mediated exclusively through `baby_users`.

## Roles

| Role    | Read | Write logs / files | Manage caregivers | Delete baby |
|---------|:---:|:---:|:---:|:---:|
| owner   | ✅   | ✅  | ✅  | ✅  |
| editor  | ✅   | ✅  | —   | —   |
| viewer  | ✅   | —   | —   | —   |

Role is stored as the `role` column in `baby_users`. Helper functions centralize the check so policies stay small and auditable:

```sql
public.has_baby_access(b uuid)  -- any role
public.has_baby_write(b uuid)   -- owner or editor
public.is_baby_owner(b uuid)    -- owner only
```

All are `SECURITY DEFINER STABLE` and `grant execute … to authenticated`.

## Policy pattern

Every domain table (`feedings`, `stool_logs`, `medications`, `medication_logs`, `measurements`, `medical_files`, `extracted_text`) follows the same two policies:

```sql
create policy <t>_select on public.<t>
  for select using (public.has_baby_access(baby_id));

create policy <t>_write on public.<t>
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));
```

## Special cases

- **profiles** — each user sees/edits only their own row. Inserts are done by the `on_auth_user_created` trigger; direct INSERT is denied.
- **babies** — `select` via `has_baby_access`, `update` via `has_baby_write`, `delete` only for `is_baby_owner`. `insert` requires `created_by = auth.uid()` (the creator becomes the first owner via the `create_baby_with_owner` RPC, inside a single transaction).
- **baby_users** — members can see their own row; owners see all rows for their baby. Only owners can insert/update/delete, except a member can remove themselves (`user_id = auth.uid()`).
- **notifications** — select by owners of the baby (and the target user if set). No direct inserts — only the Edge Function and RPCs create notifications (via service role).
- **audit_log** — select only; writes come from the trigger (`SECURITY DEFINER`), direct `INSERT` is denied.

## Storage RLS

The `medical-files` bucket has policies that derive `baby_id` from the object name (`babies/{baby_id}/…`) via `public.baby_from_storage_path(name)`. Any upload that doesn't start with `babies/{baby_id}/…` where the caller has `has_baby_write(baby_id)` is rejected by Supabase before bytes are accepted.

## Verification

After deployment, log in as user A and confirm you cannot read or write:

```sql
-- as user A, with baby B1 that A does not have in baby_users
select * from feedings where baby_id = '<B1>'; -- returns 0 rows (not an error — RLS filters)
insert into feedings (baby_id, feeding_time, milk_type, created_by)
  values ('<B1>', now(), 'formula', auth.uid());
-- error: new row violates row-level security policy
```
