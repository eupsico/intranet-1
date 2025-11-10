import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

export function init(user, userData) {
  console.log("🚀 Módulo de Importar Pacientes iniciado (v3.0).");
  const importForm = document.getElementById("import-form");
  const fileInput = document.getElementById("file-input");
  const filaSelect = document.getElementById("fila-select");
  const submitButton = document.getElementById("submit-button");
  const resultContainer = document.getElementById("result-container");
  const resultContent = document.getElementById("result-content");

  if (!importForm || !fileInput || !filaSelect || !submitButton) {
    console.error("Elementos do formulário não encontrados no DOM.");
    return;
  }

  importForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    const fila = filaSelect.value;

    if (!file) {
      alert("Por favor, selecione um arquivo Excel (.xlsx ou .csv).");
      return;
    }

    console.log(`Iniciando importação com fila padrão: ${fila}`);

    // Desabilitar botão e mostrar loading
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<span class="loading-spinner"></span> Processando...';
    resultContainer.style.display = "block";
    resultContent.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Aguarde, processando planilha. Isso pode levar alguns minutos...</p>
    `;

    try {
      // Carregar biblioteca XLSX dinamicamente
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
      );

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, {
            type: "array",
            cellDates: true,
            dateNF: "yyyy-mm-dd",
          });

          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Converter para JSON com valores vazios como ""
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            defval: "",
          });

          console.log(`Planilha carregada: ${jsonData.length} linhas`);

          if (jsonData.length === 0) {
            throw new Error("A planilha está vazia ou em formato inválido.");
          }

          // Log dos primeiros dados para debug
          console.log("Primeiros dados:", jsonData[0]);

          // Chamar Cloud Function
          const functions = getFunctions();
          const importarPacientes = httpsCallable(
            functions,
            "importarPacientesBatch"
          );

          const result = await importarPacientesWithRetry(
            {
              pacientes: jsonData,
              fila: fila,
            },
            3
          );

          displayResults(result.data);
        } catch (parseError) {
          console.error("Erro ao parsear arquivo:", parseError);
          throw new Error(`Erro ao ler arquivo: ${parseError.message}`);
        }
      };

      reader.onerror = () => {
        throw new Error("Erro ao ler arquivo");
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Erro na importação:", error);
      displayResults({
        total: 0,
        sucesso: 0,
        erros: 1,
        duplicatas: 0,
        mensagensErro: [`Erro: ${error.message}`],
      });
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = "Importar Pacientes";
      fileInput.value = "";
    }
  });

  // Função para carregar script dinamicamente
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Falha ao carregar ${url}`));
      document.head.appendChild(script);
    });
  }

  // Retry com backoff exponencial
  async function importarPacientesWithRetry(payload, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const functions = getFunctions();
        const importarPacientes = httpsCallable(
          functions,
          "importarPacientesBatch"
        );
        console.log(`Tentativa ${i + 1} de ${maxRetries}...`);
        return await importarPacientes(payload);
      } catch (error) {
        console.warn(`Tentativa ${i + 1} falhou:`, error.message);
        if (i === maxRetries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  // Exibir resultados melhorado
  function displayResults(data) {
    console.log("Resultado da importação:", data);

    let html = `<div class="result-summary" style="padding: 20px; background-color: #f5f5f5; border-radius: 8px;">`;
    html += `<h3 style="margin-top: 0;">📊 Resultado da Importação</h3>`;

    html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">`;
    html += `<div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #27ae60;">`;
    html += `<strong style="color: #27ae60;">✓ Sucessos</strong><br/>`;
    html += `<span style="font-size: 24px; font-weight: bold; color: #27ae60;">${
      data.sucesso || 0
    }</span>`;
    html += `</div>`;

    html += `<div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #e74c3c;">`;
    html += `<strong style="color: #e74c3c;">✗ Erros</strong><br/>`;
    html += `<span style="font-size: 24px; font-weight: bold; color: #e74c3c;">${
      data.erros || 0
    }</span>`;
    html += `</div>`;

    html += `<div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #f39c12;">`;
    html += `<strong style="color: #f39c12;">⚠ Duplicatas</strong><br/>`;
    html += `<span style="font-size: 24px; font-weight: bold; color: #f39c12;">${
      data.duplicatas || 0
    }</span>`;
    html += `</div>`;

    html += `<div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #3498db;">`;
    html += `<strong style="color: #3498db;">📋 Total</strong><br/>`;
    html += `<span style="font-size: 24px; font-weight: bold; color: #3498db;">${
      data.total || 0
    }</span>`;
    html += `</div>`;
    html += `</div>`;

    if (
      (data.erros || 0) > 0 &&
      data.mensagensErro &&
      data.mensagensErro.length > 0
    ) {
      html +=
        '<h4 style="color: #e74c3c; margin-top: 20px;">❌ Erros Detalhados:</h4>';
      html +=
        '<ul style="background: white; padding: 15px; border-radius: 5px; max-height: 300px; overflow-y: auto; list-style: none; padding-left: 0;">';
      data.mensagensErro.slice(0, 20).forEach((msg) => {
        html += `<li style="padding: 8px; border-bottom: 1px solid #eee; color: #c0392b;">• ${msg}</li>`;
      });
      if (data.mensagensErro.length > 20) {
        html += `<li style="padding: 8px; color: #7f8c8d;">... e mais ${
          data.mensagensErro.length - 20
        } erro(s)</li>`;
      }
      html += "</ul>";
    }

    if (data.sucesso > 0 && data.pacientesCriados) {
      html +=
        '<h4 style="color: #27ae60; margin-top: 20px;">✓ Pacientes Importados:</h4>';
      html +=
        '<ul style="background: white; padding: 15px; border-radius: 5px; max-height: 300px; overflow-y: auto; list-style: none; padding-left: 0;">';
      data.pacientesCriados.slice(0, 15).forEach((p) => {
        html += `<li style="padding: 8px; border-bottom: 1px solid #eee;">📌 <strong>${
          p.nome
        }</strong> - Status: ${p.status} (ID: ${p.id.substring(0, 8)}...)</li>`;
      });
      if (data.pacientesCriados.length > 15) {
        html += `<li style="padding: 8px; color: #7f8c8d;">... e mais ${
          data.pacientesCriados.length - 15
        } paciente(s)</li>`;
      }
      html += "</ul>";
    }

    if (data.atualizados > 0 && data.pacientesAtualizados) {
      html +=
        '<h4 style="color: #3498db; margin-top: 20px;">🔄 Pacientes Atualizados:</h4>';
      html +=
        '<ul style="background: white; padding: 15px; border-radius: 5px; max-height: 300px; overflow-y: auto; list-style: none; padding-left: 0;">';
      data.pacientesAtualizados.slice(0, 10).forEach((p) => {
        html += `<li style="padding: 8px; border-bottom: 1px solid #eee;">🔄 <strong>${p.nome}</strong> - Status: ${p.statusNovo}</li>`;
      });
      html += "</ul>";
    }

    html += `<p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">⏱️ Importação concluída em ${new Date().toLocaleTimeString()}</p>`;
    html += "</div>";

    resultContent.innerHTML = html;
  }
}
