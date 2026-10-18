(function () {
  "use strict";

  const SYNC_WAIT_ALERT_DAYS = 7;
  let currentCase = null;
  let pendingAction = null;
  let currentUser = null;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getCaseIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || "CS-2026-0148";
  }

  function renderHeader(c) {
    document.getElementById("crumbCaseId").textContent = c.id;
    document.getElementById("caseIdHeading").textContent = c.id;
    document.getElementById("caseSubline").innerHTML =
      `${c.type} — فُتحت بتاريخ ${c.openedDate} · مرتبطة بسجل المنسوب رقم <span class="mono">${c.personnelId}</span>`;

    const sourceBadge = document.getElementById("sourceBadge");
    sourceBadge.textContent = c.source;
    sourceBadge.className = "tag " + (c.source === "واردة من الجهة" ? "info" : "neutral");

    const displayStatus = Format.getCaseDisplayStatus(c);
    const variant = Format.getCaseTagVariant(displayStatus);
    document.getElementById("statusTag").className = "tag " + variant;
    document.getElementById("statusTagLabel").textContent = displayStatus;
  }

  function renderSyncBanner(c) {
    const banner = document.getElementById("syncStatusBanner");
    if (!c.syncStatus || !c.syncStatus.awaiting) {
      banner.style.display = "none";
      return;
    }
    const since = new Date(c.syncStatus.since);
    const days = Math.floor((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000));
    const overdue = days >= SYNC_WAIT_ALERT_DAYS;
    banner.style.display = "block";
    banner.style.background = overdue ? "var(--error-50)" : "var(--warn-50)";
    banner.style.borderColor = overdue ? "var(--error-200)" : "var(--warn-200)";
    banner.style.color = overdue ? "var(--error-700)" : "var(--warn-700)";
    banner.textContent = `بانتظار رد الجهة الخارجية منذ ${Math.max(days, 0)} يوم${overdue ? " — تجاوز المدة المعتادة" : ""}`;
  }

  function renderInfo(c) {
    document.getElementById("infoType").textContent = c.type;
    document.getElementById("infoReportingEntity").textContent = c.reportingEntity;
    document.getElementById("infoOfficer").textContent = c.officer || "— غير مُسندة —";
    document.getElementById("infoOpenedDate").textContent = c.openedDate;
    document.getElementById("infoDeadline").textContent = `${c.deadlineDays} يومًا (تنتهي ${c.deadlineDate})`;
    document.getElementById("infoSensitivity").textContent = c.sensitivity;
    document.getElementById("infoDescriptionItem").style.display = c.description ? "block" : "none";
    if (c.description) document.getElementById("infoDescription").textContent = c.description;
  }

  function renderTimeline(c) {
    const html = c.timeline
      .map((ev) => {
        const isSystem = ev.source === "system";
        const dt = new Date(ev.timestamp);
        const dateStr = dt.toISOString().slice(0, 10);
        const timeStr = dt.toISOString().slice(11, 16);
        return `<div class="tl-item">
          <div class="tl-dot${isSystem ? " neutral" : ""}"></div>
          <div class="tl-body"><b>${ev.title}${isSystem ? " <span class=\"mono\" style=\"font-size:10px; color:var(--text-faint)\">(تكامل آلي)</span>" : ""}</b><span>${ev.description}</span><time>${dateStr} — ${timeStr}</time></div>
        </div>`;
      })
      .join("");
    document.getElementById("timeline").innerHTML = html;
  }

  function renderPersonnel(c) {
    document.getElementById("personnelId").textContent = c.personnelId;
    document.getElementById("personnelRank").textContent = c.personnelSummary.rank;
    document.getElementById("personnelBranch").textContent = c.personnelSummary.branch;
    document.getElementById("personnelPriorCases").textContent = c.personnelSummary.priorCases;
  }

  function renderVerdict(c) {
    const panel = document.getElementById("verdictPanel");
    if (!c.verdict) {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "block";
    document.getElementById("verdictType").textContent = c.verdict.type;
    document.getElementById("verdictPenaltyType").textContent = c.verdict.penaltyType;
    document.getElementById("verdictPenaltyDescription").textContent = c.verdict.penaltyDescription;
    document.getElementById("verdictIssuedDate").textContent = c.verdict.issuedDate;
    document.getElementById("verdictIssuingAuthority").textContent = c.verdict.issuingAuthority;
    document.getElementById("verdictDocument").textContent = c.verdict.documentName;
  }

  async function renderLinked(c) {
    const [labTests, tracks] = await Promise.all([Api.listLabTests({ caseId: c.id }), Api.listAwarenessTracks({ caseId: c.id })]);
    const panel = document.getElementById("linkedPanel");
    if (labTests.length === 0 && tracks.length === 0) {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "block";
    const labRows = labTests
      .map((t) => `<div class="field-row"><span class="k">فحص: ${escapeHtml(t.testType)}</span><a class="v" href="lab.html">${escapeHtml(t.status)}</a></div>`)
      .join("");
    const trackRows = tracks
      .map((t) => `<div class="field-row"><span class="k">توعية: ${escapeHtml(t.reason)}</span><a class="v" href="awareness.html">${escapeHtml(t.status)}</a></div>`)
      .join("");
    document.getElementById("linkedList").innerHTML = labRows + trackRows;
  }

  function renderAttachments(c) {
    const html = c.attachments
      .map((a) => `<div class="attach-item"><div class="fi">${a.type}</div><div class="name">${a.name}</div><div class="size">${a.size}</div></div>`)
      .join("");
    document.getElementById("attachmentsList").innerHTML = html || `<div class="attach-item"><div class="name">لا توجد مرفقات</div></div>`;
  }

  function renderActionState(c) {
    const closed = c.status === "مغلقة";
    ["approveBtn", "rejectBtn", "escalateBtn"].forEach((id) => {
      document.getElementById(id).disabled = closed;
    });
  }

  function showDecisionError(message) {
    const err = document.getElementById("decisionError");
    err.textContent = message;
    err.style.display = "block";
  }

  function openDecisionDialog(action, title) {
    pendingAction = action;
    document.getElementById("decisionDialogTitle").textContent = title;
    document.getElementById("decisionReason").value = "";
    document.getElementById("decisionError").style.display = "none";
    document.getElementById("decisionStep1").classList.add("active");
    document.getElementById("decisionStep2").classList.remove("active");
    document.getElementById("decisionBackBtn").style.display = "none";
    const isApprove = action === "معتمدة";
    document.getElementById("decisionNextBtn").style.display = isApprove ? "inline-flex" : "none";
    document.getElementById("decisionConfirmBtn").style.display = isApprove ? "none" : "inline-flex";
    if (isApprove) {
      document.getElementById("verdictIssuedDateInput").value = new Date().toISOString().slice(0, 10);
      document.getElementById("verdictPenaltyDescriptionInput").value = "";
      document.getElementById("verdictIssuingAuthorityInput").value = "";
      document.getElementById("verdictDocumentInput").value = "";
    }
    document.getElementById("decisionDialog").style.display = "flex";
  }

  function goToVerdictStep() {
    if (!document.getElementById("decisionReason").value.trim()) {
      showDecisionError("سبب القرار إلزامي.");
      return;
    }
    document.getElementById("decisionError").style.display = "none";
    document.getElementById("decisionStep1").classList.remove("active");
    document.getElementById("decisionStep2").classList.add("active");
    document.getElementById("decisionNextBtn").style.display = "none";
    document.getElementById("decisionConfirmBtn").style.display = "inline-flex";
    document.getElementById("decisionBackBtn").style.display = "inline-flex";
  }

  function backToReasonStep() {
    document.getElementById("decisionError").style.display = "none";
    document.getElementById("decisionStep2").classList.remove("active");
    document.getElementById("decisionStep1").classList.add("active");
    document.getElementById("decisionConfirmBtn").style.display = "none";
    document.getElementById("decisionBackBtn").style.display = "none";
    document.getElementById("decisionNextBtn").style.display = "inline-flex";
  }

  function closeDecisionDialog() {
    document.getElementById("decisionDialog").style.display = "none";
    pendingAction = null;
  }

  async function confirmDecision() {
    const reason = document.getElementById("decisionReason").value;
    if (!reason.trim()) {
      showDecisionError("سبب القرار إلزامي.");
      return;
    }
    let verdict;
    if (pendingAction === "معتمدة") {
      verdict = {
        type: document.getElementById("verdictTypeInput").value,
        penaltyType: document.getElementById("verdictPenaltyTypeInput").value,
        penaltyDescription: document.getElementById("verdictPenaltyDescriptionInput").value,
        issuedDate: document.getElementById("verdictIssuedDateInput").value,
        issuingAuthority: document.getElementById("verdictIssuingAuthorityInput").value,
        documentName: document.getElementById("verdictDocumentInput").value,
      };
      if (!verdict.penaltyDescription.trim() || !verdict.issuedDate.trim() || !verdict.issuingAuthority.trim()) {
        const err = document.getElementById("decisionError");
        err.textContent = "بيانات الحكم والجزاء إلزامية عند الاعتماد.";
        err.style.display = "block";
        return;
      }
    }
    try {
      currentCase = await Api.decideCase(currentCase.id, pendingAction, reason, currentUser.id, verdict);
    } catch (e) {
      const err = document.getElementById("decisionError");
      err.textContent = e.message || "تعذّر تنفيذ القرار. يرجى المحاولة مرة أخرى.";
      err.style.display = "block";
      return;
    }
    closeDecisionDialog();
    renderAll(currentCase);
  }

  function renderAll(c) {
    renderHeader(c);
    renderSyncBanner(c);
    renderInfo(c);
    renderTimeline(c);
    renderPersonnel(c);
    renderLinked(c);
    renderVerdict(c);
    renderAttachments(c);
    renderActionState(c);
  }

  async function init() {
    try {
      const user = await Partials.initPartials();
      if (!user) return;
      currentUser = user;

      const id = getCaseIdFromUrl();
      currentCase = await Api.getCase(id);
      if (!currentCase) {
        document.querySelector("main.app-content").innerHTML = `<p>لم يتم العثور على القضية ${id}.</p>`;
        return;
      }
      renderAll(currentCase);

      document.getElementById("approveBtn").addEventListener("click", () => openDecisionDialog("معتمدة", "تأكيد اعتماد القضية"));
      document.getElementById("rejectBtn").addEventListener("click", () => openDecisionDialog("مرفوضة", "تأكيد رفض القضية"));
      document.getElementById("escalateBtn").addEventListener("click", () => openDecisionDialog("تصعيد داخلي", "تأكيد تصعيد القضية"));
      document.getElementById("decisionNextBtn").addEventListener("click", goToVerdictStep);
      document.getElementById("decisionBackBtn").addEventListener("click", backToReasonStep);
      document.getElementById("decisionConfirmBtn").addEventListener("click", confirmDecision);
      document.getElementById("decisionCancelBtn").addEventListener("click", closeDecisionDialog);
    } catch (e) {
      Partials.showPageError();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
