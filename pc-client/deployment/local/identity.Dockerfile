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
COPY admin/resource-submissions.cjs /app/admin/resource-submissions.cjs
COPY shared/active-catalog-products.cjs \
     shared/avatar-image.cjs \
     shared/catalog-taxonomy.cjs \
     shared/catalog-published-icon-url.cjs \
     shared/catalog-release.cjs \
     shared/catalog.cjs \
     shared/cli-deploy-only.cjs \
     shared/desktop-adapters.cjs \
     shared/desktop-download-only.cjs \
     shared/desktop-lifecycle.cjs \
     shared/ecosystem-resources.cjs \
     shared/environment-download.cjs \
     shared/extension-install-registry.cjs \
     shared/identity-security.cjs \
     shared/install-registry.cjs \
     shared/managed-binary-cli.cjs \
     shared/managed-downloads.cjs \
     shared/microsoft-store-repair.cjs \
     shared/official-download-approvals.cjs \
     shared/official-download-page.cjs \
     shared/product-components.cjs \
     shared/product-entry-points.cjs \
     shared/product-extensions.cjs \
     shared/product-intake-approvals.cjs \
     shared/product-intake-dossier.cjs \
     shared/product-modules.cjs \
     shared/product-policy.cjs \
     shared/python-cli-locks-expansion.json \
     shared/python-cli-locks.cjs \
     shared/resource-store.cjs \
     shared/sha256-portable.cjs \
     shared/signed-release.cjs \
     shared/vendor-icon.cjs \
     shared/windows-cli-catalog.cjs \
     shared/windows-desktop-catalog.cjs \
     shared/windows-package-manager-catalog.cjs \
     /app/shared/
COPY catalog/channel.json /app/catalog/channel.json

USER node
EXPOSE 4180
CMD ["node", "server.cjs"]
