export type ThemeColors = { primary: string; secondary: string; accent: string; background: string; foreground: string; button: string };

export const defaultTheme = {
  businessName: "Harbor Auto Spa",
  tagline: "A fresh finish, right at home.",
  logoUrl: "",
  preset: "ocean",
  colors: { primary: "#087E8B", secondary: "#0B3954", accent: "#FF5A5F", background: "#F6F8F7", foreground: "#132A32", button: "#087E8B" },
  font: "sans",
  buttonStyle: "rounded",
} as const;

export function readableText(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(value)) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b! > 0.179 ? "#102126" : "#ffffff";
}

export function themeStyle(colors: ThemeColors) {
  return {
    "--primary": colors.primary,
    "--secondary": colors.secondary,
    "--accent": colors.accent,
    "--background": colors.background,
    "--foreground": colors.foreground,
    "--button": colors.button,
    "--button-foreground": readableText(colors.button),
  } as React.CSSProperties;
}
