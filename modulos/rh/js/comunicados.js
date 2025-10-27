// modulos/rh/js/comunicados.js

import {
  db,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  deleteDoc,
} from "../../../assets/js/firebase-init.js";

const comunicadosCollection = collection(db, "comunicados");
const formComunicado = document.getElementById("form-comunicado");
const modalComunicado = document.getElementById("modal-comunicado");
const listaComunicados = document.getElementById("lista-comunicados");

/**
 * Inicializa o módulo de comunicados.
 */
export function initcomunicados(user, userData) {
  console.log("Módulo de Gestão de Comunicados carregado.");

  document
    .getElementById("btn-novo-comunicado")
    .addEventListener("click", () => abrirModalComunicado());
  document.querySelectorAll(".fechar-modal").forEach((btn) => {
    btn.addEventListener(
      "click",
      () => (modalComunicado.style.display = "none")
    );
  });

  formComunicado.addEventListener("submit", handleSalvarComunicado);

  carregarComunicados();

  // Adiciona listener para ações na tabela (Editar/Excluir)
  listaComunicados.addEventListener("click", handleTabelaActions);
}

/**
 * Abre o modal para novo comunicado ou edição.
 */
function abrirModalComunicado(comunicado = null) {
  formComunicado.reset();
  document.getElementById("comunicado-id").value = "";

  if (comunicado) {
    document.getElementById("comunicado-id").value = comunicado.id;
    document.getElementById("comunicado-titulo").value = comunicado.titulo;
    document.getElementById("comunicado-conteudo").value = comunicado.conteudo;
    document.getElementById("comunicado-destino").value = comunicado.destino;
    document.getElementById("comunicado-status").value = comunicado.status;
    document.querySelector("#modal-comunicado h3").textContent =
      "Editar Comunicado";
  } else {
    document.querySelector("#modal-comunicado h3").textContent =
      "Criar Novo Comunicado";
  }

  modalComunicado.style.display = "flex";
}

/**
 * Lida com a submissão do formulário.
 */
async function handleSalvarComunicado(e) {
  e.preventDefault();

  const id = document.getElementById("comunicado-id").value;
  const titulo = document.getElementById("comunicado-titulo").value;
  const conteudo = document.getElementById("comunicado-conteudo").value;
  const destino = document.getElementById("comunicado-destino").value;
  const status = document.getElementById("comunicado-status").value;

  const data = {
    titulo: titulo,
    conteudo: conteudo,
    destino: destino,
    status: status,
    dataPublicacao: status === "ativo" ? new Date() : null,
    dataAtualizacao: new Date(),
  };

  try {
    if (id) {
      // Edição
      await updateDoc(doc(db, "comunicados", id), data);
      window.showToast("Comunicado atualizado com sucesso!");
    } else {
      // Novo comunicado
      data.dataCriacao = new Date();
      await addDoc(comunicadosCollection, data);
      window.showToast("Comunicado criado e salvo!");
    }

    modalComunicado.style.display = "none";
    carregarComunicados();
  } catch (error) {
    console.error("Erro ao salvar comunicado:", error);
    window.showToast("Erro ao salvar o comunicado.", "error");
  }
}

/**
 * Carrega a lista de comunicados.
 */
async function carregarComunicados() {
  listaComunicados.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

  const q = query(
    comunicadosCollection,
    // Ordena por data de publicação para mostrar os mais recentes primeiro
    where("status", "in", ["ativo", "rascunho"])
  );

  try {
    const snapshot = await getDocs(q);
    let htmlComms = "";

    if (snapshot.empty) {
      listaComunicados.innerHTML =
        '<tr><td colspan="5" class="text-center">Nenhum comunicado ativo ou em rascunho.</td></tr>';
      return;
    }

    snapshot.docs.sort(
      (a, b) =>
        (b.data().dataPublicacao?.seconds || 0) -
        (a.data().dataPublicacao?.seconds || 0)
    );

    snapshot.forEach((doc) => {
      const comm = doc.data();
      comm.id = doc.id;

      const dataPub = comm.dataPublicacao
        ? new Date(comm.dataPublicacao.seconds * 1000).toLocaleDateString(
            "pt-BR"
          )
        : "Rascunho";
      const statusClass =
        comm.status === "ativo" ? "status-concluída" : "status-pendente";

      htmlComms += `
                <tr>
                    <td>${comm.titulo}</td>
                    <td><span class="status-badge ${statusClass}">${comm.status.toUpperCase()}</span></td>
                    <td>${dataPub}</td>
                    <td>${comm.destino.toUpperCase()}</td>
                    <td>
                        <button class="action-button secondary btn-sm btn-editar" data-id="${
                          comm.id
                        }">Editar</button>
                        <button class="action-button error btn-sm btn-excluir" data-id="${
                          comm.id
                        }">Arquivar</button>
                    </td>
                </tr>
            `;
    });

    listaComunicados.innerHTML = htmlComms;
  } catch (error) {
    console.error("Erro ao carregar comunicados:", error);
    listaComunicados.innerHTML =
      '<tr><td colspan="5" class="alert alert-error">Erro ao carregar os comunicados.</td></tr>';
  }
}

/**
 * Lida com cliques nos botões da tabela (Editar/Arquivar).
 */
async function handleTabelaActions(e) {
  const btn = e.target;
  const id = btn.getAttribute("data-id");

  if (!id) return;

  if (btn.classList.contains("btn-editar")) {
    try {
      const commDoc = await getDocs(doc(db, "comunicados", id));
      if (commDoc.exists()) {
        abrirModalComunicado({ ...commDoc.data(), id: id });
      }
    } catch (error) {
      console.error("Erro ao buscar comunicado para edição:", error);
      window.showToast("Não foi possível carregar o comunicado.", "error");
    }
  } else if (btn.classList.contains("btn-excluir")) {
    if (
      confirm(
        "Tem certeza que deseja arquivar este comunicado? Ele será removido da página principal."
      )
    ) {
      try {
        // Ao invés de deletar, alteramos o status para 'arquivado'
        await updateDoc(doc(db, "comunicados", id), {
          status: "arquivado",
          dataArquivamento: new Date(),
        });
        window.showToast("Comunicado arquivado com sucesso!", "warning");
        carregarComunicados();
      } catch (error) {
        console.error("Erro ao arquivar comunicado:", error);
        window.showToast("Erro ao arquivar o comunicado.", "error");
      }
    }
  }
}
