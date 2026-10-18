(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./mock-data.js"), require("./org-data.js"), require("./org-tree.js"), require("./permissions.js"), require("./personnel-data.js"), require("./personnel.js"), require("./masking.js"), require("./lab-data.js"), require("./awareness-data.js"), require("./persist.js"));
  } else {
    root.Api = factory(root.MockData, root.OrgData, root.OrgTree, root.Permissions, root.PersonnelData, root.Personnel, root.Masking, root.LabData, root.AwarenessData, root.Persist);
  }
})(typeof self !== "undefined" ? self : this, function (MockData, OrgData, OrgTree, Permissions, PersonnelData, Personnel, Masking, LabData, AwarenessData, Persist) {
  "use strict";

  const STORAGE_KEY = "platform_current_user_id";
  let inMemoryCurrentUserId = null;
  let nextAuditId = MockData.auditLog.length + 1;

  function hasStorage() {
    return typeof sessionStorage !== "undefined";
  }

  function readCurrentUserId() {
    if (hasStorage()) return sessionStorage.getItem(STORAGE_KEY);
    return inMemoryCurrentUserId;
  }

  function writeCurrentUserId(id) {
    if (hasStorage()) {
      if (id) sessionStorage.setItem(STORAGE_KEY, id);
      else sessionStorage.removeItem(STORAGE_KEY);
    } else {
      inMemoryCurrentUserId = id;
    }
  }

  function findUserByCredentials(personnelNumber, password) {
    return MockData.users.find((u) => u.personnelNumber === personnelNumber && u.password === password) || null;
  }

  function findUserById(id) {
    return MockData.users.find((u) => u.id === id) || null;
  }

  function toPublicUser(u) {
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      initials: u.initials,
      role: u.role,
      canViewFullIdentity: u.canViewFullIdentity,
      orgUnitId: u.orgUnitId,
      permissionOverrides: { ...(u.permissionOverrides || {}) },
    };
  }

  function computePersonnelSummary(c) {
    const person = PersonnelData.personnel.find((p) => p.id === c.personnelId);
    if (!person) return { rank: "—", branch: "—", priorCases: 0 };

    const actingUser = findUserById(readCurrentUserId());
    const canViewFullIdentity = !!(actingUser && actingUser.canViewFullIdentity);
    const unit = OrgTree.findUnit(OrgData.units, person.orgUnitId);
    const { total } = Personnel.countPriorCases(MockData.cases, person.id);

    return {
      rank: Personnel.maskRank(person.rank, canViewFullIdentity),
      branch: unit ? unit.name : "—",
      // "Prior" cases excludes the case currently being viewed.
      priorCases: Math.max(0, total - 1),
    };
  }

  function withComputedPersonnelSummary(c) {
    return { ...c, personnelSummary: computePersonnelSummary(c) };
  }

  async function login(personnelNumber, password) {
    const user = findUserByCredentials(personnelNumber, password);
    if (!user) return { ok: false, error: "رقم الهوية الوظيفية أو كلمة المرور غير صحيحة" };
    return { ok: true, userId: user.id };
  }

  async function setCurrentUser(userId) {
    writeCurrentUserId(userId);
  }

  async function getCurrentUser() {
    const id = readCurrentUserId();
    return toPublicUser(findUserById(id));
  }

  async function logout() {
    writeCurrentUserId(null);
  }

  async function getMetrics() {
    const openCases = MockData.cases.filter((c) => c.status !== "مغلقة").length;
    return {
      openCases,
      pendingLabTests: 34,
      activeAwarenessTracks: 19,
      securityAlerts: 2,
    };
  }

  const SHORT_STATUSES = ["الكل", "جديدة", "قيد المراجعة", "معتمدة", "مرفوضة", "مغلقة"];

  function shortStatusOf(c) {
    if (c.internalDecision === "تصعيد داخلي") return "قيد المراجعة";
    if (c.internalDecision) return c.internalDecision;
    const map = {
      "جديدة (منصة داخلية)": "جديدة",
      "جديدة (واردة من الجهة)": "جديدة",
      "قيد المراجعة الداخلية": "قيد المراجعة",
      "مُحالة للجهة / بانتظار رد الجهة": "قيد المراجعة",
      "الحكم مستلم": "قيد المراجعة",
      "مغلقة": "مغلقة",
    };
    return map[c.status] || c.status;
  }

  function applyNonStatusFilters(cases, filters) {
    let result = cases;
    if (filters.search) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(
        (c) => c.id.toLowerCase().includes(q) || c.realName.toLowerCase().includes(q)
      );
    }
    if (filters.type) {
      result = result.filter((c) => c.type === filters.type);
    }
    if (filters.days) {
      const cutoff = Date.now() - filters.days * 86400000;
      result = result.filter((c) => new Date(c.openedDate).getTime() >= cutoff);
    }
    if (filters.orgUnitId) {
      result = result.filter((c) => OrgTree.isWithinScope(OrgData.units, filters.orgUnitId, c.orgUnitId));
    }
    return result;
  }

  async function listCases(filters) {
    const f = filters || {};
    const page = f.page && f.page > 0 ? f.page : 1;
    const pageSize = f.pageSize && f.pageSize > 0 ? f.pageSize : 7;

    const preStatus = applyNonStatusFilters(MockData.cases, f);

    const statusCounts = {};
    for (const label of SHORT_STATUSES) {
      statusCounts[label] =
        label === "الكل" ? preStatus.length : preStatus.filter((c) => shortStatusOf(c) === label).length;
    }

    const filtered = f.status && f.status !== "الكل" ? preStatus.filter((c) => shortStatusOf(c) === f.status) : preStatus;

    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map(withComputedPersonnelSummary);

    return { items, total: filtered.length, page, pageSize, statusCounts };
  }

  // FR-CASE-L05: فتح قضية جديدة يدويًا. المصدر ثابت "مرصودة داخلياً" — الفتح التلقائي
  // من بلاغات الجهة الخارجية (FR-CASE-D09's "واردة من الجهة") مسار منفصل غير مبني هنا.
  async function addCase(personnelId, type, sensitivity, orgUnitId, description) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "cases.create");
    if (!personnelId) throw new Error("يجب ربط القضية بمنسوب");
    if (!type || !type.trim()) throw new Error("نوع القضية إلزامي");
    if (!description || !description.trim()) throw new Error("وصف الحالة إلزامي");
    const person = PersonnelData.personnel.find((p) => p.id === personnelId);
    if (!person) throw new Error("المنسوب غير موجود");
    const unit = OrgTree.findUnit(OrgData.units, orgUnitId);
    if (!unit) throw new Error("جهة العمل غير موجودة");

    const year = new Date().getFullYear();
    const maxNum = MockData.cases.reduce((max, c) => {
      const m = /CS-\d{4}-(\d+)/.exec(c.id);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    const nextNum = maxNum + 1;
    const id = `CS-${year}-${String(nextNum).padStart(4, "0")}`;
    const now = new Date().toISOString();
    const deadlineDays = 15;

    const newCase = {
      id,
      personnelId,
      realName: person.name,
      type: type.trim(),
      description: description.trim(),
      status: "جديدة (منصة داخلية)",
      internalDecision: null,
      internalDecisionReason: null,
      source: "مرصودة داخلياً",
      correlationId: `COR-${year}-${String(nextNum).padStart(6, "0")}`,
      reportingEntity: "الإدارة العامة للرقابة",
      officer: actingUser.name,
      openedDate: now.slice(0, 10),
      deadlineDays,
      deadlineDate: new Date(Date.now() + deadlineDays * 86400000).toISOString().slice(0, 10),
      sensitivity: sensitivity || "متوسط",
      updatedAt: now,
      orgUnitId,
      syncStatus: { awaiting: false, since: null },
      verdict: null,
      personnelSummary: { rank: "—", branch: "—", priorCases: 0 },
      attachments: [],
      timeline: [{ title: "فُتحت القضية", description: `فُتحت يدويًا بواسطة ${actingUser.name}`, timestamp: now, source: "human" }],
    };
    MockData.cases.unshift(newCase);

    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: now,
      actorId: actingUser.id,
      actorName: actingUser.name,
      eventType: "فتح قضية",
      description: `فُتحت القضية ${id} يدويًا — النوع: ${newCase.type}`,
    });

    return withComputedPersonnelSummary(newCase);
  }

  async function getCase(id) {
    const c = MockData.cases.find((c) => c.id === id) || null;
    return c ? withComputedPersonnelSummary(c) : null;
  }

  const VERDICT_REQUIRED_FIELDS = ["type", "penaltyType", "penaltyDescription", "issuedDate", "issuingAuthority"];

  async function decideCase(id, action, reason, actingUserId, verdict) {
    if (!reason || !reason.trim()) {
      throw new Error("سبب القرار إلزامي");
    }
    const c = MockData.cases.find((x) => x.id === id);
    if (!c) throw new Error("القضية غير موجودة");
    if (c.status === "مغلقة") throw new Error("القضية مغلقة ولا يمكن اتخاذ قرار جديد عليها");

    if (action === "معتمدة") {
      const missing = !verdict || VERDICT_REQUIRED_FIELDS.some((k) => !verdict[k] || !String(verdict[k]).trim());
      if (missing) throw new Error("بيانات الحكم والجزاء إلزامية عند اعتماد القضية");
      c.verdict = {
        type: verdict.type.trim(),
        penaltyType: verdict.penaltyType.trim(),
        penaltyDescription: verdict.penaltyDescription.trim(),
        issuedDate: verdict.issuedDate.trim(),
        issuingAuthority: verdict.issuingAuthority.trim(),
        documentName: (verdict.documentName || "").trim() || "—",
      };
      c.status = "مغلقة";
    } else if (action === "مرفوضة") {
      c.status = "مغلقة";
    } else if (action === "تصعيد داخلي") {
      c.status = "قيد المراجعة الداخلية";
    }

    c.internalDecision = action;
    c.internalDecisionReason = reason.trim();
    c.updatedAt = new Date().toISOString();
    c.timeline.unshift({
      title: action === "تصعيد داخلي" ? "صُعِّدت القضية" : `اتُّخذ قرار: ${action}`,
      description: `${action} — السبب: ${reason.trim()}`,
      timestamp: c.updatedAt,
      source: "human",
    });

    const actor = findUserById(actingUserId);
    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: c.updatedAt,
      actorId: actingUserId || null,
      actorName: actor ? actor.name : "غير معروف",
      eventType: "قرار على قضية",
      description: `${action} على القضية ${id} — السبب: ${reason.trim()}`,
    });

    return withComputedPersonnelSummary(c);
  }

  async function revealIdentity(caseId) {
    const c = MockData.cases.find((x) => x.id === caseId);
    if (!c) throw new Error("القضية غير موجودة");
    const actingUserId = readCurrentUserId();
    const actor = findUserById(actingUserId);
    const entry = {
      id: `AL-${nextAuditId++}`,
      timestamp: new Date().toISOString(),
      actorId: actingUserId || null,
      actorName: actor ? actor.name : "غير معروف",
      eventType: "عرض الهوية الكاملة",
      description: `عرض الهوية الكاملة لمنسوب القضية ${caseId}`,
    };
    MockData.auditLog.unshift(entry);
    return c.realName;
  }

  async function listAuditLog(filters) {
    const f = filters || {};
    let result = [...MockData.auditLog];
    if (f.actorId) result = result.filter((e) => e.actorId === f.actorId);
    if (f.eventType) result = result.filter((e) => e.eventType === f.eventType);
    if (f.limit) result = result.slice(0, f.limit);
    return result;
  }

  async function listOrgUnits() {
    return OrgData.units.map((u) => ({ ...u }));
  }

  async function getOrgUnit(id) {
    const u = OrgTree.findUnit(OrgData.units, id);
    return u ? { ...u } : null;
  }

  async function getOrgUnitStats(unitId) {
    const scopeIds = OrgTree.getDescendantIds(OrgData.units, unitId);
    const personnelCount = MockData.users.filter((u) => scopeIds.includes(u.orgUnitId)).length;
    const openCaseCount = MockData.cases.filter((c) => scopeIds.includes(c.orgUnitId) && c.status !== "مغلقة").length;
    return { personnelCount, openCaseCount };
  }

  const CHILD_LEVEL_OF = { region: "department", department: "division", division: "section" };

  async function addOrgUnit(parentId, name, level) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    const parent = OrgTree.findUnit(OrgData.units, parentId);
    if (!parent) throw new Error("الوحدة الأم غير موجودة");
    if (!name || !name.trim()) throw new Error("اسم الوحدة إلزامي");

    if (parent.level === "hq") throw new Error("لا يمكن إضافة منطقة رئيسية جديدة — المناطق الثلاث عشرة ثابتة العدد");
    const expectedLevel = CHILD_LEVEL_OF[parent.level];
    if (!expectedLevel || level !== expectedLevel) {
      throw new Error(`لا يمكن إضافة وحدة من نوع «${level}» تحت وحدة من نوع «${parent.level}»`);
    }

    const actingEffective = Permissions.computeEffectivePermissions(actingUser);
    const isSuperAdmin = actingEffective.includes("platform.super_admin");
    if (!isSuperAdmin) {
      if (!actingEffective.includes("org.manage")) throw new Error("لا تملك صلاحية تعديل الهيكل التنظيمي");
      if (!OrgTree.isWithinScope(OrgData.units, actingUser.orgUnitId, parentId)) {
        throw new Error("الإضافة تتجاوز نطاق صلاحيتك التنظيمي");
      }
    }

    const newUnit = { id: `${level.toUpperCase()}-${Date.now()}`, name: name.trim(), level, parentId };
    OrgData.units.push(newUnit);

    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: new Date().toISOString(),
      actorId: actingUser.id,
      actorName: actingUser.name,
      eventType: "إضافة وحدة تنظيمية",
      description: `أُضيفت وحدة «${newUnit.name}» تحت ${parent.name}`,
    });

    return { ...newUnit };
  }

  async function transferPersonnelUnit(personnelId, newUnitId) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    const person = MockData.users.find((u) => u.id === personnelId);
    if (!person) throw new Error("المنسوب غير موجود");
    const newUnit = OrgTree.findUnit(OrgData.units, newUnitId);
    if (!newUnit) throw new Error("الوحدة التنظيمية غير موجودة");

    const actingEffective = Permissions.computeEffectivePermissions(actingUser);
    const isSuperAdmin = actingEffective.includes("platform.super_admin");
    if (!isSuperAdmin) {
      if (!actingEffective.includes("org.manage")) throw new Error("لا تملك صلاحية تعديل الهيكل التنظيمي");
      const withinOld = OrgTree.isWithinScope(OrgData.units, actingUser.orgUnitId, person.orgUnitId);
      const withinNew = OrgTree.isWithinScope(OrgData.units, actingUser.orgUnitId, newUnitId);
      if (!withinOld || !withinNew) throw new Error("النقل يتجاوز نطاق صلاحيتك التنظيمي");
    }

    const oldUnitId = person.orgUnitId;
    const oldUnit = OrgTree.findUnit(OrgData.units, oldUnitId);
    person.orgUnitId = newUnitId;

    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: new Date().toISOString(),
      actorId: actingUser.id,
      actorName: actingUser.name,
      eventType: "نقل تبعية تنظيمية",
      description: `نُقل ${person.name} من الوحدة ${oldUnit ? oldUnit.name : oldUnitId} إلى الوحدة ${newUnit.name}`,
    });

    return toPublicUser(person);
  }

  async function listPermissionCatalog() {
    return [...Permissions.PERMISSION_CATALOG];
  }

  async function getEffectivePermissions(userId) {
    const user = findUserById(userId);
    if (!user) return [];
    return Permissions.computeEffectivePermissions(user);
  }

  async function listManageablePersonnel() {
    const actingUserId = readCurrentUserId();
    const actingUser = findUserById(actingUserId);
    if (!actingUser) return [];
    const effective = Permissions.computeEffectivePermissions(actingUser);

    let candidates;
    if (effective.includes("platform.super_admin")) {
      candidates = MockData.users;
    } else if (effective.includes("permissions.manage_scoped")) {
      const scopeIds = OrgTree.getDescendantIds(OrgData.units, actingUser.orgUnitId);
      candidates = MockData.users.filter((u) => scopeIds.includes(u.orgUnitId));
    } else {
      candidates = [];
    }

    return candidates
      .filter((u) => u.id !== actingUserId)
      .map((u) => ({ id: u.id, name: u.name, role: u.role, orgUnitId: u.orgUnitId }));
  }

  async function setPermissionOverride(targetUserId, permissionKey, granted) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    const targetUser = findUserById(targetUserId);
    if (!targetUser) throw new Error("مستخدم غير موجود");
    if (actingUser.id === targetUser.id) throw new Error("لا يمكن تعديل صلاحياتك الخاصة");

    const catalogKeys = Permissions.PERMISSION_CATALOG.map((p) => p.key);
    if (!catalogKeys.includes(permissionKey)) throw new Error("صلاحية غير معروفة");

    if (!Permissions.canManagePermissionsFor(actingUser, targetUser, OrgData.units)) {
      throw new Error("لا تملك صلاحية إدارة صلاحيات هذا الشخص");
    }

    if (!Permissions.canGrantPermission(actingUser, targetUser, permissionKey, OrgData.units)) {
      throw new Error("هذه الصلاحية محجوزة للجهاز الرئيسي فقط");
    }

    targetUser.permissionOverrides = targetUser.permissionOverrides || {};
    targetUser.permissionOverrides[permissionKey] = granted;

    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: new Date().toISOString(),
      actorId: actingUser.id,
      actorName: actingUser.name,
      eventType: "تعديل صلاحية",
      description: `${granted ? "منح" : "سحب"} صلاحية «${permissionKey}» لـ ${targetUser.name}`,
    });

    return toPublicUser(targetUser);
  }

  function maskPersonnelRecord(p) {
    const actingUser = findUserById(readCurrentUserId());
    const canViewFullIdentity = !!(actingUser && actingUser.canViewFullIdentity);
    return {
      ...p,
      name: canViewFullIdentity ? p.name : Masking.maskPersonnelName(p.name),
      rank: Personnel.maskRank(p.rank, canViewFullIdentity),
    };
  }

  async function listPersonnel(filters) {
    return Personnel.searchPersonnel(PersonnelData.personnel, filters || {}).map(maskPersonnelRecord);
  }

  async function getPersonnel(id) {
    const p = Personnel.findPersonnelById(PersonnelData.personnel, id);
    return p ? maskPersonnelRecord(p) : null;
  }

  async function listCasesForPersonnel(personnelId) {
    return MockData.cases
      .filter((c) => c.personnelId === personnelId)
      .map((c) => ({ id: c.id, type: c.type, status: c.status, openedDate: c.openedDate }));
  }

  function assertPersonnelWriteAccess(actingUser, targetOrgUnitId) {
    const effective = Permissions.computeEffectivePermissions(actingUser);
    if (effective.includes("platform.super_admin")) return;
    if (!effective.includes("org.manage")) throw new Error("لا تملك صلاحية إدارة سجل المنسوبين");
    if (!OrgTree.isWithinScope(OrgData.units, actingUser.orgUnitId, targetOrgUnitId)) {
      throw new Error("هذا الإجراء يتجاوز نطاق صلاحيتك التنظيمي");
    }
  }

  async function addPersonnel(personnelNumber, name, rank, orgUnitId, joinDate) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    if (!personnelNumber || !personnelNumber.trim()) throw new Error("رقم المنسوب إلزامي");
    if (!name || !name.trim()) throw new Error("الاسم الكامل إلزامي");
    if (PersonnelData.personnel.some((p) => p.personnelNumber === personnelNumber.trim())) {
      throw new Error("رقم المنسوب مستخدم بالفعل");
    }
    const unit = OrgTree.findUnit(OrgData.units, orgUnitId);
    if (!unit) throw new Error("جهة العمل غير موجودة");

    assertPersonnelWriteAccess(actingUser, orgUnitId);

    const record = {
      id: personnelNumber.trim(),
      personnelNumber: personnelNumber.trim(),
      name: name.trim(),
      rank: rank ? rank.trim() : "",
      orgUnitId,
      joinDate: joinDate || null,
      status: "active",
    };
    PersonnelData.personnel.push(record);

    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: new Date().toISOString(),
      actorId: actingUser.id,
      actorName: actingUser.name,
      eventType: "إضافة منسوب",
      description: `أُضيف المنسوب «${record.name}» (${record.personnelNumber}) إلى ${unit.name}`,
    });

    return maskPersonnelRecord(record);
  }

  async function updatePersonnel(id, fields) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    const person = Personnel.findPersonnelById(PersonnelData.personnel, id);
    if (!person) throw new Error("المنسوب غير موجود");

    const f = fields || {};
    if (f.orgUnitId && !OrgTree.findUnit(OrgData.units, f.orgUnitId)) {
      throw new Error("جهة العمل غير موجودة");
    }

    assertPersonnelWriteAccess(actingUser, person.orgUnitId);
    if (f.orgUnitId && f.orgUnitId !== person.orgUnitId) {
      assertPersonnelWriteAccess(actingUser, f.orgUnitId);
    }

    if (f.name !== undefined) {
      if (!f.name || !String(f.name).trim()) throw new Error("الاسم الكامل إلزامي");
      person.name = String(f.name).trim();
    }
    if (f.rank !== undefined) person.rank = f.rank ? String(f.rank).trim() : "";
    if (f.joinDate !== undefined) person.joinDate = f.joinDate;
    if (f.orgUnitId !== undefined) person.orgUnitId = f.orgUnitId;

    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: new Date().toISOString(),
      actorId: actingUser.id,
      actorName: actingUser.name,
      eventType: "تحديث بيانات منسوب",
      description: `حُدّثت بيانات المنسوب «${person.name}» (${person.personnelNumber})`,
    });

    return maskPersonnelRecord(person);
  }

  async function archivePersonnel(id) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    const person = Personnel.findPersonnelById(PersonnelData.personnel, id);
    if (!person) throw new Error("المنسوب غير موجود");

    assertPersonnelWriteAccess(actingUser, person.orgUnitId);

    person.status = "archived";

    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: new Date().toISOString(),
      actorId: actingUser.id,
      actorName: actingUser.name,
      eventType: "أرشفة منسوب",
      description: `أُرشف المنسوب «${person.name}» (${person.personnelNumber})`,
    });

    return maskPersonnelRecord(person);
  }

  const LAB_STATUSES = ["قيد الانتظار", "جارٍ التنفيذ", "مكتمل", "ملغى"];

  function addCustodyEntry(test, event, actor) {
    test.custody.push({ event, actorId: actor.id, actorName: actor.name, timestamp: new Date().toISOString() });
    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      eventType: "تحليل مخبري",
      description: `${event} — فحص ${test.id}`,
    });
  }

  async function listLabTests(filters) {
    const f = filters || {};
    return LabData.tests
      .filter((t) => !f.caseId || t.caseId === f.caseId)
      .filter((t) => !f.personnelId || t.personnelId === f.personnelId)
      .map((t) => ({ ...t }));
  }

  async function getLabTest(id) {
    const t = LabData.tests.find((t) => t.id === id);
    return t ? { ...t } : null;
  }

  async function requestLabTest(personnelId, caseId, testType) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    if (!personnelId) throw new Error("يجب ربط الفحص بمنسوب");
    if (!testType || !testType.trim()) throw new Error("نوع الفحص إلزامي");
    if (caseId && !MockData.cases.some((c) => c.id === caseId)) throw new Error("القضية غير موجودة");

    const test = {
      id: `LAB-${LabData.tests.length + 1}-${Date.now()}`,
      personnelId,
      caseId: caseId || null,
      testType: testType.trim(),
      status: "قيد الانتظار",
      requestedAt: new Date().toISOString(),
      requestedBy: actingUser.id,
      result: null,
      custody: [],
    };
    addCustodyEntry(test, "طلب فحص جديد", actingUser);
    LabData.tests.push(test);
    return { ...test };
  }

  // طباعة دفعة أرقام عينات كباركود قبل أي ربط بمنسوب — تُستخدم ميدانيًا عند
  // جمع العينات، ثم تُقرأ لاحقًا عبر registerScannedSample لإكمال التسجيل.
  async function printSampleBatch(count) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "lab.print_samples");
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 200) throw new Error("عدد العينات يجب أن يكون بين 1 و 200");

    const maxNum = LabData.sampleBatches.reduce((max, s) => {
      const m = /SMP-(\d+)/.exec(s.sampleId);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);

    const now = new Date().toISOString();
    const issued = [];
    for (let i = 1; i <= n; i++) {
      const sampleId = `SMP-${String(maxNum + i).padStart(6, "0")}`;
      LabData.sampleBatches.push({ sampleId, printedAt: now, printedBy: actingUser.name, used: false });
      issued.push(sampleId);
    }

    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: now,
      actorId: actingUser.id,
      actorName: actingUser.name,
      eventType: "طباعة دفعة عينات",
      description: `طُبعت دفعة من ${n} رقم عينة (${issued[0]}${n > 1 ? " … " + issued[n - 1] : ""})`,
    });

    return issued;
  }

  // يُكمل تسجيل فحص من رقم عينة مطبوع مسبقًا (يُقرأ بجهاز باركود كإدخال
  // لوحة مفاتيح عادي) — يرفض أي رقم لم يُطبع من النظام أو سُجِّل مسبقًا،
  // فيحمي من عينات مزوَّرة أو مسح مكرر لنفس الملصق.
  async function registerScannedSample(sampleId, personnelId, caseId, testType) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "lab.register_sample");
    const id = (sampleId || "").trim();
    if (!id) throw new Error("رقم العينة إلزامي");
    const sample = LabData.sampleBatches.find((s) => s.sampleId === id);
    if (!sample) throw new Error("رقم العينة غير مطبوع من النظام");
    if (sample.used) throw new Error("رقم العينة هذا مُسجَّل مسبقًا");
    if (!personnelId) throw new Error("يجب ربط العينة بمنسوب");
    if (!testType || !testType.trim()) throw new Error("نوع الفحص إلزامي");
    if (caseId && !MockData.cases.some((c) => c.id === caseId)) throw new Error("القضية غير موجودة");

    sample.used = true;

    const test = {
      id: `LAB-${LabData.tests.length + 1}-${Date.now()}`,
      sampleId: id,
      personnelId,
      caseId: caseId || null,
      testType: testType.trim(),
      status: "قيد الانتظار",
      requestedAt: new Date().toISOString(),
      requestedBy: actingUser.id,
      result: null,
      custody: [],
    };
    addCustodyEntry(test, `تسجيل عينة ممسوحة (${id})`, actingUser);
    LabData.tests.push(test);
    return { ...test };
  }

  async function updateLabTestStatus(id, status) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    const test = LabData.tests.find((t) => t.id === id);
    if (!test) throw new Error("الفحص غير موجود");
    if (!LAB_STATUSES.includes(status)) throw new Error("حالة غير معروفة");

    test.status = status;
    addCustodyEntry(test, `تحديث الحالة إلى «${status}»`, actingUser);
    return { ...test };
  }

  function assertHasPermission(actingUser, key) {
    const effective = Permissions.computeEffectivePermissions(actingUser);
    if (effective.includes("platform.super_admin")) return;
    if (!effective.includes(key)) throw new Error("لا تملك صلاحية هذا الإجراء");
  }

  // فني مختبر يسجّل النتيجة → مدير شعبة الفحوص يراجعها → مدير الإدارة يعتمدها.
  // الفحص لا يصبح "مكتمل" ولا يُضاف لجدول القضية الزمني إلا بعد الاعتماد.
  async function submitLabResult(id, value, attachmentName) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "lab.enter_result");
    const test = LabData.tests.find((t) => t.id === id);
    if (!test) throw new Error("الفحص غير موجود");
    if (!value || !value.trim()) throw new Error("نتيجة الفحص إلزامية");

    test.result = {
      value: value.trim(),
      attachmentName: attachmentName || null,
      enteredBy: actingUser.id,
      enteredAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      approvedBy: null,
      approvedAt: null,
    };
    test.status = "جارٍ التنفيذ";
    addCustodyEntry(test, "تسجيل النتيجة (بانتظار المراجعة)", actingUser);
    return { ...test };
  }

  async function reviewLabResult(id, notes) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "lab.review_result");
    const test = LabData.tests.find((t) => t.id === id);
    if (!test) throw new Error("الفحص غير موجود");
    if (!test.result) throw new Error("لا توجد نتيجة مسجَّلة بعد لمراجعتها");

    test.result.reviewedBy = actingUser.id;
    test.result.reviewedAt = new Date().toISOString();
    test.result.reviewNotes = notes || null;
    addCustodyEntry(test, "مراجعة النتيجة (بانتظار الاعتماد)", actingUser);
    return { ...test };
  }

  async function approveLabResult(id) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "lab.approve_result");
    const test = LabData.tests.find((t) => t.id === id);
    if (!test) throw new Error("الفحص غير موجود");
    if (!test.result) throw new Error("لا توجد نتيجة مسجَّلة بعد لاعتمادها");
    if (!test.result.reviewedBy) throw new Error("النتيجة لم تُراجَع بعد");

    test.result.approvedBy = actingUser.id;
    test.result.approvedAt = new Date().toISOString();
    test.status = "مكتمل";
    addCustodyEntry(test, "اعتماد النتيجة", actingUser);

    if (test.caseId) {
      const c = MockData.cases.find((c) => c.id === test.caseId);
      if (c) {
        c.timeline.unshift({
          title: "اكتمل فحص مخبري",
          description: `فحص «${test.testType}» — النتيجة: ${test.result.value}`,
          timestamp: test.result.approvedAt,
          source: "human",
        });
      }
    }

    return { ...test };
  }

  const TRACK_STATUSES = ["نشط", "مكتمل", "متوقف"];

  async function listAwarenessTracks(filters) {
    const f = filters || {};
    return AwarenessData.tracks
      .filter((t) => !f.personnelId || t.personnelId === f.personnelId)
      .filter((t) => !f.caseId || t.caseId === f.caseId)
      .map((t) => ({ ...t }));
  }

  async function getAwarenessTrack(id) {
    const t = AwarenessData.tracks.find((t) => t.id === id);
    return t ? { ...t } : null;
  }

  async function createAwarenessTrack(personnelId, caseId, reason) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "awareness.manage");
    if (!personnelId) throw new Error("يجب ربط المسار بمنسوب");
    if (!reason || !reason.trim()) throw new Error("سبب إنشاء المسار إلزامي");

    const track = {
      id: `TAW-${AwarenessData.tracks.length + 1}-${Date.now()}`,
      personnelId,
      caseId: caseId || null,
      reason: reason.trim(),
      status: "نشط",
      statusHistory: [{ status: "نشط", reason: reason.trim(), actorId: actingUser.id, actorName: actingUser.name, timestamp: new Date().toISOString() }],
      sessions: [],
      evaluation: null,
    };
    AwarenessData.tracks.push(track);
    return { ...track };
  }

  async function updateTrackStatus(id, status, reason) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "awareness.manage");
    const track = AwarenessData.tracks.find((t) => t.id === id);
    if (!track) throw new Error("المسار غير موجود");
    if (!TRACK_STATUSES.includes(status)) throw new Error("حالة غير معروفة");
    if (!reason || !reason.trim()) throw new Error("سبب تغيير الحالة إلزامي");

    track.status = status;
    track.statusHistory.push({ status, reason: reason.trim(), actorId: actingUser.id, actorName: actingUser.name, timestamp: new Date().toISOString() });
    return { ...track };
  }

  async function addFollowUpSession(id, scheduledAt, attended, notes) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "awareness.manage");
    const track = AwarenessData.tracks.find((t) => t.id === id);
    if (!track) throw new Error("المسار غير موجود");

    track.sessions.push({
      id: `SESS-${track.sessions.length + 1}`,
      scheduledAt: scheduledAt || new Date().toISOString(),
      attended: !!attended,
      notes: notes || "",
      actorId: actingUser.id,
      actorName: actingUser.name,
      timestamp: new Date().toISOString(),
    });
    return { ...track };
  }

  async function evaluateTrack(id, rating, notes) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "awareness.evaluate");
    const track = AwarenessData.tracks.find((t) => t.id === id);
    if (!track) throw new Error("المسار غير موجود");
    if (!rating || !rating.trim()) throw new Error("التقييم إلزامي");

    track.evaluation = { rating: rating.trim(), notes: notes || "", actorId: actingUser.id, actorName: actingUser.name, timestamp: new Date().toISOString() };
    track.status = "مكتمل";
    track.statusHistory.push({ status: "مكتمل", reason: "تقييم ختامي: " + rating.trim(), actorId: actingUser.id, actorName: actingUser.name, timestamp: new Date().toISOString() });
    return { ...track };
  }

  // FR-SRCH-02: صلاحية عليا فقط، مفروضة هنا لا بالواجهة فقط.
  async function smartSearch(query) {
    const actingUser = findUserById(readCurrentUserId());
    if (!actingUser) throw new Error("لا توجد جلسة نشطة");
    assertHasPermission(actingUser, "platform.super_admin");
    const q = (query || "").trim();
    if (!q) throw new Error("نص البحث إلزامي");

    const personnel = Personnel.searchPersonnel(PersonnelData.personnel, { query: q, includeArchived: true }).map(maskPersonnelRecord);
    const cases = MockData.cases
      .filter((c) => c.id.includes(q) || c.realName.includes(q) || c.type.includes(q) || c.personnelId.includes(q))
      .map((c) => ({ id: c.id, type: c.type, status: c.status }));
    const labTests = LabData.tests
      .filter((t) => t.id.includes(q) || t.testType.includes(q) || t.personnelId.includes(q))
      .map((t) => ({ id: t.id, testType: t.testType, status: t.status }));
    const awarenessTracks = AwarenessData.tracks
      .filter((t) => t.id.includes(q) || t.reason.includes(q) || t.personnelId.includes(q))
      .map((t) => ({ id: t.id, reason: t.reason, status: t.status }));

    const moduleCount = [personnel, cases, labTests, awarenessTracks].filter((r) => r.length > 0).length;
    MockData.auditLog.unshift({
      id: `AL-${nextAuditId++}`,
      timestamp: new Date().toISOString(),
      actorId: actingUser.id,
      actorName: actingUser.name,
      eventType: "بحث ذكي",
      description: `استعلام بحث ذكي «${q}» — ${moduleCount} وحدات`,
    });

    return { personnel, cases, labTests, awarenessTracks };
  }

  const rawApi = {
    login,
    setCurrentUser,
    getCurrentUser,
    logout,
    getMetrics,
    listCases,
    getCase,
    addCase,
    decideCase,
    revealIdentity,
    listAuditLog,
    listOrgUnits,
    getOrgUnit,
    getOrgUnitStats,
    addOrgUnit,
    transferPersonnelUnit,
    listPermissionCatalog,
    getEffectivePermissions,
    listManageablePersonnel,
    setPermissionOverride,
    listPersonnel,
    getPersonnel,
    addPersonnel,
    updatePersonnel,
    archivePersonnel,
    listCasesForPersonnel,
    listLabTests,
    getLabTest,
    requestLabTest,
    printSampleBatch,
    registerScannedSample,
    updateLabTestStatus,
    submitLabResult,
    reviewLabResult,
    approveLabResult,
    listAwarenessTracks,
    getAwarenessTrack,
    createAwarenessTrack,
    updateTrackStatus,
    addFollowUpSession,
    evaluateTrack,
    smartSearch,
  };

  // This app has no real backend — every data module's array lives only in
  // this page's JS heap. Snapshot everything to localStorage after every
  // call so the next page load (a different module instance entirely)
  // hydrates from where this one left off, instead of resetting to the
  // static seed. Guarded per-module since not every page loads every
  // dependency (e.g. login.html never loads PersonnelData).
  function persistAll() {
    Persist.save("users", MockData.users);
    Persist.save("cases", MockData.cases);
    Persist.save("auditLog", MockData.auditLog);
    if (PersonnelData) Persist.save("personnel", PersonnelData.personnel);
    if (LabData) Persist.save("labTests", LabData.tests);
    if (LabData) Persist.save("labSampleBatches", LabData.sampleBatches);
    if (AwarenessData) Persist.save("awarenessTracks", AwarenessData.tracks);
    if (OrgData) Persist.save("orgUnits", OrgData.units);
  }

  // Only mutators persist. If a page's hydration ever misses (a stale
  // cached script, a storage error), a read must NEVER write back — that
  // would silently overwrite good saved data with this page's unhydrated
  // in-memory seed, turning one page's transient glitch into permanent
  // data loss for every page after it.
  const MUTATORS = new Set([
    "setCurrentUser", "logout",
    "addCase", "decideCase", "revealIdentity",
    "addOrgUnit", "transferPersonnelUnit", "setPermissionOverride",
    "addPersonnel", "updatePersonnel", "archivePersonnel",
    "requestLabTest", "printSampleBatch", "registerScannedSample", "updateLabTestStatus", "submitLabResult", "reviewLabResult", "approveLabResult",
    "createAwarenessTrack", "updateTrackStatus", "addFollowUpSession", "evaluateTrack",
    "smartSearch",
  ]);

  const api = {};
  Object.keys(rawApi).forEach((name) => {
    if (!MUTATORS.has(name)) {
      api[name] = rawApi[name];
      return;
    }
    api[name] = async function (...args) {
      const result = await rawApi[name](...args);
      persistAll();
      return result;
    };
  });

  return api;
});
