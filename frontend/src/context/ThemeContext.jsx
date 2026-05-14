import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check local storage or system preference
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pp_theme");
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    // Update local storage and document class
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("pp_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("pp_theme", "light");
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
