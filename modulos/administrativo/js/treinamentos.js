import { db, doc, getDoc } from "../../../assets/js/firebase-init.js";

// A função é exportada e recebe os dados do usuário, seguindo o padrão do painel
export function init(user, userData) {
  console.log("📚 Módulo de Treinamentos (Visualização) iniciado.");

  async function carregarTreinamentos() {
    const container = document.getElementById("videos-container");
    if (!container) return;

    container.innerHTML = '<div class="loading-spinner"></div>'; // Mostra carregando

    try {
      const docRef = doc(db, "configuracoesSistema", "treinamentos");
      const docSnap = await getDoc(docRef);

      let todosOsVideos = [];
      if (docSnap.exists()) {
        const data = docSnap.data(); // Garante que cada item seja tratado como array ou array vazio
        todosOsVideos = [
          ...(Array.isArray(data.integracao) ? data.integracao : []),
          ...(Array.isArray(data.geral) ? data.geral : []),
          ...(Array.isArray(data.administrativo) ? data.administrativo : []),
        ];
      }

      renderizarVideos(todosOsVideos);
    } catch (error) {
      console.error("Erro ao carregar treinamentos:", error);
      container.innerHTML = "<p>Ocorreu um erro ao carregar os vídeos.</p>";
    }
  }
  /**
   * Converte um link de visualização padrão do Google Drive para um link de incorporação (embed).
   * Isso permite que o vídeo seja exibido em um iframe sem a interface completa do Drive,
   * geralmente impedindo o download fácil.
   * @param {string} url - Link do Google Drive (ex: https://drive.google.com/file/d/ID_DO_ARQUIVO/view?usp=sharing)
   * @returns {string | null} O link de embed, ou null se não for um link do Drive reconhecido.
   */

  function converterLinkDriveParaEmbed(url) {
    if (!url) return null;
    const regex = /file\/d\/([a-zA-Z0-9_-]+)\//;
    const matches = url.match(regex);
    if (matches && matches[1]) {
      const fileId = matches[1]; // Formato ideal para incorporar no iframe
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return null;
  }

  function renderizarVideos(videos) {
    const container = document.getElementById("videos-container");
    container.innerHTML = ""; // Limpa o spinner

    if (videos.length === 0) {
      container.innerHTML =
        "<p>Nenhum vídeo de treinamento cadastrado no momento.</p>";
      return;
    }

    videos.forEach((video) => {
      const youtubeId = extrairVideoId(video.link);
      const driveEmbedLink = converterLinkDriveParaEmbed(video.link); // Determina qual URL de incorporação usar

      let embedUrl = null;
      if (youtubeId) {
        embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
      } else if (driveEmbedLink) {
        embedUrl = driveEmbedLink;
      } // Se não for YouTube nem Drive, exibe um aviso e não renderiza.

      if (!embedUrl) {
        console.warn(
          "Link de vídeo inválido ou não suportado para incorporação:",
          video.link
        );
        return;
      }

      // Se chegamos aqui, temos um embedUrl (YouTube ou Drive)
      const accordionItem = document.createElement("div");
      accordionItem.classList.add("accordion-item"); // Conteúdo com o iframe

      const contentBody = `
    <div class="video-description">
      <p>${video.descricao.replace(/\n/g, "<br>")}</p>
    </div>
    <div class="video-embed">
      <iframe src="${embedUrl}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    </div>
   `;

      accordionItem.innerHTML = `
    <button class="accordion-header">
     ${video.title || "Vídeo sem Título"}
     <span class="accordion-icon">+</span>
    </button>
    <div class="accordion-content">
     ${contentBody}
    </div>
   `;
      container.appendChild(accordionItem);
    }); // Adiciona os eventos de clique DEPOIS que todos os itens foram criados

    setupAccordion();
  } // FUNÇÃO para controlar a lógica do acordeão (sem alterações)

  function setupAccordion() {
    const accordionHeaders = document.querySelectorAll(".accordion-header");
    accordionHeaders.forEach((header) => {
      header.addEventListener("click", () => {
        const content = header.nextElementSibling;
        const icon = header.querySelector(".accordion-icon"); // Alterna a classe 'active' para mostrar/esconder o conteúdo

        header.classList.toggle("active");

        if (content.style.maxHeight) {
          content.style.maxHeight = null;
          icon.textContent = "+";
        } else {
          content.style.maxHeight = content.scrollHeight + "px";
          icon.textContent = "-";
        }
      });
    });
  }

  function extrairVideoId(url) {
    if (!url) return null; // Esta regex é específica para YouTube.
    const regex =
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const matches = url.match(regex);
    return matches ? matches[1] : null;
  }

  carregarTreinamentos();
}
