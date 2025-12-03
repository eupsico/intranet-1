/**
 * MÓDULO: importar-pacientes.js
 * VERSÃO: 4.0 COM DEBUG COMPLETO
 * DESCRIÇÃO: Importação de pacientes com v3 otimizado (data/horário separados, expandido, SEM JSON)
 * CRIADO: 2025-11-10
 */

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

export function init(user, userData) {
  console.log("🚀 Módulo de Importar Pacientes iniciado (v4.0 COM DEBUG).");
  console.log(`👤 Usuário autenticado: ${user.email}`);

  const importForm = document.getElementById("import-form");
  const fileInput = document.getElementById("file-input");
  const filaSelect = document.getElementById("fila-select");
  const submitButton = document.getElementById("submit-button");
  const resultContainer = document.getElementById("result-container");
  const resultContent = document.getElementById("result-content");
  const debugContainer =
    document.getElementById("debug-container") || createDebugContainer();

  if (!importForm || !fileInput || !filaSelect || !submitButton) {
    console.error("❌ Elementos do formulário não encontrados no DOM.");
    return;
  }

  console.log("✅ Elementos do DOM encontrados");

  // Listener para preview do arquivo
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      console.log(
        `📁 Arquivo selecionado: ${e.target.files[0].name} (${e.target.files[0].size} bytes)`
      );
    }
  });

  importForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    const fila = filaSelect.value;

    console.log("\n=== INICIANDO IMPORTAÇÃO ===");
    console.log(`📁 Arquivo: ${file?.name || "Não selecionado"}`);
    console.log(`🎯 Fila padrão: ${fila}`);

    if (!file) {
      alert("Por favor, selecione um arquivo Excel (.xlsx ou .csv).");
      console.warn("⚠️ Nenhum arquivo selecionado");
      return;
    }

    // Validar tipo
    const allowedTypes = [".xlsx", ".xls", ".csv"];
    const fileExt = file.name
      .slice((Math.max(0, file.name.lastIndexOf(".")) || Infinity) + 1)
      .toLowerCase();

    if (!allowedTypes.includes(`.${fileExt}`)) {
      alert("Apenas arquivos .xlsx, .xls ou .csv são suportados.");
      console.error(`❌ Tipo de arquivo não suportado: ${fileExt}`);
      return;
    }

    // UI: Mostrar loading
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<span class="loading-spinner"></span> Processando...';
    resultContainer.style.display = "block";
    resultContent.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Aguarde, processando planilha...</p>
    `;
    debugContainer.innerHTML = "";

    try {
      console.log("📦 Carregando biblioteca XLSX...");
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
      );
      console.log("✅ XLSX carregado");

      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          console.log("\n📖 LENDO ARQUIVO...");
          const data = new Uint8Array(event.target.result);
          console.log(`📊 Bytes lidos: ${data.length}`);

          const workbook = XLSX.read(data, {
            type: "array",
            cellDates: true,
            dateNF: "yyyy-mm-dd",
          });

          console.log(`📑 Abas encontradas: ${workbook.SheetNames.join(", ")}`);

          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Converter para JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            defval: "",
          });

          console.log(`\n📊 RESULTADO DO PARSING:`);
          console.log(`   Total de linhas: ${jsonData.length}`);

          if (jsonData.length === 0) {
            throw new Error("A planilha está vazia ou em formato inválido.");
          }

          // DEBUG: Exibir primeira linha
          const primeiraLinha = jsonData[0];
          console.log("\n🔍 PRIMEIRA LINHA (OBJETO):");
          console.table(primeiraLinha);

          const colunas = Object.keys(primeiraLinha);
          console.log(`\n📋 COLUNAS DETECTADAS (${colunas.length}):`);
          colunas.forEach((col, idx) => {
            console.log(`   ${idx + 1}. "${col}": "${primeiraLinha[col]}"`);
          });

          // Verificar campos OBRIGATÓRIOS
          console.log("\n✓ VERIFICANDO CAMPOS OBRIGATÓRIOS:");
          const verificacao = {
            nomeCompleto: primeiraLinha.nomeCompleto || "",
            cpf: primeiraLinha.cpf || "",
            status: primeiraLinha.status || "",
          };

          console.table(verificacao);

          const camposVazios = Object.entries(verificacao)
            .filter(([k, v]) => v === "")
            .map(([k]) => k);

          if (camposVazios.length > 0) {
            console.warn(`⚠️ CAMPOS VAZIOS: ${camposVazios.join(", ")}`);
          } else {
            console.log("✅ Todos os campos obrigatórios preenchidos");
          }

          // Exibir dados em HTML para debug visual
          displayDebugInfo(jsonData, debugContainer);

          // Chamar Cloud Function
          console.log("\n☁️ ENVIANDO PARA CLOUD FUNCTION...");
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

          console.log("\n✅ RESULTADO DA IMPORTAÇÃO:");
          console.table(result.data);

          displayResults(result.data, resultContent);
        } catch (parseError) {
          console.error("❌ Erro ao parsear arquivo:", parseError);
          console.error(parseError.stack);
          throw new Error(`Erro ao ler arquivo: ${parseError.message}`);
        }
      };

      reader.onerror = () => {
        console.error("❌ Erro ao ler arquivo");
        throw new Error("Erro ao ler arquivo");
      };

      console.log("📂 Iniciando leitura de arquivo...");
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("❌ Erro geral na importação:", error);
      console.error(error.stack);
      displayResults(
        {
          total: 0,
          sucesso: 0,
          erros: 1,
          duplicatas: 0,
          mensagensErro: [`Erro: ${error.message}`],
        },
        resultContent
      );
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = "Importar Pacientes";
      fileInput.value = "";
    }
  });

  // ============== FUNÇÕES AUXILIARES ==============

  /**
   * Criar container para debug se não existir
   */
  function createDebugContainer() {
    const container = document.createElement("div");
    container.id = "debug-container";
    container.style.cssText = `
      margin-top: 20px;
      padding: 15px;
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 5px;
      max-height: 300px;
      overflow-y: auto;
      font-size: 12px;
      font-family: monospace;
    `;
    resultContainer.parentElement.appendChild(container);
    return container;
  }

  /**
   * Exibir informações de debug
   */
  function displayDebugInfo(jsonData, debugContainer) {
    let html = `
      <div style="padding: 10px; background: white; border-radius: 3px;">
        <strong style="color: #0066cc;">🐛 DEBUG - Primeiras 3 linhas:</strong>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
          <thead>
            <tr style="background: #e9ecef;">
              <th style="border: 1px solid #dee2e6; padding: 5px; text-align: left;">nomeCompleto</th>
              <th style="border: 1px solid #dee2e6; padding: 5px; text-align: left;">cpf</th>
              <th style="border: 1px solid #dee2e6; padding: 5px; text-align: left;">status</th>
              <th style="border: 1px solid #dee2e6; padding: 5px; text-align: left;">dataTriagem</th>
            </tr>
          </thead>
          <tbody>
    `;

    jsonData.slice(0, 3).forEach((row, idx) => {
      html += `
        <tr style="background: ${idx % 2 === 0 ? "#fff" : "#f8f9fa"};">
          <td style="border: 1px solid #dee2e6; padding: 5px;">${
            row.nomeCompleto || "❌ VAZIO"
          }</td>
          <td style="border: 1px solid #dee2e6; padding: 5px;">${
            row.cpf || "❌ VAZIO"
          }</td>
          <td style="border: 1px solid #dee2e6; padding: 5px;">${
            row.status || "❌ VAZIO"
          }</td>
          <td style="border: 1px solid #dee2e6; padding: 5px;">${
            row.dataTriagem || "❌ VAZIO"
          }</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 3px;">
          <strong>Dica:</strong> Se ver ❌ VAZIO, confira o nome da coluna na planilha (case-sensitive).
        </div>
      </div>
    `;

    debugContainer.innerHTML = html;
  }

  /**
   * Carregar script dinamicamente
   */
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        console.log(`✅ Script já carregado: ${url}`);
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = url;
      script.onload = () => {
        console.log(`✅ Script carregado: ${url}`);
        resolve();
      };
      script.onerror = () => {
        console.error(`❌ Falha ao carregar: ${url}`);
        reject(new Error(`Falha ao carregar ${url}`));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Retry com backoff exponencial
   */
  async function importarPacientesWithRetry(payload, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`🔄 Tentativa ${i + 1} de ${maxRetries}...`);
        const functions = getFunctions();
        const importarPacientes = httpsCallable(
          functions,
          "importarPacientesBatch"
        );
        return await importarPacientes(payload);
      } catch (error) {
        console.warn(`⚠️ Tentativa ${i + 1} falhou: ${error.message}`);
        if (i === maxRetries - 1) throw error;
        const delay = 1000 * (i + 1);
        console.log(`⏳ Aguardando ${delay}ms antes de tentar novamente...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Exibir resultados
   */
  function displayResults(data, resultContent) {
    console.log("\n🎨 GERANDO INTERFACE DE RESULTADOS...");

    let html = `<div class="result-summary" style="padding: 20px; background-color: #f5f5f5; border-radius: 8px;">`;
    html += `<h3 style="margin-top: 0;">📊 Resultado da Importação</h3>`;

    // Cards de resumo
    html += `<div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">`;

    html += `
      <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #27ae60;">
        <strong style="color: #27ae60;">✓ Sucessos</strong><br/>
        <span style="font-size: 20px; font-weight: bold; color: #27ae60;">${
          data.sucesso || 0
        }</span>
      </div>
    `;

    html += `
      <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #e74c3c;">
        <strong style="color: #e74c3c;">✗ Erros</strong><br/>
        <span style="font-size: 20px; font-weight: bold; color: #e74c3c;">${
          data.erros || 0
        }</span>
      </div>
    `;

    html += `
      <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #f39c12;">
        <strong style="color: #f39c12;">⚠ Duplicatas</strong><br/>
        <span style="font-size: 20px; font-weight: bold; color: #f39c12;">${
          data.duplicatas || 0
        }</span>
      </div>
    `;

    html += `
      <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #3498db;">
        <strong style="color: #3498db;">📋 Total</strong><br/>
        <span style="font-size: 20px; font-weight: bold; color: #3498db;">${
          data.total || 0
        }</span>
      </div>
    `;

    html += `</div>`;

    // Erros detalhados
    if (
      (data.erros || 0) > 0 &&
      data.mensagensErro &&
      data.mensagensErro.length > 0
    ) {
      html +=
        '<h4 style="color: #e74c3c; margin-top: 20px;">❌ Erros Detalhados:</h4>';
      html +=
        '<ul style="background: white; padding: 15px; border-radius: 5px; max-height: 200px; overflow-y: auto; list-style: none; padding-left: 0;">';
      data.mensagensErro.slice(0, 15).forEach((msg) => {
        html += `<li style="padding: 8px; border-bottom: 1px solid #eee; color: #c0392b; font-size: 12px;">• ${msg}</li>`;
      });
      if (data.mensagensErro.length > 15) {
        html += `<li style="padding: 8px; color: #7f8c8d;">... e mais ${
          data.mensagensErro.length - 15
        } erro(s)</li>`;
      }
      html += "</ul>";
    }

    // Sucessos
    if (data.sucesso > 0 && data.pacientesCriados) {
      html +=
        '<h4 style="color: #27ae60; margin-top: 20px;">✓ Pacientes Importados:</h4>';
      html +=
        '<ul style="background: white; padding: 15px; border-radius: 5px; max-height: 200px; overflow-y: auto; list-style: none; padding-left: 0;">';
      data.pacientesCriados.slice(0, 10).forEach((p) => {
        html += `<li style="padding: 8px; border-bottom: 1px solid #eee; font-size: 12px;">📌 <strong>${p.nome}</strong> - Status: ${p.status}</li>`;
      });
      if (data.pacientesCriados.length > 10) {
        html += `<li style="padding: 8px; color: #7f8c8d;">... e mais ${
          data.pacientesCriados.length - 10
        } paciente(s)</li>`;
      }
      html += "</ul>";
    }

    html += `<p style="margin-top: 20px; font-size: 12px; color: #7f8c8d;">⏱️ Importação concluída em ${new Date().toLocaleTimeString()}</p>`;
    html += "</div>";

    resultContent.innerHTML = html;
    console.log("✅ Interface de resultados renderizada");
  }
}
