"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextType>({
  theme: "light",
  resolvedTheme: "light",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    try {
      localStorage.removeItem("syncspace-theme");
      document.documentElement.classList.remove("dark");
    } catch {
      // Ignore
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme: "light",
        resolvedTheme: "light",
        setTheme: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  return context;
}
