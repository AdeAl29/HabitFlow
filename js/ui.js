(function () {
  var reminderTimer = null;
  var THEME_KEY = "habitflow_theme";
  var deferredInstallPrompt = null;
  var pwaInitialized = false;

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
    updateThemeColor(mode);
    updateThemeButtons(mode);
  }

  function updateThemeColor(mode) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      return;
    }
    meta.setAttribute("content", mode === "dark" ? "#121626" : "#6d79ff");
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

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    var isSecure = window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!isSecure) {
      return;
    }
    navigator.serviceWorker.register("sw.js").catch(function () {
      return null;
    });
  }

  function isStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function getInstallButtons() {
    var byDataAttr = Array.prototype.slice.call(document.querySelectorAll("[data-install-app]"));
    var byId = document.getElementById("installAppBtn");
    if (byId && byDataAttr.indexOf(byId) === -1) {
      byDataAttr.push(byId);
    }
    return byDataAttr;
  }

  function updateInstallButtons() {
    var installed = isStandaloneMode();
    var canPrompt = Boolean(deferredInstallPrompt);
    var buttons = getInstallButtons();

    buttons.forEach(function (button) {
      if (installed) {
        button.textContent = "App Installed";
        button.disabled = true;
        return;
      }
      button.disabled = false;
      button.textContent = canPrompt ? "Install App" : "Add to Home Screen";
    });
  }

  function showManualInstallHint() {
    var ua = (window.navigator.userAgent || "").toLowerCase();
    var isIOS = /iphone|ipad|ipod/.test(ua);
    if (isIOS) {
      showToast("iPhone: buka Share lalu pilih Add to Home Screen.", "info");
      return;
    }
    showToast("Buka menu browser lalu pilih Install app / Add to Home Screen.", "info");
  }

  function promptInstall() {
    if (isStandaloneMode()) {
      showToast("App sudah terpasang.", "info");
      updateInstallButtons();
      return;
    }

    if (!deferredInstallPrompt) {
      showManualInstallHint();
      return;
    }

    var event = deferredInstallPrompt;
    deferredInstallPrompt = null;
    event.prompt();
    event.userChoice.then(function (choice) {
      if (choice && choice.outcome === "accepted") {
        showToast("Installing HabitFlow...", "success");
      }
      updateInstallButtons();
    });
  }

  function bindInstallButton(buttonId) {
    var button = document.getElementById(buttonId);
    if (!button) {
      return;
    }
    if (button.dataset.boundInstall === "true") {
      updateInstallButtons();
      return;
    }
    button.dataset.boundInstall = "true";
    button.addEventListener("click", promptInstall);
    updateInstallButtons();
  }

  function setupInstallPromptListeners() {
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      updateInstallButtons();
    });

    window.addEventListener("appinstalled", function () {
      deferredInstallPrompt = null;
      updateInstallButtons();
      showToast("HabitFlow installed.", "success");
    });
  }

  function initPWA() {
    if (pwaInitialized) {
      return;
    }
    pwaInitialized = true;
    registerServiceWorker();
    setupInstallPromptListeners();
    updateInstallButtons();
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
    initPWA: initPWA,
    bindInstallButton: bindInstallButton,
    promptInstall: promptInstall,
    openModal: openModal,
    closeModal: closeModal,
    bindModalCloseHandlers: bindModalCloseHandlers,
    showReminder: showReminder,
    startReminderLoop: startReminderLoop,
    stopReminderLoop: stopReminderLoop
  };
})();
