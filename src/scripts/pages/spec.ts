/* Spec sheet pages: wire the print button and keep the printed date stamp
   current. The stamp is filled at load and refreshed on beforeprint, so a
   tab left open overnight still prints with the date it was actually saved. */
export function initSpecSheet(): void {
  const stamp = () => {
    const d = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    document.querySelectorAll(".spx-date").forEach((el) => {
      el.textContent = d;
    });
  };
  stamp();
  window.addEventListener("beforeprint", stamp);
  document.getElementById("spxPrint")?.addEventListener("click", () => {
    stamp();
    window.print();
  });
}
