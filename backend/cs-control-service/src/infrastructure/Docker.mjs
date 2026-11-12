import http from "node:http";

export class DockerError extends Error {
  constructor(message, statusCode, details = '') {
    super(message);
    this.name = 'DockerError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class DockerClient {
  constructor(socketPath = '/var/run/docker.sock') {
    this.socketPath = socketPath;
  }

  request(method, path, body = undefined) {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));

    return new Promise((resolve, reject) => {
      const request = http.request({
        socketPath: this.socketPath,
        method,
        path,
        headers: payload ? {
          'content-type': 'application/json',
          'content-length': payload.length,
        } : {},
      }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          if (response.statusCode < 200 || response.statusCode >= 300) {
            let details = buffer.toString('utf8');
            try {
              details = JSON.parse(details).message || details;
            } catch {}
            reject(new DockerError(`Docker API ${method} ${path} failed`, response.statusCode, details));
            return;
          }

          const contentType = response.headers['content-type'] || '';
          if (contentType.includes('application/json') && buffer.length) {
            try {
              resolve(JSON.parse(buffer.toString('utf8')));
            } catch (error) {
              reject(new DockerError(`Invalid Docker JSON: ${error.message}`, response.statusCode));
            }
            return;
          }
          resolve(buffer);
        });
      });

      request.on('error', (error) => reject(new DockerError(`Cannot reach Docker: ${error.message}`, 503)));
      if (payload) request.write(payload);
      request.end();
    });
  }
}

export function demuxDockerStream(buffer) {
  if (!buffer.length) return '';
  const parts = [];
  let offset = 0;

  while (offset + 8 <= buffer.length) {
    const streamType = buffer[offset];
    const isHeader = (streamType === 1 || streamType === 2) &&
      buffer[offset + 1] === 0 && buffer[offset + 2] === 0 && buffer[offset + 3] === 0;
    if (!isHeader) return buffer.toString('utf8');

    const length = buffer.readUInt32BE(offset + 4);
    if (offset + 8 + length > buffer.length) return buffer.toString('utf8');
    parts.push(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    offset += 8 + length;
  }

  return parts.join('');
}
