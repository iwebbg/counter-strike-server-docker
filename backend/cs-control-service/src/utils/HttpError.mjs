export class HttpError extends Error {
  constructor(status, code, extensions = []) {
    super(code);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.extensions = extensions;
  }
}

export const badRequest = (code, extensions = []) => new HttpError(400, code, extensions);
export const unauthorized = (code = "UNAUTHORIZED") => new HttpError(401, code);
export const notFound = (code = "RESOURCE_NOT_FOUND") => new HttpError(404, code);
export const conflict = (code) => new HttpError(409, code);
export const unprocessable = (code, extensions = []) => new HttpError(422, code, extensions);
export const badGateway = (code, extensions = []) => new HttpError(502, code, extensions);
