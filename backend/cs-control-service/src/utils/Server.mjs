import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import { rateLimit } from "express-rate-limit";
import expressWinston from "express-winston";
import helmet from "helmet";
import passport from "passport";
import path from "node:path";
import { fileURLToPath } from "node:url";
import winston from "winston";
import loggerConfig from "../config/logger.mjs";
import serverConfig from "../config/server.mjs";
import { configurePassport } from "./configurePassport.mjs";
import createRouter from "./helpers/router.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(directory, "../../public");

function jsonOk(code = 200, message = "", data = {}) {
  return this.status(code).json({ success: true, message, data });
}

function jsonError(code = 400, message = "UNKNOWN_ERROR", extensions = []) {
  const normalized = Array.isArray(extensions) ? extensions : [extensions];
  const errorCode =
    normalized.find((item) => item && typeof item === "object" && item.error_code)?.error_code ?? message;
  return this.status(code).json({
    success: false,
    message: errorCode,
    error_code: errorCode,
    extensions: normalized,
    request_id: this.req?.requestId,
  });
}

class Server {
  app = null;
  server = null;

  async init() {
    this.app = express();
    this.app.set("trust proxy", "loopback, linklocal, uniquelocal");
    this.app.use((req, res, next) => {
      req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
      res.setHeader("X-Request-Id", req.requestId);
      res.jsonOk = jsonOk;
      res.jsonError = jsonError;
      next();
    });
    if (loggerConfig.showConsoleLogs) {
      this.app.use(
        expressWinston.logger({
          transports: [new winston.transports.Console()],
          format: winston.format.json(),
          meta: true,
          msg: "HTTP {{req.method}}",
          requestWhitelist: ["method", "httpVersion", "ip"],
          responseWhitelist: ["statusCode", "responseTime"],
        }),
      );
    }
    this.app.use(bodyParser.json({ limit: process.env.REQUEST_BODY_LIMIT ?? "1mb" }));
    this.app.use(bodyParser.urlencoded({ extended: false, limit: process.env.REQUEST_BODY_LIMIT ?? "1mb" }));
    this.app.use(cookieParser());
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"],
            imgSrc: ["'self'", "data:"],
            baseUri: ["'none'"],
            frameAncestors: ["'none'"],
          },
        },
      }),
    );
    this.app.use(
      "/api",
      rateLimit({
        windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60000),
        limit: Number(process.env.API_RATE_LIMIT_MAX ?? 600),
        standardHeaders: "draft-8",
        legacyHeaders: false,
        handler: (req, res) => res.jsonError(429, "API_RATE_LIMITED"),
      }),
    );
    this.app.use("/api", (req, res, next) => {
      if (
        ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
        !req.cookies?.[process.env.AUTH_COOKIE_NAME ?? "cs_control_session"]
      )
        return next();
      const configuredOrigin = new URL(process.env.CORS_ORIGIN ?? process.env.APP_PUBLIC_URL ?? "http://localhost")
        .origin;
      const requestOrigin = `${req.protocol}://${req.get("host")}`;
      const origin = req.get("origin");
      const fetchSite = req.get("sec-fetch-site");
      if (
        fetchSite === "cross-site" ||
        (origin && ![configuredOrigin, requestOrigin].includes(origin)) ||
        (!origin && process.env.NODE_ENV === "production")
      )
        return res.jsonError(403, "CSRF_ORIGIN_REJECTED");
      return next();
    });
    configurePassport();
    this.app.use(passport.initialize());
    this.app.use("/api", cors({ origin: process.env.CORS_ORIGIN ?? false, credentials: true }), await createRouter());
    this.app.get("/health", (req, res) => res.jsonOk(200, "HEALTHY", { service: serverConfig.serviceName }));
    this.app.use(express.static(publicDirectory, { etag: false, lastModified: false, maxAge: 0 }));
    this.app.get("/{*path}", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      return res.sendFile(path.join(publicDirectory, "index.html"));
    });
    this.app.use((error, req, res, next) => {
      if (loggerConfig.showErrorLogs) {
        console.error("HTTP request failed", { requestId: req.requestId, route: error.route, message: error.message });
      }
      if (error.status && error.code) return res.jsonError(error.status, error.code, error.extensions ?? []);
      return res.jsonError(500, "INTERNAL_SERVER_ERROR");
    });
    this.app.use((req, res) => res.jsonError(404, "RESOURCE_NOT_FOUND"));
    await new Promise((resolve) => {
      this.server = this.app.listen(serverConfig.servicePort, "0.0.0.0", resolve);
    });
    return this.app;
  }

  async stop() {
    if (!this.server) return;
    await new Promise((resolve, reject) => this.server.close((error) => (error ? reject(error) : resolve())));
    this.server = null;
  }
}

export default Server;
