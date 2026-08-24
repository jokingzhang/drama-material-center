export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "material-center:theme";

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

function storedTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (!persist) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme still applies for the current page when local storage is unavailable.
  }
}

export function initializeTheme(): Theme {
  const theme = storedTheme();
  applyTheme(theme, false);
  return theme;
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
