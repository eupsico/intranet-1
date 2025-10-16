// Arquivo: /modulos/financeiro/js/configuracoes.js
// Versão: 2.0 (Migrado para a sintaxe modular do Firebase v9)

import {
  db,
  doc,
  getDoc,
  updateDoc,
} from "../../../assets/js/firebase-init.js";

export function init() {
  const viewContent = document.querySelector('[data-view-id="configuracoes"]');
  if (!viewContent) return;

  const tabContainer = viewContent.querySelector(".tabs-container");
  const inicializado = {
    mensagens: false,
    valores: false,
  };

  function initValoresSessao() {
    if (inicializado.valores) return;
    const docRef = doc(db, "financeiro", "configuracoes");
    const inputOnline = document.getElementById("valor-online");
    const inputPresencial = document.getElementById("valor-presencial");
    const inputTaxa = document.getElementById("taxa-acordo");
    const saveBtn = document.getElementById("salvar-valores-btn");

    async function carregarValores() {
      if (!inputOnline) return;
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.valores) {
            inputOnline.value = data.valores.online || 0;
            inputPresencial.value = data.valores.presencial || 0;
            inputTaxa.value = data.valores.taxaAcordo || 0;
          }
        }
      } catch (error) {
        console.error("Erro ao buscar valores: ", error);
        window.showToast("Erro ao buscar valores.", "error");
      }
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        const dados = {
          "valores.online": parseFloat(inputOnline.value) || 0,
          "valores.presencial": parseFloat(inputPresencial.value) || 0,
          "valores.taxaAcordo": parseFloat(inputTaxa.value) || 0,
        };
        try {
          await updateDoc(docRef, dados);
          window.showToast("Valores salvos com sucesso!", "success");
        } catch (error) {
          console.error("Erro ao salvar valores: ", error);
          window.showToast("Erro ao salvar valores.", "error");
        } finally {
          saveBtn.disabled = false;
        }
      });
    }
    carregarValores();
    inicializado.valores = true;
  }

  function initModelosMensagem() {
    if (inicializado.mensagens) return;
    const docRef = doc(db, "financeiro", "configuracoes");
    const inputAcordo = document.getElementById("msg-acordo");
    const inputCobranca = document.getElementById("msg-cobranca");
    const inputContrato = document.getElementById("msg-contrato");
    const saveBtn = document.getElementById("salvar-mensagens-btn");
    let modoEdicao = false;

    function setMensagensState(isEditing) {
      if (!inputAcordo) return;
      modoEdicao = isEditing;
      inputAcordo.disabled = !isEditing;
      inputCobranca.disabled = !isEditing;
      inputContrato.disabled = !isEditing;
      saveBtn.textContent = isEditing ? "Salvar" : "Modificar";
    }

    async function carregarMensagens() {
      if (!inputAcordo) return;
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.Mensagens) {
            inputAcordo.value = data.Mensagens.acordo || "";
            inputCobranca.value = data.Mensagens.cobranca || "";
            inputContrato.value = data.Mensagens.contrato || "";
          }
        }
      } catch (error) {
        console.error("Erro ao buscar mensagens: ", error);
        window.showToast("Erro ao buscar mensagens.", "error");
      }
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        if (!modoEdicao) {
          setMensagensState(true);
          return;
        }
        saveBtn.disabled = true;
        const novasMensagens = {
          "Mensagens.acordo": inputAcordo.value,
          "Mensagens.cobranca": inputCobranca.value,
          "Mensagens.contrato": inputContrato.value,
        };
        try {
          await updateDoc(docRef, novasMensagens);
          window.showToast("Mensagens salvas com sucesso!", "success");
          setMensagensState(false);
        } catch (error) {
          console.error("Erro ao salvar mensagens: ", error);
          window.showToast("Erro ao salvar mensagens.", "error");
        } finally {
          saveBtn.disabled = false;
        }
      });
    }

    carregarMensagens();
    setMensagensState(false);
    inicializado.mensagens = true;
  }

  if (tabContainer) {
    tabContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("tab-link")) {
        const clickedButton = e.target;
        const tabNameToOpen = clickedButton.dataset.tab;

        tabContainer
          .querySelectorAll(".tab-link")
          .forEach((btn) => btn.classList.remove("active"));
        clickedButton.classList.add("active");

        viewContent
          .querySelectorAll(".tab-content")
          .forEach((content) => (content.style.display = "none"));
        const contentToDisplay = viewContent.querySelector(`#${tabNameToOpen}`);
        if (contentToDisplay) {
          contentToDisplay.style.display = "block";
        }

        if (tabNameToOpen === "ValoresSessao") initValoresSessao();
        else if (tabNameToOpen === "ModelosMensagem") initModelosMensagem();
      }
    });

    const primeiraAba = tabContainer.querySelector(".tab-link");
    if (primeiraAba) {
      primeiraAba.click();
    }
  }
}
