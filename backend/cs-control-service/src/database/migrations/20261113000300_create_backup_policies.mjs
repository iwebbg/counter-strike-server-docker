export const up = async (knex) => {
  if (await knex.schema.hasTable("panel_backup_policies")) return;
  await knex.schema.createTable("panel_backup_policies", (table) => {
    table.string("server_id", 64).primary();
    table.boolean("enabled").notNullable().defaultTo(false);
    table.integer("interval_hours").unsigned().notNullable().defaultTo(24);
    table.integer("retention_count").unsigned().notNullable().defaultTo(7);
    table.boolean("include_logs").notNullable().defaultTo(true);
    table.boolean("include_database").notNullable().defaultTo(false);
    table.boolean("remote_enabled").notNullable().defaultTo(false);
    table.timestamp("last_run_at").nullable();
    table.timestamp("next_run_at").nullable().index();
    table.string("last_status", 24).nullable();
    table.text("last_error").nullable();
    table.timestamps(true, true);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("panel_backup_policies");
};
