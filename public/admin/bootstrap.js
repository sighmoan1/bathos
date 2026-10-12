(function () {
  "use strict";
  var notice = document.getElementById("admin-notice");
  if (!window.CMS) {
    notice.textContent = "The editor could not load. Check your connection and reload this page.";
    return;
  }
  try {
    if (window.BathosAdminMobile && window.BathosAdminMobile.register) window.BathosAdminMobile.register(window.CMS);
    window.CMS.init();
    notice.textContent = "Sign in with a GitHub account that can write to the Bathos repository.";
  } catch (error) {
    notice.textContent = "The editor could not start. Reload this page or contact the site owner.";
  }
})();
