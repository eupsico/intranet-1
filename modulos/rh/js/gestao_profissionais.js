// Arquivo: /modulos/rh/js/gestao_profissionais.js
// Versão: 2.1 (Correção de Modal e Assinatura Init)

import { functions, db } from "../../../assets/js/firebase-init.js";
import { httpsCallable } from "../../../assets/js/firebase-init.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
} from "../../../assets/js/firebase-init.js";

// Ajuste na assinatura: removido db_ignored para alinhar com rh-painel.js
export function init(user, userData) {
  const usuariosCollectionRef = collection(db, "usuarios");
  let localUsuariosList = [];

  const tableBody = document.querySelector("#profissionais-table tbody");
  const modal = document.getElementById("profissional-modal");
  const addBtn = document.getElementById("add-profissional-btn");
  const closeBtn = document.getElementById("modal-close-btn");
  const cancelBtn = document.getElementById("modal-cancel-btn");
  const saveBtn = document.getElementById("modal-save-btn");
  const deleteBtn = document.getElementById("modal-delete-btn");
  const form = document.getElementById("profissional-form");

  /**
   * Carrega a lista de profissões do Firestore e popula o select.
   */
  async function carregarListaDeProfissoes() {
    const selectProfissao = document.getElementById("prof-profissao");
    if (!selectProfissao) return;

    try {
      const configRef = doc(db, "configuracoesSistema", "geral");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists() && docSnap.data().listas?.profissoes) {
        const profissoes = docSnap.data().listas.profissoes;
        let optionsHtml =
          '<option value="" disabled selected>Selecione uma profissão</option>';
        profissoes.forEach((p) => {
          optionsHtml += `<option value="${p}">${p}</option>`;
        });
        selectProfissao.innerHTML = optionsHtml;
      } else {
        console.warn("Lista de profissões não encontrada nas configurações.");
      }
    } catch (error) {
      console.error("Erro ao carregar lista de profissões:", error);
    }
  }

  const formatarTelefone = (value) => {
    if (!value) return "";
    value = value.replace(/\D/g, "").substring(0, 11);
    value = value.replace(/^(\d{2})(\d)/g, "($1) $2");
    if (value.length > 9) {
      value = value.replace(/(\d{5})(\d)/, "$1-$2");
    }
    return value;
  };

  document.getElementById("prof-contato").addEventListener("input", (e) => {
    e.target.value = formatarTelefone(e.target.value);
  });

  const validarFormulario = () => {
    let isValid = true;
    form.querySelectorAll("[required]").forEach((input) => {
      if (!input.value.trim()) {
        isValid = false;
        console.warn(`Campo obrigatório não preenchido: ${input.id}`);
      }
    });
    return isValid;
  };

  // Lógica de Abertura do Modal Corrigida (Display + ClassList)
  const openModal = (profissional = null) => {
    form.reset();
    document.getElementById("profissional-id").value = profissional
      ? profissional.uid
      : "";
    document.getElementById("prof-email").disabled = !!profissional;
    document.getElementById("modal-title").textContent = profissional
      ? "Editar Profissional"
      : "Adicionar Profissional";
    deleteBtn.style.display = profissional ? "inline-block" : "none";

    if (profissional) {
      form.querySelector("#prof-nome").value = profissional.nome || "";
      form.querySelector("#prof-email").value = profissional.email || "";
      form.querySelector("#prof-contato").value = formatarTelefone(
        profissional.contato || ""
      );
      form.querySelector("#prof-profissao").value =
        profissional.profissao || "";
      form.querySelector("#prof-inativo").checked =
        profissional.inativo || false;
      form.querySelector("#prof-recebeDireto").checked =
        profissional.recebeDireto || false;
      form.querySelector("#prof-primeiraFase").checked =
        profissional.primeiraFase || false;
      form.querySelector("#prof-fazAtendimento").checked =
        profissional.fazAtendimento !== false;
      form.querySelectorAll('input[name="funcoes"]').forEach((cb) => {
        cb.checked = (profissional.funcoes || []).includes(cb.value);
      });
    }

    // Garante que o modal seja exibido e anime a opacidade
    modal.style.display = "flex";
    setTimeout(() => {
      modal.classList.add("is-visible");
    }, 10);
  };

  // Lógica de Fechamento do Modal Corrigida
  const closeModal = () => {
    modal.classList.remove("is-visible");
    // Aguarda a transição do CSS antes de esconder
    setTimeout(() => {
      modal.style.display = "none";
    }, 300);
  };

  const renderTable = (profissionais) => {
    tableBody.innerHTML = "";
    if (profissionais.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="8">Nenhum profissional encontrado.</td></tr>';
      return;
    }
    profissionais.forEach((prof) => {
      const row = tableBody.insertRow();
      row.innerHTML = `
                <td>${prof.nome || ""}</td>
                <td>${formatarTelefone(prof.contato || "")}</td>
                <td>${(prof.funcoes || []).join(", ") || "Nenhuma"}</td>
                <td>${prof.inativo ? "Sim" : "Não"}</td>
                <td>${prof.primeiraFase ? "Sim" : "Não"}</td>
                <td>${prof.fazAtendimento !== false ? "Sim" : "Não"}</td>
                <td>${prof.recebeDireto ? "Sim" : "Não"}</td>
                <td><button class="action-button edit-row-btn" data-id="${
                  prof.uid
                }">Editar</button></td>
            `;
    });
  };

  const q = query(usuariosCollectionRef, orderBy("nome"));
  onSnapshot(
    q,
    (snapshot) => {
      localUsuariosList = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        uid: doc.id,
      }));
      renderTable(localUsuariosList);
    },
    (error) => {
      console.error("Erro ao carregar profissionais: ", error);
      window.showToast("Erro ao carregar profissionais.", "error");
    }
  );

  addBtn.addEventListener("click", () => openModal(null));
  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  // Fecha ao clicar fora do modal
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  tableBody.addEventListener("click", (e) => {
    if (e.target.classList.contains("edit-row-btn")) {
      const userId = e.target.dataset.id;
      const userToEdit = localUsuariosList.find((u) => u.uid === userId);
      if (userToEdit) openModal(userToEdit);
    }
  });

  deleteBtn.addEventListener("click", async () => {
    const userId = document.getElementById("profissional-id").value;
    if (
      !userId ||
      !confirm(
        "Atenção! Esta ação excluirá os dados do profissional no Firestore, mas NÃO removerá o login do Google. Deseja continuar?"
      )
    )
      return;

    try {
      await deleteDoc(doc(db, "usuarios", userId));
      window.showToast("Profissional excluído com sucesso!", "success");
      closeModal();
    } catch (err) {
      window.showToast(`Erro ao excluir: ${err.message}`, "error");
    }
  });

  saveBtn.addEventListener("click", async () => {
    if (!validarFormulario()) {
      window.showToast(
        "Por favor, preencha todos os campos obrigatórios.",
        "error"
      );
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Salvando...";

    const id = document.getElementById("profissional-id").value;
    const nomeCompleto = form.querySelector("#prof-nome").value.trim();
    const username =
      nomeCompleto.split(" ")[0] + " " + nomeCompleto.split(" ").slice(-1);

    const dados = {
      nome: nomeCompleto,
      username: username,
      email: form.querySelector("#prof-email").value.trim(),
      contato: form.querySelector("#prof-contato").value.replace(/\D/g, ""),
      profissao: form.querySelector("#prof-profissao").value,
      inativo: form.querySelector("#prof-inativo").checked,
      recebeDireto: form.querySelector("#prof-recebeDireto").checked,
      primeiraFase: form.querySelector("#prof-primeiraFase").checked,
      fazAtendimento: form.querySelector("#prof-fazAtendimento").checked,
      funcoes: Array.from(
        form.querySelectorAll('input[name="funcoes"]:checked')
      ).map((cb) => cb.value),
    };

    try {
      if (id) {
        await updateDoc(doc(db, "usuarios", id), dados);
        window.showToast("Profissional atualizado com sucesso!", "success");
      } else {
        const criarNovoProfissional = httpsCallable(
          functions,
          "criarNovoProfissional"
        );
        const resultado = await criarNovoProfissional(dados);
        window.showToast(resultado.data.message, "success");
      }
      closeModal();
    } catch (error) {
      console.error("Erro ao salvar profissional:", error);
      window.showToast(`Erro ao salvar: ${error.message}`, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Salvar";
    }
  });

  // Inicializa lista de profissões
  carregarListaDeProfissoes();
}
