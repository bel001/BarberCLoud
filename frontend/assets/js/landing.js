document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("heroCardToggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const expanded = toggle.classList.toggle("is-expanded");
    document.querySelectorAll(".hero-metric-extra").forEach(el => el.classList.toggle("hidden", !expanded));
    toggle.querySelector("span").textContent = expanded ? "Ver menos horarios" : "Ver todos los horarios";
  });
});
