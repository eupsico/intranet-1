// Arquivo: /modulos/voluntario/js/meus-pacientes.js
// Versão: 9.1 (Modularizado)

import { initializeMeusPacientes } from "./meus-pacientes/data.js";

export async function init(user, userData) {
  // O container principal onde o acordeão será renderizado
  const container = document.getElementById("pacientes-accordion-container");
  if (!container) {
    console.error(
      "Container de pacientes não encontrado. (ID: pacientes-accordion-container)"
    );
    return;
  }

  // Chama a função inicializadora do módulo de dados, passando as dependências
  await initializeMeusPacientes(user, userData, container);
}
