(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./persist.js"));
  } else {
    root.AwarenessData = factory(root.Persist);
  }
})(typeof self !== "undefined" ? self : this, function (Persist) {
  "use strict";
  const P = Persist || { load: (k, f) => f, save: () => {} };

  const tracks = [
    {
      id: "TAW-1",
      personnelId: "ID-40118",
      caseId: "CS-2026-0145",
      reason: "متابعة سلوكية بعد إغلاق القضية",
      status: "نشط",
      statusHistory: [{ status: "نشط", reason: "إنشاء المسار", actorId: "U-1", actorName: "عبدالله الشهري", timestamp: "2026-09-10T09:00:00Z" }],
      sessions: [],
      evaluation: null,
    },
  ];

  const restored = P.load("awarenessTracks", null);
  if (restored) { tracks.length = 0; tracks.push(...restored); }

  return { tracks };
});
