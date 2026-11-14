import { Noto_Serif_SC } from "next/font/google";

export const notoSerif = Noto_Serif_SC({
  weight: "variable",
  variable: "--font-serif",
  display: "swap",
  fallback: ["Songti SC", "SimSun", "serif"],
});
