(function () {
  "use strict";

  let currentUser = null;
  let allUnits = [];
  let selectedPersonId = null;

  const LEVEL_DEPTH = { hq: 0, region: 1, department: 2, division: 3, section: 4 };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function unitName(unitId) {
    const unit = allUnits.find((u) => u.id === unitId);
    return unit ? unit.name : "—";
  }

  function unitOptionsHtml() {
    return allUnits
      .map((u) => `<option value="${escapeHtml(u.id)}">${"— ".repeat(LEVEL_DEPTH[u.level] || 0)}${escapeHtml(u.name)}</option>`)
      .join("");
  }

  function currentFilters() {
    return {
      query: document.getElementById("searchInput").value.trim(),
      orgUnitId: document.getElementById("orgUnitFilter").value || undefined,
      rank: document.getElementById("rankFilter").value || undefined,
      includeArchived: document.getElementById("includeArchivedCheckbox").checked,
    };
  }

  async function renderTable() {
    const list = await Api.listPersonnel(currentFilters());
    const tbody = document.getElementById("personnelBody");
    tbody.innerHTML = list
      .map(
        (p) => `<tr class="clickable" data-id="${escapeHtml(p.id)}">
          <td class="id">${escapeHtml(p.personnelNumber)}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.rank || "—")}</td>
          <td>${escapeHtml(unitName(p.orgUnitId))}</td>
          <td class="id">${escapeHtml(p.joinDate || "—")}</td>
          <td><span class="tag ${p.status === "archived" ? "neutral" : "success"}"><span class="dot"></span> ${p.status === "archived" ? "مؤرشف" : "نشط"}</span></td>
        </tr>`
      )
      .join("");
    tbody.querySelectorAll("tr[data-id]").forEach((row) => {
      row.addEventListener("click", () => openDetailDialog(row.dataset.id));
    });
  }

  async function populateRankFilterOptions() {
    const all = await Api.listPersonnel({ includeArchived: true });
    const ranks = Array.from(new Set(all.map((p) => p.rank).filter(Boolean))).sort();
    const select = document.getElementById("rankFilter");
    select.innerHTML = '<option value="">كل الرتب</option>' + ranks.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
  }

  function openAddDialog() {
    document.getElementById("addPersonnelError").style.display = "none";
    document.getElementById("addPersonnelNumberInput").value = "";
    document.getElementById("addPersonnelNameInput").value = "";
    document.getElementById("addPersonnelRankInput").value = "";
    document.getElementById("addPersonnelJoinDateInput").value = "";
    document.getElementById("addPersonnelUnitSelect").innerHTML = unitOptionsHtml();
    document.getElementById("addPersonnelDialog").style.display = "flex";
  }

  function closeAddDialog() {
    document.getElementById("addPersonnelDialog").style.display = "none";
  }

  async function confirmAddPersonnel() {
    const personnelNumber = document.getElementById("addPersonnelNumberInput").value;
    const name = document.getElementById("addPersonnelNameInput").value;
    const rank = document.getElementById("addPersonnelRankInput").value;
    const orgUnitId = document.getElementById("addPersonnelUnitSelect").value;
    const joinDate = document.getElementById("addPersonnelJoinDateInput").value;
    try {
      await Api.addPersonnel(personnelNumber, name, rank, orgUnitId, joinDate || null);
      closeAddDialog();
      await renderTable();
      await populateRankFilterOptions();
    } catch (e) {
      const err = document.getElementById("addPersonnelError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function openDetailDialog(personId) {
    const person = await Api.getPersonnel(personId);
    if (!person) return;
    selectedPersonId = personId;
    document.getElementById("detailName").textContent = person.name;
    document.getElementById("detailNumber").textContent = person.personnelNumber;
    document.getElementById("detailRank").textContent = person.rank || "—";
    document.getElementById("detailUnit").textContent = unitName(person.orgUnitId);
    document.getElementById("detailJoinDate").textContent = person.joinDate || "—";
    document.getElementById("detailStatus").textContent = person.status === "archived" ? "مؤرشف" : "نشط";

    const cases = await Api.listCasesForPersonnel(personId);
    const casesList = document.getElementById("detailCasesList");
    casesList.innerHTML = cases.length
      ? cases.map((c) => `<div>${escapeHtml(c.id)} — ${escapeHtml(c.type)} — ${escapeHtml(c.status)}</div>`).join("")
      : "لا توجد قضايا مرتبطة.";

    const archiveBtn = document.getElementById("archivePersonnelBtn");
    archiveBtn.style.display = person.status === "archived" ? "none" : "inline-flex";
    document.getElementById("detailArchiveError").style.display = "none";

    document.getElementById("personnelDetailDialog").style.display = "flex";
  }

  function closeDetailDialog() {
    document.getElementById("personnelDetailDialog").style.display = "none";
    selectedPersonId = null;
  }

  async function confirmArchive() {
    if (!selectedPersonId) return;
    try {
      await Api.archivePersonnel(selectedPersonId);
      closeDetailDialog();
      await renderTable();
    } catch (e) {
      const err = document.getElementById("detailArchiveError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function init() {
    currentUser = await Partials.initPartials();
    if (!currentUser) return;
    try {
      allUnits = await Api.listOrgUnits();
      document.getElementById("orgUnitFilter").innerHTML = '<option value="">كل جهات العمل</option>' + unitOptionsHtml();
      await populateRankFilterOptions();
      await renderTable();

      document.getElementById("searchInput").addEventListener("input", renderTable);
      document.getElementById("orgUnitFilter").addEventListener("change", renderTable);
      document.getElementById("rankFilter").addEventListener("change", renderTable);
      document.getElementById("includeArchivedCheckbox").addEventListener("change", renderTable);

      document.getElementById("openAddPersonnelBtn").addEventListener("click", openAddDialog);
      document.getElementById("addPersonnelConfirmBtn").addEventListener("click", confirmAddPersonnel);
      document.getElementById("addPersonnelCancelBtn").addEventListener("click", closeAddDialog);

      document.getElementById("detailCloseBtn").addEventListener("click", closeDetailDialog);
      document.getElementById("archivePersonnelBtn").addEventListener("click", confirmArchive);
    } catch (e) {
      Partials.showPageError();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
