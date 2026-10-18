(function () {
  "use strict";

  const STATUS_TABS = ["الكل", "جديدة", "قيد المراجعة", "معتمدة", "مرفوضة", "مغلقة"];

  const state = {
    status: "الكل",
    search: "",
    type: "",
    days: "",
    orgUnitId: "",
    page: 1,
    currentUser: null,
  };

  function renderTabs(counts) {
    const html = STATUS_TABS.map((label) => {
      const active = label === state.status ? "active" : "";
      return `<button class="${active}" data-status="${label}">${label} <span class="count">${counts[label]}</span></button>`;
    }).join("");
    document.getElementById("statusTabs").innerHTML = html;
    document.querySelectorAll("#statusTabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.status = btn.getAttribute("data-status");
        state.page = 1;
        renderAll();
      });
    });
  }

  function displayName(c) {
    return Masking.maskPersonnelName(c.realName);
  }

  function renderRow(c, now) {
    const displayStatus = Format.getCaseDisplayStatus(c);
    const variant = Format.getCaseTagVariant(displayStatus);
    const relTime = Format.formatRelativeArabicTime(new Date(c.updatedAt), now);
    const officer = c.officer || "— غير مُسندة —";
    const canReveal = state.currentUser && state.currentUser.canViewFullIdentity;
    const nameCell = canReveal
      ? `<span class="masked-name" data-case="${c.id}">${displayName(c)}</span> <button type="button" class="reveal-btn" data-case="${c.id}" title="عرض الهوية الكاملة" style="border:none;background:none;cursor:pointer;">🔓</button>`
      : `<span>${displayName(c)}</span>`;
    return `<tr class="clickable"><td class="id" onclick="location.href='case-detail.html?id=${c.id}'">${c.id}</td><td>${nameCell}</td><td onclick="location.href='case-detail.html?id=${c.id}'">${c.type}</td><td onclick="location.href='case-detail.html?id=${c.id}'"><span class="tag ${variant}"><span class="dot"></span> ${displayStatus}</span></td><td onclick="location.href='case-detail.html?id=${c.id}'">${officer}</td><td class="id" onclick="location.href='case-detail.html?id=${c.id}'">${relTime}</td></tr>`;
  }

  async function onRevealClick(e) {
    const btn = e.target.closest(".reveal-btn");
    if (!btn) return;
    const caseId = btn.getAttribute("data-case");
    try {
      const realName = await Api.revealIdentity(caseId);
      const span = document.querySelector(`.masked-name[data-case="${caseId}"]`);
      if (span) span.textContent = realName;
      btn.remove();
    } catch (e) {
      Partials.showPageError();
    }
  }

  function renderPager(total, pageSize, page) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    let buttons = "";
    for (let p = 1; p <= totalPages; p++) {
      buttons += `<button class="${p === page ? "active" : ""}" data-page="${p}">${p}</button>`;
    }
    document.getElementById("pager").innerHTML = `
      <span>عرض ${from}–${to} من ${total}</span>
      <div class="pbtns">${buttons}</div>
    `;
    document.querySelectorAll("#pager .pbtns button").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.page = Number(btn.getAttribute("data-page"));
        renderAll();
      });
    });
  }

  async function renderAll() {
    const result = await Api.listCases({
      status: state.status,
      search: state.search,
      type: state.type,
      days: state.days ? Number(state.days) : undefined,
      orgUnitId: state.orgUnitId,
      page: state.page,
    });
    renderTabs(result.statusCounts);
    const now = new Date();
    document.getElementById("casesBody").innerHTML = result.items.map((c) => renderRow(c, now)).join("");
    renderPager(result.total, result.pageSize, result.page);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function openAddCaseDialog() {
    document.getElementById("addCaseError").style.display = "none";
    const personnel = await Api.listPersonnel({});
    document.getElementById("addCasePersonnelSelect").innerHTML = personnel
      .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.personnelNumber)})</option>`)
      .join("");
    const units = await Api.listOrgUnits();
    const LEVEL_DEPTH = { hq: 0, region: 1, department: 2, division: 3, section: 4 };
    document.getElementById("addCaseUnitSelect").innerHTML = units
      .map((u) => `<option value="${escapeHtml(u.id)}">${"— ".repeat(LEVEL_DEPTH[u.level] || 0)}${escapeHtml(u.name)}</option>`)
      .join("");
    document.getElementById("addCaseDialog").style.display = "flex";
  }

  function closeAddCaseDialog() {
    document.getElementById("addCaseDialog").style.display = "none";
  }

  async function confirmAddCase() {
    const personnelId = document.getElementById("addCasePersonnelSelect").value;
    const type = document.getElementById("addCaseTypeSelect").value;
    const sensitivity = document.getElementById("addCaseSensitivitySelect").value;
    const orgUnitId = document.getElementById("addCaseUnitSelect").value;
    const description = document.getElementById("addCaseDescriptionInput").value;
    try {
      await Api.addCase(personnelId, type, sensitivity, orgUnitId, description);
      document.getElementById("addCaseDescriptionInput").value = "";
      closeAddCaseDialog();
      state.page = 1;
      await renderAll();
    } catch (e) {
      const err = document.getElementById("addCaseError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function init() {
    try {
      const user = await Partials.initPartials();
      if (!user) return;
      state.currentUser = user;

      document.getElementById("casesBody").addEventListener("click", onRevealClick);
      document.getElementById("searchInput").addEventListener("input", (e) => {
        state.search = e.target.value;
        state.page = 1;
        renderAll();
      });

      document.getElementById("openAddCaseBtn").addEventListener("click", openAddCaseDialog);
      document.getElementById("addCaseConfirmBtn").addEventListener("click", confirmAddCase);
      document.getElementById("addCaseCancelBtn").addEventListener("click", closeAddCaseDialog);

      document.getElementById("typeFilter").addEventListener("change", (e) => {
        state.type = e.target.value;
        state.page = 1;
        renderAll();
      });
      document.getElementById("daysFilter").addEventListener("change", (e) => {
        state.days = e.target.value;
        state.page = 1;
        renderAll();
      });
      const units = await Api.listOrgUnits();
      const LEVEL_DEPTH = { hq: 0, region: 1, department: 2, division: 3, section: 4 };
      document.getElementById("branchFilter").insertAdjacentHTML(
        "beforeend",
        units.map((u) => `<option value="${escapeHtml(u.id)}">${"— ".repeat(LEVEL_DEPTH[u.level] || 0)}${escapeHtml(u.name)}</option>`).join("")
      );
      document.getElementById("branchFilter").addEventListener("change", (e) => {
        state.orgUnitId = e.target.value;
        state.page = 1;
        renderAll();
      });

      await renderAll();
    } catch (e) {
      Partials.showPageError();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
