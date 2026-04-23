import { createContext, useContext } from "react";
import { defaultThemeMode, themeModes } from "../../../utils/theme";

export const ADMIN_THEME_STORAGE_KEY = "doc_track_theme_mode";

export const ADMIN_THEME_OPTIONS = [
    { value: "dark", label: "Dark" },
    { value: "ivory", label: "Ivory" },
    { value: "clean", label: "Clean" },
];

const fallbackMode = themeModes[defaultThemeMode] ? defaultThemeMode : "dark";

const AdminThemeContext = createContext({
    themeMode: fallbackMode,
    setThemeMode: () => {},
    activeTheme: themeModes[fallbackMode],
});

export function useAdminTheme() {
    return useContext(AdminThemeContext);
}

export default AdminThemeContext;
