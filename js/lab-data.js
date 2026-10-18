(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./persist.js"));
  } else {
    root.LabData = factory(root.Persist);
  }
})(typeof self !== "undefined" ? self : this, function (Persist) {
  "use strict";
  const P = Persist || { load: (k, f) => f, save: () => {} };

  // personnelId/caseId below are real values already in mock-data.js/personnel-data.js.
  const tests = [
    {
      id: "LAB-1",
      personnelId: "ID-88421",
      caseId: "CS-2026-0148",
      testType: "تحليل عينة دم",
      status: "قيد الانتظار",
      requestedAt: "2026-09-08T10:00:00Z",
      requestedBy: "U-1",
      result: null,
      custody: [{ event: "طلب فحص جديد", actorId: "U-1", actorName: "عبدالله الشهري", timestamp: "2026-09-08T10:00:00Z" }],
    },
  ];

  // Sample numbers printed as barcodes in the field before any test/personnel
  // link exists yet — issued here, claimed later by registerScannedSample.
  const sampleBatches = [];

  const restored = P.load("labTests", null);
  if (restored) { tests.length = 0; tests.push(...restored); }
  const restoredBatches = P.load("labSampleBatches", null);
  if (restoredBatches) { sampleBatches.length = 0; sampleBatches.push(...restoredBatches); }

  return { tests, sampleBatches };
});
