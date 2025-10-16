// Arquivo: /modulos/voluntario/js/mensagens.js
// Versão: 3.0 (Integrado com as Configurações do Sistema)

import { db, doc, getDoc } from "../../../assets/js/firebase-init.js";

export async function init() {
  const container = document.querySelector("#mensagens");
  if (!container) return;

  let systemConfigs = null;

  async function loadSystemConfigs() {
    if (systemConfigs) return systemConfigs;
    try {
      const configRef = doc(db, "configuracoesSistema", "geral");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists()) {
        systemConfigs = docSnap.data();
        return systemConfigs;
      } else {
        console.warn("Documento de configurações não encontrado.");
        systemConfigs = { textos: {} };
        return systemConfigs;
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      systemConfigs = { textos: {} };
      return systemConfigs;
    }
  }

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Bom dia";
    if (h >= 12 && h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const getFutureDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}`;
  };

  const formatDateTimeLocalString = (str) => {
    if (!str) return "";
    const d = new Date(str);
    const week = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];
    return `${week[d.getDay()]}, ${d.toLocaleDateString("pt-BR")} às ${String(
      d.getHours()
    ).padStart(2, "0")}h`;
  };

  const formatDateToDDMM = (str) =>
    !str ? "" : `${str.split("-")[2]}/${str.split("-")[1]}`;

  const generateAndCopy = (outputElementId, msg) => {
    const outputElement = container.querySelector(`#${outputElementId}`);
    if (!outputElement) return;

    outputElement.value = msg;
    outputElement.select();
    navigator.clipboard
      .writeText(msg)
      .then(() => alert("Mensagem copiada!"))
      .catch(() => alert("Falha ao copiar. Por favor, copie manualmente."));
  };

  function setupSelects() {
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
    container.querySelector("#cobranca-mes").innerHTML = meses
      .map((m) => `<option value="${m}">${m}</option>`)
      .join("");

    let hoursOptions = "";
    for (let i = 8; i <= 21; i++) {
      const hour = String(i).padStart(2, "0");
      hoursOptions += `<option value="${hour}:00">${hour}:00</option>`;
    }
    container.querySelector("#agendada-hora").innerHTML = hoursOptions;
    container.querySelector("#agendar-hora").innerHTML = hoursOptions.replace(
      /:00/g,
      "h"
    );
  }

  function setupAccordion() {
    const triggers = container.querySelectorAll(".accordion-trigger");
    triggers.forEach((trigger) => {
      trigger.addEventListener("click", function () {
        const isActive = this.classList.contains("active");
        triggers.forEach((t) => {
          t.classList.remove("active");
          const content = t.nextElementSibling;
          content.classList.remove("active");
          content.style.maxHeight = null;
        });
        if (!isActive) {
          this.classList.add("active");
          const content = this.nextElementSibling;
          content.classList.add("active");
          content.style.maxHeight = content.scrollHeight + "px";
        }
      });
    });
  }

  function setupButtonListeners() {
    container.querySelector("#btn-cobranca").addEventListener("click", () => {
      const p = container.querySelector("#cobranca-paciente").value;
      const d = container.querySelector("#cobranca-data").value;
      const m = container.querySelector("#cobranca-mes").value;
      const v = container.querySelector("#cobranca-valor").value;
      const px = container.querySelector("#cobranca-pix").value;

      let template =
        systemConfigs.textos?.cobrancaVoluntario ||
        `(Modelo de mensagem 'cobrancaVoluntario' não encontrado nas configurações)`;

      let msg = template
        .replace(/{saudacao}/g, getGreeting())
        .replace(/{p}/g, p)
        .replace(/{d}/g, formatDateToDDMM(d))
        .replace(/{m}/g, m)
        .replace(/{v}/g, v)
        .replace(/{px}/g, px);

      generateAndCopy("output-cobranca", msg);
    });

    container.querySelector("#btn-agendada").addEventListener("click", () => {
      const tipo = container.querySelector("#agendada-tipo").value;
      const p = container.querySelector("#agendada-paciente").value;
      const t = container.querySelector("#agendada-terapeuta").value;
      const prof = container.querySelector("#agendada-profissao").value;
      const dia = container.querySelector("#agendada-diasemana").value;
      const data = container.querySelector("#agendada-data").value;
      const hora = container.querySelector("#agendada-hora").value;

      let template;
      if (tipo === "plantao") {
        template =
          systemConfigs.textos?.boasVindasPlantao ||
          `(Modelo de mensagem 'boasVindasPlantao' não encontrado nas configurações)`;
      } else {
        template =
          systemConfigs.textos?.boasVindas ||
          `(Modelo de mensagem 'boasVindas' não encontrado nas configurações)`;
      }

      let msg = template
        .replace(/{saudacao}/g, getGreeting())
        .replace(/{p}/g, p)
        .replace(/{t}/g, t)
        .replace(/{prof}/g, prof)
        .replace(/{dia}/g, dia)
        .replace(/{data}/g, formatDateToDDMM(data))
        .replace(/{hora}/g, hora);

      generateAndCopy("output-agendada", msg);
    });

    container.querySelector("#btn-agendar").addEventListener("click", () => {
      const p = container.querySelector("#agendar-paciente").value;
      const t = container.querySelector("#agendar-terapeuta").value;
      const prof = container.querySelector("#agendar-profissao").value;
      const mod = container.querySelector("#agendar-modalidade").value;
      const dia = container.querySelector("#agendar-diasemana").value;
      const hora = container.querySelector("#agendar-hora").value;

      let template =
        systemConfigs.textos?.agendarHorario ||
        `(Modelo de mensagem 'agendarHorario' não encontrado nas configurações)`;

      let msg = template
        .replace(/{saudacao}/g, getGreeting())
        .replace(/{p}/g, p)
        .replace(/{t}/g, t)
        .replace(/{prof}/g, prof)
        .replace(/{mod}/g, mod)
        .replace(/{dia}/g, dia)
        .replace(/{hora}/g, hora);

      generateAndCopy("output-agendar", msg);
    });

    container.querySelector("#btn-primeira").addEventListener("click", () => {
      const p = container.querySelector("#primeira-paciente").value;
      const data = container.querySelector("#primeira-data-agendamento").value;
      const v = container.querySelector("#primeira-valor").value;
      const px = container.querySelector("#primeira-pix").value;

      let template =
        systemConfigs.textos?.primeiroPagamento ||
        `(Modelo de mensagem 'primeiroPagamento' não encontrado nas configurações)`;

      let msg = template
        .replace(/{p}/g, p)
        .replace(/{data}/g, formatDateTimeLocalString(data))
        .replace(/{v}/g, v)
        .replace(/{px}/g, px)
        .replace(/{prazo}/g, getFutureDate(2));

      generateAndCopy("output-primeira", msg);
    });
  }

  // Ponto de entrada
  await loadSystemConfigs();
  setupSelects();
  setupAccordion();
  setupButtonListeners();
}
