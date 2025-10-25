// Arquivo: /modulos/voluntario/js/meus-pacientes.js
// Confirme que está assim:

import { initializeMeusPacientes } from "./meus-pacientes/data.js";

export async function init(user, userData) {
  console.log(">>> Entrou em init()", { user, userData });
  console.log("meus-pacientes.js: Iniciando com user ID:", user?.uid); // Log Adicional
  if (!user || !user.uid) {
    console.error("meus-pacientes.js: Objeto user inválido recebido.");
    // Exibir erro ou tratar adequadamente
    const contentArea = document.getElementById("content-area");
    if (contentArea)
      contentArea.innerHTML =
        '<p class="alert alert-error">Erro: Falha na autenticação ao carregar pacientes.</p>';
    return;
  }
  // Chama initializeMeusPacientes, que agora busca o tableBody internamente
  await initializeMeusPacientes(user, userData); // Passa user e userData
}
