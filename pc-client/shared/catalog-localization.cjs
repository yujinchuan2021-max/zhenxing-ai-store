"use strict";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateEnglishLocalization(localized, fieldLimits) {
  if (localized === undefined) return true;
  if (
    !isRecord(localized) ||
    Object.keys(localized).length !== 1 ||
    !Object.hasOwn(localized, "en") ||
    !isRecord(localized.en)
  ) return false;
  const fields = Object.keys(fieldLimits);
  return (
    Object.keys(localized.en).length === fields.length &&
    fields.every((field) => {
      const value = localized.en[field];
      return (
        Object.hasOwn(localized.en, field) &&
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= fieldLimits[field]
      );
    })
  );
}

module.exports = {
  validateEnglishLocalization
};
