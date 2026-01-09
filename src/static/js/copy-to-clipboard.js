/**
 * Copy to Clipboard functionality
 * Generic: any element with `data-copy` will copy that value.
 * Optional UX: temporarily shows "Copied!" on the element.
 */

function initCopyToClipboard() {
  const elements = document.querySelectorAll('[data-copy]');
  if (!elements.length) return;

  elements.forEach((el) => {
    el.addEventListener('click', async (e) => {
      // Only intercept anchor/button clicks
      if (el.tagName === 'A' || el.tagName === 'BUTTON') {
        e.preventDefault();
      }
      const value = el.getAttribute('data-copy');
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        const original = el.innerHTML;
        el.innerHTML = '<i class="fa-solid fa-check"></i> Copied ' + value;
        setTimeout(() => {
          el.innerHTML = original;
        }, 1000);
      } catch (err) {
        console.error('[Copy to Clipboard] Failed to copy:', err);
      }
    }, { passive: false });
  });
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCopyToClipboard);
} else {
  initCopyToClipboard();
}
