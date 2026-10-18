(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./persist.js"));
  } else {
    root.OrgData = factory(root.Persist);
  }
})(typeof self !== "undefined" ? self : this, function (Persist) {
  "use strict";
  const P = Persist || { load: (k, f) => f, save: () => {} };

  const units = [
    { id: "HQ", name: "الجهاز الرئيسي", level: "hq", parentId: null },

    { id: "REG-RD", name: "منطقة الرياض", level: "region", parentId: "HQ" },
    { id: "REG-MK", name: "منطقة مكة المكرمة", level: "region", parentId: "HQ" },
    { id: "REG-MD", name: "منطقة المدينة المنورة", level: "region", parentId: "HQ" },
    { id: "REG-EP", name: "المنطقة الشرقية", level: "region", parentId: "HQ" },
    { id: "REG-QS", name: "منطقة القصيم", level: "region", parentId: "HQ" },
    { id: "REG-AS", name: "منطقة عسير", level: "region", parentId: "HQ" },
    { id: "REG-TB", name: "منطقة تبوك", level: "region", parentId: "HQ" },
    { id: "REG-HA", name: "منطقة حائل", level: "region", parentId: "HQ" },
    { id: "REG-NB", name: "منطقة الحدود الشمالية", level: "region", parentId: "HQ" },
    { id: "REG-JZ", name: "منطقة جازان", level: "region", parentId: "HQ" },
    { id: "REG-NJ", name: "منطقة نجران", level: "region", parentId: "HQ" },
    { id: "REG-BH", name: "منطقة الباحة", level: "region", parentId: "HQ" },
    { id: "REG-JF", name: "منطقة الجوف", level: "region", parentId: "HQ" },

    { id: "DEPT-RD-OPS", name: "إدارة العمليات", level: "department", parentId: "REG-RD" },
    { id: "DIV-RD-INV", name: "شعبة التحقيقات", level: "division", parentId: "DEPT-RD-OPS" },
    { id: "SEC-RD-CASES", name: "قسم القضايا الإدارية", level: "section", parentId: "DIV-RD-INV" },
    { id: "DIV-RD-FIELD", name: "شعبة الرقابة الميدانية", level: "division", parentId: "DEPT-RD-OPS" },
    { id: "SEC-RD-FOLLOWUP", name: "قسم المتابعة", level: "section", parentId: "DIV-RD-FIELD" },

    { id: "DEPT-EP-ADMIN", name: "إدارة الشؤون الإدارية", level: "department", parentId: "REG-EP" },
    { id: "DIV-EP-HR", name: "شعبة الموارد البشرية", level: "division", parentId: "DEPT-EP-ADMIN" },
    { id: "SEC-EP-PERSONNEL", name: "قسم شؤون المنسوبين", level: "section", parentId: "DIV-EP-HR" },
  ];

  const restored = P.load("orgUnits", null);
  if (restored) { units.length = 0; units.push(...restored); }

  return { units };
});
