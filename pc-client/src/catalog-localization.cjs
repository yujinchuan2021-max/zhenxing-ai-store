"use strict";

function catalogDisplayField(value, field, language) {
  return (language === "en" ? value.localized?.en?.[field] : undefined) ?? value[field];
}

module.exports = { catalogDisplayField };
