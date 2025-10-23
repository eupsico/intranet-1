// Arquivo: /modulos/voluntario/js/meus-pacientes.js
// Versão: 9.3 (Corrigido para usar tbody da tabela)

import { initializeMeusPacientes } from "./meus-pacientes/data.js";

export async function init(user, userData) {
  // O container onde as LINHAS (<tr>) dos pacientes serão renderizadas
  // Mudamos do 'pacientes-list-container' para o 'tbody' da tabela.
  const tableBody = document.getElementById("pacientes-table-body"); // <<<--- CORREÇÃO AQUI

  if (!tableBody) {
    // A mensagem de erro agora reflete o ID correto que está faltando
    console.error(
      "Container da tabela de pacientes (tbody) não encontrado. (ID: pacientes-table-body)" // <<<--- CORREÇÃO NA MENSAGEM
    );
    // Opcional: Exibir erro na área principal se o tbody não for encontrado
    const contentArea = document.getElementById("content-area"); // Ou o ID da área principal
    if (contentArea) {
      contentArea.innerHTML =
        '<p class="alert alert-error">Erro interno: A estrutura da tabela de pacientes está incompleta.</p>';
    }
    return;
  }

  // Chama a função inicializadora do módulo de dados, passando o tbody como container
  await initializeMeusPacientes(user, userData); // <<<--- CORREÇÃO AQUI (passa tableBody)
}
