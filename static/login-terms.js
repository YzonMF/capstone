/* Opens and closes the Terms and Conditions modal on the login screen
   (templates/index.html), remembers acceptance across reloads/visits,
   and toggles password visibility. */
(function () {
  var STORAGE_KEY = 'ednp_terms_accepted';
  var modal = document.getElementById('terms-modal');
  var openBtn = document.getElementById('open-terms-btn');
  var agreeBtn = document.getElementById('agree-terms-btn');
  var checkbox = document.getElementById('accept-terms');
  var termsBox = document.getElementById('terms-row-box');

  function saveAcceptedState(accepted) {
    try {
      if (accepted) {
        localStorage.setItem(STORAGE_KEY, '1');
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (_) {}
  }

  function loadAcceptedState() {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  if (checkbox) {
    if (checkbox.checked) {
      saveAcceptedState(true);
    } else if (loadAcceptedState()) {
      checkbox.checked = true;
    }
    checkbox.addEventListener('change', function () {
      saveAcceptedState(checkbox.checked);
    });
  }

  document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var wrap = btn.closest('.pwd-input-wrap');
      var input = wrap ? wrap.querySelector('input') : null;
      if (!input) return;
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      btn.title = showing ? 'Show password' : 'Hide password';
      var icon = btn.querySelector('i');
      if (icon) {
        icon.className = showing ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
      }
    });
  });

  if (!modal || !openBtn) return;

  function openModal() {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (agreeBtn) agreeBtn.focus();
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    openBtn.focus();
  }

  openBtn.addEventListener('click', function (e) {
    e.preventDefault();
    openModal();
  });

  modal.querySelectorAll('[data-close="terms-modal"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      closeModal();
    });
  });

  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  if (agreeBtn) {
    agreeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      if (checkbox) {
        checkbox.checked = true;
        saveAcceptedState(true);
        try {
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
      }
      if (termsBox) {
        termsBox.classList.add('has-focus');
        setTimeout(function () {
          termsBox.classList.remove('has-focus');
        }, 1200);
      }
      closeModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
})();
