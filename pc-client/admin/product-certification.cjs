"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  INSTALL_MODES,
  INSTALL_REGISTRY,
  getProductIntakeDossier
} = require("../shared/install-registry.cjs");

const STORE_FIELDS = new Set(["schemaVersion", "revision", "records"]);
const RECORD_FIELDS = new Set(["history"]);
const BASE_EVENT_FIELDS = [
  "status",
  "changedAt",
  "changedBy",
  "executionContractSha256",
  "notes"
];
const ACCEPTED_EVENT_FIELDS = new Set([
  ...BASE_EVENT_FIELDS,
  "clientVersion",
  "windowsVersion",
  "evidenceReference",
  "checks"
]);
const REVIEW_EVENT_FIELDS = new Set(BASE_EVENT_FIELDS);
const INPUT_FIELDS = new Set([
  "productId",
  "status",
  "expectedRevision",
  "changedBy",
  "clientVersion",
  "windowsVersion",
  "evidenceReference",
  "notes",
  "checks"
]);
const CHECK_FIELDS = Object.freeze([
  "downloadIntegrity",
  "installerLaunch",
  "postInstallDetection",
  "open",
  "updateOwnership",
  "uninstall",
  "dataRetention"
]);
const CHECK_FIELD_SET = new Set(CHECK_FIELDS);

function objectWithOnly(value, fields) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).every((field) => fields.has(field))
  );
}

function shortText(value, maximum, allowEmpty = false) {
  return (
    typeof value === "string" &&
    value.length <= maximum &&
    (allowEmpty || value.trim().length > 0) &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function exactCompletedChecks(checks) {
  return Boolean(
    objectWithOnly(checks, CHECK_FIELD_SET) &&
      Object.keys(checks).length === CHECK_FIELDS.length &&
      CHECK_FIELDS.every((field) => checks[field] === true)
  );
}

function validEvent(event) {
  if (
    !event ||
    !["pending", "reviewed", "accepted"].includes(event.status) ||
    Number.isNaN(Date.parse(event.changedAt)) ||
    !shortText(event.changedBy, 100) ||
    !/^[a-f0-9]{64}$/.test(event.executionContractSha256 || "") ||
    !shortText(event.notes, 500, true)
  ) {
    return false;
  }
  if (event.status !== "accepted") {
    return objectWithOnly(event, REVIEW_EVENT_FIELDS);
  }
  return Boolean(
    objectWithOnly(event, ACCEPTED_EVENT_FIELDS) &&
      shortText(event.clientVersion, 64) &&
      shortText(event.windowsVersion, 120) &&
      shortText(event.evidenceReference, 500) &&
      exactCompletedChecks(event.checks)
  );
}

function emptyStore() {
  return { schemaVersion: 1, revision: 0, records: {} };
}

function readStore(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) {
      throw new Error("产品验收记录文件不可信");
    }
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (
      !objectWithOnly(value, STORE_FIELDS) ||
      value.schemaVersion !== 1 ||
      !Number.isSafeInteger(value.revision) ||
      value.revision < 0 ||
      !value.records ||
      typeof value.records !== "object" ||
      Array.isArray(value.records) ||
      Object.entries(value.records).some(
        ([productId, record]) =>
          !/^[a-z0-9][a-z0-9-]{0,99}$/.test(productId) ||
          !objectWithOnly(record, RECORD_FIELDS) ||
          !Array.isArray(record.history) ||
          record.history.length < 1 ||
          record.history.some((event) => !validEvent(event))
      )
    ) {
      throw new Error("产品验收记录格式无效");
    }
    return value;
  } catch (error) {
    if (error?.code === "ENOENT") return emptyStore();
    throw error;
  }
}

function writeStore(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600
    });
    fs.renameSync(temporary, filePath);
  } catch (error) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {}
    throw error;
  }
}

