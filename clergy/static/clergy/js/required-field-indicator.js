/* Colors each field's "*" required-mark: red while empty, green once validly
 * filled, and maintains aria-invalid for assistive technologies. Runs on load
 * (so fields pre-filled from a saved profile start correctly styled) and
 * again on every input/change, including values set programmatically. */
(function () {
  function checkValidityState(control) {
    if (!control) return { filled: false, valid: false };
    const val = (control.value || '').trim();
    if (!val) return { filled: false, valid: false };

    // Check HTML5 validity if available
    const isValid = typeof control.checkValidity === 'function' ? control.checkValidity() : true;
    return { filled: true, valid: isValid };
  }

  function setupField(field) {
    const mark = field.querySelector('.req-mark');
    const control = field.querySelector('input, select, textarea');
    if (!mark || !control) return;

    const update = () => {
      const state = checkValidityState(control);
      if (!state.filled) {
        mark.classList.remove('filled');
        mark.classList.remove('invalid');
        control.removeAttribute('aria-invalid');
        field.classList.remove('has-error');
      } else if (state.valid) {
        mark.classList.add('filled');
        mark.classList.remove('invalid');
        control.setAttribute('aria-invalid', 'false');
        field.classList.remove('has-error');
      } else {
        // Filled with invalid format
        mark.classList.remove('filled');
        mark.classList.add('invalid');
        control.setAttribute('aria-invalid', 'true');
        field.classList.add('has-error');
      }
    };

    update();
    control.addEventListener('input', update);
    control.addEventListener('change', update);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.field').forEach(setupField);
  });

  // Export helper for dynamically added fields (such as clone nodes or address picker updates)
  window.initRequiredFieldIndicators = function (container) {
    const root = container || document;
    root.querySelectorAll('.field').forEach(setupField);
  };
})();
