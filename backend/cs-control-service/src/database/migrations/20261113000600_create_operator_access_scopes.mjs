export const up = async (knex) => {
  if (!(await knex.schema.hasColumn("users", "custom_permissions"))) {
    await knex.schema.alterTable("users", (table) => table.json("custom_permissions").nullable());
  }
  if (!(await knex.schema.hasTable("panel_operator_server_scopes"))) {
    await knex.schema.createTable("panel_operator_server_scopes", (table) => {
      table.string("user_id", 36).notNullable().references("id").inTable("users").onDelete("CASCADE");
      table.string("server_id", 64).notNullable();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.primary(["user_id", "server_id"], "pk_operator_server_scope");
      table.index(["server_id", "user_id"], "idx_operator_scope_server");
    });
  }
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("panel_operator_server_scopes");
  if (await knex.schema.hasColumn("users", "custom_permissions")) {
    await knex.schema.alterTable("users", (table) => table.dropColumn("custom_permissions"));
  }
};
