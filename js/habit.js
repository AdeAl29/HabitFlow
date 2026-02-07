(function () {
  var state = {
    user: null,
    calendarOffset: 0,
    quoteIndex: -1,
    quoteTimer: null
  };

  var QUOTES = [
    { text: "Small daily improvements are the key to staggering long-term results.", author: "Robin Sharma" },
    { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
    { text: "Consistency is what transforms average into excellence.", author: "Unknown" },
    { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
    { text: "Success is the product of daily habits, not once-in-a-lifetime changes.", author: "James Clear" },
    { text: "The secret of your future is hidden in your daily routine.", author: "Mike Murdock" }
  ];

  var ACHIEVEMENTS = [
    {
      id: "first_complete",
      icon: "1",
      title: "First Win",
      description: "Selesaikan habit pertama kamu.",
      value: function (ctx) {
        return ctx.totalCompleted;
      },
      tiers: {
        bronze: 1,
        silver: 10,
        gold: 30
      }
    },
    {
      id: "week_streak",
      icon: "7",
      title: "Streak 7 Hari",
      description: "Capai streak minimal 7 hari pada satu habit.",
      value: function (ctx) {
        return ctx.longestStreak;
      },
      tiers: {
        bronze: 7,
        silver: 14,
        gold: 30
      }
    },
    {
      id: "habit_builder",
      icon: "H",
      title: "Habit Builder",
      description: "Miliki minimal 5 habit aktif.",
      value: function (ctx) {
        return ctx.habitCount;
      },
      tiers: {
        bronze: 3,
        silver: 5,
        gold: 8
      }
    },
    {
      id: "consistent_70",
      icon: "C",
      title: "Consistency Pro",
      description: "Raih completion rate 70% dalam 30 hari terakhir.",
      value: function (ctx) {
        return ctx.completionRate30d;
      },
      tiers: {
        bronze: 50,
        silver: 70,
        gold: 90
      }
    },
    {
      id: "centurion",
      icon: "100",
      title: "Centurion",
      description: "Selesaikan total 100 checklist habit.",
      value: function (ctx) {
        return ctx.totalCompleted;
      },
      tiers: {
        bronze: 40,
        silver: 100,
        gold: 200
      }
    }
  ];

  var LEVEL_ORDER = ["locked", "bronze", "silver", "gold"];

  function getHabits() {
    return state.user && Array.isArray(state.user.habits) ? state.user.habits : [];
  }

  function getUserPreferences() {
    var defaults = StorageAPI.getDefaultPreferences ? StorageAPI.getDefaultPreferences() : {};
    var userPrefs = state.user && state.user.preferences ? state.user.preferences : {};
    return StorageAPI.normalizePreferences ? StorageAPI.normalizePreferences(Object.assign({}, defaults, userPrefs)) : userPrefs;
  }

  function saveAndRefresh(mutator) {
    StorageAPI.updateCurrentUserData(function (user) {
      mutator(user);
      return user;
    });
    state.user = StorageAPI.getCurrentUserData();
    renderAll();
  }

  function getWeeklySummary(habits) {
    var keys = StorageAPI.getDateKeysForLast(7);
    var total = habits.length * 7;
    var completed = 0;

    habits.forEach(function (habit) {
      keys.forEach(function (key) {
        if (habit.history && habit.history[key]) {
          completed += 1;
        }
      });
    });

    return { completed: completed, total: total };
  }

  function getDailyProgress(habits) {
    var today = StorageAPI.getTodayKey();
    var total = habits.length;
    var completed = 0;

    habits.forEach(function (habit) {
      if (habit.history && habit.history[today]) {
        completed += 1;
      }
    });

    var percent = total ? Math.round((completed / total) * 100) : 0;
    return { completed: completed, total: total, percent: percent };
  }

  function updateTopStats(habits) {
    var progress = getDailyProgress(habits);
    var progressLabel = document.getElementById("dailyProgressLabel");
    var progressBar = document.getElementById("dailyProgressBar");
    var bestStreakLabel = document.getElementById("bestStreakLabel");
    var weeklySummaryLabel = document.getElementById("weeklySummaryLabel");

    if (progressLabel) {
      progressLabel.textContent = progress.percent + "% (" + progress.completed + "/" + progress.total + ")";
    }
    if (progressBar) {
      progressBar.style.width = progress.percent + "%";
    }

    var today = StorageAPI.getTodayKey();
    var bestCurrentStreak = habits.reduce(function (best, habit) {
      var streak = StorageAPI.computeCurrentStreak(habit, today);
      return streak > best ? streak : best;
    }, 0);

    if (bestStreakLabel) {
      bestStreakLabel.textContent = bestCurrentStreak + " days";
    }

    var weekly = getWeeklySummary(habits);
    if (weeklySummaryLabel) {
      weeklySummaryLabel.textContent = weekly.completed + " / " + weekly.total;
    }
  }

  function habitItemTemplate(habit) {
    var today = StorageAPI.getTodayKey();
    var checkedToday = Boolean(habit.history && habit.history[today]);
    var streak = StorageAPI.computeCurrentStreak(habit, today);
    var totalCompletions = Object.keys(habit.history || {}).filter(function (key) {
      return Boolean(habit.history[key]);
    }).length;

    return (
      '<article class="habit-item" data-id="' + habit.id + '">' +
      '  <label class="check-wrap" title="Mark complete">' +
      '    <input type="checkbox" data-action="toggle-complete" ' + (checkedToday ? "checked" : "") + ">" +
      '    <span class="check-ui"></span>' +
      "  </label>" +
      '  <div class="habit-main">' +
      '    <div class="habit-name">' + escapeHtml(habit.name) + "</div>" +
      '    <div class="habit-meta">' +
      '      <span class="streak-badge">Streak: ' + streak + "d</span>" +
      "      <span>Total done: " + totalCompletions + "</span>" +
      "    </div>" +
      "  </div>" +
      '  <div class="habit-actions">' +
      '    <label class="toggle" title="Reminder">' +
      '      <input type="checkbox" data-action="toggle-reminder" ' + (habit.reminderEnabled ? "checked" : "") + ">" +
      "      <span></span>" +
      "    </label>" +
      '    <button class="icon-btn" data-action="edit" title="Edit">E</button>' +
      '    <button class="icon-btn danger" data-action="delete" title="Delete">X</button>' +
      "  </div>" +
      "</article>"
    );
  }

  function renderHabits() {
    var habits = getHabits();
    var listEl = document.getElementById("habitList");
    var emptyEl = document.getElementById("emptyState");
    if (!listEl || !emptyEl) {
      return;
    }

    if (!habits.length) {
      listEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
    } else {
      emptyEl.classList.add("hidden");
      listEl.innerHTML = habits.map(habitItemTemplate).join("");
    }
    updateTopStats(habits);
  }

  function getCompletionForDate(dateKey, habits) {
    var total = habits.length;
    var completed = 0;
    habits.forEach(function (habit) {
      if (habit.history && habit.history[dateKey]) {
        completed += 1;
      }
    });
    return { completed: completed, total: total };
  }

  function formatDateKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function getMonthDate(year, month, day) {
    return new Date(year, month, day);
  }

  function getViewedMonthMeta() {
    var today = new Date();
    var viewed = getMonthDate(today.getFullYear(), today.getMonth() + state.calendarOffset, 1);
    return {
      year: viewed.getFullYear(),
      month: viewed.getMonth()
    };
  }

  function renderCalendarHeader() {
    var weekdayContainer = document.getElementById("calendarWeekdayHeader");
    if (!weekdayContainer) {
      return;
    }
    var prefs = getUserPreferences();
    var labels = prefs.calendarStartMonday
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    weekdayContainer.innerHTML = labels.map(function (label) {
      return "<span>" + label + "</span>";
    }).join("");
  }

  function renderCalendar() {
    var calendar = document.getElementById("habitCalendar");
    var monthLabel = document.getElementById("calendarMonthLabel");
    if (!calendar || !monthLabel) {
      return;
    }

    var meta = getViewedMonthMeta();
    var firstDate = getMonthDate(meta.year, meta.month, 1);
    var prefs = getUserPreferences();
    var startWeekdayRaw = firstDate.getDay();
    var startWeekday = prefs.calendarStartMonday ? (startWeekdayRaw + 6) % 7 : startWeekdayRaw;
    var monthName = firstDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    monthLabel.textContent = monthName;

    var daysInMonth = getMonthDate(meta.year, meta.month + 1, 0).getDate();
    var cells = [];
    for (var i = 0; i < startWeekday; i += 1) {
      cells.push('<div class="calendar-day is-empty"></div>');
    }

    var habits = getHabits();
    var todayKey = StorageAPI.getTodayKey();
    for (var day = 1; day <= daysInMonth; day += 1) {
      var date = getMonthDate(meta.year, meta.month, day);
      var key = formatDateKey(date);
      var status = getCompletionForDate(key, habits);
      var isToday = key === todayKey;
      var dayClass = "neutral";

      if (status.total > 0 && status.completed > 0 && status.completed < status.total) {
        dayClass = "partial";
      } else if (status.total > 0 && status.completed === status.total) {
        dayClass = "full";
      } else if (status.total > 0 && status.completed === 0) {
        dayClass = "none";
      }

      var classes = "calendar-day " + dayClass + (isToday ? " is-today" : "");
      var rateText = status.total ? status.completed + "/" + status.total : "-";
      cells.push(
        '<button class="' + classes + '" type="button" data-calendar-day="' + key + '">' +
        '  <span class="day-num">' + day + "</span>" +
        '  <span class="day-rate">' + rateText + "</span>" +
        "</button>"
      );
    }

    calendar.innerHTML = cells.join("");
  }

  function getAchievementContext() {
    var habits = getHabits();
    var totalCompleted = 0;
    var longestStreak = 0;
    habits.forEach(function (habit) {
      var keys = Object.keys(habit.history || {}).filter(function (key) {
        return Boolean(habit.history[key]);
      });
      totalCompleted += keys.length;
      var longest = StorageAPI.computeLongestStreak(habit);
      if (longest > longestStreak) {
        longestStreak = longest;
      }
    });
    var completionRate30d = state.user && state.user.progressStats ? state.user.progressStats.completionRate30d : 0;
    return {
      totalCompleted: totalCompleted,
      longestStreak: longestStreak,
      habitCount: habits.length,
      completionRate30d: completionRate30d
    };
  }

  function getBadgeLevelStorageKey() {
    if (!state.user) {
      return "";
    }
    return "habitflow_badge_levels_" + state.user.username;
  }

  function getSavedBadgeLevels() {
    var key = getBadgeLevelStorageKey();
    if (!key) {
      return {};
    }
    try {
      var parsed = JSON.parse(localStorage.getItem(key) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveBadgeLevels(levelMap) {
    var key = getBadgeLevelStorageKey();
    if (!key) {
      return;
    }
    localStorage.setItem(key, JSON.stringify(levelMap));
  }

  function getLevelIndex(level) {
    var index = LEVEL_ORDER.indexOf(level);
    return index < 0 ? 0 : index;
  }

  function resolveBadgeLevel(value, tiers) {
    if (value >= tiers.gold) {
      return "gold";
    }
    if (value >= tiers.silver) {
      return "silver";
    }
    if (value >= tiers.bronze) {
      return "bronze";
    }
    return "locked";
  }

  function getNextTierTarget(level, tiers) {
    if (level === "locked") {
      return { label: "Bronze", value: tiers.bronze, base: 0 };
    }
    if (level === "bronze") {
      return { label: "Silver", value: tiers.silver, base: tiers.bronze };
    }
    if (level === "silver") {
      return { label: "Gold", value: tiers.gold, base: tiers.silver };
    }
    return null;
  }

  function getBadgeProgressPercent(value, level, tiers) {
    var nextTier = getNextTierTarget(level, tiers);
    if (!nextTier) {
      return 100;
    }
    var range = nextTier.value - nextTier.base;
    if (range <= 0) {
      return 100;
    }
    var current = Math.max(0, value - nextTier.base);
    var percent = Math.round((current / range) * 100);
    return Math.max(0, Math.min(100, percent));
  }

  function getProgressLabel(value, level, tiers) {
    var nextTier = getNextTierTarget(level, tiers);
    if (!nextTier) {
      return "Max level reached";
    }
    return String(value) + " / " + String(nextTier.value) + " to " + nextTier.label;
  }

  function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function renderAchievements() {
    var container = document.getElementById("achievementList");
    if (!container) {
      return;
    }

    var context = getAchievementContext();
    var previousLevels = getSavedBadgeLevels();
    var currentLevels = {};

    var html = ACHIEVEMENTS.map(function (badge) {
      var value = badge.value(context);
      var level = resolveBadgeLevel(value, badge.tiers);
      currentLevels[badge.id] = level;
      var levelLabel = capitalize(level);
      var cls = "achievement-item level-" + level + (level === "locked" ? " locked" : "");
      var progress = getBadgeProgressPercent(value, level, badge.tiers);
      var progressLabel = getProgressLabel(value, level, badge.tiers);

      return (
        '<article class="' + cls + '">' +
        '  <div class="badge-icon">' + badge.icon + "</div>" +
        "  <div>" +
        '    <div class="badge-title-row">' +
        '      <div class="badge-title">' + badge.title + "</div>" +
        '      <span class="badge-tier tier-' + level + '">' + levelLabel + "</span>" +
        "    </div>" +
        '    <div class="badge-desc">' + badge.description + "</div>" +
        '    <div class="badge-progress-track">' +
        '      <span class="badge-progress-fill tier-' + level + '" style="width:' + progress + '%;"></span>' +
        "    </div>" +
        '    <div class="badge-progress-label">' + progressLabel + "</div>" +
        "  </div>" +
        "</article>"
      );
    }).join("");

    container.innerHTML = html;

    var upgradedBadges = Object.keys(currentLevels).filter(function (id) {
      return getLevelIndex(currentLevels[id]) > getLevelIndex(previousLevels[id] || "locked");
    });

    if (upgradedBadges.length) {
      upgradedBadges.forEach(function (id) {
        var badge = ACHIEVEMENTS.find(function (item) {
          return item.id === id;
        });
        if (badge) {
          var level = currentLevels[id];
          UI.showToast("Badge upgraded: " + badge.title + " (" + capitalize(level) + ")", "success");
        }
      });
    }

    saveBadgeLevels(currentLevels);
  }

  function renderRandomQuote(forceDifferent) {
    var quoteText = document.getElementById("quoteText");
    var quoteAuthor = document.getElementById("quoteAuthor");
    if (!quoteText || !quoteAuthor || !QUOTES.length) {
      return;
    }

    var nextIndex = state.quoteIndex;
    if (forceDifferent || nextIndex < 0) {
      nextIndex = Math.floor(Math.random() * QUOTES.length);
      if (QUOTES.length > 1 && nextIndex === state.quoteIndex) {
        nextIndex = (nextIndex + 1) % QUOTES.length;
      }
    }

    state.quoteIndex = nextIndex;
    var quote = QUOTES[nextIndex];
    quoteText.textContent = '"' + quote.text + '"';
    quoteAuthor.textContent = "- " + quote.author;
  }

  function stopQuoteAutoRefresh() {
    if (state.quoteTimer) {
      clearInterval(state.quoteTimer);
      state.quoteTimer = null;
    }
  }

  function startQuoteAutoRefresh() {
    stopQuoteAutoRefresh();
    var prefs = getUserPreferences();
    if (!prefs.quoteAutoRefresh) {
      return;
    }
    var intervalMs = Math.max(10000, Number(prefs.quoteIntervalSec || 45) * 1000);
    state.quoteTimer = setInterval(function () {
      renderRandomQuote(true);
    }, intervalMs);
  }

  function renderGreeting() {
    var greeting = document.getElementById("greeting");
    if (greeting && state.user) {
      greeting.textContent = state.user.username;
    }
  }

  function renderAll() {
    applyDisplaySettings();
    renderGreeting();
    renderHabits();
    renderCalendarHeader();
    renderCalendar();
    renderAchievements();
    renderRandomQuote(false);
    startQuoteAutoRefresh();
  }

  function openAddModal() {
    var idField = document.getElementById("habitIdField");
    var nameField = document.getElementById("habitNameField");
    var reminderField = document.getElementById("habitReminderField");
    var title = document.getElementById("habitModalTitle");
    if (idField) {
      idField.value = "";
    }
    if (nameField) {
      nameField.value = "";
    }
    if (reminderField) {
      reminderField.checked = Boolean(getUserPreferences().defaultReminderForNewHabit);
    }
    if (title) {
      title.textContent = "Add Habit";
    }
    UI.openModal("habitModal");
    if (nameField) {
      nameField.focus();
    }
  }

  function openEditModal(habitId) {
    var habit = getHabits().find(function (item) {
      return item.id === habitId;
    });
    if (!habit) {
      return;
    }
    var idField = document.getElementById("habitIdField");
    var nameField = document.getElementById("habitNameField");
    var reminderField = document.getElementById("habitReminderField");
    var title = document.getElementById("habitModalTitle");
    if (idField) {
      idField.value = habit.id;
    }
    if (nameField) {
      nameField.value = habit.name;
    }
    if (reminderField) {
      reminderField.checked = Boolean(habit.reminderEnabled);
    }
    if (title) {
      title.textContent = "Edit Habit";
    }
    UI.openModal("habitModal");
    if (nameField) {
      nameField.focus();
    }
  }

  function createHabit(name, reminderEnabled) {
    var habit = StorageAPI.normalizeHabit({
      name: name,
      reminderEnabled: reminderEnabled,
      history: {}
    });

    saveAndRefresh(function (user) {
      user.habits.push(habit);
    });
    UI.showToast("Habit added.", "success");
  }

  function updateHabit(habitId, name, reminderEnabled) {
    saveAndRefresh(function (user) {
      user.habits = user.habits.map(function (habit) {
        if (habit.id !== habitId) {
          return habit;
        }
        habit.name = name;
        habit.reminderEnabled = Boolean(reminderEnabled);
        return habit;
      });
    });
    UI.showToast("Habit updated.", "success");
  }

  function deleteHabit(habitId) {
    var prefs = getUserPreferences();
    if (prefs.confirmDeleteHabit && !window.confirm("Delete this habit? This cannot be undone.")) {
      return;
    }
    saveAndRefresh(function (user) {
      user.habits = user.habits.filter(function (habit) {
        return habit.id !== habitId;
      });
    });
    UI.showToast("Habit deleted.", "info");
  }

  function toggleCompletion(habitId, isDone) {
    var today = StorageAPI.getTodayKey();
    saveAndRefresh(function (user) {
      user.habits = user.habits.map(function (habit) {
        if (habit.id !== habitId) {
          return habit;
        }
        if (!habit.history || typeof habit.history !== "object") {
          habit.history = {};
        }
        if (isDone) {
          habit.history[today] = true;
        } else {
          delete habit.history[today];
        }
        return habit;
      });
    });
  }

  function toggleReminder(habitId, enabled) {
    saveAndRefresh(function (user) {
      user.habits = user.habits.map(function (habit) {
        if (habit.id !== habitId) {
          return habit;
        }
        habit.reminderEnabled = Boolean(enabled);
        return habit;
      });
    });
    UI.showToast(enabled ? "Reminder enabled." : "Reminder disabled.", "info");
  }

  function bindListActions() {
    var list = document.getElementById("habitList");
    var calendar = document.getElementById("habitCalendar");
    if (!list) {
      return;
    }
    list.addEventListener("click", function (event) {
      var target = event.target;
      var action = target.getAttribute("data-action");
      if (!action) {
        return;
      }
      var habitItem = target.closest(".habit-item");
      if (!habitItem) {
        return;
      }
      var habitId = habitItem.getAttribute("data-id");
      if (!habitId) {
        return;
      }

      if (action === "edit") {
        openEditModal(habitId);
      } else if (action === "delete") {
        deleteHabit(habitId);
      }
    });

    list.addEventListener("change", function (event) {
      var target = event.target;
      var action = target.getAttribute("data-action");
      if (!action) {
        return;
      }
      var habitItem = target.closest(".habit-item");
      if (!habitItem) {
        return;
      }
      var habitId = habitItem.getAttribute("data-id");
      if (!habitId) {
        return;
      }

      if (action === "toggle-complete") {
        toggleCompletion(habitId, target.checked);
      } else if (action === "toggle-reminder") {
        toggleReminder(habitId, target.checked);
      }
    });

    if (calendar) {
      calendar.addEventListener("click", function (event) {
        var button = event.target.closest("[data-calendar-day]");
        if (!button) {
          return;
        }
        var key = button.getAttribute("data-calendar-day");
        var status = getCompletionForDate(key, getHabits());
        UI.showToast(key + ": " + status.completed + "/" + status.total + " completed", "info");
      });
    }
  }

  function bindModalForm() {
    var openBtn = document.getElementById("openHabitModalBtn");
    var form = document.getElementById("habitForm");
    UI.bindModalCloseHandlers("habitModal");

    if (openBtn) {
      openBtn.addEventListener("click", openAddModal);
    }

    if (!form) {
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var habitId = document.getElementById("habitIdField").value;
      var name = document.getElementById("habitNameField").value.trim();
      var reminderEnabled = document.getElementById("habitReminderField").checked;

      if (name.length < 2) {
        UI.showToast("Habit name must be at least 2 characters.", "error");
        return;
      }

      if (habitId) {
        updateHabit(habitId, name, reminderEnabled);
      } else {
        createHabit(name, reminderEnabled);
      }

      UI.closeModal("habitModal");
      form.reset();
    });
  }

  function getPendingReminderHabits() {
    var today = StorageAPI.getTodayKey();
    return getHabits().filter(function (habit) {
      return habit.reminderEnabled && !(habit.history && habit.history[today]);
    });
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function bindCalendarControls() {
    var prev = document.getElementById("calendarPrevBtn");
    var next = document.getElementById("calendarNextBtn");
    if (prev) {
      prev.addEventListener("click", function () {
        state.calendarOffset -= 1;
        renderCalendar();
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        state.calendarOffset += 1;
        renderCalendar();
      });
    }
  }

  function applyDisplaySettings() {
    var prefs = getUserPreferences();
    document.body.classList.toggle("compact-mode", Boolean(prefs.compactMode));
    var calendarCard = document.getElementById("calendarCard");
    var achievementCard = document.getElementById("achievementCard");
    var quoteCard = document.getElementById("quoteCard");
    if (calendarCard) {
      calendarCard.classList.toggle("hidden", !prefs.showCalendarSection);
    }
    if (achievementCard) {
      achievementCard.classList.toggle("hidden", !prefs.showAchievementSection);
    }
    if (quoteCard) {
      quoteCard.classList.toggle("hidden", !prefs.showQuoteSection);
    }
  }

  function bindQuoteButton() {
    var btn = document.getElementById("newQuoteBtn");
    if (!btn) {
      return;
    }
    btn.addEventListener("click", function () {
      renderRandomQuote(true);
    });
  }

  function init() {
    if (!document.getElementById("habitList")) {
      return;
    }

    state.user = Auth.requireAuth();
    if (!state.user) {
      return;
    }

    UI.markActiveNav("dashboard");
    UI.bindLogout();
    bindListActions();
    bindModalForm();
    bindCalendarControls();
    bindQuoteButton();

    UI.simulateLoading(function () {
      renderAll();
    }, "Loading dashboard...", 520);

    var prefs = getUserPreferences();
    UI.startReminderLoop(
      getPendingReminderHabits,
      Number(prefs.reminderIntervalSec || 35) * 1000,
      Boolean(prefs.reminderPopupEnabled)
    );
  }

  init();
})();
