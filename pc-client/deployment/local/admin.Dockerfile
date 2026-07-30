FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

WORKDIR /app
COPY --chown=node:node admin /app/admin
COPY --chown=node:node shared /app/shared
COPY --chown=node:node catalog /app/catalog
COPY --chown=node:node updates /app/updates

USER node
EXPOSE 4173
CMD ["node", "admin/server.cjs"]
