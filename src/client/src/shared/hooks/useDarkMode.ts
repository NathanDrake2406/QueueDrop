import { useState, useEffect } from "react";

export function useDarkMode() {
  // Always start with false during SSR to avoid hydration mismatch
  const [isDark, setIsDark] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  // On mount, read the stored preference
  useEffect(() => {
    setHasMounted(true);
    const saved = localStorage.getItem("theme");
    if (saved) {
      setIsDark(saved === "dark");
    } else {
      setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  // Apply dark mode class and save preference
  useEffect(() => {
    if (!hasMounted) return;

    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark, hasMounted]);

  return [isDark, setIsDark] as const;
}
