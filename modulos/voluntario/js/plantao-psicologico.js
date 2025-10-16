// Arquivo: /modulos/voluntario/js/plantao-psicologico.js
// Versão: 2.0 (Código Refatorado para Melhor Legibilidade)
// Descrição: Controla a funcionalidade do acordeão na página do Plantão.

export function init() {
  const container = document.querySelector(".view-container");
  if (!container) {
    console.error("Container da view 'plantao-psicologico' não encontrado.");
    return;
  }

  const accordionHeaders = container.querySelectorAll(".accordion-header");

  accordionHeaders.forEach((header) => {
    header.addEventListener("click", () => {
      const accordionItem = header.closest(".accordion-item");
      if (!accordionItem) return;

      const accordionBody = header.nextElementSibling;
      const isActive = accordionItem.classList.contains("active");

      // Fecha todos os outros itens que possam estar abertos
      container.querySelectorAll(".accordion-item").forEach((item) => {
        if (item !== accordionItem) {
          item.classList.remove("active");
          item.querySelector(".accordion-header").classList.remove("active");
          const body = item.querySelector(".accordion-body");
          if (body) {
            body.style.maxHeight = null; // Recolhe o corpo do acordeão
          }
        }
      });

      // Alterna (abre ou fecha) o item que foi clicado
      if (!isActive) {
        accordionItem.classList.add("active");
        header.classList.add("active");
        accordionBody.style.maxHeight = accordionBody.scrollHeight + "px"; // Expande para a altura total do conteúdo
      } else {
        accordionItem.classList.remove("active");
        header.classList.remove("active");
        accordionBody.style.maxHeight = null; // Recolhe o corpo do acordeão
      }
    });
  });
}
