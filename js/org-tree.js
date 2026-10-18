(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.OrgTree = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function findUnit(units, unitId) {
    return units.find((u) => u.id === unitId) || null;
  }

  function getDescendantIds(units, unitId) {
    const result = [unitId];
    const childrenOf = (parentId) => units.filter((u) => u.parentId === parentId);
    let frontier = childrenOf(unitId);
    while (frontier.length > 0) {
      const next = [];
      for (const child of frontier) {
        result.push(child.id);
        next.push(...childrenOf(child.id));
      }
      frontier = next;
    }
    return result;
  }

  function getAncestorIds(units, unitId) {
    const result = [];
    let current = findUnit(units, unitId);
    while (current && current.parentId) {
      result.push(current.parentId);
      current = findUnit(units, current.parentId);
    }
    return result;
  }

  function isWithinScope(units, scopeUnitId, targetUnitId) {
    return getDescendantIds(units, scopeUnitId).includes(targetUnitId);
  }

  function getUnitPath(units, unitId) {
    const ancestors = getAncestorIds(units, unitId).reverse();
    const self = findUnit(units, unitId);
    const path = ancestors.map((id) => findUnit(units, id)).filter(Boolean);
    if (self) path.push(self);
    return path;
  }

  return { findUnit, getDescendantIds, getAncestorIds, isWithinScope, getUnitPath };
});
