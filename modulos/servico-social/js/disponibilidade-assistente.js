// Arquivo: /modulos/servico-social/js/disponibilidade-assistente.js
// Versão: 4.0 (Migrado para a sintaxe modular do Firebase v9)

import { db, doc, setDoc } from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  const form = document.getElementById("disponibilidade-form");
  if (!form) return;

  // --- Mapeamento de Elementos ---
  const nomeInput = document.getElementById("assistente-nome");
  const mesSelect = document.getElementById("mes-disponibilidade");
  const horaInicioSelect = document.getElementById(
    "hora-inicio-disponibilidade"
  );
  const horaFimSelect = document.getElementById("hora-fim-disponibilidade");
  const datasOnlineContainer = document.getElementById(
    "datas-container-online"
  );
  const datasPresencialContainer = document.getElementById(
    "datas-container-presencial"
  );

  // --- Funções de Inicialização ---
  nomeInput.value = userData.nome || "Não identificado";

  function popularHoras(selectElement) {
    selectElement.innerHTML = "";
    for (let i = 8; i <= 22; i++) {
      const hora = `${String(i).padStart(2, "0")}:00`;
      selectElement.innerHTML += `<option value="${hora}">${hora}</option>`;
    }
  }

  function popularMeses() {
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
    const mesAtual = new Date().getMonth();
    mesSelect.innerHTML = '<option value="">Selecione...</option>';
    for (let i = mesAtual; i < 12; i++) {
      mesSelect.innerHTML += `<option value="${i}">${meses[i]}</option>`;
    }
  }

  // --- Lógica de Geração e Exclusão Mútua ---
  function gerarDiasDoMes(mes, ano) {
    datasOnlineContainer.innerHTML = "";
    datasPresencialContainer.innerHTML = "";
    if (mes === "") return;

    const diasNoMes = new Date(ano, parseInt(mes) + 1, 0).getDate();
    const diasSemana = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];
    let diasHtmlOnline = "";
    let diasHtmlPresencial = "";

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const data = new Date(ano, mes, dia);
      const diaDaSemanaNome = diasSemana[data.getDay()];
      const diaFormatado = `${String(dia).padStart(2, "0")}/${String(
        parseInt(mes) + 1
      ).padStart(2, "0")}`;
      const dataValue = data.toISOString().split("T")[0];

      diasHtmlOnline += `
                <div class="checkbox-item">
                    <input type="checkbox" id="online-dia-${dia}" name="dias_online" value="${dataValue}">
                    <label for="online-dia-${dia}">${diaFormatado} - ${diaDaSemanaNome}</label>
                </div>`;
      diasHtmlPresencial += `
                <div class="checkbox-item">
                    <input type="checkbox" id="presencial-dia-${dia}" name="dias_presencial" value="${dataValue}">
                    <label for="presencial-dia-${dia}">${diaFormatado} - ${diaDaSemanaNome}</label>
                </div>`;
    }
    datasOnlineContainer.innerHTML = diasHtmlOnline;
    datasPresencialContainer.innerHTML = diasHtmlPresencial;
  }

  mesSelect.addEventListener("change", () => {
    const anoAtual = new Date().getFullYear();
    gerarDiasDoMes(mesSelect.value, anoAtual);
  });

  datasOnlineContainer.addEventListener("change", (e) => {
    if (e.target.type === "checkbox") {
      const presencialCheckbox = datasPresencialContainer.querySelector(
        `input[value="${e.target.value}"]`
      );
      if (presencialCheckbox) {
        presencialCheckbox.disabled = e.target.checked;
        if (e.target.checked) presencialCheckbox.checked = false;
      }
    }
  });

  datasPresencialContainer.addEventListener("change", (e) => {
    if (e.target.type === "checkbox") {
      const onlineCheckbox = datasOnlineContainer.querySelector(
        `input[value="${e.target.value}"]`
      );
      if (onlineCheckbox) {
        onlineCheckbox.disabled = e.target.checked;
        if (e.target.checked) onlineCheckbox.checked = false;
      }
    }
  });

  // --- Lógica de Salvamento ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveButton = form.querySelector('button[type="submit"]');

    const mes = mesSelect.value;
    const ano = new Date().getFullYear();
    const horaInicio = horaInicioSelect.value;
    const horaFim = horaFimSelect.value;
    const diasOnline = Array.from(
      datasOnlineContainer.querySelectorAll("input:checked")
    ).map((input) => input.value);
    const diasPresencial = Array.from(
      datasPresencialContainer.querySelectorAll("input:checked")
    ).map((input) => input.value);

    if (mes === "") {
      alert("Por favor, selecione um mês para salvar.");
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Salvando...";

    const docRef = doc(db, "disponibilidadeAssistentes", user.uid);
    const mesKey = `${ano}-${String(parseInt(mes) + 1).padStart(2, "0")}`;

    const dadosParaSalvar = {
      assistenteNome: userData.nome,
      atualizadoEm: new Date(),
      disponibilidade: {
        [mesKey]: {
          online: {
            dias: diasOnline,
            inicio: horaInicio,
            fim: horaFim,
          },
          presencial: {
            dias: diasPresencial,
            inicio: horaInicio,
            fim: horaFim,
          },
        },
      },
    };

    try {
      await setDoc(docRef, dadosParaSalvar, { merge: true });
      alert("Disponibilidade salva com sucesso!");
      form.reset();
      popularMeses();
      datasOnlineContainer.innerHTML =
        "<p>Selecione um mês para ver os dias.</p>";
      datasPresencialContainer.innerHTML =
        "<p>Selecione um mês para ver os dias.</p>";
    } catch (error) {
      console.error("Erro ao salvar disponibilidade:", error);
      alert("Ocorreu um erro ao salvar. Tente novamente.");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Salvar Disponibilidade";
    }
  });

  // --- Inicialização ---
  popularHoras(horaInicioSelect);
  popularHoras(horaFimSelect);
  popularMeses();
}
