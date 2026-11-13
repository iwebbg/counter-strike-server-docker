export const up = async (knex) => {
  if (await knex.schema.hasTable("panel_server_definitions")) return;
  await knex.schema.createTable("panel_server_definitions", (table) => {
    table.string("server_id", 64).primary();
    table.string("container_name", 128).notNullable().unique();
    table.text("create_payload", "longtext").notNullable();
    table.string("desired_state", 16).notNullable().defaultTo("stopped");
    table.boolean("enabled").notNullable().defaultTo(true);
    table.string("container_id", 64).nullable();
    table.timestamp("last_reconciled_at").nullable();
    table.text("last_error").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.index(["enabled", "desired_state"], "idx_server_definitions_reconcile");
  });
};

export const down = async (knex) => knex.schema.dropTableIfExists("panel_server_definitions");
