"use strict";

function applyDefinition(target, definition, preservedFields = []) {
  const preserved = Object.fromEntries(
    preservedFields
      .filter((field) => Object.hasOwn(target, field))
      .map((field) => [field, target[field]])
  );
  return Object.assign(target, definition, preserved);
}

module.exports = { applyDefinition };
