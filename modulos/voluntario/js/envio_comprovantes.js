// Arquivo: /modulos/voluntario/js/envio_comprovantes.js
// Versão: 3.2 (Integrado com as Configurações do Sistema)

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
} from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbzOGyDANVS--DeH6T-ZaqFiEmhpBYUJu4P8VT0uevQPwC3tLL5EgappHPI2mhKwPtf1fg/exec";
  let formData = {};

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
    prazoDiaElement: document.getElementById("prazo-dia"), // Elemento do prazo
  };

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
    // --- INÍCIO DA ALTERAÇÃO ---
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
    // --- FIM DA ALTERAÇÃO ---

    try {
      const q = query(
        collection(db, "usuarios"),
        where("inativo", "==", false),
        where("recebeDireto", "==", true),
        where("fazAtendimento", "==", true),
        orderBy("nome")
      );
      const snapshot = await getDocs(q);
      const profissionais = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const optionsHtml = [
        '<option value="">Selecione seu nome...</option>',
        ...profissionais.map(
          (p) => `<option value="${p.nome}">${p.nome}</option>`
        ),
      ].join("");
      elements.selectProfissional.innerHTML = optionsHtml;

      if (userData && userData.nome) {
        elements.selectProfissional.value = userData.nome;
      }
    } catch (error) {
      console.error("Erro ao buscar profissionais:", error);
      elements.selectProfissional.innerHTML =
        '<option value="">Erro ao carregar</option>';
    }

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
              mesReferencia: payload.mesReferencia.toLowerCase(),
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
