(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./org-tree.js"));
  } else {
    root.Permissions = factory(root.OrgTree);
  }
})(typeof self !== "undefined" ? self : this, function (OrgTree) {
  "use strict";

  const PERMISSION_CATALOG = [
    { key: "cases.view", module: "القضايا الإدارية", label: "عرض القضايا", enforced: false },
    { key: "cases.decide", module: "القضايا الإدارية", label: "اتخاذ قرار على قضية", enforced: false },
    { key: "cases.create", module: "القضايا الإدارية", label: "فتح قضية جديدة يدويًا", enforced: true },
    { key: "cases.reveal_identity", module: "القضايا الإدارية", label: "كشف الهوية الكاملة", enforced: false },
    { key: "audit.view_full", module: "سجل التدقيق", label: "عرض كامل لسجل التدقيق", enforced: false },
    { key: "audit.view_own", module: "سجل التدقيق", label: "عرض سجل التدقيق الخاص فقط", enforced: false },
    { key: "search.smart_search", module: "البحث الذكي", label: "استخدام البحث الذكي الموحّد", enforced: false },
    { key: "org.view", module: "الهيكل التنظيمي", label: "عرض الهيكل التنظيمي", enforced: false },
    { key: "org.manage", module: "الهيكل التنظيمي", label: "تعديل الهيكل التنظيمي ونقل المنسوبين", enforced: true },
    { key: "permissions.manage_scoped", module: "إدارة الصلاحيات", label: "إدارة صلاحيات من هم ضمن النطاق التنظيمي", enforced: true },
    { key: "platform.super_admin", module: "النظام", label: "صلاحية عليا على مستوى المنصة بأكملها", enforced: true },
    { key: "security_ops.access", module: "العمليات الأمنية", label: "الوصول لوحدة العمليات الأمنية المعزولة", enforced: false },
    { key: "lab.enter_result", module: "التحاليل المخبرية", label: "تسجيل نتيجة فحص (فني مختبر)", enforced: true },
    { key: "lab.review_result", module: "التحاليل المخبرية", label: "مراجعة نتيجة فحص (مدير شعبة الفحوص)", enforced: true },
    { key: "lab.approve_result", module: "التحاليل المخبرية", label: "اعتماد نتيجة فحص (مدير الإدارة)", enforced: true },
    { key: "lab.print_samples", module: "التحاليل المخبرية", label: "طباعة دفعة أرقام عينات بالباركود", enforced: true },
    { key: "lab.register_sample", module: "التحاليل المخبرية", label: "تسجيل فحص من عينة ممسوحة بالباركود", enforced: true },
    { key: "awareness.manage", module: "التوعية والمعالجة", label: "إنشاء مسار توعية وتسجيل جلسات المتابعة (مرشد)", enforced: true },
    { key: "awareness.evaluate", module: "التوعية والمعالجة", label: "التقييم الختامي وإغلاق المسار (مشرف)", enforced: true },
  ];

  const RESERVED_PERMISSIONS = ["platform.super_admin", "security_ops.access"];

  const ROLE_DEFAULTS = {
    "super-admin": [
      "cases.view", "cases.decide", "cases.create", "cases.reveal_identity",
      "audit.view_full", "search.smart_search",
      "org.view", "org.manage", "permissions.manage_scoped",
      "platform.super_admin",
    ],
    "case-officer": ["cases.view", "cases.decide", "cases.create", "audit.view_own", "awareness.manage"],
    "auditor": ["cases.view", "audit.view_full"],
    "regional-delegate": [
      "cases.view", "cases.decide", "cases.create", "audit.view_own",
      "org.view", "org.manage", "permissions.manage_scoped",
    ],
    "lab-technician": ["cases.view", "lab.enter_result", "lab.print_samples", "lab.register_sample"],
    "lab-division-head": ["cases.view", "lab.review_result"],
    "department-manager": ["cases.view", "lab.approve_result"],
    "awareness-supervisor": ["cases.view", "awareness.evaluate"],
  };

  function computeEffectivePermissions(user) {
    const base = new Set(ROLE_DEFAULTS[user.role] || []);
    const overrides = user.permissionOverrides || {};
    Object.keys(overrides).forEach((key) => {
      if (overrides[key]) base.add(key);
      else base.delete(key);
    });
    return Array.from(base);
  }

  function canManagePermissionsFor(actingUser, targetUser, units) {
    const effective = computeEffectivePermissions(actingUser);
    if (effective.includes("platform.super_admin")) return true;
    if (!effective.includes("permissions.manage_scoped")) return false;
    return OrgTree.isWithinScope(units, actingUser.orgUnitId, targetUser.orgUnitId);
  }

  function canGrantPermission(actingUser, targetUser, permissionKey, units) {
    if (actingUser.id === targetUser.id) return false;
    if (!canManagePermissionsFor(actingUser, targetUser, units)) return false;
    if (RESERVED_PERMISSIONS.includes(permissionKey)) {
      return computeEffectivePermissions(actingUser).includes("platform.super_admin");
    }
    return true;
  }

  return {
    PERMISSION_CATALOG,
    RESERVED_PERMISSIONS,
    ROLE_DEFAULTS,
    computeEffectivePermissions,
    canManagePermissionsFor,
    canGrantPermission,
  };
});
