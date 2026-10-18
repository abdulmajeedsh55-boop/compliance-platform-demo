(function () {
  "use strict";

  let selectedId = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function renderTable() {
    const tracks = await Api.listAwarenessTracks({});
    const tbody = document.getElementById("tracksBody");
    tbody.innerHTML = tracks
      .map(
        (t) => `<tr class="clickable" data-id="${escapeHtml(t.id)}">
          <td class="id">${escapeHtml(t.id)}</td>
          <td>${escapeHtml(t.personnelId)}</td>
          <td class="id">${escapeHtml(t.caseId || "—")}</td>
          <td>${escapeHtml(t.reason)}</td>
          <td>${escapeHtml(t.status)}</td>
        </tr>`
      )
      .join("");
    tbody.querySelectorAll("tr[data-id]").forEach((row) => {
      row.addEventListener("click", () => openDetail(row.dataset.id));
    });
  }

  function openCreateDialog() {
    document.getElementById("createError").style.display = "none";
    document.getElementById("createReasonInput").value = "";
    document.getElementById("createDialog").style.display = "flex";
  }

  function closeCreateDialog() {
    document.getElementById("createDialog").style.display = "none";
  }

  async function confirmCreate() {
    const personnelId = document.getElementById("createPersonnelSelect").value;
    const caseId = document.getElementById("createCaseSelect").value || null;
    const reason = document.getElementById("createReasonInput").value;
    try {
      await Api.createAwarenessTrack(personnelId, caseId, reason);
      closeCreateDialog();
      await renderTable();
    } catch (e) {
      const err = document.getElementById("createError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function openDetail(id) {
    const t = await Api.getAwarenessTrack(id);
    if (!t) return;
    selectedId = id;
    document.getElementById("detailTitle").textContent = `${t.id} — ${t.reason}`;
    document.getElementById("statusSelect").value = t.status;
    document.getElementById("statusReasonInput").value = "";
    document.getElementById("sessionsList").innerHTML = t.sessions.length
      ? t.sessions.map((s) => `<div>${escapeHtml(s.scheduledAt.slice(0, 16).replace("T", " "))} — ${s.attended ? "حضر" : "لم يحضر"} — ${escapeHtml(s.notes || "بلا ملاحظات")}</div>`).join("")
      : "لا توجد جلسات بعد.";
    document.getElementById("sessionNotesInput").value = "";
    document.getElementById("sessionAttendedCheckbox").checked = true;
    document.getElementById("evaluationDisplay").textContent = t.evaluation ? `${t.evaluation.rating} — ${t.evaluation.notes || ""}` : "لم يتم التقييم بعد.";
    document.getElementById("evalRatingInput").value = "";
    document.getElementById("evalNotesInput").value = "";
    document.getElementById("detailError").style.display = "none";
    document.getElementById("detailDialog").style.display = "flex";
  }

  function closeDetail() {
    document.getElementById("detailDialog").style.display = "none";
    selectedId = null;
  }

  async function saveStatus() {
    if (!selectedId) return;
    try {
      await Api.updateTrackStatus(selectedId, document.getElementById("statusSelect").value, document.getElementById("statusReasonInput").value);
      await openDetail(selectedId);
      await renderTable();
    } catch (e) {
      const err = document.getElementById("detailError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function addSession() {
    if (!selectedId) return;
    try {
      await Api.addFollowUpSession(selectedId, new Date().toISOString(), document.getElementById("sessionAttendedCheckbox").checked, document.getElementById("sessionNotesInput").value);
      await openDetail(selectedId);
    } catch (e) {
      const err = document.getElementById("detailError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function saveEvaluation() {
    if (!selectedId) return;
    try {
      await Api.evaluateTrack(selectedId, document.getElementById("evalRatingInput").value, document.getElementById("evalNotesInput").value);
      await openDetail(selectedId);
      await renderTable();
    } catch (e) {
      const err = document.getElementById("detailError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function init() {
    const currentUser = await Partials.initPartials();
    if (!currentUser) return;
    try {
      const personnel = await Api.listPersonnel({});
      document.getElementById("createPersonnelSelect").innerHTML = personnel
        .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.personnelNumber)})</option>`)
        .join("");

      const cases = await Api.listCases({});
      document.getElementById("createCaseSelect").insertAdjacentHTML(
        "beforeend",
        cases.items.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.id)}</option>`).join("")
      );

      await renderTable();

      document.getElementById("openCreateBtn").addEventListener("click", openCreateDialog);
      document.getElementById("createConfirmBtn").addEventListener("click", confirmCreate);
      document.getElementById("createCancelBtn").addEventListener("click", closeCreateDialog);

      document.getElementById("detailCloseBtn").addEventListener("click", closeDetail);
      document.getElementById("statusSaveBtn").addEventListener("click", saveStatus);
      document.getElementById("sessionAddBtn").addEventListener("click", addSession);
      document.getElementById("evalSaveBtn").addEventListener("click", saveEvaluation);
    } catch (e) {
      Partials.showPageError();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
