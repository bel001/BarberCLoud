(() => {
  const theme = localStorage.getItem("barbercloud_theme")
    || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
})();
