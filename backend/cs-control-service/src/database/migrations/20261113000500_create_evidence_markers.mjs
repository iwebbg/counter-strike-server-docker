export const up = async (knex) => {
  if (await knex.schema.hasTable("panel_evidence_markers")) return;
  await knex.schema.createTable("panel_evidence_markers", (table) => {
    table.string("id", 36).primary();
    table.string("server_id", 64).notNullable().index();
    table.string("recording_filename", 128).notNullable().index();
    table.string("player_steam_id", 40).notNullable().index();
    table.string("player_name", 64).notNullable();
    table.string("reason", 255).notNullable();
    table.integer("marker_offset_seconds").unsigned().nullable();
    table.string("operator_user_id", 36).nullable().references("id").inTable("users").onDelete("SET NULL");
    table.string("operator_name", 128).nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now()).index();
    table.index(["server_id", "created_at"], "idx_evidence_marker_server_time");
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("panel_evidence_markers");
};
