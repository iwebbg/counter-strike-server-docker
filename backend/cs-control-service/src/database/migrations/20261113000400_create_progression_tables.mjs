export const up = async (knex) => {
  for (const column of ["mvp_awards", "revenge_kills", "nemesis_events"]) {
    if (!(await knex.schema.hasColumn("cs_player_server_stats", column))) {
      await knex.schema.alterTable("cs_player_server_stats", (table) =>
        table.integer(column).unsigned().notNullable().defaultTo(0),
      );
    }
  }

  if (!(await knex.schema.hasTable("cs_missions"))) {
    await knex.schema.createTable("cs_missions", (table) => {
      table.charset("utf8mb4");
      table.collate("utf8mb4_unicode_ci");
      table.string("code", 48).primary();
      table.string("name", 96).notNullable();
      table.string("description", 180).notNullable();
      table.enu("period", ["daily", "weekly"]).notNullable();
      table.string("metric", 32).notNullable().index();
      table.integer("target_value").unsigned().notNullable();
      table.boolean("active").notNullable().defaultTo(true);
      table.integer("sort_order").unsigned().notNullable().defaultTo(0);
    });
  }
  if (!(await knex.schema.hasTable("cs_player_mission_progress"))) {
    await knex.schema.createTable("cs_player_mission_progress", (table) => {
      table.charset("utf8mb4");
      table.collate("utf8mb4_unicode_ci");
      table.string("server_id", 64).notNullable();
      table.string("steam_id", 40).notNullable().references("steam_id").inTable("cs_players").onDelete("CASCADE");
      table.string("mission_code", 48).notNullable().references("code").inTable("cs_missions").onDelete("CASCADE");
      table.string("period_key", 16).notNullable();
      table.integer("progress").unsigned().notNullable().defaultTo(0);
      table.timestamp("completed_at").nullable();
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
      table.primary(["server_id", "steam_id", "mission_code", "period_key"], "pk_player_mission_progress");
      table.index(["steam_id", "period_key"], "idx_mission_player_period");
    });
  }

  await knex("cs_missions")
    .insert([
      {
        code: "daily_kills_20",
        name: "Daily Hunter",
        description: "Get 20 kills today.",
        period: "daily",
        metric: "kills",
        target_value: 20,
        sort_order: 10,
      },
      {
        code: "daily_headshots_5",
        name: "Daily Precision",
        description: "Get 5 headshots today.",
        period: "daily",
        metric: "headshots",
        target_value: 5,
        sort_order: 20,
      },
      {
        code: "weekly_kills_100",
        name: "Weekly Veteran",
        description: "Get 100 kills this week.",
        period: "weekly",
        metric: "kills",
        target_value: 100,
        sort_order: 30,
      },
      {
        code: "weekly_mvp_10",
        name: "Weekly MVP",
        description: "Earn 10 MVP awards this week.",
        period: "weekly",
        metric: "mvp",
        target_value: 10,
        sort_order: 40,
      },
      {
        code: "weekly_revenge_5",
        name: "Revenge Week",
        description: "Get 5 revenge kills this week.",
        period: "weekly",
        metric: "revenge",
        target_value: 5,
        sort_order: 50,
      },
    ])
    .onConflict("code")
    .ignore();
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("cs_player_mission_progress");
  await knex.schema.dropTableIfExists("cs_missions");
  for (const column of ["nemesis_events", "revenge_kills", "mvp_awards"]) {
    if (await knex.schema.hasColumn("cs_player_server_stats", column)) {
      await knex.schema.alterTable("cs_player_server_stats", (table) => table.dropColumn(column));
    }
  }
};
