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
    const tests = await Api.listLabTests({});
    const tbody = document.getElementById("labBody");
    tbody.innerHTML = tests
      .map(
        (t) => `<tr class="clickable" data-id="${escapeHtml(t.id)}">
          <td class="id">${escapeHtml(t.id)}</td>
          <td>${escapeHtml(t.personnelId)}</td>
          <td class="id">${escapeHtml(t.caseId || "—")}</td>
          <td>${escapeHtml(t.testType)}</td>
          <td>${escapeHtml(t.status)}</td>
          <td class="id">${escapeHtml(t.requestedAt.slice(0, 10))}</td>
        </tr>`
      )
      .join("");
    tbody.querySelectorAll("tr[data-id]").forEach((row) => {
      row.addEventListener("click", () => openDetail(row.dataset.id));
    });
  }

  function openRequestDialog() {
    document.getElementById("reqError").style.display = "none";
    document.getElementById("reqTypeInput").value = "";
    document.getElementById("requestDialog").style.display = "flex";
  }

  function closeRequestDialog() {
    document.getElementById("requestDialog").style.display = "none";
  }

  async function confirmRequest() {
    const personnelId = document.getElementById("reqPersonnelSelect").value;
    const caseId = document.getElementById("reqCaseSelect").value || null;
    const testType = document.getElementById("reqTypeInput").value;
    try {
      await Api.requestLabTest(personnelId, caseId, testType);
      closeRequestDialog();
      await renderTable();
    } catch (e) {
      const err = document.getElementById("reqError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  function openPrintBatchDialog() {
    document.getElementById("printBatchError").style.display = "none";
    document.getElementById("printBatchCountInput").value = "10";
    document.getElementById("printBatchDialog").style.display = "flex";
  }

  function closePrintBatchDialog() {
    document.getElementById("printBatchDialog").style.display = "none";
  }

  function renderPrintArea(sampleIds) {
    const labels = sampleIds
      .map((id) => `<div class="barcode-label"><div class="bars">*${id}*</div><div class="code">${id}</div></div>`)
      .join("");
    const rows = sampleIds.map((id) => `<tr><td>${id}</td><td class="name-cell"></td></tr>`).join("");
    document.getElementById("printArea").innerHTML = `
      <div>${labels}</div>
      <div class="manifest-page">
        <h2>كشف مطابقة العينات — ${new Date().toISOString().slice(0, 10)}</h2>
        <table><thead><tr><th>رقم العينة</th><th>اسم المنسوب</th></tr></thead><tbody>${rows}</tbody></table>
      </div>`;
  }

  async function confirmPrintBatch() {
    const count = Number(document.getElementById("printBatchCountInput").value);
    try {
      const sampleIds = await Api.printSampleBatch(count);
      renderPrintArea(sampleIds);
      closePrintBatchDialog();
      window.print();
    } catch (e) {
      const err = document.getElementById("printBatchError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  function openRegisterScanDialog() {
    document.getElementById("scanError").style.display = "none";
    document.getElementById("scanSampleIdInput").value = "";
    document.getElementById("registerScanDialog").style.display = "flex";
    document.getElementById("scanSampleIdInput").focus();
  }

  function closeRegisterScanDialog() {
    document.getElementById("registerScanDialog").style.display = "none";
  }

  async function confirmRegisterScan() {
    const sampleId = document.getElementById("scanSampleIdInput").value;
    const personnelId = document.getElementById("scanPersonnelSelect").value;
    const caseId = document.getElementById("scanCaseSelect").value || null;
    const testType = document.getElementById("scanTypeInput").value;
    try {
      await Api.registerScannedSample(sampleId, personnelId, caseId, testType);
      document.getElementById("scanError").style.display = "none";
      document.getElementById("scanSampleIdInput").value = "";
      document.getElementById("scanSampleIdInput").focus();
      await renderTable();
    } catch (e) {
      const err = document.getElementById("scanError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function openDetail(id) {
    const t = await Api.getLabTest(id);
    if (!t) return;
    selectedId = id;
    document.getElementById("detailTitle").textContent = `${t.id} — ${t.testType}`;
    document.getElementById("detailStatusSelect").value = t.status;
    document.getElementById("detailResultInput").value = t.result ? t.result.value : "";
    document.getElementById("detailAttachmentInput").value = t.result ? t.result.attachmentName || "" : "";
    document.getElementById("detailCustodyList").innerHTML = t.custody
      .map((c) => `<div>${escapeHtml(c.timestamp.slice(0, 16).replace("T", " "))} — ${escapeHtml(c.actorName)} — ${escapeHtml(c.event)}</div>`)
      .join("");

    const r = t.result;
    const resultDone = !!r;
    const reviewDone = !!(r && r.reviewedBy);
    const approveDone = !!(r && r.approvedBy);

    document.getElementById("resultStatusDisplay").textContent = resultDone ? `سُجّلت بواسطة ${r.enteredBy} — ${r.enteredAt.slice(0, 16).replace("T", " ")}` : "لم تُسجَّل نتيجة بعد.";
    document.getElementById("resultForm").style.display = resultDone ? "none" : "block";

    document.getElementById("reviewNotesInput").value = "";
    document.getElementById("stageReview").style.display = resultDone ? "block" : "none";
    document.getElementById("reviewStatusDisplay").textContent = reviewDone ? `رُوجعت بواسطة ${r.reviewedBy} — ${r.reviewedAt.slice(0, 16).replace("T", " ")}${r.reviewNotes ? " — " + r.reviewNotes : ""}` : "بانتظار المراجعة.";
    document.getElementById("reviewForm").style.display = resultDone && !reviewDone ? "block" : "none";

    document.getElementById("stageApprove").style.display = reviewDone ? "block" : "none";
    document.getElementById("approveStatusDisplay").textContent = approveDone ? `اعتُمدت بواسطة ${r.approvedBy} — ${r.approvedAt.slice(0, 16).replace("T", " ")}` : "بانتظار الاعتماد.";
    document.getElementById("approveBtn").style.display = approveDone ? "none" : "inline-flex";

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
      await Api.updateLabTestStatus(selectedId, document.getElementById("detailStatusSelect").value);
      await openDetail(selectedId);
      await renderTable();
    } catch (e) {
      const err = document.getElementById("detailError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function saveResult() {
    if (!selectedId) return;
    try {
      await Api.submitLabResult(selectedId, document.getElementById("detailResultInput").value, document.getElementById("detailAttachmentInput").value);
      await openDetail(selectedId);
      await renderTable();
    } catch (e) {
      const err = document.getElementById("detailError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function review() {
    if (!selectedId) return;
    try {
      await Api.reviewLabResult(selectedId, document.getElementById("reviewNotesInput").value);
      await openDetail(selectedId);
    } catch (e) {
      const err = document.getElementById("detailError");
      err.textContent = e.message;
      err.style.display = "block";
    }
  }

  async function approve() {
    if (!selectedId) return;
    try {
      await Api.approveLabResult(selectedId);
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
      const personnelOptions = personnel
        .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${escapeHtml(p.personnelNumber)})</option>`)
        .join("");
      document.getElementById("reqPersonnelSelect").innerHTML = personnelOptions;
      document.getElementById("scanPersonnelSelect").innerHTML = personnelOptions;

      const cases = await Api.listCases({});
      const caseOptions = cases.items.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.id)}</option>`).join("");
      document.getElementById("reqCaseSelect").insertAdjacentHTML("beforeend", caseOptions);
      document.getElementById("scanCaseSelect").insertAdjacentHTML("beforeend", caseOptions);

      await renderTable();

      document.getElementById("openRequestBtn").addEventListener("click", openRequestDialog);
      document.getElementById("reqConfirmBtn").addEventListener("click", confirmRequest);
      document.getElementById("reqCancelBtn").addEventListener("click", closeRequestDialog);

      document.getElementById("openPrintBatchBtn").addEventListener("click", openPrintBatchDialog);
      document.getElementById("printBatchConfirmBtn").addEventListener("click", confirmPrintBatch);
      document.getElementById("printBatchCancelBtn").addEventListener("click", closePrintBatchDialog);

      document.getElementById("openRegisterScanBtn").addEventListener("click", openRegisterScanDialog);
      document.getElementById("scanConfirmBtn").addEventListener("click", confirmRegisterScan);
      document.getElementById("scanCancelBtn").addEventListener("click", closeRegisterScanDialog);
      document.getElementById("scanSampleIdInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") confirmRegisterScan();
      });

      document.getElementById("detailCloseBtn").addEventListener("click", closeDetail);
      document.getElementById("detailStatusBtn").addEventListener("click", saveStatus);
      document.getElementById("detailResultBtn").addEventListener("click", saveResult);
      document.getElementById("reviewBtn").addEventListener("click", review);
      document.getElementById("approveBtn").addEventListener("click", approve);
    } catch (e) {
      Partials.showPageError();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
