(function () {
  function keyToDate(key) {
    var parts = key.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
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

    habits.forEach(function (habit) {
      totalCompleted += getCompletedCount(habit.history);
      var longest = StorageAPI.computeLongestStreak(habit);
      if (longest > longestStreak) {
        longestStreak = longest;
      }
    });

    var keys30 = StorageAPI.getDateKeysForLast(30);
    var completed30 = 0;
    habits.forEach(function (habit) {
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

      var date = keyToDate(key);
      var label = date.toLocaleDateString(undefined, { weekday: "short" });
      return { key: key, label: label, value: count };
    });
  }

  function renderChart(habits) {
    var chart = document.getElementById("weeklyChart");
    if (!chart) {
      return;
    }
    var data = getWeeklyData(habits);
    var max = data.reduce(function (best, item) {
      return item.value > best ? item.value : best;
    }, 0);
    var baseline = max || 1;

    chart.innerHTML = data.map(function (item) {
      var height = Math.max(12, Math.round((item.value / baseline) * 150));
      return (
        '<div class="bar-wrap">' +
        '  <span class="bar-value">' + item.value + "</span>" +
        '  <div class="bar" style="height:' + height + 'px;"></div>' +
        '  <span class="bar-label">' + item.label + "</span>" +
        "</div>"
      );
    }).join("");
  }

  function renderStats(user) {
    var stats = computeStats(user);
    var totalEl = document.getElementById("totalCompletedStat");
    var longestEl = document.getElementById("longestStreakStat");
    var rateEl = document.getElementById("completionRateStat");
    if (totalEl) {
      totalEl.textContent = String(stats.totalCompleted);
    }
    if (longestEl) {
      longestEl.textContent = stats.longestStreak + " days";
    }
    if (rateEl) {
      rateEl.textContent = stats.completionRate + "%";
    }
    renderChart(user.habits || []);
  }

  function init() {
    if (!document.getElementById("weeklyChart")) {
      return;
    }

    var user = Auth.requireAuth();
    if (!user) {
      return;
    }

    UI.markActiveNav("stats");

    UI.simulateLoading(function () {
      renderStats(user);
    }, "Calculating insights...", 540);
  }

  init();
})();
