export const up = async (knex) => {
  if (await knex.schema.hasTable("panel_community_events")) return;
  await knex.schema.createTable("panel_community_events", (table) => {
    table.string("id", 36).primary();
    table.string("name", 128).notNullable();
    table.string("server_id", 64).notNullable();
    table.integer("day_of_week").unsigned().notNullable();
    table.string("start_time", 5).notNullable();
    table.string("timezone", 64).notNullable().defaultTo("Europe/Sofia");
    table.integer("duration_minutes").unsigned().notNullable().defaultTo(180);
    table.string("start_map", 64).nullable();
    table.boolean("enabled").notNullable().defaultTo(true);
    table.string("last_occurrence_key", 40).nullable();
    table.timestamp("last_run_at").nullable();
    table.timestamp("active_until").nullable();
    table.string("last_status", 32).nullable();
    table.text("last_error").nullable();
    table.string("created_by", 36).nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.index(["enabled", "day_of_week", "start_time"], "idx_community_event_schedule");
    table.index(["server_id"], "idx_community_event_server");
  });
};

export const down = async (knex) => knex.schema.dropTableIfExists("panel_community_events");
