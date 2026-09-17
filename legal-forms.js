(() => {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', event => {
    if (!form.elements.inquiryConsent.checked) { event.preventDefault(); event.stopImmediatePropagation(); form.elements.inquiryConsent.reportValidity(); return; }
  }, true);
})();
