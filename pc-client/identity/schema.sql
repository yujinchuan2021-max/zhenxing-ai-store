CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  normalized_email text NOT NULL UNIQUE,
  phone text,
  normalized_phone text UNIQUE,
  username text NOT NULL,
  normalized_username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS normalized_phone text;
CREATE UNIQUE INDEX IF NOT EXISTS users_normalized_phone_unique
  ON users(normalized_phone) WHERE normalized_phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS community_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  avatar_url text,
  bio text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_avatars (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 393216),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS registration_challenges (
  id uuid PRIMARY KEY,
  normalized_email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registration_challenges_email_created
  ON registration_challenges(normalized_email, created_at DESC);

CREATE TABLE IF NOT EXISTS email_change_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  normalized_email text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_change_challenges_user_created
  ON email_change_challenges(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS devices (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  access_hash text NOT NULL UNIQUE,
  access_expires_at timestamptz NOT NULL,
  refresh_hash text NOT NULL UNIQUE,
  refresh_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, device_id)
    REFERENCES devices(user_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sessions_user_active
  ON sessions(user_id, revoked_at, last_seen_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'devices_pkey'
      AND conrelid = 'devices'::regclass
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) THEN
    ALTER TABLE sessions
      DROP CONSTRAINT IF EXISTS sessions_user_id_device_id_fkey;
    ALTER TABLE sessions
      DROP CONSTRAINT IF EXISTS sessions_device_id_fkey;
    ALTER TABLE devices
      DROP CONSTRAINT IF EXISTS devices_user_id_id_key;
    ALTER TABLE devices
      DROP CONSTRAINT devices_pkey;
    ALTER TABLE devices
      ADD CONSTRAINT devices_pkey PRIMARY KEY (user_id, id);
    ALTER TABLE sessions
      ADD CONSTRAINT sessions_user_id_device_id_fkey
      FOREIGN KEY (user_id, device_id)
      REFERENCES devices(user_id, id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_handoffs (
  credential_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audience text NOT NULL CHECK (audience = 'community-browser'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_handoffs_expiry
  ON community_handoffs(expires_at);

CREATE TABLE IF NOT EXISTS used_refresh_credentials (
  refresh_hash text PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS discussions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id text,
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discussions_created
  ON discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS discussions_product
  ON discussions(product_id, created_at DESC);

-- Product entry aggregation keeps existing discussions attached to the
-- stable managed product identity instead of the retired Web-only record.
UPDATE discussions
SET product_id = CASE product_id
  WHEN 'chatgpt-web' THEN 'chatgpt-desktop'
  WHEN 'claude-web' THEN 'claude-desktop'
  WHEN 'doubao' THEN 'bytedance-doubao'
  WHEN 'microsoft-copilot-web' THEN 'microsoft-copilot-desktop'
  WHEN 'qianwen-web' THEN 'alibaba-qwen-studio'
  WHEN 'tencent-yuanbao-web' THEN 'tencent-yuanbao-desktop'
  ELSE product_id
END
WHERE product_id IN (
  'chatgpt-web',
  'claude-web',
  'doubao',
  'microsoft-copilot-web',
  'qianwen-web',
  'tencent-yuanbao-web'
);

CREATE TABLE IF NOT EXISTS discussion_replies (
  id uuid PRIMARY KEY,
  discussion_id uuid NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discussion_replies_discussion
  ON discussion_replies(discussion_id, created_at);

CREATE TABLE IF NOT EXISTS site_messages (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  action_path text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_messages_user_created
  ON site_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_interactions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  discussion_id text NOT NULL,
  discussion_title text NOT NULL,
  discussion_path text NOT NULL,
  favorited boolean NOT NULL DEFAULT false,
  liked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, discussion_id)
);

CREATE INDEX IF NOT EXISTS community_interactions_user_updated
  ON community_interactions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  kind text NOT NULL,
  remote_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
