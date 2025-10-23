// Arquivo: /modulos/voluntario/js/meus-pacientes.js
// Versão: 9.2 (Modularizado - Refatoração Detalhe Paciente)

import { initializeMeusPacientes } from "./meus-pacientes/data.js";

export async function init(user, userData) {
  // O container principal onde a lista de pacientes será renderizada
  // O ID foi alterado de "pacientes-accordion-container" para "pacientes-list-container" no HTML.
  const container = document.getElementById("pacientes-list-container");
  if (!container) {
    console.error(
      "Container de pacientes não encontrado. (ID: pacientes-list-container)"
    );
    return;
  } // Chama a função inicializadora do módulo de dados, passando as dependências

  await initializeMeusPacientes(user, userData, container);
}
