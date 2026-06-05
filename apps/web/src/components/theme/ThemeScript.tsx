const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("openforum-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored === "light" || stored === "dark" ? stored : (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
