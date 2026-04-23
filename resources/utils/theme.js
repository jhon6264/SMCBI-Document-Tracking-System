const sharedThemeTokens = {
  fonts: {
    primary: "'Inter', system-ui, sans-serif",
  },

  fontSizes: {
    pageTitle: "22px",
    sectionTitle: "18px",
    cardTitle: "16px",
    body: "14px",
    small: "13px",
  },

  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  radius: {
    sm: "8px",
    md: "10px",
    lg: "14px",
  },
};

export const themeModes = {
  dark: {
    colors: {
      background: "#0d0f14",
      primary: "#388bff",
      primaryDark: "#63a0ff",
      accent: "#3fcf8e",
      text: "#ffffff",
      textMuted: "rgba(255,255,255,0.7)",
      border: "rgba(255,255,255,0.07)",
      white: "#FFFFFF",
      black: "#0d0f14",
      surface: "#111318",
      panel: "#111827",
      card: "#1a1f2e",
      hint: "rgba(255,255,255,0.15)",
      borderHover: "rgba(255,255,255,0.12)",
      blueTint: "rgba(56,139,255,0.12)",
      tealTint: "rgba(99,200,180,0.08)",
      status: {
        pending: "#63c8b4",
        opened: "#388bff",
        signed: "#3fcf8e",
      },
    },
    shadows: {
      card: "0 24px 60px rgba(0, 0, 0, 0.28)",
    },
  },

  ivory: {
    colors: {
      background: "#F4ECDE",
      primary: "#2F61C9",
      primaryDark: "#1A3D8F",
      accent: "#1E9C72",
      text: "#0E1D39",
      textMuted: "rgba(14,29,57,0.70)",
      border: "rgba(14,29,57,0.16)",
      white: "#FFFFFF",
      black: "#0E1D39",
      surface: "#FFF9EE",
      panel: "#E7DCC8",
      card: "#FFFDF7",
      hint: "rgba(14,29,57,0.18)",
      borderHover: "rgba(14,29,57,0.26)",
      blueTint: "rgba(47,97,201,0.14)",
      tealTint: "rgba(30,156,114,0.11)",
      status: {
        pending: "#BA8C2A",
        opened: "#2F61C9",
        signed: "#1E9C72",
      },
    },
    shadows: {
      card: "0 18px 38px rgba(14, 29, 57, 0.14)",
    },
  },

  clean: {
    colors: {
      background: "#FAFCFF",
      primary: "#2F61C9",
      primaryDark: "#183B8C",
      accent: "#1B8F6A",
      text: "#0D1A32",
      textMuted: "rgba(13,26,50,0.68)",
      border: "rgba(13,26,50,0.14)",
      white: "#FFFFFF",
      black: "#0D1A32",
      surface: "#FFFFFF",
      panel: "#ECF2FF",
      card: "#FFFFFF",
      hint: "rgba(13,26,50,0.16)",
      borderHover: "rgba(13,26,50,0.24)",
      blueTint: "rgba(47,97,201,0.12)",
      tealTint: "rgba(27,143,106,0.10)",
      status: {
        pending: "#B28421",
        opened: "#2F61C9",
        signed: "#1B8F6A",
      },
    },
    shadows: {
      card: "0 16px 34px rgba(13, 26, 50, 0.12)",
    },
  },
};

export const defaultThemeMode = "dark";

export const theme = {
  colors: themeModes[defaultThemeMode].colors,
  shadows: themeModes[defaultThemeMode].shadows,
  ...sharedThemeTokens,
};
