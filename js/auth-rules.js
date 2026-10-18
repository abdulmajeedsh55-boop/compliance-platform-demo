(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.AuthRules = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createLoginAttemptTracker(maxAttempts) {
    const max = maxAttempts || 5;
    let failures = 0;

    return {
      recordFailure() {
        failures += 1;
      },
      isLocked() {
        return failures >= max;
      },
      attemptsRemaining() {
        return Math.max(0, max - failures);
      },
      reset() {
        failures = 0;
      },
    };
  }

  function isSessionIdle(lastActivityMs, nowMs, idleLimitMs) {
    const limit = idleLimitMs || 15 * 60 * 1000;
    return nowMs - lastActivityMs >= limit;
  }

  return { createLoginAttemptTracker, isSessionIdle };
});
