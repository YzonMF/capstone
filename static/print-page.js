/* The Print and Back buttons on the printable record and report pages. */
document.querySelectorAll('[data-print-page]').forEach(function (button) {
  button.addEventListener('click', function () { window.print(); });
});

document.querySelectorAll('[data-back-page]').forEach(function (button) {
  button.addEventListener('click', function (e) {
    var fallback = button.getAttribute('data-back-url') || '/';
    if (window.history.length > 1) {
      e.preventDefault();
      window.history.back();
    } else if (window.opener) {
      e.preventDefault();
      window.close();
    } else {
      window.location.href = fallback;
    }
  });
});
