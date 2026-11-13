export const up = async (knex) => {
  await knex("users").whereIn("role", ["admin", "operator"]).update({ role: "owner" });
  if (await knex.schema.hasTable("panel_audit_logs")) return;
  await knex.schema.createTable("panel_audit_logs", (table) => {
    table.string("id", 36).primary();
    table.string("actor_user_id", 36).nullable().references("id").inTable("users").onDelete("SET NULL");
    table.string("actor_name", 128).nullable();
    table.string("actor_email", 254).nullable();
    table.string("action", 96).notNullable().index();
    table.string("category", 48).notNullable().index();
    table.string("target_type", 48).nullable();
    table.string("target_id", 128).nullable();
    table.string("target_name", 255).nullable();
    table.string("server_id", 128).nullable().index();
    table.enum("status", ["success", "failure", "denied"]).notNullable().defaultTo("success").index();
    table.string("request_id", 64).nullable().index();
    table.string("ip_address", 64).nullable();
    table.string("user_agent", 512).nullable();
    table.json("metadata").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now()).index();
    table.index(["actor_user_id", "created_at"], "idx_panel_audit_actor_time");
    table.index(["server_id", "created_at"], "idx_panel_audit_server_time");
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("panel_audit_logs");
};
