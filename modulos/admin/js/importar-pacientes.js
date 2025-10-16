import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

export function init(user, userData) {
  console.log("🚀 Módulo de Importar Pacientes iniciado.");

  const importForm = document.getElementById("import-form");
  const fileInput = document.getElementById("file-input");
  const filaSelect = document.getElementById("fila-select");
  const submitButton = document.getElementById("submit-button");
  const resultContainer = document.getElementById("result-container");
  const resultContent = document.getElementById("result-content");

  importForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    const fila = filaSelect.value;

    if (!file || !fila) {
      alert("Por favor, selecione uma fila e um arquivo.");
      return;
    }

    // Desabilitar o botão e mostrar o feedback
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<div class="spinner-border spinner-border-sm" role="status"></div> Enviando e processando...';
    resultContainer.style.display = "block";
    resultContent.innerHTML = `<div class="progress-bar"><div class="progress-bar-fill"></div></div><p>Aguarde, sua planilha está sendo processada. Isso pode levar alguns minutos...</p>`;

    try {
      // É preciso uma biblioteca para ler o Excel no navegador. Usaremos uma CDN para isso.
      // O script da biblioteca será adicionado dinamicamente ao HTML.
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
      );

      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Converte a planilha para um array de objetos JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          throw new Error("A planilha está vazia ou em um formato inválido.");
        }

        // Chamar a Firebase Function para processar os dados
        const functions = getFunctions();
        const importarPacientes = httpsCallable(
          functions,
          "importarPacientesBatch"
        ); // Nome da nossa futura função

        const result = await importarPacientes({
          pacientes: jsonData,
          fila: fila,
        });

        // Exibir o resultado
        displayResults(result.data);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Erro na importação:", error);
      displayResults({
        sucesso: 0,
        erros: 0,
        total: 0,
        mensagensErro: [`Erro no lado do cliente: ${error.message}`],
      });
    }
  });

  function displayResults(data) {
    let html = `<h4>Processamento Concluído!</h4>`;
    html += `<p><strong>Total de linhas na planilha:</strong> ${data.total}</p>`;
    html += `<p class="success-text"><strong>Pacientes importados com sucesso:</strong> ${data.sucesso}</p>`;
    html += `<p class="error-text"><strong>Linhas com erros:</strong> ${data.erros}</p>`;

    if (data.erros > 0 && data.mensagensErro.length > 0) {
      html += `<h5>Detalhes dos Erros:</h5>`;
      html += `<ul class="error-list">`;
      data.mensagensErro.forEach((msg) => {
        html += `<li>${msg}</li>`;
      });
      html += `</ul>`;
    }

    resultContent.innerHTML = html;
    submitButton.disabled = false;
    submitButton.innerHTML = "Iniciar Importação";
    importForm.reset();
  }

  // Função utilitária para carregar scripts dinamicamente
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        return resolve();
      }
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error(`Falha ao carregar o script: ${src}`));
      document.head.appendChild(script);
    });
  }
}
