import "./dotenv.mjs";

export default {
  env: process.env.NODE_ENV ?? "development",
  processRole: process.env.PROCESS_ROLE ?? "api",
  appName: process.env.APP_DISPLAY_NAME ?? "CS Control",
  swaggerUi: {
    title: process.env.SWAGGER_UI_TITLE ?? "CS Control API",
    description: process.env.SWAGGER_UI_DESCRIPTION ?? "Counter-Strike 1.6 fleet control and statistics API.",
    version: process.env.SWAGGER_UI_VERSION ?? "1.0.0",
    contactEmail: process.env.SWAGGER_UI_CONTACT_EMAIL ?? "",
    termsOfServiceUrl: process.env.SWAGGER_UI_TERMS_OF_SERVICE_URL ?? "",
    host: process.env.SWAGGER_UI_HOST ?? "localhost",
  },
};
