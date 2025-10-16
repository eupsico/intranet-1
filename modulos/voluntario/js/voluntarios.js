// Arquivo: /modulos/voluntario/js/voluntarios.js
// Versão: 2.0 (Migrado para a sintaxe modular do Firebase v9)

// 1. Importa as funções necessárias do Firestore v9
import {
  db,
  collection,
  query,
  orderBy,
  getDocs,
} from "../../../assets/js/firebase-init.js";

export function init(dbRef, user, userData) {
  const gridContainer = document.getElementById("voluntarios-grid-container");

  if (!gridContainer) return;

  async function carregarVoluntarios() {
    try {
      // 2. Cria a referência da coleção e a query com a sintaxe v9
      const usuariosRef = collection(db, "usuarios");
      const q = query(usuariosRef, orderBy("nome", "asc"));

      // 3. Executa a query com getDocs
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        gridContainer.innerHTML = "<p>Nenhum voluntário encontrado.</p>";
        return;
      }

      let cardsHtml = "";
      querySnapshot.forEach((doc) => {
        const voluntario = doc.data();

        // Lógica simplificada: usa a foto do banco de dados se for um link, senão, usa a padrão.
        const fotoUrlFinal =
          voluntario.fotoUrl && voluntario.fotoUrl.startsWith("http")
            ? voluntario.fotoUrl
            : "../../../assets/img/avatar-padrao.png";

        // --- NOVAS INFORMAÇÕES ADICIONADAS AQUI ---

        // 1. Formata o registro profissional
        let registroHtml = "";
        if (
          voluntario.conselhoProfissional &&
          voluntario.registroProfissional
        ) {
          const registroFormatado = `${voluntario.conselhoProfissional}/${voluntario.registroProfissional}`;
          registroHtml = `
                        <li>
                            <span>${registroFormatado}</span>
                        </li>`;
        }

        // 2. Formata as especializações
        let especializacoesHtml = "";
        if (
          Array.isArray(voluntario.especializacoes) &&
          voluntario.especializacoes.length > 0
        ) {
          especializacoesHtml = `
                        <li>
                            <strong>Especialidades:</strong>
                            <span>${voluntario.especializacoes.join(
                              ", "
                            )}</span>
                        </li>`;
        }

        // 3. Formata o telefone
        let telefoneHtml = "";
        if (voluntario.telefone) {
          const telefoneFormatado = voluntario.telefone.replace(
            /(\d{2})(\d{5})(\d{4})/,
            "($1) $2-$3"
          );
          telefoneHtml = `
                        <li>
                            <strong>Telefone:</strong>
                            <span>${telefoneFormatado}</span>
                        </li>`;
        }

        const funcoes = Array.isArray(voluntario.funcoes)
          ? voluntario.funcoes.join(", ")
          : "Não informado";

        cardsHtml += `
                    <div class="voluntario-card">
                        <div class="profile-pic-container">
                            <img src="${fotoUrlFinal}" alt="Foto de ${
          voluntario.nome
        }" class="profile-pic" onerror="this.src='../../../assets/img/avatar-padrao.png';">
                        </div>
                        <h3 class="nome">${
                          voluntario.nome || "Nome não informado"
                        }</h3>
                        <p class="funcao">${funcoes}</p>
                        <ul class="info-list">
                            <li>
                                <strong>Profissão:</strong>
                                <span>${
                                  voluntario.profissao || "Não informada"
                                }</span>
                            </li>
                            ${registroHtml}
                            ${especializacoesHtml}
                            ${telefoneHtml}
                        </ul>
                    </div>
                `;
      });

      gridContainer.innerHTML = cardsHtml;
    } catch (error) {
      console.error("Erro ao carregar voluntários:", error);
      gridContainer.innerHTML = `<p class="alert alert-error">Não foi possível carregar a lista de voluntários.</p>`;
    }
  }

  carregarVoluntarios();
}
