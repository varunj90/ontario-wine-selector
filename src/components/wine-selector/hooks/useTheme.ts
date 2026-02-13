import { useLocalStorage } from "./useLocalStorage";

export function useTheme() {
  const [isDark, setIsDark] = useLocalStorage("wine-selector-dark-mode", true);
  const toggle = () => setIsDark((prev) => !prev);
  return { isDark, setIsDark, toggle } as const;
}
