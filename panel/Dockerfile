FROM node:22-alpine

WORKDIR /app
COPY package.json ./
COPY src/ ./src/
COPY public/ ./public/

ENV NODE_ENV=production \
    PANEL_PORT=8080

EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --retries=3 --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/server.mjs"]
