"use strict";

const ASSET_IMAGE_PATH = /^\/assets\/[A-Za-z0-9][A-Za-z0-9._\/-]*\.(svg|png|jpe?g|webp|avif)$/i;

function isAllowedCarouselImageUrl(value) {
  if (typeof value !== "string" || value.includes("..")) return false;
  if (ASSET_IMAGE_PATH.test(value)) return !value.includes("//");
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.pathname.includes("//");
  } catch {
    return false;
  }
}

function resolveCarouselImageUrl(value, baseUrl) {
  if (!isAllowedCarouselImageUrl(value)) return "";
  if (value.startsWith("https://")) return value;
  if (!value.startsWith("/assets/home-carousel/")) return "";
  try {
    return new URL(value.slice(1), baseUrl).href;
  } catch {
    return "";
  }
}

function isAllowedCarouselActionHref(value) {
  if (["/vendors", "/resources/skill", "/resources/mcp", "/resources/plugin", "/resources/connector"].includes(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function selectHomeCarouselSlides(homeCarousel) {
  if (!Array.isArray(homeCarousel?.slides)) return [];
  return homeCarousel.slides
    .filter((slide) => slide?.enabled === true && isAllowedCarouselImageUrl(slide.imageUrl))
    .slice()
    .sort((left, right) => left.sort - right.sort);
}

module.exports = {
  isAllowedCarouselActionHref,
  resolveCarouselImageUrl,
  selectHomeCarouselSlides
};
