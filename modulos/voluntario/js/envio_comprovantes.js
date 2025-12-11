// Arquivo: /modulos/voluntario/js/envio_comprovantes.js
// Versão: 3.5 (Seleção de Profissional Fixa ao Usuário Logado)

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  limit,
} from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbxgukbZwtnRj-uNRYkl-x2PGRIY1LtDBRAxEYdelM4B_B_5ijpahZqCEOAuPk9XT50y/exec";
  let formData = {};

  let todosComprovantes = [];

  const elements = {
    formContainer: document.getElementById("form-container"),
    confirmationSection: document.getElementById("confirmation-section"),
    finalMessageSection: document.getElementById("final-message-section"),
    messageContainer: document.getElementById("message-container"),
    form: document.getElementById("comprovante-form"),
    selectProfissional: document.getElementById("form-profissional"),
    selectMes: document.getElementById("form-mes-ref"),
    inputPaciente: document.getElementById("form-paciente"),
    inputDataPagamento: document.getElementById("form-data-pagamento"),
    inputValor: document.getElementById("form-valor"),
    inputFile: document.getElementById("form-arquivo"),
    btnReview: document.getElementById("btn-review"),
    btnEdit: document.getElementById("btn-edit"),
    btnConfirmSend: document.getElementById("btn-confirm-send"),
    btnNewForm: document.getElementById("btn-new-form"),
    prazoDiaElement: document.getElementById("prazo-dia"),
    // Elementos do Histórico
    filterPaciente: document.getElementById("filter-paciente"),
    filterMes: document.getElementById("filter-mes"),
    tableBody: document.getElementById("history-table-body"),
    // Elementos das Abas
    tabs: document.querySelectorAll("#comprovantes-tabs .tab-link"),
    tabContents: document.querySelectorAll(".tab-content"),
  };

  function setupTabs() {
    elements.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        // Remove active de todos
        elements.tabs.forEach((t) => t.classList.remove("active"));
        elements.tabContents.forEach((c) => {
          c.classList.remove("active");
          c.style.display = "none";
        });

        // Ativa o clicado
        tab.classList.add("active");
        const targetId = tab.dataset.tab;
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
          targetContent.classList.add("active");
          targetContent.style.display = "block";
        }
      });
    });
  }

  function formatCurrency(input) {
    let value = input.value.replace(/\D/g, "");
    if (value === "") {
      input.value = "";
      return;
    }
    value = (parseInt(value, 10) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    input.value = value;
  }

  function parseCurrency(currencyString) {
    if (!currencyString) return 0;
    const numericString = currencyString
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();
    return parseFloat(numericString) || 0;
  }

  async function initializeView() {
    setupTabs(); // Inicializa lógica das abas

    // Busca a configuração do dia limite
    try {
      const configRef = doc(db, "configuracoesSistema", "geral");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        const diaLimite = docSnap.data().financeiro?.diaLimiteComprovantes;
        if (diaLimite && elements.prazoDiaElement) {
          elements.prazoDiaElement.textContent = diaLimite;
        }
      }
    } catch (error) {
      console.error("Erro ao buscar dia limite dos comprovantes:", error);
    }

    // --- ALTERAÇÃO AQUI: Define apenas o nome do profissional logado ---
    if (userData && userData.nome) {
      elements.selectProfissional.innerHTML = `<option value="${userData.nome}" selected>${userData.nome}</option>`;
      // Opcional: Desabilitar o campo para evitar confusão, já que só tem uma opção
      // elements.selectProfissional.disabled = true;
    } else {
      elements.selectProfissional.innerHTML =
        '<option value="">Usuário não identificado</option>';
    }
    // --- FIM DA ALTERAÇÃO ---

    const meses = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    const mesOptions = meses
      .map((m) => `<option value="${m}">${m}</option>`)
      .join("");
    elements.selectMes.innerHTML = mesOptions;

    const today = new Date();
    elements.selectMes.value = meses[today.getMonth()];
    elements.inputDataPagamento.value = today.toISOString().split("T")[0];

    // Inicia o carregamento do histórico
    carregarHistoricoComprovantes();
  }

  // --- FUNÇÃO PARA CARREGAR O HISTÓRICO ---
  async function carregarHistoricoComprovantes() {
    if (!elements.tableBody) return;
    elements.tableBody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;"><div class="loading-spinner-small"></div> Carregando...</td></tr>';

    try {
      let q;
      const isAdmin = userData.funcoes && userData.funcoes.includes("admin");

      if (isAdmin) {
        q = query(collection(db, "comprovantes"), orderBy("timestamp", "desc"));
      } else {
        q = query(
          collection(db, "comprovantes"),
          where("userId", "==", user.uid),
          orderBy("timestamp", "desc")
        );
      }

      const snapshot = await getDocs(q);
      todosComprovantes = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      renderizarTabela(todosComprovantes);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      let errorMsg = "Erro ao carregar dados.";
      if (error.code === "failed-precondition") {
        errorMsg = "Erro de índice no banco de dados. Contate o administrador.";
      }
      elements.tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: red;">${errorMsg}</td></tr>`;
    }
  }

  // --- FUNÇÃO PARA RENDERIZAR TABELA ---
  function renderizarTabela(comprovantes) {
    if (comprovantes.length === 0) {
      elements.tableBody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;">Nenhum comprovante encontrado.</td></tr>';
      return;
    }

    let html = "";
    comprovantes.forEach((item) => {
      const valorFormatado =
        typeof item.valor === "number"
          ? item.valor.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : item.valor;

      let dataFormatada = item.dataPagamento;
      if (dataFormatada && dataFormatada.includes("-")) {
        const parts = dataFormatada.split("-");
        dataFormatada = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      html += `
        <tr>
            <td>${item.profissional || "N/A"}</td>
            <td>${item.paciente || "N/A"}</td>
            <td>${dataFormatada || "N/A"}</td>
            <td>${item.mesReferencia || "N/A"}</td>
            <td>${valorFormatado}</td>
            <td style="text-align: center;">
                <a href="${
                  item.comprovanteUrl
                }" target="_blank" class="btn-view-receipt">
                    Visualizar
                </a>
            </td>
        </tr>
      `;
    });
    elements.tableBody.innerHTML = html;
  }

  // --- FUNÇÃO DE FILTRAGEM ---
  function filtrarTabela() {
    const nomeFiltro = elements.filterPaciente.value.toLowerCase().trim();
    const mesFiltro = elements.filterMes.value;

    const filtrados = todosComprovantes.filter((item) => {
      const matchNome =
        !nomeFiltro ||
        (item.paciente && item.paciente.toLowerCase().includes(nomeFiltro));
      const itemMes = (item.mesReferencia || "").toLowerCase();
      const filtroMesLower = mesFiltro.toLowerCase();
      const matchMes = !mesFiltro || itemMes === filtroMesLower;

      return matchNome && matchMes;
    });

    renderizarTabela(filtrados);
  }

  if (elements.filterPaciente) {
    elements.filterPaciente.addEventListener("input", filtrarTabela);
  }
  if (elements.filterMes) {
    elements.filterMes.addEventListener("change", filtrarTabela);
  }

  function showMessage(message, type = "error") {
    elements.messageContainer.textContent = message;
    elements.messageContainer.className = `alert alert-${type}`;
    elements.messageContainer.style.display = "block";
  }

  function hideMessage() {
    elements.messageContainer.style.display = "none";
  }

  function validateForm() {
    const fields = {
      profissional: {
        value: elements.selectProfissional.value,
        name: "Seu Nome",
      },
      paciente: {
        value: elements.inputPaciente.value.trim(),
        name: "Nome do Paciente",
      },
      dataPagamento: {
        value: elements.inputDataPagamento.value,
        name: "Data do Pagamento",
      },
      valor: {
        value: elements.inputValor.value,
        name: "Valor da Contribuição",
      },
      file: {
        value: elements.inputFile.files.length,
        name: "Anexo do Comprovante",
      },
    };

    for (const key in fields) {
      if (!fields[key].value) {
        showMessage(`O campo '${fields[key].name}' é obrigatório.`, "error");
        return false;
      }
    }
    const valorNumerico = parseCurrency(fields.valor.value);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      showMessage(
        `O valor informado no campo '${fields.valor.name}' não é válido.`,
        "error"
      );
      return false;
    }
    hideMessage();
    return true;
  }

  function confirmAndSend() {
    elements.btnConfirmSend.disabled = true;
    elements.btnConfirmSend.textContent = "Enviando...";

    const reader = new FileReader();
    reader.readAsDataURL(formData.file);

    reader.onload = function () {
      const fileData = reader.result.split(",")[1];
      const payload = {
        profissional: formData.profissional,
        paciente: formData.paciente,
        dataPagamento: formData.dataPagamentoOriginal,
        mesReferencia: formData.mesReferencia,
        valor: formData.valor,
        fileName: formData.file.name,
        mimeType: formData.file.type,
        fileData: fileData,
      };

      fetch(WEB_APP_URL, { method: "POST", body: JSON.stringify(payload) })
        .then((res) => res.json())
        .then((response) => {
          if (response.status === "success") {
            const comprovanteData = {
              userId: user.uid,
              profissional: payload.profissional,
              paciente: payload.paciente,
              valor: payload.valor,
              dataPagamento: payload.dataPagamento,
              mesReferencia: payload.mesReferencia,
              anoReferencia: new Date(
                payload.dataPagamento + "T03:00:00"
              ).getFullYear(),
              comprovanteUrl: response.fileUrl,
              status: "Pendente",
              timestamp: serverTimestamp(),
            };
            return addDoc(collection(db, "comprovantes"), comprovanteData).then(
              () => payload
            );
          } else {
            throw new Error(
              response.message || "Erro desconhecido no servidor de upload."
            );
          }
        })
        .then((payload) => {
          elements.confirmationSection.style.display = "none";
          const summaryHtml = `
                      <p><strong>Profissional:</strong> <span>${
                        payload.profissional
                      }</span></p>
                      <p><strong>Paciente:</strong> <span>${
                        payload.paciente
                      }</span></p>
                      <p><strong>Data:</strong> <span>${new Date(
                        payload.dataPagamento + "T03:00:00"
                      ).toLocaleDateString("pt-BR")}</span></p>
                      <p><strong>Valor:</strong> <span>${payload.valor.toLocaleString(
                        "pt-BR",
                        { style: "currency", currency: "BRL" }
                      )}</span></p>`;
          document.getElementById("sent-data-summary").innerHTML = summaryHtml;
          elements.finalMessageSection.style.display = "block";
          elements.form.reset();
          carregarHistoricoComprovantes();
        })
        .catch((error) => {
          console.error("Erro no processo de envio:", error);
          showMessage(
            "Ocorreu um erro grave no envio: " + error.message,
            "error"
          );
          elements.formContainer.style.display = "block";
          elements.confirmationSection.style.display = "none";
        })
        .finally(() => {
          elements.btnConfirmSend.disabled = false;
          elements.btnConfirmSend.textContent = "Confirmar e Enviar";
        });
    };

    reader.onerror = function (error) {
      console.error("Erro ao ler o arquivo:", error);
      showMessage("Não foi possível ler o arquivo anexado.", "error");
      elements.btnConfirmSend.disabled = false;
      elements.btnConfirmSend.textContent = "Confirmar e Enviar";
    };
  }

  elements.inputValor.addEventListener("input", () => {
    formatCurrency(elements.inputValor);
  });

  elements.btnReview.addEventListener("click", () => {
    if (!validateForm()) return;

    const dataPagamento = new Date(
      elements.inputDataPagamento.value + "T03:00:00"
    ).toLocaleDateString("pt-BR");
    const valor = parseCurrency(elements.inputValor.value);
    const file = elements.inputFile.files[0];

    formData = {
      profissional: elements.selectProfissional.value,
      paciente: elements.inputPaciente.value,
      dataPagamentoOriginal: elements.inputDataPagamento.value,
      mesReferencia: elements.selectMes.value,
      valor,
      file,
    };

    document.getElementById("confirm-profissional").textContent =
      formData.profissional;
    document.getElementById("confirm-paciente").textContent = formData.paciente;
    document.getElementById("confirm-data").textContent = dataPagamento;
    document.getElementById("confirm-mes").textContent = formData.mesReferencia;
    document.getElementById("confirm-valor").textContent = valor.toLocaleString(
      "pt-BR",
      { style: "currency", currency: "BRL" }
    );
    document.getElementById("confirm-arquivo").textContent = file.name;

    elements.formContainer.style.display = "none";
    elements.confirmationSection.style.display = "block";
  });

  elements.btnEdit.addEventListener("click", () => {
    elements.formContainer.style.display = "block";
    elements.confirmationSection.style.display = "none";
  });

  elements.btnConfirmSend.addEventListener("click", confirmAndSend);

  elements.btnNewForm.addEventListener("click", () => {
    elements.finalMessageSection.style.display = "none";
    elements.formContainer.style.display = "block";
    hideMessage();
    initializeView();
  });

  initializeView();
}
