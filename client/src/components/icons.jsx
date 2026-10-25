// Small stroke icons in the lg24 admin's 24px style.
function Icon({ d, className = "h-5 w-5", strokeWidth = 1.8 }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24" aria-hidden="true">
      {[].concat(d).map((p) => (
        <path key={p} strokeLinecap="round" strokeLinejoin="round" d={p} />
      ))}
    </svg>
  );
}

export const BuildingIcon = (p) => <Icon {...p} d={["M3 21h18", "M5 21V5a2 2 0 012-2h7a2 2 0 012 2v16", "M16 9h2a2 2 0 012 2v10", "M9 7h3M9 11h3M9 15h3"]} />;
export const UsersIcon = (p) => <Icon {...p} d={["M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1", "M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7z", "M21 19v-1a4 4 0 00-3-3.87", "M16 3.13a3.5 3.5 0 010 6.75"]} />;
export const LicenseIcon = (p) => <Icon {...p} d={["M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z", "M14 3v5h5", "M9 13h6M9 17h4"]} />;
export const PencilIcon = (p) => <Icon {...p} d={["M16.86 4.49l2.65 2.65", "M4 20l4.5-1 10.06-10.06a1.87 1.87 0 000-2.65l-.85-.85a1.87 1.87 0 00-2.65 0L5 15.5 4 20z"]} />;
export const TrashIcon = (p) => <Icon {...p} d={["M4 7h16", "M10 11v6M14 11v6", "M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12", "M9 7V4h6v3"]} />;
export const MailIcon = (p) => <Icon {...p} d={["M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z", "M3.5 7l8.5 6 8.5-6"]} />;
export const PlusIcon = (p) => <Icon {...p} strokeWidth={2} d="M12 5v14m7-7H5" />;
export const CloseIcon = (p) => <Icon {...p} strokeWidth={2} d="M6 18L18 6M6 6l12 12" />;
export const KeyIcon = (p) => <Icon {...p} d={["M15.5 7.5a3 3 0 11-6 0 3 3 0 016 0z", "M12.5 10.5L5 18v3h3l1-1v-2h2v-2h2l1.2-1.2"]} />;
export const LogoutIcon = (p) => <Icon {...p} d={["M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3", "M10 17l-5-5 5-5", "M5 12h11"]} />;
export const SunIcon = (p) => <Icon {...p} d={["M12 17a5 5 0 100-10 5 5 0 000 10z", "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"]} />;
export const MoonIcon = (p) => <Icon {...p} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />;
export const MenuIcon = (p) => <Icon {...p} strokeWidth={2} d={["M4 6h16", "M4 12h10", "M4 18h16"]} />;
export const ChevronDownIcon = (p) => <Icon {...p} d="M6 9l6 6 6-6" />;
export const CoinIcon = (p) => <Icon {...p} d={["M12 21a9 9 0 100-18 9 9 0 000 18z", "M14.5 9.5A2.5 2 0 0012 8h-1a2 2 0 000 4h2a2 2 0 010 4h-1a2.5 2 0 01-2.5-1.5", "M12 6.5V8M12 16v1.5"]} />;
export const VideoIcon = (p) => <Icon {...p} d={["M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14", "M5 6h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"]} />;
export const SettingsIcon = (p) => <Icon {...p} d={["M12 15a3 3 0 100-6 3 3 0 000 6z", "M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 008 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 8a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"]} />;
export const ExternalIcon = (p) => <Icon {...p} d={["M14 4h6v6", "M20 4l-9 9", "M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"]} />;
