(function () {
  var USERS_KEY = "habitflow_users";
  var CURRENT_USER_KEY = "habitflow_current_user";

  function parseJSON(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function dateToKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function keyToDate(key) {
    var parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function addDays(key, amount) {
    var date = keyToDate(key);
    date.setDate(date.getDate() + amount);
    return dateToKey(date);
  }

  function diffDays(keyA, keyB) {
    var a = keyToDate(keyA);
    var b = keyToDate(keyB);
    var diff = b.getTime() - a.getTime();
    return Math.round(diff / 86400000);
  }

  function getTodayKey() {
    return dateToKey(new Date());
  }

  function clampString(input, max) {
    return String(input || "").trim().slice(0, max);
  }

  function clampNumber(value, min, max, fallback) {
    var num = Number(value);
    if (!Number.isFinite(num)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(num)));
  }

  function getDefaultPreferences() {
    return {
      theme: "light",
      reminderPopupEnabled: true,
      reminderIntervalSec: 35,
      calendarStartMonday: false,
      quoteAutoRefresh: false,
      quoteIntervalSec: 45,
      compactMode: false,
      confirmDeleteHabit: true,
      defaultReminderForNewHabit: false,
      showCalendarSection: true,
      showAchievementSection: true,
      showQuoteSection: true
    };
  }

  function normalizePreferences(preferences) {
    var defaults = getDefaultPreferences();
    var safe = preferences && typeof preferences === "object" ? preferences : {};
    return {
      theme: safe.theme === "dark" ? "dark" : "light",
      reminderPopupEnabled: safe.reminderPopupEnabled == null ? defaults.reminderPopupEnabled : Boolean(safe.reminderPopupEnabled),
      reminderIntervalSec: clampNumber(safe.reminderIntervalSec, 10, 300, defaults.reminderIntervalSec),
      calendarStartMonday: Boolean(safe.calendarStartMonday),
      quoteAutoRefresh: Boolean(safe.quoteAutoRefresh),
      quoteIntervalSec: clampNumber(safe.quoteIntervalSec, 10, 600, defaults.quoteIntervalSec),
      compactMode: Boolean(safe.compactMode),
      confirmDeleteHabit: safe.confirmDeleteHabit == null ? defaults.confirmDeleteHabit : Boolean(safe.confirmDeleteHabit),
      defaultReminderForNewHabit: Boolean(safe.defaultReminderForNewHabit),
      showCalendarSection: safe.showCalendarSection == null ? defaults.showCalendarSection : Boolean(safe.showCalendarSection),
      showAchievementSection: safe.showAchievementSection == null ? defaults.showAchievementSection : Boolean(safe.showAchievementSection),
      showQuoteSection: safe.showQuoteSection == null ? defaults.showQuoteSection : Boolean(safe.showQuoteSection)
    };
  }

  function normalizeHabit(habit) {
    var history = {};
    if (habit && habit.history && typeof habit.history === "object") {
      Object.keys(habit.history).forEach(function (key) {
        if (habit.history[key]) {
          history[key] = true;
        }
      });
    }

    var today = getTodayKey();
    return {
      id: habit && habit.id ? String(habit.id) : "habit_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      name: clampString(habit && habit.name, 60) || "Untitled Habit",
      createdAt: habit && habit.createdAt ? String(habit.createdAt) : today,
      reminderEnabled: Boolean(habit && habit.reminderEnabled),
      history: history
    };
  }

  function computeCurrentStreak(habit, todayKey) {
    var history = habit.history || {};
    var hasToday = Boolean(history[todayKey]);
    var cursor = hasToday ? todayKey : addDays(todayKey, -1);

    if (!history[cursor]) {
      return 0;
    }

    var streak = 0;
    while (history[cursor]) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function computeLongestStreak(habit) {
    var keys = Object.keys(habit.history || {}).filter(function (key) {
      return Boolean(habit.history[key]);
    }).sort();

    if (!keys.length) {
      return 0;
    }

    var longest = 1;
    var running = 1;

    for (var i = 1; i < keys.length; i += 1) {
      if (diffDays(keys[i - 1], keys[i]) === 1) {
        running += 1;
      } else {
        running = 1;
      }
      if (running > longest) {
        longest = running;
      }
    }
    return longest;
  }

  function getDateKeysForLast(days) {
    var list = [];
    var today = getTodayKey();
    for (var i = days - 1; i >= 0; i -= 1) {
      list.push(addDays(today, -i));
    }
    return list;
  }

  function normalizeUser(user) {
    var safe = user && typeof user === "object" ? user : {};
    var habits = Array.isArray(safe.habits) ? safe.habits.map(normalizeHabit) : [];
    return {
      username: clampString(safe.username, 24),
      password: String(safe.password || ""),
      habits: habits,
      preferences: normalizePreferences(safe.preferences),
      progressStats: safe.progressStats && typeof safe.progressStats === "object" ? safe.progressStats : {
        totalCompleted: 0,
        longestStreak: 0,
        completionRate30d: 0
      }
    };
  }

  function calculateAndStoreStats(user) {
    var habits = user.habits || [];
    var totalCompleted = 0;
    var longestStreak = 0;
    var keys30 = getDateKeysForLast(30);
    var keySet30 = {};
    keys30.forEach(function (key) {
      keySet30[key] = true;
    });
    var completedIn30 = 0;

    habits.forEach(function (habit) {
      var historyKeys = Object.keys(habit.history || {}).filter(function (key) {
        return Boolean(habit.history[key]);
      });
      totalCompleted += historyKeys.length;

      var habitLongest = computeLongestStreak(habit);
      if (habitLongest > longestStreak) {
        longestStreak = habitLongest;
      }

      historyKeys.forEach(function (key) {
        if (keySet30[key]) {
          completedIn30 += 1;
        }
      });
    });

    var denominator = habits.length * 30;
    var completionRate30d = denominator ? Math.round((completedIn30 / denominator) * 100) : 0;

    user.progressStats = {
      totalCompleted: totalCompleted,
      longestStreak: longestStreak,
      completionRate30d: completionRate30d
    };
  }

  function getUsers() {
    var raw = localStorage.getItem(USERS_KEY);
    var parsed = parseJSON(raw || "{}", {});
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getCurrentUsername() {
    return localStorage.getItem(CURRENT_USER_KEY);
  }

  function setCurrentUsername(username) {
    localStorage.setItem(CURRENT_USER_KEY, username);
  }

  function clearCurrentUsername() {
    localStorage.removeItem(CURRENT_USER_KEY);
  }

  function registerUser(username, password) {
    var cleanUsername = clampString(username, 24);
    var cleanPassword = String(password || "").trim();

    if (cleanUsername.length < 3) {
      return { ok: false, message: "Username must be at least 3 characters." };
    }
    if (cleanPassword.length < 4) {
      return { ok: false, message: "Password must be at least 4 characters." };
    }

    var users = getUsers();
    if (users[cleanUsername]) {
      return { ok: false, message: "Username already exists." };
    }

    var user = normalizeUser({
      username: cleanUsername,
      password: cleanPassword,
      habits: [],
      progressStats: {}
    });
    calculateAndStoreStats(user);
    users[cleanUsername] = user;
    saveUsers(users);
    return { ok: true };
  }

  function loginUser(username, password) {
    var cleanUsername = clampString(username, 24);
    var cleanPassword = String(password || "").trim();
    var users = getUsers();
    var user = users[cleanUsername];
    if (!user || String(user.password) !== cleanPassword) {
      return { ok: false, message: "Invalid username or password." };
    }
    setCurrentUsername(cleanUsername);
    return { ok: true };
  }

  function getCurrentUserData() {
    var username = getCurrentUsername();
    if (!username) {
      return null;
    }
    var users = getUsers();
    if (!users[username]) {
      clearCurrentUsername();
      return null;
    }
    return normalizeUser(users[username]);
  }

  function saveCurrentUserData(userData) {
    var username = getCurrentUsername();
    if (!username) {
      return false;
    }
    var users = getUsers();
    var normalized = normalizeUser(userData);
    normalized.username = username;
    calculateAndStoreStats(normalized);
    users[username] = normalized;
    saveUsers(users);
    return true;
  }

  function updateCurrentUserData(updater) {
    var user = getCurrentUserData();
    if (!user) {
      return null;
    }
    var nextUser = updater(normalizeUser(user)) || user;
    saveCurrentUserData(nextUser);
    return getCurrentUserData();
  }

  window.StorageAPI = {
    getTodayKey: getTodayKey,
    addDays: addDays,
    getDateKeysForLast: getDateKeysForLast,
    getUsers: getUsers,
    saveUsers: saveUsers,
    registerUser: registerUser,
    loginUser: loginUser,
    getCurrentUsername: getCurrentUsername,
    setCurrentUsername: setCurrentUsername,
    clearCurrentUsername: clearCurrentUsername,
    getCurrentUserData: getCurrentUserData,
    saveCurrentUserData: saveCurrentUserData,
    updateCurrentUserData: updateCurrentUserData,
    getDefaultPreferences: getDefaultPreferences,
    normalizePreferences: normalizePreferences,
    normalizeHabit: normalizeHabit,
    computeCurrentStreak: computeCurrentStreak,
    computeLongestStreak: computeLongestStreak
  };
})();
