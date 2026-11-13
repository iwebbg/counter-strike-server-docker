import { Router } from "express";
import loggerConfig from "../../config/logger.mjs";
import serverConfig from "../../config/server.mjs";
import Swagger from "./Swagger.mjs";
import { validate } from "./validator.mjs";
import requirePermission from "../../middlewares/requirePermission.mjs";
import { writeAudit } from "../../controllers/audit/services/AuditService.mjs";

const validationMiddleware = (rest, location, source) => (req, res, next) => {
  const schema = rest.validation?.[location];
  if (!schema || Object.keys(schema).length === 0) return next();
  const input = source(req);
  const errors = validate(input, schema);
  if (errors) return res.jsonError(422, `${location.toUpperCase()}_VALIDATION_ERRORS`, errors);
  req.validated ??= {};
  req.validated[location] = input;
  return next();
};

const bodyInput = (req) => {
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, "input")) return req.body.input;
  return req.body ?? {};
};

export default async function createRouter() {
  const router = Router();
  const docs = new Swagger();
  const supportedMethods = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"]);
  for (const descriptorUrl of serverConfig.serviceRests) {
    let rest;
    try {
      rest = (await import(descriptorUrl)).default;
    } catch (error) {
      if (loggerConfig.showErrorLogs) console.error("Route import failed", descriptorUrl, error);
      throw error;
    }
    if (!rest?.route || !rest?.method || typeof rest.entryPoint !== "function") {
      throw new Error(`Invalid REST descriptor: ${descriptorUrl}`);
    }
    if (!supportedMethods.has(rest.method)) throw new Error(`Unsupported REST method: ${rest.method}`);
    docs.set(rest);
    const routeMiddlewares = [...(rest.middlewares ?? [])];
    if (rest.permission) routeMiddlewares.push(requirePermission(rest.permission));
    router[rest.method.toLowerCase()](
      rest.route,
      validationMiddleware(rest, "query", (req) => req.query ?? {}),
      validationMiddleware(rest, "path", (req) => req.params ?? {}),
      validationMiddleware(rest, "body", bodyInput),
      ...routeMiddlewares,
      async (req, res, next) => {
        try {
          const result = await rest.entryPoint(req, res, next);
          if (rest.audit) {
            const context = typeof rest.audit === "function" ? rest.audit(req) : rest.audit;
            await writeAudit(req, { ...context, status: "success" });
          }
          return result;
        } catch (error) {
          if (rest.audit) {
            const context = typeof rest.audit === "function" ? rest.audit(req) : rest.audit;
            await writeAudit(req, {
              ...context,
              status: "failure",
              metadata: { ...context.metadata, error: error.message },
            });
          }
          error.route = `${rest.method} ${rest.route}`;
          return next(error);
        }
      },
    );
  }
  docs.make(router);
  return router;
}
