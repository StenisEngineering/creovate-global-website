
document.getElementById("year").textContent = new Date().getFullYear();

const navLinks = document.getElementById("navLinks");
document.querySelectorAll(".nav-links a").forEach(a => {
  a.addEventListener("click", () => navLinks.classList.remove("open"));
});

function toggleMenu(){
  navLinks.classList.toggle("open");
}
