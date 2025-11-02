// This script handles the automatic rendering of Lucide icons.

// Function to render icons. It's safe to call multiple times.
const renderIcons = () => {
  if (window.lucide) {
    window.lucide.createIcons();
  } else {
    // This might happen if the script runs before lucide is loaded, though it's unlikely with 'defer'.
    console.warn("Lucide library not available yet.");
  }
};

// Use a MutationObserver to watch for DOM changes and render icons automatically.
// This is more efficient than calling createIcons() in every React component's useEffect.
const observer = new MutationObserver((mutations) => {
  // We can debounce this if performance becomes an issue, but for now, it's fine.
  renderIcons();
});

// Start observing the body for child list changes (e.g., when React adds components).
// We wait for the DOM to be fully loaded before starting the observer.
document.addEventListener('DOMContentLoaded', () => {
  // Initial render for any icons present in the static HTML (if any).
  renderIcons();

  // Start observing for dynamic changes.
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
});

// As a fallback, if the observer is disconnected somehow, we can also listen for a custom event.
// For example, a complex component could dispatch this event after a major DOM update.
window.addEventListener('render-icons', renderIcons);
