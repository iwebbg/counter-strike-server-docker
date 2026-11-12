import swaggerUi from "swagger-ui-express";
import globalConfig from "../../config/global.mjs";

class Swagger {
  constructor() {
    this.document = {
      swagger: "2.0",
      info: {
        title: globalConfig.swaggerUi.title,
        description: globalConfig.swaggerUi.description,
        version: globalConfig.swaggerUi.version,
        contact: { email: globalConfig.swaggerUi.contactEmail },
        termsOfService: globalConfig.swaggerUi.termsOfServiceUrl,
      },
      host: globalConfig.swaggerUi.host,
      schemes: globalConfig.env === "production" ? ["https"] : ["http"],
      consumes: ["application/json"],
      produces: ["application/json"],
      securityDefinitions: { Bearer: { type: "apiKey", name: "Authorization", in: "header" } },
      paths: {},
    };
  }

  set(rest) {
    const route = `/api${rest.route}`;
    const method = rest.method.toLowerCase();
    const item = {
      tags: rest.docs?.tags ?? ["Other"],
      description: rest.docs?.description ?? "",
      parameters: [],
      responses: rest.docs?.responses ?? { 500: { description: "INTERNAL_SERVER_ERROR" } },
      security: rest.bearerAuth ? [{ Bearer: [] }] : [],
    };
    for (const location of ["query", "path"]) {
      const schema = rest.validation?.[location];
      for (const [name, property] of Object.entries(schema?.properties ?? {})) {
        item.parameters.push({
          in: location,
          name,
          required: schema.required?.includes(name) ?? false,
          description: property.description,
          type: property.type,
          format: property.format,
          enum: property.enum,
        });
      }
    }
    const body = rest.validation?.body;
    if (body?.properties && Object.keys(body.properties).length) {
      item.parameters.push({ name: "body", in: "body", required: true, schema: body });
    }
    this.document.paths[route] ??= {};
    this.document.paths[route][method] = item;
  }

  make(router) {
    if (globalConfig.env === "production" && process.env.SWAGGER_UI_ENABLED !== "true") return;
    router.use("/docs", swaggerUi.serve, swaggerUi.setup(this.document));
  }
}

export default Swagger;
