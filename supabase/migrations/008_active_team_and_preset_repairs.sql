ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_active_team_id
  ON users(active_team_id);

WITH ranked_memberships AS (
  SELECT
    tm.user_id,
    tm.team_id,
    ROW_NUMBER() OVER (
      PARTITION BY tm.user_id
      ORDER BY tm.joined_at DESC, tm.team_id DESC
    ) AS row_number
  FROM team_members tm
)
UPDATE users u
SET active_team_id = ranked_memberships.team_id
FROM ranked_memberships
WHERE ranked_memberships.user_id = u.id
  AND ranked_memberships.row_number = 1
  AND (
    u.active_team_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM team_members existing_membership
      WHERE existing_membership.user_id = u.id
        AND existing_membership.team_id = u.active_team_id
    )
  );
