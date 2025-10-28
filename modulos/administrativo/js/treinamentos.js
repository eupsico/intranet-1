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

  function renderizarVideos(videos) {
    const container = document.getElementById("videos-container");
    container.innerHTML = ""; // Limpa o spinner

    if (videos.length === 0) {
      container.innerHTML =
        "<p>Nenhum vídeo de treinamento cadastrado no momento.</p>";
      return;
    }

    videos.forEach((video) => {
      const videoId = extrairVideoId(video.link); // Conteúdo que será exibido dentro do acordeão

      let contentBody;

      if (videoId) {
        // --- Lógica para YouTube (incorporação via iframe) ---
        contentBody = `
     <div class="video-description">
       <p>${video.descricao.replace(/\n/g, "<br>")}</p>
     </div>
     <div class="video-embed">
       <iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
     </div>
    `;
      } else {
        // --- Lógica para Links Externos (Google Drive, etc.) ---
        console.warn(
          "Link de vídeo não-YouTube detectado (será exibido como link externo):",
          video.link
        );
        contentBody = `
     <div class="video-description">
       <p>${video.descricao.replace(/\n/g, "<br>")}</p>
     </div>
     <div class="external-link-embed">
       <p>Este vídeo está hospedado externamente (Ex: Google Drive). Clique no link abaixo para abrir em uma nova aba.</p>
       <a href="${
         video.link
       }" target="_blank" rel="noopener noreferrer" class="action-button primary-button">
        Abrir Vídeo Externo
       </a>
              <p class="small-link">${video.link}</p>
     </div>
    `;
      } // Cria o item do acordeão para AMBOS os tipos de link (YouTube e Externo)

      const accordionItem = document.createElement("div");
      accordionItem.classList.add("accordion-item");

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
