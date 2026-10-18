(function () {
  "use strict";

  let currentUser = null;
  let allUnits = [];

  const LEVEL_LABELS = { hq: "الجهاز الرئيسي", region: "منطقة رئيسية", department: "إدارة", division: "شعبة", section: "قسم" };
  const LEVEL_DEPTH = { hq: 0, region: 1, department: 2, division: 3, section: 4 };
  const CHILD_LEVEL_OF = { region: "department", department: "division", division: "section" };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function renderNode(unit, container) {
    const stats = await Api.getOrgUnitStats(unit.id);
    const children = allUnits.filter((u) => u.parentId === unit.id);
    const node = document.createElement("div");
    node.className = "org-node";
    node.innerHTML = `
      <div class="org-node-head" data-unit="${unit.id}">
        ${children.length ? '<button type="button" class="org-toggle">▾</button>' : '<span class="org-toggle-spacer"></span>'}
        <span class="org-name">${escapeHtml(unit.name)}</span>
        <span class="org-level-tag">${LEVEL_LABELS[unit.level] || unit.level}</span>
        <span class="org-stats">👤 ${stats.personnelCount} · 📁 ${stats.openCaseCount}</span>
      </div>
      <div class="org-children"></div>
    `;
    container.appendChild(node);
    const childrenContainer = node.querySelector(".org-children");
    for (const child of children) {
      await renderNode(child, childrenContainer);
    }
    const toggleBtn = node.querySelector(".org-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const collapsed = childrenContainer.style.display === "none";
        childrenContainer.style.display = collapsed ? "block" : "none";
        toggleBtn.textContent = collapsed ? "▾" : "▸";
      });
    }
  }

  async function renderTree() {
    allUnits = await Api.listOrgUnits();
    const rootUnit = allUnits.find((u) => u.level === "hq");
    const container = document.getElementById("orgTree");
    container.innerHTML = "";
    if (rootUnit) await renderNode(rootUnit, container);
  }

  function populateUnitSelect(selectEl) {
    selectEl.innerHTML = allUnits
      .map((u) => `<option value="${u.id}">${"— ".repeat(LEVEL_DEPTH[u.level] || 0)}${escapeHtml(u.name)}</option>`)
      .join("");
  }

  function openTransferDialog() {
    document.getElementById("transferError").style.display = "none";
    document.getElementById("transferDialog").style.display = "flex";
  }

  function closeTransferDialog() {
    document.getElementById("transferDialog").style.display = "none";
  }

  async function confirmTransfer() {
    const personnelId = document.getElementById("transferPersonSelect").value;
    const newUnitId = document.getElementById("transferUnitSelect").value;
    try {
      await Api.transferPersonnelUnit(personnelId, newUnitId);
      closeTransferDialog();
      await renderTree();
    } catch (e) {
      const err = document.getElementById("transferError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  function populateParentUnitSelect(selectEl) {
    // A section is always a leaf — it can never be a parent, so it's excluded here.
    selectEl.innerHTML = allUnits
      .filter((u) => u.level !== "section")
      .map((u) => `<option value="${u.id}">${"— ".repeat(LEVEL_DEPTH[u.level] || 0)}${escapeHtml(u.name)}</option>`)
      .join("");
  }

  function openAddUnitDialog() {
    document.getElementById("addUnitError").style.display = "none";
    document.getElementById("addUnitNameInput").value = "";
    populateParentUnitSelect(document.getElementById("addUnitParentSelect"));
    document.getElementById("addUnitDialog").style.display = "flex";
  }

  function closeAddUnitDialog() {
    document.getElementById("addUnitDialog").style.display = "none";
  }

  async function confirmAddUnit() {
    const parentId = document.getElementById("addUnitParentSelect").value;
    const name = document.getElementById("addUnitNameInput").value;
    const parent = allUnits.find((u) => u.id === parentId);
    const level = parent ? CHILD_LEVEL_OF[parent.level] : null;
    try {
      if (!level) throw new Error("لا يمكن إضافة وحدة تحت هذه الوحدة الأم");
      await Api.addOrgUnit(parentId, name, level);
      closeAddUnitDialog();
      await renderTree();
      populateUnitSelect(document.getElementById("transferUnitSelect"));
    } catch (e) {
      const err = document.getElementById("addUnitError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function init() {
    currentUser = await Partials.initPartials();
    if (!currentUser) return;
    try {
      await renderTree();

      const personSelect = document.getElementById("transferPersonSelect");
      const manageable = await Api.listManageablePersonnel();
      personSelect.innerHTML = manageable.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");

      const unitSelect = document.getElementById("transferUnitSelect");
      populateUnitSelect(unitSelect);

      document.getElementById("openTransferBtn").addEventListener("click", openTransferDialog);
      document.getElementById("transferConfirmBtn").addEventListener("click", confirmTransfer);
      document.getElementById("transferCancelBtn").addEventListener("click", closeTransferDialog);

      document.getElementById("openAddUnitBtn").addEventListener("click", openAddUnitDialog);
      document.getElementById("addUnitConfirmBtn").addEventListener("click", confirmAddUnit);
      document.getElementById("addUnitCancelBtn").addEventListener("click", closeAddUnitDialog);
    } catch (e) {
      Partials.showPageError();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
