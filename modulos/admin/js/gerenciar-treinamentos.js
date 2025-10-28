import { db, doc, getDoc, setDoc } from "../../../assets/js/firebase-init.js";

export function init(user, userData) {
  console.log("🚀 Módulo de Gerenciar Treinamentos iniciado.");

  const tabs = document.querySelectorAll(".tab-link");
  const contents = document.querySelectorAll(".tab-content");
  const modal = document.getElementById("video-modal");
  const videoForm = document.getElementById("video-form"); // Botões para fechar o modal

  const closeModalBtn = document.querySelector(".close-modal-btn");
  const cancelModalBtn = document.getElementById("modal-cancel-btn");
  const modalOverlay = document.querySelector(".modal-overlay");

  let treinamentosData = {}; // --- LÓGICA DAS ABAS ---

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((item) => item.classList.remove("active"));
      contents.forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  }); // --- LÓGICA DO MODAL ---

  const openModal = (category, id = null) => {
    videoForm.reset();
    document.getElementById("video-category").value = category;
    const modalTitle = document.getElementById("modal-title");

    if (
      id !== null &&
      treinamentosData[category] &&
      treinamentosData[category][id]
    ) {
      modalTitle.textContent = "Editar Vídeo"; // O ID é usado como índice do array, conforme sua lógica atual.
      const video = treinamentosData[category][id];
      document.getElementById("video-id").value = id;
      document.getElementById("video-title").value = video.title || "";
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
  }); // --- LÓGICA DE DADOS ---

  videoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await salvarVideo();
  });

  async function carregarTreinamentos() {
    try {
      const docRef = doc(db, "configuracoesSistema", "treinamentos");
      const docSnap = await getDoc(docRef); // Garante que treinamentosData seja um objeto com as chaves esperadas, mesmo que vazias.
      treinamentosData = docSnap.exists()
        ? docSnap.data()
        : { integracao: [], geral: [], administrativo: [] }; // Garante que cada categoria seja um array para evitar erro de .forEach

      ["integracao", "geral", "administrativo"].forEach((category) => {
        if (!Array.isArray(treinamentosData[category])) {
          treinamentosData[category] = [];
        }
      });

      renderizarListasDeVideos();
    } catch (error) {
      console.error("Erro ao carregar treinamentos:", error); // Adicione um alerta ou log de erro para o usuário se o carregamento falhar
      alert("Erro ao carregar dados de treinamento. Verifique o console.");
    }
  }

  function renderizarListasDeVideos() {
    ["integracao", "geral", "administrativo"].forEach((category) => {
      const container = document.getElementById(`${category}-videos-list`);
      container.innerHTML = ""; // Verifica se a categoria é um array. Se não for, usa um array vazio.
      const videos = Array.isArray(treinamentosData[category])
        ? treinamentosData[category]
        : [];
      if (videos.length === 0) {
        container.innerHTML = "<p>Nenhum vídeo cadastrado nesta categoria.</p>";
        return;
      }

      videos.forEach((video, index) => {
        const item = document.createElement("div");
        item.classList.add("video-list-item"); // Mostra o Título na lista
        item.innerHTML = `
 <div class="video-info">
   <strong>${video.title || "Vídeo sem título"}</strong>
   <p>${video.descricao}</p>
   <a href="${video.link}" target="_blank" rel="noopener noreferrer">${
          video.link
        }</a>
 </div>
 <div class="video-actions">
   <button class="action-button secondary btn-edit-video" data-category="${category}" data-id="${index}">Editar</button>
   <button class="action-button danger btn-delete-video" data-category="${category}" data-id="${index}">Excluir</button>
 </div>
`;
        container.appendChild(item);
      });
    }); // Chama a função para adicionar listeners APENAS uma vez após o FOR
    addEventListenersAcoes();
  }

  function addEventListenersAcoes() {
    // Remove listeners antigos para evitar duplicação antes de adicionar novos
    document.querySelectorAll(".btn-edit-video").forEach((button) => {
      // Remove o listener anterior (se houver) para evitar que a função seja chamada múltiplas vezes
      button.removeEventListener("click", handleEditClick);
      button.addEventListener("click", handleEditClick);
    });

    document.querySelectorAll(".btn-delete-video").forEach((button) => {
      // Remove o listener anterior (se houver)
      button.removeEventListener("click", handleDeleteClick);
      button.addEventListener("click", handleDeleteClick);
    });
  }

  // Funções separadas para os event listeners
  function handleEditClick(e) {
    const { category, id } = e.target.dataset;
    openModal(category, id);
  }

  async function handleDeleteClick(e) {
    if (confirm("Tem certeza que deseja excluir este vídeo?")) {
      const { category, id } = e.target.dataset;
      // O 'id' é o índice do array, por isso usamos splice
      treinamentosData[category].splice(id, 1);
      await salvarTreinamentosNoFirebase();
      renderizarListasDeVideos();
    }
  }

  async function salvarVideo() {
    const category = document.getElementById("video-category").value;
    const id = document.getElementById("video-id").value;
    const title = document.getElementById("video-title").value.trim();
    const link = document.getElementById("video-link").value.trim();
    const descricao = document.getElementById("video-description").value.trim();

    if (!title || !link || !descricao) {
      alert("Por favor, preencha todos os campos.");
      return;
    }

    const video = { title, link, descricao };

    if (id) {
      // Edita pelo índice (id)
      treinamentosData[category][id] = video;
    } else {
      // Adiciona novo
      if (
        !treinamentosData[category] ||
        !Array.isArray(treinamentosData[category])
      ) {
        treinamentosData[category] = [];
      }
      treinamentosData[category].push(video);
    }

    await salvarTreinamentosNoFirebase();
    renderizarListasDeVideos();
    closeModalFunction();
  }

  async function salvarTreinamentosNoFirebase() {
    try {
      const docRef = doc(db, "configuracoesSistema", "treinamentos"); // Salva o objeto completo de treinamentos
      await setDoc(docRef, treinamentosData);
      console.log("Treinamentos salvos com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar treinamentos:", error);
      alert("Ocorreu um erro ao salvar os dados.");
    }
  }

  carregarTreinamentos();
}
