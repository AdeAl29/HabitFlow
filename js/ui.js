(function () {
  var reminderTimer = null;
  var THEME_KEY = "habitflow_theme";

  function showToast(message, type) {
    var root = document.getElementById("toastRoot");
    if (!root) {
      return;
    }
    var toast = document.createElement("div");
    toast.className = "toast " + (type || "info");
    toast.textContent = message;
    root.appendChild(toast);
    setTimeout(function () {
      toast.remove();
    }, 2600);
  }

  function showLoading(text) {
    var overlay = document.getElementById("loadingOverlay");
    if (!overlay) {
      return;
    }
    if (text) {
      var message = overlay.querySelector("p");
      if (message) {
        message.textContent = text;
      }
    }
    overlay.classList.remove("hidden");
  }

  function hideLoading() {
    var overlay = document.getElementById("loadingOverlay");
    if (!overlay) {
      return;
    }
    overlay.classList.add("hidden");
  }

  function simulateLoading(done, text, ms) {
    showLoading(text || "Loading...");
    setTimeout(function () {
      hideLoading();
      if (typeof done === "function") {
        done();
      }
    }, ms || 650);
  }

  function markActiveNav(name) {
    var links = document.querySelectorAll("[data-nav]");
    links.forEach(function (link) {
      if (link.getAttribute("data-nav") === name) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  function bindLogout() {
    var btn = document.getElementById("logoutBtn");
    if (!btn) {
      return;
    }
    if (btn.dataset.boundLogout === "true") {
      return;
    }
    btn.dataset.boundLogout = "true";
    btn.addEventListener("click", function () {
      StorageAPI.clearCurrentUsername();
      showToast("Logged out successfully.", "info");
      simulateLoading(function () {
        window.location.href = "index.html";
      }, "Logging out...", 500);
    });
  }

  function getSavedTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    return saved === "dark" ? "dark" : "light";
  }

  function applyTheme(theme) {
    var mode = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem(THEME_KEY, mode);
    updateThemeButtons(mode);
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme") || getSavedTheme();
    var next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    showToast(next === "dark" ? "Dark mode enabled." : "Light mode enabled.", "info");
  }

  function updateThemeButtons(theme) {
    var text = theme === "dark" ? "Light Mode" : "Dark Mode";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.textContent = text;
    });
  }

  function bindThemeToggleButtons() {
    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      if (button.dataset.boundTheme === "true") {
        return;
      }
      button.dataset.boundTheme = "true";
      button.addEventListener("click", toggleTheme);
    });
    updateThemeButtons(getSavedTheme());
  }

  function initTheme() {
    applyTheme(getSavedTheme());
    bindThemeToggleButtons();
  }

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) {
      return;
    }
    modal.classList.remove("hidden");
  }

  function closeModal(id) {
    var modal = document.getElementById(id);
    if (!modal) {
      return;
    }
    modal.classList.add("hidden");
  }

  function bindModalCloseHandlers(modalId) {
    var modal = document.getElementById(modalId);
    if (!modal) {
      return;
    }
    modal.querySelectorAll("[data-close-modal]").forEach(function (el) {
      el.addEventListener("click", function () {
        closeModal(modalId);
      });
    });
  }

  function showReminder(message) {
    var popup = document.getElementById("reminderPopup");
    var text = document.getElementById("reminderText");
    var dismiss = document.getElementById("dismissReminderBtn");
    if (!popup || !text || !dismiss) {
      return;
    }
    text.textContent = message;
    popup.classList.remove("hidden");
    dismiss.onclick = function () {
      popup.classList.add("hidden");
    };
  }

  function startReminderLoop(getPendingReminders) {
    var intervalMs = arguments.length > 1 ? arguments[1] : null;
    var enabled = arguments.length > 2 ? arguments[2] : true;
    stopReminderLoop();
    if (!enabled) {
      return;
    }

    var safeInterval = Number(intervalMs);
    if (!Number.isFinite(safeInterval) || safeInterval < 10000) {
      safeInterval = 35000;
    }

    reminderTimer = setInterval(function () {
      if (typeof getPendingReminders !== "function") {
        return;
      }
      var list = getPendingReminders();
      if (!Array.isArray(list) || !list.length) {
        return;
      }
      var random = list[Math.floor(Math.random() * list.length)];
      showReminder("Time to complete: " + random.name);
    }, safeInterval);
  }

  function stopReminderLoop() {
    if (reminderTimer) {
      clearInterval(reminderTimer);
      reminderTimer = null;
    }
  }

  window.UI = {
    showToast: showToast,
    showLoading: showLoading,
    hideLoading: hideLoading,
    simulateLoading: simulateLoading,
    markActiveNav: markActiveNav,
    bindLogout: bindLogout,
    initTheme: initTheme,
    getSavedTheme: getSavedTheme,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    openModal: openModal,
    closeModal: closeModal,
    bindModalCloseHandlers: bindModalCloseHandlers,
    showReminder: showReminder,
    startReminderLoop: startReminderLoop,
    stopReminderLoop: stopReminderLoop
  };
})();
