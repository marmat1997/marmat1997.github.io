const statusDisplay = document.getElementById('connection-status');

if (statusDisplay) {
    statusDisplay.textContent = '¡HTML, CSS, and JavaScript connected!';
} else {
    console.error("Element with ID 'connection-status' not found.");
}
// funcionalidad de desplazar hacia arriba
const desplazarArriba = document.querySelector("#desplazarse-hacia-arriba");

desplazarArriba.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
});

// menú móvil (hamburguesa)
const menuToggle = document.querySelector("#menu-toggle");
const enlaces = document.querySelector("#Enlaces");

if (menuToggle && enlaces) {
  menuToggle.addEventListener("click", () => {
    const abierto = enlaces.classList.toggle("activo");
    menuToggle.setAttribute("aria-expanded", abierto);
  });

  // cierra el menú al elegir un enlace (útil en móvil)
  enlaces.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      enlaces.classList.remove("activo");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}
