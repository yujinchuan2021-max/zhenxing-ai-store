FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

WORKDIR /app/identity
COPY identity/package.json identity/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY identity ./
COPY shared/identity-security.cjs /app/shared/identity-security.cjs
COPY shared/avatar-image.cjs /app/shared/avatar-image.cjs

USER node
EXPOSE 4180
CMD ["node", "server.cjs"]
