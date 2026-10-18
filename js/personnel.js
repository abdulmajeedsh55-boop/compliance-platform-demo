(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.Personnel = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function findPersonnelById(list, id) {
    return list.find((p) => p.id === id) || null;
  }

  function searchPersonnel(list, filters) {
    const f = filters || {};
    const includeArchived = f.includeArchived === true;
    const query = (f.query || "").trim();

    return list.filter((p) => {
      if (!includeArchived && p.status === "archived") return false;
      if (f.orgUnitId && p.orgUnitId !== f.orgUnitId) return false;
      if (f.rank && p.rank !== f.rank) return false;
      if (query && !p.name.includes(query) && !p.personnelNumber.includes(query)) return false;
      return true;
    });
  }

  function countPriorCases(cases, personnelId) {
    const matches = cases.filter((c) => c.personnelId === personnelId);
    const byType = {};
    matches.forEach((c) => {
      byType[c.type] = (byType[c.type] || 0) + 1;
    });
    return { total: matches.length, byType };
  }

  function maskRank(rank, canViewFullIdentity) {
    return canViewFullIdentity ? rank : "—";
  }

  return { findPersonnelById, searchPersonnel, countPriorCases, maskRank };
});
