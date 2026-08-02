FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

ARG AIHUB_SOURCE_REVISION
ARG AIHUB_RELEASE_VERSION
LABEL com.aihub.source-revision=$AIHUB_SOURCE_REVISION \
      com.aihub.release-version=$AIHUB_RELEASE_VERSION \
      com.aihub.runtime-contract=admin-v1

WORKDIR /app
COPY --chown=node:node admin/*.cjs /app/admin/
COPY --chown=node:node admin/public /app/admin/public
COPY --chown=node:node admin/data/catalog-v1.json admin/data/release-settings.json /app/admin/data/
COPY --chown=node:node admin/data/vendor-icon-sources.json /app/admin/data/
COPY --chown=node:node admin/data/vendor-icons /app/admin/data/vendor-icons
COPY --chown=node:node shared /app/shared
COPY --chown=node:node scripts/discover-official-products.mjs /app/scripts/discover-official-products.mjs

USER node
EXPOSE 4173
CMD ["node", "admin/server.cjs"]
