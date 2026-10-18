(function () {
  "use strict";

  const MFA_SECONDS = 5 * 60;
  const tracker = AuthRules.createLoginAttemptTracker(5);
  let countdownHandle = null;
  let remainingSeconds = MFA_SECONDS;
  let pendingUserId = null;

  function goStep(n) {
    document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
    document.getElementById("step" + n).classList.add("active");
  }

  function showError(message) {
    const el = document.getElementById("loginError");
    el.textContent = message;
    el.style.display = message ? "block" : "none";
  }

  function setFieldsDisabled(disabled) {
    document.getElementById("personnelNumber").disabled = disabled;
    document.getElementById("password").disabled = disabled;
    document.getElementById("continueBtn").disabled = disabled;
    document.getElementById("ssoBtn").disabled = disabled;
  }

  function startCountdown() {
    stopCountdown();
    remainingSeconds = MFA_SECONDS;
    updateCountdownLabel();
    document.getElementById("confirmBtn").disabled = true;
    countdownHandle = setInterval(() => {
      remainingSeconds -= 1;
      updateCountdownLabel();
      if (remainingSeconds <= 0) {
        stopCountdown();
        document.getElementById("confirmBtn").disabled = true;
      }
    }, 1000);
  }

  function stopCountdown() {
    if (countdownHandle) clearInterval(countdownHandle);
    countdownHandle = null;
  }

  function updateCountdownLabel() {
    document.getElementById("mfaCountdown").textContent =
      "ينتهي الرمز خلال " + Format.formatCountdown(remainingSeconds);
  }

  function currentMfaCode() {
    return Array.from(document.querySelectorAll("#mfaBoxes input"))
      .map((i) => i.value)
      .join("");
  }

  async function attemptTraditionalLogin() {
    if (tracker.isLocked()) {
      showError("تم قفل الحساب مؤقتاً بسبب تكرار محاولات الدخول الفاشلة.");
      return;
    }
    showError("");
    const personnelNumber = document.getElementById("personnelNumber").value.trim();
    const password = document.getElementById("password").value;
    const result = await Api.login(personnelNumber, password);
    if (!result.ok) {
      tracker.recordFailure();
      if (tracker.isLocked()) {
        setFieldsDisabled(true);
        showError("تم قفل الحساب مؤقتاً بعد 5 محاولات فاشلة. يرجى التواصل مع إدارة تقنية المعلومات.");
      } else {
        showError(`${result.error} — المحاولات المتبقية: ${tracker.attemptsRemaining()}`);
      }
      return;
    }
    tracker.reset();
    pendingUserId = result.userId;
    goStep(2);
    startCountdown();
  }

  async function attemptSsoLogin() {
    // Mock SSO: same effect as a successful traditional login for demo user U-1.
    pendingUserId = "U-1";
    goStep(2);
    startCountdown();
  }

  async function confirmMfa() {
    if (currentMfaCode().length !== 6) return;
    await Api.setCurrentUser(pendingUserId);
    stopCountdown();
    window.location.href = "dashboard.html";
  }

  function wireMfaBoxAutoAdvance() {
    const boxes = Array.from(document.querySelectorAll("#mfaBoxes input"));
    boxes.forEach((box, idx) => {
      box.value = "";
      box.addEventListener("input", () => {
        if (box.value && idx < boxes.length - 1) boxes[idx + 1].focus();
        document.getElementById("confirmBtn").disabled = currentMfaCode().length !== 6 || remainingSeconds <= 0;
      });
      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !box.value && idx > 0) boxes[idx - 1].focus();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireMfaBoxAutoAdvance();
    document.getElementById("continueBtn").addEventListener("click", attemptTraditionalLogin);
    document.getElementById("ssoBtn").addEventListener("click", attemptSsoLogin);
    document.getElementById("confirmBtn").addEventListener("click", confirmMfa);
    document.getElementById("resendLink").addEventListener("click", (e) => {
      e.preventDefault();
      startCountdown();
    });
    document.getElementById("backLink").addEventListener("click", (e) => {
      e.preventDefault();
      stopCountdown();
      goStep(1);
    });
  });
})();
