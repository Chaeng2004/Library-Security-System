# databse update

## Not changed directly

The dashboard now renders two views in the frontend, but the database still does not expose a role/profile source in the workspace that I can use safely.

## Likely missing database pieces

1. A role source for users, such as `app_metadata.role`, `user_metadata.role`, or a separate `profiles` table.
2. A clear way to mark admin accounts in Supabase Auth or in a role table.
3. If the admin dashboard needs more than audit logs, tables for library records such as books, loans, and users would need to exist.

## Current working data

- Auth session and email from Supabase Auth.
- `audit_logs` table for the event log.

## Notes

- I did not change the database directly.
- If the team wants true admin/user separation, the next step should be to add a role column or profile table in Supabase and map it into auth metadata.