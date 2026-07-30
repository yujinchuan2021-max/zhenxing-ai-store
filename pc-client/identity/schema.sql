CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  normalized_email text NOT NULL UNIQUE,
  username text NOT NULL,
  normalized_username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  avatar_url text,
  bio text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
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

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, id)
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

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  kind text NOT NULL,
  remote_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
