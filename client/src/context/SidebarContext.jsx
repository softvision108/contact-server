import { createContext, useContext, useEffect, useState } from "react";

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setIsMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const value = {
    isExpanded,
    isMobileOpen,
    isHovered,
    setIsHovered,
    toggleSidebar: () => setIsExpanded((v) => !v),
    toggleMobileSidebar: () => setIsMobileOpen((v) => !v),
    closeMobileSidebar: () => setIsMobileOpen(false),
  };
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export const useSidebar = () => useContext(SidebarContext);
