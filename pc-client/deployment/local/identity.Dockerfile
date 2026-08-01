FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

ARG AIHUB_SOURCE_REVISION
ARG AIHUB_RELEASE_VERSION
LABEL com.aihub.source-revision=$AIHUB_SOURCE_REVISION \
      com.aihub.release-version=$AIHUB_RELEASE_VERSION \
      com.aihub.runtime-contract=identity-catalog-url-v2

WORKDIR /app/identity
COPY identity/package.json identity/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY identity ./
COPY shared/identity-security.cjs /app/shared/identity-security.cjs
COPY shared/avatar-image.cjs /app/shared/avatar-image.cjs
COPY shared/active-catalog-products.cjs /app/shared/active-catalog-products.cjs

USER node
EXPOSE 4180
CMD ["node", "server.cjs"]
