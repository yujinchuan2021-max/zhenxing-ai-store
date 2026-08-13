"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  resolveCarouselImageUrl,
  selectHomeCarouselSlides
} = require("../shared/home-carousel-presentation.cjs");

test("only enabled carousel slides are shown in catalog sort order", () => {
  const slides = selectHomeCarouselSlides({
    slides: [
      { id: "third", enabled: true, sort: 3, imageUrl: "/assets/third.svg" },
      { id: "hidden", enabled: false, sort: 1, imageUrl: "/assets/hidden.svg" },
      { id: "first", enabled: true, sort: 0, imageUrl: "/assets/first.svg" }
    ]
  });
  assert.deepEqual(slides.map((slide) => slide.id), ["first", "third"]);
});

test("unsafe slide images do not reach the renderer", () => {
  assert.deepEqual(selectHomeCarouselSlides({
    slides: [{ id: "bad", enabled: true, sort: 0, imageUrl: "file:///C:/secret.png" }]
  }), []);
});

test("approved HTTPS images remain eligible", () => {
  assert.equal(selectHomeCarouselSlides({
    slides: [{ id: "remote", enabled: true, sort: 0, imageUrl: "https://cdn.example.com/slide.webp" }]
  }).length, 1);
});

test("missing or empty carousel selects no slide so the caller can retain banners", () => {
  assert.deepEqual(selectHomeCarouselSlides(undefined), []);
  assert.deepEqual(selectHomeCarouselSlides({ slides: [] }), []);
});

test("controlled carousel assets resolve beside a file-based packaged entry, never at file:///assets", () => {
  const resolved = resolveCarouselImageUrl(
    "/assets/home-carousel/constellation.svg",
    "file:///C:/ZhenXing/resources/app/dist/index.html"
  );
  assert.equal(
    resolved,
    "file:///C:/ZhenXing/resources/app/dist/assets/home-carousel/constellation.svg"
  );
  assert.equal(resolved.startsWith("file:///assets/"), false);
});

test("only controlled local carousel assets use the packaged relative resolver", () => {
  assert.equal(
    resolveCarouselImageUrl("/assets/vendor-icons/example.svg", "file:///C:/bundle/index.html"),
    ""
  );
  assert.equal(
    resolveCarouselImageUrl("file:///C:/secret.svg", "file:///C:/bundle/index.html"),
    ""
  );
  assert.equal(
    resolveCarouselImageUrl("https://cdn.example.com/slide.webp", "file:///C:/bundle/index.html"),
    "https://cdn.example.com/slide.webp"
  );
});
