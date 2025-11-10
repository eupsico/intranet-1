import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js"; // Adicionado para auth

// Configuração das opções da trilha do paciente (extraída de trilha-paciente.js)
const COLUMNSCONFIG = {
  inscricaodocumentos: "Inscrição e Documentos",
  triagemagendada: "Triagem Agendada",
  encaminharparaplantao: "Encaminhar para Plantão",
  ematendimentoplantao: "Em Atendimento Plantão",
  agendamentoconfirmadoplantao: "Agendamento Confirmado Plantão",
  encaminharparapb: "Encaminhar para PB",
  aguardandoinfohorarios: "Aguardando Info Horários",
  cadastrarhorariopsicomanager: "Cadastrar Horário Psicomanager",
  ematendimentopb: "Em Atendimento PB",
  aguardandoreavaliacao: "Aguardando Reavaliação",
  pacientesparcerias: "Pacientes Parcerias",
  grupos: "Grupos",
  desistencia: "Desistência",
  alta: "Alta",
};

// Campos obrigatórios baseados na trilha do paciente
const REQUIRED_FIELDS = ["nome", "cpf", "telefone", "status"];
const OPTIONAL_FIELDS = [
  "idade",
  "email",
  "endereco",
  "assistenteSocial",
  "motivoAtendimento",
  "observacoes",
];

