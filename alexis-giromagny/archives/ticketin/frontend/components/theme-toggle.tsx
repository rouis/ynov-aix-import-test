"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Bascule clair/sombre, persistée dans localStorage. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // null = pas encore monté (évite un mismatch d'hydratation).
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    // Synchronisation DOM → React au montage : on lit la classe appliquée
    // par le script anti-flash du layout racine.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage indisponible : la préférence ne sera pas persistée.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Passer en thème clair" : "Passer en thème sombre"}
      title={dark ? "Thème clair" : "Thème sombre"}
      className={`flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${className}`}
    >
      {/* Icône neutre (Lune) avant le montage pour éviter un mismatch d'hydratation. */}
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
