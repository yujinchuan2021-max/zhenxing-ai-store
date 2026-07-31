"use strict";

function componentIds(product) {
  return Array.isArray(product?.componentProductIds)
    ? product.componentProductIds
    : [];
}

function validateProductComponentLinks(vendors) {
  const products = new Map();
  const vendorByProduct = new Map();
  for (const vendor of Array.isArray(vendors) ? vendors : []) {
    for (const product of Array.isArray(vendor?.products) ? vendor.products : []) {
      products.set(product.id, product);
      vendorByProduct.set(product.id, vendor.id);
    }
  }

  const parentByChild = new Map();
  for (const [productId, product] of products) {
    const children = componentIds(product);
    if (children.length > 20) return `too many components: ${productId}`;
    if (new Set(children).size !== children.length) {
      return `duplicate component: ${productId}`;
    }
    for (const childId of children) {
      if (typeof childId !== "string" || !products.has(childId)) {
        return `missing component: ${productId}/${String(childId)}`;
      }
      if (childId === productId) return `component cycle: ${productId}`;
      if (vendorByProduct.get(childId) !== vendorByProduct.get(productId)) {
        return `components must use the same vendor: ${productId}/${childId}`;
      }
      if (parentByChild.has(childId)) {
        return `component has multiple parents: ${childId}`;
      }
      parentByChild.set(childId, productId);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (productId) => {
    if (visiting.has(productId)) return false;
    if (visited.has(productId)) return true;
    visiting.add(productId);
    for (const childId of componentIds(products.get(productId))) {
      if (!visit(childId)) return false;
    }
    visiting.delete(productId);
    visited.add(productId);
    return true;
  };
  for (const productId of products.keys()) {
    if (!visit(productId)) return `component cycle: ${productId}`;
  }
  return "";
}

function buildProductDirectory(products) {
  const source = Array.isArray(products) ? products : [];
  const byId = new Map(source.map((product) => [product.id, product]));
  const childIds = new Set(
    source.flatMap((product) => componentIds(product))
  );
  const childrenByProductId = Object.fromEntries(
    source.map((product) => [
      product.id,
      componentIds(product)
        .map((productId) => byId.get(productId))
        .filter(Boolean)
    ])
  );
  return {
    roots: source.filter((product) => !childIds.has(product.id)),
    childrenByProductId
  };
}

module.exports = {
  buildProductDirectory,
  validateProductComponentLinks
};
