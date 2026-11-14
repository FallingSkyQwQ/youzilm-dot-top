/**
 * Runs before the body paints so that a stored dark theme does not flash
 * light for a frame. Keep this tiny and dependency-free.
 */
export const themeScript = `(function(){try{var key="theme";var stored=localStorage.getItem(key);var dark=stored==="dark"||(!stored&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.dataset.theme=dark?"dark":"light";root.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
