export const up = async (knex) => {
  if (!(await knex.schema.hasTable("panel_configuration_templates"))) {
    await knex.schema.createTable("panel_configuration_templates", (table) => {
      table.string("id", 36).primary();
      table.string("name", 96).notNullable().unique();
      table.string("description", 255).nullable();
      table.json("configuration").notNullable();
      table.string("created_by", 36).nullable().references("id").inTable("users").onDelete("SET NULL");
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable("panel_configuration_history"))) {
    await knex.schema.createTable("panel_configuration_history", (table) => {
      table.string("id", 36).primary();
      table.string("server_id", 64).notNullable().index();
      table.integer("revision").unsigned().notNullable();
      table.string("reason", 48).notNullable().defaultTo("update");
      table.json("configuration").notNullable();
      table.string("actor_user_id", 36).nullable().references("id").inTable("users").onDelete("SET NULL");
      table.string("actor_name", 128).nullable();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now()).index();
      table.unique(["server_id", "revision"], "uq_configuration_server_revision");
    });
  }
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("panel_configuration_history");
  await knex.schema.dropTableIfExists("panel_configuration_templates");
};
