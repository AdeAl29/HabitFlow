(function () {
  var state = {
    user: null
  };

  function getPreferences() {
    var raw = state.user && state.user.preferences ? state.user.preferences : {};
    return StorageAPI.normalizePreferences(raw);
  }

  function setInputStateFromToggles() {
    var reminderEnabled = document.getElementById("reminderEnabledToggle");
    var reminderInterval = document.getElementById("reminderIntervalInput");
    var quoteAuto = document.getElementById("quoteAutoToggle");
    var quoteInterval = document.getElementById("quoteIntervalInput");

    if (reminderEnabled && reminderInterval) {
      reminderInterval.disabled = !reminderEnabled.checked;
    }
    if (quoteAuto && quoteInterval) {
      quoteInterval.disabled = !quoteAuto.checked;
    }
  }

  function populateForm() {
    var prefs = getPreferences();
    var username = document.getElementById("settingsUsername");
    var themeSelect = document.getElementById("themeSelect");
    var compactMode = document.getElementById("compactModeToggle");
    var reminderEnabled = document.getElementById("reminderEnabledToggle");
    var reminderInterval = document.getElementById("reminderIntervalInput");
    var calendarMonday = document.getElementById("calendarMondayToggle");
    var quoteAuto = document.getElementById("quoteAutoToggle");
    var quoteInterval = document.getElementById("quoteIntervalInput");
    var showCalendar = document.getElementById("showCalendarToggle");
    var showAchievement = document.getElementById("showAchievementToggle");
    var showQuote = document.getElementById("showQuoteToggle");
    var confirmDelete = document.getElementById("confirmDeleteToggle");
    var defaultReminder = document.getElementById("defaultReminderToggle");

    if (username) {
      username.textContent = state.user.username;
    }
    if (themeSelect) {
      themeSelect.value = prefs.theme;
    }
    if (compactMode) {
      compactMode.checked = Boolean(prefs.compactMode);
    }
    if (reminderEnabled) {
      reminderEnabled.checked = Boolean(prefs.reminderPopupEnabled);
    }
    if (reminderInterval) {
      reminderInterval.value = String(prefs.reminderIntervalSec);
    }
    if (calendarMonday) {
      calendarMonday.checked = Boolean(prefs.calendarStartMonday);
    }
    if (quoteAuto) {
      quoteAuto.checked = Boolean(prefs.quoteAutoRefresh);
    }
    if (quoteInterval) {
      quoteInterval.value = String(prefs.quoteIntervalSec);
    }
    if (showCalendar) {
      showCalendar.checked = Boolean(prefs.showCalendarSection);
    }
    if (showAchievement) {
      showAchievement.checked = Boolean(prefs.showAchievementSection);
    }
    if (showQuote) {
      showQuote.checked = Boolean(prefs.showQuoteSection);
    }
    if (confirmDelete) {
      confirmDelete.checked = Boolean(prefs.confirmDeleteHabit);
    }
    if (defaultReminder) {
      defaultReminder.checked = Boolean(prefs.defaultReminderForNewHabit);
    }

    setInputStateFromToggles();
    document.body.classList.toggle("compact-mode", Boolean(prefs.compactMode));
  }

  function readPreferencesFromForm() {
    var themeSelect = document.getElementById("themeSelect");
    var compactMode = document.getElementById("compactModeToggle");
    var reminderEnabled = document.getElementById("reminderEnabledToggle");
    var reminderInterval = document.getElementById("reminderIntervalInput");
    var calendarMonday = document.getElementById("calendarMondayToggle");
    var quoteAuto = document.getElementById("quoteAutoToggle");
    var quoteInterval = document.getElementById("quoteIntervalInput");
    var showCalendar = document.getElementById("showCalendarToggle");
    var showAchievement = document.getElementById("showAchievementToggle");
    var showQuote = document.getElementById("showQuoteToggle");
    var confirmDelete = document.getElementById("confirmDeleteToggle");
    var defaultReminder = document.getElementById("defaultReminderToggle");

    return StorageAPI.normalizePreferences({
      theme: themeSelect ? themeSelect.value : "light",
      compactMode: compactMode ? compactMode.checked : false,
      reminderPopupEnabled: reminderEnabled ? reminderEnabled.checked : true,
      reminderIntervalSec: reminderInterval ? reminderInterval.value : 35,
      calendarStartMonday: calendarMonday ? calendarMonday.checked : false,
      quoteAutoRefresh: quoteAuto ? quoteAuto.checked : false,
      quoteIntervalSec: quoteInterval ? quoteInterval.value : 45,
      showCalendarSection: showCalendar ? showCalendar.checked : true,
      showAchievementSection: showAchievement ? showAchievement.checked : true,
      showQuoteSection: showQuote ? showQuote.checked : true,
      confirmDeleteHabit: confirmDelete ? confirmDelete.checked : true,
      defaultReminderForNewHabit: defaultReminder ? defaultReminder.checked : false
    });
  }

  function saveSettings() {
    var preferences = readPreferencesFromForm();
    StorageAPI.updateCurrentUserData(function (user) {
      user.preferences = preferences;
      return user;
    });
    state.user = StorageAPI.getCurrentUserData();
    UI.applyTheme(preferences.theme);
    document.body.classList.toggle("compact-mode", Boolean(preferences.compactMode));
    setInputStateFromToggles();
    UI.showToast("Settings saved.", "success");
  }

  function getCompletedCount(history) {
    return Object.keys(history || {}).filter(function (key) {
      return Boolean(history[key]);
    }).length;
  }

  function computeStats(user) {
    var habits = Array.isArray(user.habits) ? user.habits : [];
    var totalCompleted = 0;
    var longestStreak = 0;
    var keys30 = StorageAPI.getDateKeysForLast(30);
    var completed30 = 0;

    habits.forEach(function (habit) {
      totalCompleted += getCompletedCount(habit.history);
      var longest = StorageAPI.computeLongestStreak(habit);
      if (longest > longestStreak) {
        longestStreak = longest;
      }
      keys30.forEach(function (key) {
        if (habit.history && habit.history[key]) {
          completed30 += 1;
        }
      });
    });

    var completionRate = habits.length ? Math.round((completed30 / (habits.length * 30)) * 100) : 0;
    return {
      totalCompleted: totalCompleted,
      longestStreak: longestStreak,
      completionRate: completionRate
    };
  }

  function getWeeklyData(habits) {
    var keys = StorageAPI.getDateKeysForLast(7);
    return keys.map(function (key) {
      var count = 0;
      habits.forEach(function (habit) {
        if (habit.history && habit.history[key]) {
          count += 1;
        }
      });
      return { date: key, completed: count };
    });
  }

  function downloadFile(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function toCsvSafe(value) {
    var text = String(value == null ? "" : value);
    if (/[",\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function buildExportJson(user) {
    var stats = computeStats(user);
    var weekly = getWeeklyData(user.habits || []);
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      username: user.username,
      preferences: user.preferences || {},
      stats: stats,
      weekly: weekly,
      habits: user.habits || []
    }, null, 2);
  }

  function buildExportCsv(user) {
    var rows = [];
    var stats = computeStats(user);

    rows.push(["Username", user.username]);
    rows.push(["Exported At", new Date().toISOString()]);
    rows.push([]);
    rows.push(["Metric", "Value"]);
    rows.push(["Total Completed", stats.totalCompleted]);
    rows.push(["Longest Streak", stats.longestStreak]);
    rows.push(["Completion Rate 30 Days (%)", stats.completionRate]);
    rows.push([]);
    rows.push(["Habit", "Date", "Completed"]);

    (user.habits || []).forEach(function (habit) {
      var keys = Object.keys(habit.history || {}).sort();
      if (!keys.length) {
        rows.push([habit.name, "-", "0"]);
        return;
      }
      keys.forEach(function (key) {
        if (habit.history[key]) {
          rows.push([habit.name, key, "1"]);
        }
      });
    });

    return rows.map(function (row) {
      return row.map(toCsvSafe).join(",");
    }).join("\n");
  }

  function bindExportButtons() {
    var jsonBtn = document.getElementById("exportJsonBtn");
    var csvBtn = document.getElementById("exportCsvBtn");

    if (jsonBtn) {
      jsonBtn.addEventListener("click", function () {
        state.user = StorageAPI.getCurrentUserData();
        var content = buildExportJson(state.user);
        downloadFile("habitflow-progress.json", content, "application/json;charset=utf-8");
        UI.showToast("Progress exported as JSON.", "success");
      });
    }

    if (csvBtn) {
      csvBtn.addEventListener("click", function () {
        state.user = StorageAPI.getCurrentUserData();
        var content = buildExportCsv(state.user);
        downloadFile("habitflow-progress.csv", content, "text/csv;charset=utf-8");
        UI.showToast("Progress exported as CSV.", "success");
      });
    }
  }

  function bindDangerActions() {
    var clearHabitsBtn = document.getElementById("clearHabitsBtn");
    if (!clearHabitsBtn) {
      return;
    }
    clearHabitsBtn.addEventListener("click", function () {
      var confirmed = window.confirm("Clear all habits and history for this account?");
      if (!confirmed) {
        return;
      }
      StorageAPI.updateCurrentUserData(function (user) {
        user.habits = [];
        return user;
      });
      state.user = StorageAPI.getCurrentUserData();
      UI.showToast("All habits cleared.", "info");
    });
  }

  function bindFormEvents() {
    var saveBtn = document.getElementById("saveSettingsBtn");
    var themeSelect = document.getElementById("themeSelect");
    var compactMode = document.getElementById("compactModeToggle");
    var reminderEnabled = document.getElementById("reminderEnabledToggle");
    var quoteAuto = document.getElementById("quoteAutoToggle");

    if (saveBtn) {
      saveBtn.addEventListener("click", saveSettings);
    }

    if (themeSelect) {
      themeSelect.addEventListener("change", function () {
        UI.applyTheme(themeSelect.value);
      });
    }

    if (compactMode) {
      compactMode.addEventListener("change", function () {
        document.body.classList.toggle("compact-mode", compactMode.checked);
      });
    }

    if (reminderEnabled) {
      reminderEnabled.addEventListener("change", setInputStateFromToggles);
    }
    if (quoteAuto) {
      quoteAuto.addEventListener("change", setInputStateFromToggles);
    }
  }

  function init() {
    if (!document.getElementById("saveSettingsBtn")) {
      return;
    }

    state.user = Auth.requireAuth();
    if (!state.user) {
      return;
    }

    UI.markActiveNav("settings");
    UI.bindLogout();
    UI.bindInstallButton("installAppBtn");
    bindFormEvents();
    bindExportButtons();
    bindDangerActions();

    UI.simulateLoading(function () {
      populateForm();
    }, "Applying settings...", 450);
  }

  init();
})();
