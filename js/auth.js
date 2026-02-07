(function () {
  function getPageName() {
    var path = window.location.pathname.split("/").pop() || "index.html";
    return path.toLowerCase();
  }

  function requireAuth() {
    var user = StorageAPI.getCurrentUserData();
    if (!user) {
      window.location.href = "index.html";
      return null;
    }
    return user;
  }

  function requireGuest() {
    var user = StorageAPI.getCurrentUserData();
    if (user) {
      window.location.href = "dashboard.html";
      return false;
    }
    return true;
  }

  function initTabs() {
    var tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var target = button.getAttribute("data-tab");
        tabButtons.forEach(function (btn) {
          btn.classList.remove("active");
        });
        button.classList.add("active");

        document.querySelectorAll(".auth-form").forEach(function (form) {
          form.classList.remove("active");
        });

        var activeForm = document.getElementById(target);
        if (activeForm) {
          activeForm.classList.add("active");
        }
      });
    });
  }

  function initLoginForm() {
    var form = document.getElementById("loginForm");
    if (!form) {
      return;
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var username = document.getElementById("loginUsername").value;
      var password = document.getElementById("loginPassword").value;
      var result = StorageAPI.loginUser(username, password);

      if (!result.ok) {
        UI.showToast(result.message, "error");
        return;
      }

      UI.showToast("Login successful.", "success");
      UI.simulateLoading(function () {
        window.location.href = "dashboard.html";
      }, "Signing in...", 650);
    });
  }

  function initRegisterForm() {
    var form = document.getElementById("registerForm");
    if (!form) {
      return;
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var username = document.getElementById("registerUsername").value;
      var password = document.getElementById("registerPassword").value;

      var result = StorageAPI.registerUser(username, password);
      if (!result.ok) {
        UI.showToast(result.message, "error");
        return;
      }

      var loginResult = StorageAPI.loginUser(username, password);
      if (!loginResult.ok) {
        UI.showToast("Account created, please login.", "info");
        return;
      }

      UI.showToast("Account created successfully.", "success");
      UI.simulateLoading(function () {
        window.location.href = "dashboard.html";
      }, "Creating workspace...", 750);
    });
  }

  function initAuthPage() {
    if (!requireGuest()) {
      return;
    }
    initTabs();
    initLoginForm();
    initRegisterForm();
  }

  function initProtectedPage() {
    var user = requireAuth();
    if (!user) {
      return;
    }
    if (user.preferences && user.preferences.theme) {
      UI.applyTheme(user.preferences.theme);
    }
    UI.bindLogout();
  }

  function init() {
    UI.initTheme();
    var page = getPageName();
    if (page === "index.html" || page === "") {
      initAuthPage();
      return;
    }
    initProtectedPage();
  }

  window.Auth = {
    requireAuth: requireAuth,
    requireGuest: requireGuest
  };

  init();
})();
