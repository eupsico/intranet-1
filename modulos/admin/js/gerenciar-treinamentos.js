import { db, doc, getDoc, setDoc } from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  console.log("🚀 Módulo de Gerenciar Treinamentos iniciado.");

  const tabs = document.querySelectorAll(".tab-link");
  const contents = document.querySelectorAll(".tab-content");
  const modal = document.getElementById("video-modal");
  const videoForm = document.getElementById("video-form");

  // Botões para fechar o modal
  const closeModalBtn = document.querySelector(".close-modal-btn");
  const cancelModalBtn = document.getElementById("modal-cancel-btn");
  const modalOverlay = document.querySelector(".modal-overlay");

  let treinamentosData = {};

  // --- LÓGICA DAS ABAS ---
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.remove("active"));
      contents.forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  // --- LÓGICA DO MODAL ---
  const openModal = (category, id = null) => {
    videoForm.reset();
    document.getElementById("video-category").value = category;
    const modalTitle = document.getElementById("modal-title");

    if (
      id !== null &&
      treinamentosData[category] &&
      treinamentosData[category][id]
    ) {
      modalTitle.textContent = "Editar Vídeo";
      const video = treinamentosData[category][id];
      document.getElementById("video-id").value = id;
      document.getElementById("video-title").value = video.title || ""; // Carrega o novo campo
      document.getElementById("video-link").value = video.link;
      document.getElementById("video-description").value = video.descricao;
    } else {
      modalTitle.textContent = "Adicionar Vídeo";
      document.getElementById("video-id").value = "";
    }
    modal.style.display = "flex";
  };

  const closeModalFunction = () => {
    modal.style.display = "none";
  };

  document.querySelectorAll(".add-video-btn").forEach((button) => {
    button.addEventListener("click", (e) =>
      openModal(e.target.dataset.category)
    );
  });

  closeModalBtn.addEventListener("click", closeModalFunction);
  cancelModalBtn.addEventListener("click", closeModalFunction);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModalFunction();
    }
  });

  // --- LÓGICA DE DADOS ---
  videoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await salvarVideo();
  });

  async function carregarTreinamentos() {
    try {
      const docRef = doc(db, "configuracoesSistema", "treinamentos");
      const docSnap = await getDoc(docRef);
      treinamentosData = docSnap.exists()
        ? docSnap.data()
        : { integracao: [], geral: [], administrativo: [] };
      renderizarListasDeVideos();
    } catch (error) {
      console.error("Erro ao carregar treinamentos:", error);
    }
  }

  function renderizarListasDeVideos() {
    ["integracao", "geral", "administrativo"].forEach((category) => {
      const container = document.getElementById(`${category}-videos-list`);
      container.innerHTML = "";
      const videos = treinamentosData[category] || [];
      if (videos.length === 0) {
        container.innerHTML = "<p>Nenhum vídeo cadastrado nesta categoria.</p>";
        return;
      }
      videos.forEach((video, index) => {
        const item = document.createElement("div");
        item.classList.add("video-list-item");
        // Mostra o Título na lista
        item.innerHTML = `
          <div class="video-info">
              <strong>${video.title || "Vídeo sem título"}</strong>
              <p>${video.descricao}</p>
              <a href="${
                video.link
              }" target="_blank" rel="noopener noreferrer">${video.link}</a>
          </div>
          <div class="video-actions">
              <button class="action-button secondary btn-edit-video" data-category="${category}" data-id="${index}">Editar</button>
              <button class="action-button danger btn-delete-video" data-category="${category}" data-id="${index}">Excluir</button>
          </div>
        `;
        container.appendChild(item);
      });
    });
    addEventListenersAcoes();
  }

  function addEventListenersAcoes() {
    document.querySelectorAll(".btn-edit-video").forEach((button) => {
      button.addEventListener("click", (e) => {
        const { category, id } = e.target.dataset;
        openModal(category, id);
      });
    });

    document.querySelectorAll(".btn-delete-video").forEach((button) => {
      button.addEventListener("click", async (e) => {
        if (confirm("Tem certeza que deseja excluir este vídeo?")) {
          const { category, id } = e.target.dataset;
          treinamentosData[category].splice(id, 1);
          await salvarTreinamentosNoFirebase();
          renderizarListasDeVideos();
        }
      });
    });
  }

  async function salvarVideo() {
    const category = document.getElementById("video-category").value;
    const id = document.getElementById("video-id").value;
    const title = document.getElementById("video-title").value.trim(); // Pega o valor do título
    const link = document.getElementById("video-link").value.trim();
    const descricao = document.getElementById("video-description").value.trim();

    if (!title || !link || !descricao) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    const video = { title, link, descricao }; // Salva o título

    if (id) {
      treinamentosData[category][id] = video;
    } else {
      if (!treinamentosData[category]) treinamentosData[category] = [];
      treinamentosData[category].push(video);
    }

    await salvarTreinamentosNoFirebase();
    renderizarListasDeVideos();
    closeModalFunction();
  }

  async function salvarTreinamentosNoFirebase() {
    try {
      const docRef = doc(db, "configuracoesSistema", "treinamentos");
      await setDoc(docRef, treinamentosData, { merge: true });
      console.log("Treinamentos salvos com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar treinamentos:", error);
      alert("Ocorreu um erro ao salvar os dados.");
    }
  }

  carregarTreinamentos();
}
