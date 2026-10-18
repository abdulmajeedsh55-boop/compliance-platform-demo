(function () {
  "use strict";

  let currentUser = null;
  let catalog = [];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function groupByModule(items) {
    const groups = {};
    items.forEach((item) => {
      groups[item.module] = groups[item.module] || [];
      groups[item.module].push(item);
    });
    return groups;
  }

  async function renderMatrix(targetUserId) {
    const err = document.getElementById("permError");
    err.style.display = "none";
    const matrix = document.getElementById("permMatrix");

    const effective = await Api.getEffectivePermissions(targetUserId);
    const actingEffective = await Api.getEffectivePermissions(currentUser.id);
    const isHQ = actingEffective.includes("platform.super_admin");

    const groups = groupByModule(catalog);
    const html = Object.keys(groups)
      .map((moduleName) => {
        const rows = groups[moduleName]
          .map((perm) => {
            const checked = effective.includes(perm.key);
            const reserved = Permissions.RESERVED_PERMISSIONS.includes(perm.key);
            const disabled = reserved && !isHQ;
            const notes = [];
            if (reserved) notes.push('<div class="perm-reserved-note">صلاحية محجوزة — الجهاز الرئيسي فقط</div>');
            if (!perm.enforced) notes.push('<div class="perm-unenforced-note">هذه الصلاحية غير مُفعّلة بعد في بقية صفحات المنصة — التبديل هنا لا يغيّر شيئاً خارج هذه الشاشة حالياً</div>');
            return `<div class="perm-row${reserved ? " reserved" : ""}">
              <div>
                <div class="perm-label">${escapeHtml(perm.label)}</div>
                ${notes.join("")}
              </div>
              <label class="perm-toggle">
                <input type="checkbox" data-perm="${perm.key}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}>
                <span class="slider"></span>
              </label>
            </div>`;
          })
          .join("");
        return `<div class="perm-group"><div class="perm-group-head">${moduleName}</div>${rows}</div>`;
      })
      .join("");

    matrix.innerHTML = html;
    matrix.style.display = "block";

    matrix.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      input.addEventListener("change", async () => {
        const permKey = input.getAttribute("data-perm");
        try {
          await Api.setPermissionOverride(targetUserId, permKey, input.checked);
        } catch (e) {
          input.checked = !input.checked;
          err.textContent = e.message;
          err.style.display = "block";
        }
      });
    });
  }

  async function init() {
    currentUser = await Partials.initPartials();
    if (!currentUser) return;
    try {
      catalog = await Api.listPermissionCatalog();
      const actingEffective = await Api.getEffectivePermissions(currentUser.id);
      const isHQ = actingEffective.includes("platform.super_admin");
      document.getElementById("scopeNote").textContent = isHQ
        ? "عرض كامل — يمكنك إدارة صلاحيات جميع منسوبي المنصة."
        : "عرض جزئي — يمكنك إدارة صلاحيات من هم ضمن نطاقك التنظيمي فقط.";

      const people = await Api.listManageablePersonnel();
      const allUnits = await Api.listOrgUnits();
      const select = document.getElementById("personSelect");
      select.innerHTML =
        '<option value="">— اختر —</option>' +
        people
          .map((p) => {
            const path = OrgTree.getUnitPath(allUnits, p.orgUnitId)
              .map((u) => escapeHtml(u.name))
              .join(" ◂ ");
            return `<option value="${p.id}">${escapeHtml(p.name)} — ${path}</option>`;
          })
          .join("");
      select.addEventListener("change", () => {
        if (select.value) renderMatrix(select.value);
        else document.getElementById("permMatrix").style.display = "none";
      });
    } catch (e) {
      Partials.showPageError();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
