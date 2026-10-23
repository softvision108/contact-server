import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { BuildingIcon, ChevronDownIcon, KeyIcon, LicenseIcon, LogoutIcon, MenuIcon, CloseIcon, MoonIcon, SettingsIcon, SunIcon, UsersIcon, VideoIcon } from "../components/icons.jsx";
import { routePaths } from "../constants.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useSidebar } from "../context/SidebarContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import ChangePasswordModal from "../pages/ChangePasswordModal.jsx";

const NAV = [
  { name: "Outreach", isParent: true },
  { name: "Providers", path: routePaths.providers, icon: <BuildingIcon className="h-6 w-6" /> },
  { name: "People", path: routePaths.people, icon: <UsersIcon className="h-6 w-6" /> },
  { name: "Streamers", path: routePaths.streamers, icon: <VideoIcon className="h-6 w-6" /> },
  { name: "Licensing", isParent: true },
  { name: "License", path: routePaths.licenses, icon: <LicenseIcon className="h-6 w-6" /> },
  { name: "Settings", isParent: true },
  { name: "Mail", path: routePaths.mailSettings, icon: <SettingsIcon className="h-6 w-6" /> },
];

function Logo({ compact }) {
  return (
    <Link to="/" className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-lg font-semibold text-white">C</span>
      {compact ? null : <span className="text-xl font-semibold text-gray-800 dark:text-white/90">Contacts</span>}
    </Link>
  );
}

function AppSidebar() {
  const { isExpanded, isHovered, isMobileOpen, setIsHovered, closeMobileSidebar } = useSidebar();
  const open = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed top-0 left-0 z-50 mt-16 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out lg:mt-0 dark:border-gray-800 dark:bg-gray-900 ${
        open ? "w-[290px]" : "w-[90px]"
      } ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex py-8 ${open ? "justify-start" : "lg:justify-center"}`}>
        <Logo compact={!open} />
      </div>
      <nav className="custom-scrollbar mb-6 overflow-y-auto">
        <ul className="flex flex-col gap-2">
          {NAV.map((item) =>
            item.isParent ? (
              <li key={item.name}>
                <h2 className={`mt-2 flex text-xs leading-[20px] text-gray-400 uppercase ${open ? "justify-start" : "lg:justify-center"}`}>
                  {open ? item.name : "..."}
                </h2>
              </li>
            ) : (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={closeMobileSidebar}
                  className={({ isActive }) => `group menu-item ${isActive ? "menu-item-active" : "menu-item-inactive"}`}
                >
                  {({ isActive }) => (
                    <>
                      <span className={isActive ? "menu-item-icon-active" : "menu-item-icon-inactive"}>{item.icon}</span>
                      {open ? <span>{item.name}</span> : null}
                    </>
                  )}
                </NavLink>
              </li>
            ),
          )}
        </ul>
      </nav>
    </aside>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

const menuItemClass =
  "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300";

function UserDropdown({ onChangePassword }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setIsOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setIsOpen((v) => !v)} className="flex items-center text-gray-700 dark:text-gray-400">
        <span className="mr-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-500 font-semibold text-white">
          {user?.username?.charAt(0).toUpperCase() || "U"}
        </span>
        <span className="mr-1 block text-theme-sm font-medium">{user?.username || "User"}</span>
        <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen ? (
        <div className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
          <span className="block px-3 text-theme-sm font-medium text-gray-700 dark:text-gray-400">{user?.username}</span>
          <ul className="flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3 dark:border-gray-800">
            <li>
              <button type="button" className={menuItemClass} onClick={() => { setIsOpen(false); onChangePassword(); }}>
                <KeyIcon className="h-6 w-6 text-gray-500 group-hover:text-gray-700 dark:text-gray-400" />
                Change password
              </button>
            </li>
          </ul>
          <button
            type="button"
            className={`mt-3 ${menuItemClass}`}
            onClick={() => {
              logout();
              navigate(routePaths.login, { replace: true });
            }}
          >
            <LogoutIcon className="h-6 w-6 text-gray-500 group-hover:text-gray-700 dark:text-gray-400" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AppHeader({ onChangePassword }) {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleToggle = () => (window.innerWidth >= 1024 ? toggleSidebar() : toggleMobileSidebar());

  return (
    <header className="sticky top-0 z-99999 flex w-full border-gray-200 bg-white lg:border-b dark:border-gray-800 dark:bg-gray-900">
      <div className="flex grow flex-col items-center justify-between lg:flex-row lg:px-6">
        <div className="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4 dark:border-gray-800">
          <button
            type="button"
            className="z-99999 flex h-10 w-10 items-center justify-center rounded-lg border-gray-200 text-gray-500 lg:h-11 lg:w-11 lg:border dark:border-gray-800 dark:text-gray-400"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-5 w-5" />}
          </button>
          <div className="lg:hidden">
            <Logo />
          </div>
          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label="Open account menu"
            className="z-99999 flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="6" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="18" cy="12" r="1.5" />
            </svg>
          </button>
        </div>
        <div
          className={`${isMenuOpen ? "flex" : "hidden"} w-full items-center justify-between gap-4 px-5 py-4 shadow-theme-md lg:flex lg:justify-end lg:px-0 lg:shadow-none`}
        >
          <ThemeToggleButton />
          <UserDropdown onChangePassword={onChangePassword} />
        </div>
      </div>
    </header>
  );
}

export default function AdminLayout({ children }) {
  const { isExpanded, isHovered, isMobileOpen, toggleMobileSidebar } = useSidebar();
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const margin = isMobileOpen ? "ml-0" : isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]";

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      {isMobileOpen ? <div className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden" onClick={toggleMobileSidebar} /> : null}
      <div className={`flex-1 transition-all duration-300 ease-in-out ${margin}`}>
        <AppHeader onChangePassword={() => setIsPasswordOpen(true)} />
        <div className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">{children}</div>
      </div>
      <ChangePasswordModal isOpen={isPasswordOpen} onClose={() => setIsPasswordOpen(false)} />
    </div>
  );
}