export function init(user, userData) {
  console.log(
    "🚀 Módulo de Importar Pacientes iniciado (versão melhorada com trilha do paciente)."
  );
  const importForm = document.getElementById("import-form");
  const fileInput = document.getElementById("file-input");
  const filaSelect = document.getElementById("fila-select"); // Para fallback de status
  const submitButton = document.getElementById("submit-button");
  const resultContainer = document.getElementById("result-container");
  const resultContent = document.getElementById("result-content");

  if (
    !importForm ||
    !fileInput ||
    !filaSelect ||
    !submitButton ||
    !resultContainer
  ) {
    console.error("Elementos do formulário não encontrados.");
    return;
  }

  // Validar autenticação
  const auth = getAuth();
  if (!auth.currentUser) {
    alert("Usuário deve estar autenticado para importar pacientes.");
    return;
  }

  importForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    const fila = filaSelect.value; // Usado como status padrão se não houver no Excel

    if (!file) {
      alert("Por favor, selecione um arquivo Excel (.xlsx ou .csv).");
      return;
    }

    // Validar tipo de arquivo
    const allowedTypes = [".xlsx", ".xls", ".csv"];
    const fileExt = file.name
      .slice((Math.max(0, file.name.lastIndexOf(".")) || Infinity) + 1)
      .toLowerCase();
    if (!allowedTypes.includes(`.${fileExt}`)) {
      alert("Apenas arquivos .xlsx, .xls ou .csv são suportados.");
      return;
    }

    // Desabilitar botão e mostrar loading
    submitButton.disabled = true;
    submitButton.innerHTML =
      '<span class="loading-spinner"></span> Processando...';
    resultContainer.style.display = "block";
    resultContent.innerHTML = `
      <div class="loading-spinner"></div>
      <p>Aguarde, processando planilha com opções da trilha do paciente. Isso pode levar alguns minutos...</p>
    `;

    try {
      // Carregar biblioteca XLSX dinamicamente
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
      );

      const reader = new FileReader();
      reader.onload = async (event) => {
        let jsonData = [];
        try {
          const data = new Uint8Array(event.target.result);
          let workbook, worksheet;

          if (fileExt === "csv") {
            // Para CSV, ler como texto e converter
            const csvText = new TextDecoder().decode(data);
            workbook = XLSX.read(csvText, { type: "string" });
          } else {
            workbook = XLSX.read(data, {
              type: "array",
              cellDates: true,
              dateNF: "yyyy-mm-dd",
            });
          }

          const firstSheetName = workbook.SheetNames[0];
          worksheet = workbook.Sheets[firstSheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" }); // Preenche vazios com ""

          if (jsonData.length === 0) {
            throw new Error("A planilha está vazia ou em formato inválido.");
          }
        } catch (parseError) {
          console.error("Erro ao parsear arquivo:", parseError);
          throw new Error(`Erro ao ler arquivo: ${parseError.message}`);
        }

        // Normalizar e validar dados com opções da trilha
        const normalizedData = await normalizeAndValidateData(
          jsonData,
          fila,
          auth.currentUser.email,
          userData
        );

        if (
          normalizedData.valid.length === 0 &&
          normalizedData.errors.length > 0
        ) {
          throw new Error(
            "Nenhum dado válido encontrado. Verifique os erros abaixo."
          );
        }

        // Chamar Cloud Function com dados normalizados
        const functions = getFunctions();
        const importarPacientes = httpsCallable(
          functions,
          "importarPacientesBatchTrilha"
        ); // Nome atualizado para versão com trilha
        const result = await importarPacientesWithRetry(
          {
            pacientes: normalizedData.valid,
            fila: fila,
            userEmail: auth.currentUser.email,
          },
          3
        ); // Retry até 3 vezes

        displayResults(result.data);
      };

      if (fileExt === "csv") {
        reader.readAsArrayBuffer(file); // Para consistência
      } else {
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error("Erro na importação:", error);
      displayResults({
        total: 0,
        sucesso: 0,
        erros: 1,
        mensagensErro: [`Erro no cliente: ${error.message}`],
        duplicatas: 0,
      });
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = "Importar Pacientes";
      fileInput.value = ""; // Limpar input
    }
  });

  // Função para normalizar e validar dados
  async function normalizeAndValidateData(
    data,
    defaultStatus,
    userEmail,
    userData
  ) {
    const valid = [];
    const errors = [];
    const duplicatas = new Set(); // Track CPFs duplicados

    data.forEach((row, index) => {
      const paciente = {
        nome: (row.nome || row.Nome || "").toString().trim(),
        cpf: (row.cpf || row.CPF || "").toString().trim().replace(/\D/g, ""), // Limpar CPF
        telefone: (row.telefone || row.Telefone || "").toString().trim(),
        email: (row.email || row.Email || "").toString().trim().toLowerCase(),
        idade: parseInt(row.idade || row.Idade || 0) || undefined,
        endereco: (row.endereco || row.Endereço || "").toString().trim(),
        assistenteSocial:
          row.assistenteSocial ||
          row["Assistente Social"] ||
          userData?.nome ||
          "Não informado",
        motivoAtendimento: (
          row.motivoAtendimento ||
          row["Motivo Atendimento"] ||
          ""
        )
          .toString()
          .trim(),
        observacoes: (row.observacoes || row.Observacoes || "")
          .toString()
          .trim(),
        status: getValidStatus(
          row.status || row.Status || defaultStatus,
          Object.keys(COLUMNSCONFIG)
        ),
        dataInscricao: null, // Será setado no backend com serverTimestamp
        lastUpdatedAt: null, // Backend
        lastUpdatedBy: userEmail,
        // Campos da trilha opcionais (podem ser expandidos)
        profissionalResponsavel:
          row.profissional || row["Profissional Responsável"] || "",
        dataNascimento: row["dataNascimento"]
          ? new Date(row["dataNascimento"]).toISOString()
          : null,
        prioridade: row.prioridade || "normal", // Ex.: "alta", "media", "baixa"
      };

      // Validações obrigatórias
      const missingFields = REQUIRED_FIELDS.filter((field) => !paciente[field]);
      if (missingFields.length > 0) {
        errors.push(
          `Linha ${
            index + 1
          }: Campos obrigatórios ausentes - ${missingFields.join(", ")}`
        );
        return;
      }

      // Validar CPF (simples, sem algoritmo completo)
      if (paciente.cpf.length !== 11 || !/^\d{11}$/.test(paciente.cpf)) {
        errors.push(`Linha ${index + 1}: CPF inválido (${paciente.cpf})`);
        return;
      }

      // Verificar duplicatas por CPF
      if (duplicatas.has(paciente.cpf)) {
        errors.push(`Linha ${index + 1}: CPF duplicado (${paciente.cpf})`);
        return;
      }
      duplicatas.add(paciente.cpf);

      // Validar status da trilha
      if (!paciente.status) {
        errors.push(
          `Linha ${index + 1}: Status inválido (${
            row.status || defaultStatus
          }). Use: ${Object.keys(COLUMNSCONFIG).join(", ")}`
        );
        return;
      }

      // Sanitizar email se presente
      if (
        paciente.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paciente.email)
      ) {
        errors.push(`Linha ${index + 1}: Email inválido (${paciente.email})`);
        return;
      }

      valid.push(paciente);
    });

    return { valid, errors, duplicatas: duplicatas.size };
  }

  // Função auxiliar para validar status da trilha
  function getValidStatus(statusInput, validStatuses) {
    const normalized = (statusInput || "").toString().trim().toLowerCase();
    const match = validStatuses.find(
      (s) => s.includes(normalized) || normalized.includes(s)
    );
    return match || "inscricaodocumentos"; // Padrão inicial da trilha
  }

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

  // Retry para chamada HTTPS
  async function importarPacientesWithRetry(payload, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const functions = getFunctions();
        const importarPacientes = httpsCallable(
          functions,
          "importarPacientesBatchTrilha"
        );
        return await importarPacientes(payload);
      } catch (error) {
        console.warn(`Tentativa ${i + 1} falhou:`, error);
        if (i === maxRetries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Backoff exponencial simples
      }
    }
  }

  // Exibir resultados melhorado
  function displayResults(data) {
    let html = `
      <div class="result-summary">
        <h3>Resultado da Importação</h3>
        <p><strong>Total de linhas processadas:</strong> ${data.total || 0}</p>
        <p><strong>Sucesso:</strong> ${
          data.sucesso || 0
        } pacientes cadastrados na trilha</p>
        <p><strong>Erros:</strong> ${data.erros || 0}</p>
        <p><strong>Duplicatas evitadas:</strong> ${data.duplicatas || 0}</p>
    `;

    if (
      (data.erros || 0) > 0 &&
      data.mensagensErro &&
      data.mensagensErro.length > 0
    ) {
      html += '<h4>Erros Detalhados:</h4><ul class="error-list">';
      data.mensagensErro.forEach((msg) => {
        html += `<li>${msg}</li>`;
      });
      html += "</ul>";
    }

    if (data.sucesso > 0 && data.pacientesCriados) {
      html += "<h4>Pacientes Importados:</h4><ul>";
      data.pacientesCriados.slice(0, 10).forEach((p) => {
        // Limitar a 10 para performance
        html += `<li>${p.nome} (Status: ${
          COLUMNSCONFIG[p.status] || p.status
        })</li>`;
      });
      if (data.pacientesCriados.length > 10)
        html += `<li>... e mais ${data.pacientesCriados.length - 10}</li>`;
      html += "</ul>";
    }

    html += "</div>";
    resultContent.innerHTML = html;
  }
}
