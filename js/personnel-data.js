(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./persist.js"));
  } else {
    root.PersonnelData = factory(root.Persist);
  }
})(typeof self !== "undefined" ? self : this, function (Persist) {
  "use strict";
  const P = Persist || { load: (k, f) => f, save: () => {} };

  // Every `id` below is copied verbatim from the `personnelId` field
  // already present on the matching case in mock-data.js — not invented.
  // `orgUnitId` reuses that case's own `orgUnitId` as the person's
  // "جهة العمل/الفرع" (FR-PERS-01).
  const personnel = [
    { id: "ID-88421", personnelNumber: "ID-88421", name: "محمد الصالح", rank: "رقيب أول", orgUnitId: "SEC-RD-CASES", joinDate: "2018-04-12", status: "active" },
    { id: "ID-77310", personnelNumber: "ID-77310", name: "خالد العتيبي", rank: "عريف", orgUnitId: "REG-RD", joinDate: "2020-01-20", status: "active" },
    { id: "ID-51290", personnelNumber: "ID-51290", name: "ناصر القحطاني", rank: "ملازم أول", orgUnitId: "DEPT-EP-ADMIN", joinDate: "2016-09-03", status: "active" },
    { id: "ID-40118", personnelNumber: "ID-40118", name: "سعد الحربي", rank: "وكيل رقيب", orgUnitId: "SEC-RD-CASES", joinDate: "2019-11-15", status: "active" },
    { id: "ID-33087", personnelNumber: "ID-33087", name: "بندر المطيري", rank: "رقيب", orgUnitId: "REG-EP", joinDate: "2021-02-08", status: "active" },
    { id: "ID-29014", personnelNumber: "ID-29014", name: "طلال السبيعي", rank: "نقيب", orgUnitId: "SEC-RD-FOLLOWUP", joinDate: "2015-06-01", status: "active" },
    { id: "ID-18823", personnelNumber: "ID-18823", name: "ياسر الدوسري", rank: "رقيب أول", orgUnitId: "DEPT-RD-OPS", joinDate: "2017-03-22", status: "active" },
    { id: "ID-15502", personnelNumber: "ID-15502", name: "فهد المالكي", rank: "عريف", orgUnitId: "REG-MK", joinDate: "2022-05-10", status: "active" },
    { id: "ID-09934", personnelNumber: "ID-09934", name: "عمر الغامدي", rank: "ملازم", orgUnitId: "SEC-EP-PERSONNEL", joinDate: "2020-08-19", status: "active" },
  ];

  const restored = P.load("personnel", null);
  if (restored) { personnel.length = 0; personnel.push(...restored); }

  return { personnel };
});