function createProductCertification({ filePath, clock = () => new Date() }) {
  if (!path.isAbsolute(filePath || "")) {
    throw new Error("产品验收记录必须使用绝对路径");
  }
  const products = Object.entries(INSTALL_REGISTRY).filter(
    ([, registration]) => registration.mode === INSTALL_MODES.MANAGED_INSTALLER
  );

  function snapshot() {
    const store = readStore(filePath);
    const certifications = products
      .map(([productId, registration]) => {
        const dossier = getProductIntakeDossier(productId);
        const history = store.records[productId]?.history || [];
        const transition = history.at(-1) || null;
        const matchingContract = Boolean(
          dossier &&
            transition &&
            transition.executionContractSha256 === dossier.executionContractSha256
        );
        const status = !dossier || transition?.status === "pending"
          ? "pending"
          : transition?.status === "accepted" && matchingContract
            ? "accepted"
            : "reviewed";
        const acceptance = status === "accepted"
          ? {
              acceptedAt: transition.changedAt,
              acceptedBy: transition.changedBy,
              executionContractSha256: transition.executionContractSha256,
              clientVersion: transition.clientVersion,
              windowsVersion: transition.windowsVersion,
              evidenceReference: transition.evidenceReference,
              notes: transition.notes,
              checks: transition.checks
            }
          : null;
        return {
          productId,
          label: registration.label,
          vendorId: registration.vendorId,
          profileId: registration.profileId,
          status,
          review: dossier
            ? {
                reviewedAt: dossier.reviewedAt,
                reviewReference: dossier.reviewReference,
                executionContractSha256: dossier.executionContractSha256,
                officialSources: dossier.officialSources,
                completionEvidence: dossier.completionEvidence
              }
            : null,
          acceptance,
          staleAcceptance: Boolean(
            transition?.status === "accepted" && !matchingContract
          ),
          historyCount: history.length
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));
    return {
      revision: store.revision,
      summary: {
        total: certifications.length,
        pending: certifications.filter((item) => item.status === "pending").length,
        reviewed: certifications.filter((item) => item.status === "reviewed").length,
        accepted: certifications.filter((item) => item.status === "accepted").length
      },
      products: certifications
    };
  }

  function update(input) {
    if (
      !objectWithOnly(input, INPUT_FIELDS) ||
      !/^[a-z0-9][a-z0-9-]{0,99}$/.test(input.productId || "") ||
      !["pending", "reviewed", "accepted"].includes(input.status) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      !shortText(input.changedBy, 100) ||
      !shortText(input.notes || "", 500, true)
    ) {
      throw new Error("产品验收操作无效");
    }
    const registration = INSTALL_REGISTRY[input.productId];
    if (!registration || registration.mode !== INSTALL_MODES.MANAGED_INSTALLER) {
      throw new Error("该产品不属于客户端托管桌面产品");
    }
    const store = readStore(filePath);
    if (store.revision !== input.expectedRevision) {
      throw new Error("产品验收记录已变化，请刷新后重试");
    }
    const dossier = getProductIntakeDossier(input.productId);
    if (input.status !== "pending" && !dossier) {
      throw new Error("该产品尚未通过客户端本地审核");
    }
    if (
      input.status === "accepted" &&
      (!shortText(input.clientVersion, 64) ||
        !shortText(input.windowsVersion, 120) ||
        !shortText(input.evidenceReference, 500) ||
        !exactCompletedChecks(input.checks))
    ) {
      throw new Error("请完成全部实机验收项");
    }
    const event = {
      status: input.status,
      changedAt: new Date(clock()).toISOString(),
      changedBy: input.changedBy.trim(),
      executionContractSha256:
        dossier?.executionContractSha256 || "0".repeat(64),
      notes: (input.notes || "").trim(),
      ...(input.status === "accepted"
        ? {
            clientVersion: input.clientVersion.trim(),
            windowsVersion: input.windowsVersion.trim(),
            evidenceReference: input.evidenceReference.trim(),
            checks: Object.fromEntries(
              CHECK_FIELDS.map((field) => [field, true])
            )
          }
        : {})
    };
    const history = store.records[input.productId]?.history || [];
    store.records[input.productId] = { history: [...history, event] };
    store.revision += 1;
    writeStore(filePath, store);
    return snapshot();
  }

  function validateCatalog(catalog) {
    const current = snapshot();
    const pending = new Set(
      current.products
        .filter((product) => product.status === "pending")
        .map((product) => product.productId)
    );
    const blocked = (catalog?.vendors || []).flatMap((vendor) =>
      vendor?.enabled === false
        ? []
        : (vendor?.products || [])
            .filter(
              (product) =>
                product?.enabled !== false &&
                product?.capabilities?.includes("install") &&
                pending.has(product.id)
            )
            .map((product) => product.name || product.id)
    );
    if (blocked.length) {
      throw new Error(`待审核产品不能发布安装能力：${blocked.join("、")}`);
    }
    return current;
  }

  return Object.freeze({ snapshot, update, validateCatalog });
}

module.exports = {
  CHECK_FIELDS,
  createProductCertification
};
