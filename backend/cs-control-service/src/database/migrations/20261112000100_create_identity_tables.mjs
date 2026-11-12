export const config = { transaction: false };

export const up = async (knex) => {
  if (!(await knex.schema.hasTable("users"))) {
    await knex.schema.createTable("users", (table) => {
      table.string("id", 36).primary();
      table.string("name", 128).notNullable();
      table.string("email", 254).notNullable().unique();
      table.string("normalized_email", 254).notNullable().unique();
      table.string("password", 255).notNullable();
      table.string("role", 32).notNullable().defaultTo("operator").index();
      table.string("preferred_locale", 8).notNullable().defaultTo("bg");
      table.boolean("active").notNullable().defaultTo(true).index();
      table.timestamp("email_verified_at").nullable();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });
  }
  if (!(await knex.schema.hasTable("oauth_clients"))) {
    await knex.schema.createTable("oauth_clients", (table) => {
      table.bigInteger("id").primary();
      table.string("provider", 32).notNullable().unique();
      table.string("name", 128).notNullable();
      table.boolean("revoked").notNullable().defaultTo(false);
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });
    await knex("oauth_clients").insert({
      id: 1,
      provider: "users",
      name: "CS Control password client",
      revoked: false,
    });
  }
  if (!(await knex.schema.hasTable("oauth_access_tokens"))) {
    await knex.schema.createTable("oauth_access_tokens", (table) => {
      table.string("id", 64).primary();
      table.string("user_id", 36).notNullable().references("id").inTable("users").onDelete("CASCADE");
      table.bigInteger("client_id").notNullable().references("id").inTable("oauth_clients");
      table.json("scopes").notNullable();
      table.boolean("revoked").notNullable().defaultTo(false).index();
      table.timestamp("expires_at").notNullable().index();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
      table.index(["user_id", "revoked", "expires_at"], "idx_oauth_access_user_state");
    });
  }
  if (!(await knex.schema.hasTable("oauth_refresh_tokens"))) {
    await knex.schema.createTable("oauth_refresh_tokens", (table) => {
      table.string("id", 64).primary();
      table
        .string("access_token_id", 64)
        .notNullable()
        .references("id")
        .inTable("oauth_access_tokens")
        .onDelete("CASCADE");
      table.boolean("revoked").notNullable().defaultTo(false).index();
      table.timestamp("expires_at").notNullable().index();
      table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    });
  }
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists("oauth_refresh_tokens");
  await knex.schema.dropTableIfExists("oauth_access_tokens");
  await knex.schema.dropTableIfExists("oauth_clients");
  await knex.schema.dropTableIfExists("users");
};
