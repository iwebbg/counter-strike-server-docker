-- Frozen MariaDB baseline imported by the first Knex migration.
CREATE TABLE IF NOT EXISTS cs_schema_migrations (
  version INT UNSIGNED NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_servers (
  server_id VARCHAR(64) NOT NULL PRIMARY KEY,
  container_id VARCHAR(64) NULL,
  display_name VARCHAR(96) NOT NULL,
  mode VARCHAR(24) NOT NULL,
  host_port SMALLINT UNSIGNED NULL,
  max_players TINYINT UNSIGNED NOT NULL DEFAULT 24,
  state VARCHAR(24) NOT NULL DEFAULT 'unknown',
  current_map VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_servers_heartbeat (last_heartbeat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_players (
  steam_id VARCHAR(40) NOT NULL PRIMARY KEY,
  current_name VARCHAR(64) NOT NULL,
  first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_connections INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_players_last_seen (last_seen),
  KEY idx_players_name (current_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_player_names (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  steam_id VARCHAR(40) NOT NULL,
  player_name VARCHAR(64) NOT NULL,
  first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  times_seen INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_player_name (steam_id, player_name),
  KEY idx_names_name (player_name),
  CONSTRAINT fk_names_player FOREIGN KEY (steam_id) REFERENCES cs_players (steam_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_player_server_stats (
  server_id VARCHAR(64) NOT NULL,
  steam_id VARCHAR(40) NOT NULL,
  kills INT UNSIGNED NOT NULL DEFAULT 0,
  deaths INT UNSIGNED NOT NULL DEFAULT 0,
  headshots INT UNSIGNED NOT NULL DEFAULT 0,
  damage BIGINT UNSIGNED NOT NULL DEFAULT 0,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  playtime_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  connections INT UNSIGNED NOT NULL DEFAULT 0,
  rounds_played INT UNSIGNED NOT NULL DEFAULT 0,
  wins INT UNSIGNED NOT NULL DEFAULT 0,
  gungame_wins INT UNSIGNED NOT NULL DEFAULT 0,
  highest_gungame_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id, steam_id),
  KEY idx_stats_rank (server_id, kills, deaths),
  KEY idx_stats_player (steam_id),
  CONSTRAINT fk_stats_player FOREIGN KEY (steam_id) REFERENCES cs_players (steam_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_player_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(64) NOT NULL,
  steam_id VARCHAR(40) NOT NULL,
  player_name VARCHAR(64) NOT NULL,
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP NULL,
  playtime_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  disconnect_reason VARCHAR(128) NULL,
  KEY idx_sessions_server_time (server_id, connected_at),
  KEY idx_sessions_player_time (steam_id, connected_at),
  CONSTRAINT fk_sessions_player FOREIGN KEY (steam_id) REFERENCES cs_players (steam_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_map_stats (
  server_id VARCHAR(64) NOT NULL,
  map_name VARCHAR(64) NOT NULL,
  times_played INT UNSIGNED NOT NULL DEFAULT 0,
  rounds_played INT UNSIGNED NOT NULL DEFAULT 0,
  kills INT UNSIGNED NOT NULL DEFAULT 0,
  player_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  first_played TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_played TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id, map_name),
  KEY idx_maps_last_played (last_played)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_moderation_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(64) NULL,
  action VARCHAR(24) NOT NULL,
  target_steam_id VARCHAR(40) NULL,
  target_name VARCHAR(64) NULL,
  reason VARCHAR(160) NOT NULL,
  duration_minutes INT UNSIGNED NULL,
  actor VARCHAR(96) NOT NULL DEFAULT 'CS Control',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_moderation_time (created_at),
  KEY idx_moderation_target (target_steam_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_bans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  steam_id VARCHAR(40) NOT NULL,
  scope_server_id VARCHAR(64) NULL COMMENT 'NULL means fleet-wide',
  player_name VARCHAR(64) NULL,
  reason VARCHAR(160) NOT NULL,
  issued_by VARCHAR(96) NOT NULL DEFAULT 'CS Control',
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  revoked_by VARCHAR(96) NULL,
  revoke_reason VARCHAR(160) NULL,
  KEY idx_bans_active (steam_id, revoked_at, expires_at),
  KEY idx_bans_scope (scope_server_id, issued_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  steam_id VARCHAR(40) NOT NULL,
  scope_server_id VARCHAR(64) NOT NULL DEFAULT '*' COMMENT '* means every server',
  flags VARCHAR(32) NOT NULL,
  label VARCHAR(96) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_scope (steam_id, scope_server_id),
  KEY idx_admins_scope (scope_server_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_gungame_progress (
  server_id VARCHAR(64) NOT NULL,
  steam_id VARCHAR(40) NOT NULL,
  current_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  highest_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  wins INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (server_id, steam_id),
  KEY idx_gg_rank (server_id, wins, highest_level),
  CONSTRAINT fk_gg_player FOREIGN KEY (steam_id) REFERENCES cs_players (steam_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_achievements (
  code VARCHAR(48) NOT NULL PRIMARY KEY,
  name VARCHAR(96) NOT NULL,
  description VARCHAR(180) NOT NULL,
  metric VARCHAR(32) NOT NULL,
  threshold_value INT UNSIGNED NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_player_achievements (
  steam_id VARCHAR(40) NOT NULL,
  achievement_code VARCHAR(48) NOT NULL,
  server_id VARCHAR(64) NOT NULL,
  unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (steam_id, achievement_code, server_id),
  KEY idx_unlock_time (unlocked_at),
  CONSTRAINT fk_unlock_player FOREIGN KEY (steam_id) REFERENCES cs_players (steam_id) ON DELETE CASCADE,
  CONSTRAINT fk_unlock_achievement FOREIGN KEY (achievement_code) REFERENCES cs_achievements (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_seasons (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(48) NOT NULL UNIQUE,
  name VARCHAR(96) NOT NULL,
  starts_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cs_season_stats (
  season_id INT UNSIGNED NOT NULL,
  server_id VARCHAR(64) NOT NULL,
  steam_id VARCHAR(40) NOT NULL,
  kills INT UNSIGNED NOT NULL DEFAULT 0,
  deaths INT UNSIGNED NOT NULL DEFAULT 0,
  headshots INT UNSIGNED NOT NULL DEFAULT 0,
  damage BIGINT UNSIGNED NOT NULL DEFAULT 0,
  playtime_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  gungame_wins INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (season_id, server_id, steam_id),
  KEY idx_season_rank (season_id, server_id, kills, deaths),
  CONSTRAINT fk_season_stats_season FOREIGN KEY (season_id) REFERENCES cs_seasons (id) ON DELETE CASCADE,
  CONSTRAINT fk_season_stats_player FOREIGN KEY (steam_id) REFERENCES cs_players (steam_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Import the original v1 kills/deaths table when upgrading an existing volume.
-- Dynamic SQL keeps a fresh installation valid when the legacy table is absent.
SET @legacy_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='cs_player_stats');
SET @legacy_players = IF(@legacy_exists > 0,
  'INSERT INTO cs_players (steam_id,current_name,last_seen) SELECT steam_id,steam_id,last_seen FROM cs_player_stats ON DUPLICATE KEY UPDATE last_seen=GREATEST(cs_players.last_seen,VALUES(last_seen))',
  'SELECT 1');
PREPARE legacy_players_stmt FROM @legacy_players;
EXECUTE legacy_players_stmt;
DEALLOCATE PREPARE legacy_players_stmt;

SET @legacy_stats = IF(@legacy_exists > 0,
  'INSERT INTO cs_player_server_stats (server_id,steam_id,kills,deaths,last_seen) SELECT server_id,steam_id,kills,deaths,last_seen FROM cs_player_stats ON DUPLICATE KEY UPDATE kills=GREATEST(cs_player_server_stats.kills,VALUES(kills)),deaths=GREATEST(cs_player_server_stats.deaths,VALUES(deaths)),last_seen=GREATEST(cs_player_server_stats.last_seen,VALUES(last_seen))',
  'SELECT 1');
PREPARE legacy_stats_stmt FROM @legacy_stats;
EXECUTE legacy_stats_stmt;
DEALLOCATE PREPARE legacy_stats_stmt;

INSERT IGNORE INTO cs_achievements (code, name, description, metric, threshold_value, sort_order) VALUES
  ('first_blood', 'First Blood', 'Record your first kill.', 'kills', 1, 10),
  ('soldier_100', 'Soldier', 'Reach 100 kills.', 'kills', 100, 20),
  ('veteran_1000', 'Veteran', 'Reach 1,000 kills.', 'kills', 1000, 30),
  ('headhunter_50', 'Headhunter', 'Reach 50 headshots.', 'headshots', 50, 40),
  ('survivor_hour', 'Survivor', 'Play for one hour.', 'playtime_seconds', 3600, 50),
  ('gungame_winner', 'GunGame Winner', 'Win a GunGame match.', 'gungame_wins', 1, 60);

INSERT IGNORE INTO cs_seasons (slug, name, starts_at, ends_at, active)
VALUES ('launch-season', 'Launch Season', UTC_TIMESTAMP(), NULL, 1);

INSERT IGNORE INTO cs_schema_migrations (version) VALUES (1);
