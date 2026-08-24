import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { applyTheme, currentTheme, nextTheme } from "../lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);
  const dark = theme === "dark";

  function toggleTheme() {
    const next = nextTheme(theme);
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      className="theme-toggle secondary-button"
      type="button"
      aria-label={dark ? "切换到浅色模式" : "切换到暗黑模式"}
      aria-pressed={dark}
      title={dark ? "当前为暗黑模式，点击切换到浅色模式" : "当前为浅色模式，点击切换到暗黑模式"}
      onClick={toggleTheme}
    >
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span>{dark ? "亮色" : "暗色"}</span>
    </button>
  );
}
