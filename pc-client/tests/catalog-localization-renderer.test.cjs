"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { catalogDisplayField } = require("../src/catalog-localization.cjs");

const localizedValues = [
  ["Brand.slogan", "slogan"],
  ["ExtraSection.title", "title"],
  ["Community.title", "title"],
  ["Community.description", "description"],
  ["CatalogBanner.eyebrow", "eyebrow"],
  ["CatalogBanner.title", "title"],
  ["CatalogBanner.description", "description"],
  ["CatalogBanner.action", "action"],
  ["HomeCarouselSlide.imageAlt", "imageAlt"],
  ["HomeCarouselSlide.title", "title"],
  ["HomeCarouselSlide.description", "description"],
  ["HomeCarouselAction.label", "label"],
  ["Vendor.name", "name"],
  ["Vendor.description", "description"],
  ["Product.name", "name"],
  ["Product.description", "description"],
  ["Resource.name", "name"],
  ["Resource.description", "description"],
  ["ResourceStore.label", "label"]
].map(([kind, field], index) => {
  const primary = `primary-${index}-${field}`;
  const english = `english-${index}-${field}`;
  return [kind, { [field]: primary, localized: { en: { [field]: english } } }, field, primary, english];
});

test("localization matrix covers all 19 signed display fields", () => {
  assert.equal(localizedValues.length, 19);
});

test("English catalog display selects every signed localized DTO field", () => {
  for (const [kind, value, field, , english] of localizedValues) {
    assert.equal(catalogDisplayField(value, field, "en"), english, kind);
  }
});

test("Chinese catalog display keeps every primary signed field", () => {
  for (const [kind, value, field, primary] of localizedValues) {
    assert.equal(catalogDisplayField(value, field, "zh"), primary, kind);
  }
});

test("every English display field falls back when its localized value is missing", () => {
  for (const [kind, value, field, primary] of localizedValues) {
    const missing = structuredClone(value);
    delete missing.localized.en[field];
    assert.equal(catalogDisplayField(missing, field, "en"), primary, kind);
  }
});

test("localization selection leaves every input DTO deeply unchanged", () => {
  for (const [kind, value, field] of localizedValues) {
    const before = structuredClone(value);
    catalogDisplayField(value, field, "zh");
    catalogDisplayField(value, field, "en");
    assert.deepEqual(value, before, kind);
  }
});

test("active7 DTOs without localized content remain compatible", () => {
  const value = { description: "active7-primary-description" };
  const before = structuredClone(value);
  assert.equal(catalogDisplayField(value, "description", "en"), "active7-primary-description");
  assert.deepEqual(value, before);
});
