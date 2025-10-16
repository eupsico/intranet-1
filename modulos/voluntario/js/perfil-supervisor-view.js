// Arquivo: /modulos/voluntario/js/perfil-supervisor-view.js
// Versão 3.0 (Integrado com as Configurações do Sistema)

import {
  db,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  documentId,
  getDoc, // Adicionado
} from "../../../assets/js/firebase-init.js";

export async function init(user, userData) {
  const container = document.getElementById("meu-perfil-container");
  const editModal = document.getElementById("edit-supervisor-profile-modal");
  const form = document.getElementById("edit-supervisor-profile-form");

  if (!container || !editModal || !form) {
    console.error("Componentes da aba 'Meu Perfil' não encontrados.");
    return;
  }

  let fetchedSupervisors = [];
  const isAdmin = (userData.funcoes || []).includes("admin");

  // --- INÍCIO DA ALTERAÇÃO ---
  let conselhos = []; // Agora será carregado do Firestore
  // --- FIM DA ALTERAÇÃO ---

  container.classList.toggle("admin", isAdmin);
  container.classList.toggle("supervisor", !isAdmin);

  // --- INÍCIO DA ALTERAÇÃO ---
  /**
   * Carrega a lista de conselhos do Firestore.
   */
  async function carregarListaDeConselhos() {
    try {
      const configRef = doc(db, "configuracoesSistema", "geral");
      const docSnap = await getDoc(configRef);
      if (docSnap.exists() && docSnap.data().listas?.conselhos) {
        conselhos = docSnap.data().listas.conselhos;
        console.log("Conselhos profissionais carregados:", conselhos);
      } else {
        console.warn(
          "Lista de conselhos não encontrada nas configurações. Usando lista padrão."
        );
        // Lista padrão para fallback
        conselhos = ["Nenhum", "CRP", "CRM", "CRESS", "OAB", "CFN", "Outro"];
      }
    } catch (error) {
      console.error("Erro ao carregar lista de conselhos:", error);
      conselhos = ["Nenhum", "Outro"]; // Mínimo para evitar quebras
    }
  }
  // --- FIM DA ALTERAÇÃO ---

  const createSupervisorCard = (supervisor) => {
    const card = document.createElement("div");
    card.className = "supervisor-card";

    let fotoSupervisor =
      supervisor.fotoSupervisor || "../../../assets/img/avatar-padrao.png";
    if (fotoSupervisor && !fotoSupervisor.startsWith("http")) {
      fotoSupervisor = `../../../${fotoSupervisor.replace(/^\/*/, "")}`;
    }

    const registroCompleto =
      supervisor.conselhoProfissional &&
      supervisor.conselhoProfissional !== "Nenhum" &&
      supervisor.registroProfissional
        ? `${supervisor.conselhoProfissional}: ${supervisor.registroProfissional}`
        : "";

    card.innerHTML = `
            <div class="supervisor-card-header">
                <div class="supervisor-photo-container">
                    <img src="${fotoSupervisor}" alt="Foto de ${
      supervisor.nome
    }" class="supervisor-photo" onerror="this.onerror=null;this.src='../../../assets/img/avatar-padrao.png';">
                </div>
                <h3>${supervisor.nome || "Nome não informado"}</h3>
                <div class="title-banner">${
                  supervisor.titulo || "Supervisor(a) Clínico(a)"
                }</div>
            </div>
            <div class="supervisor-card-body">
                <div class="supervisor-contact">
                    <p>${registroCompleto}</p>
                    <p><strong>Telefone:</strong> ${
                      supervisor.contato || "Não informado"
                    }</p>
                    <p><strong>E-mail:</strong> ${
                      supervisor.email || "Não informado"
                    }</p>
                    <p><strong>www.eupsico.org.br</strong></p>
                </div>
                <div class="logo-container">
                    <img src="../../../assets/img/logo-branca.png" alt="Logo EuPsico">
                </div>
            </div>
            <div class="supervisor-card-footer">
                <button class="action-button edit-btn" data-uid="${
                  supervisor.uid
                }">Editar Perfil</button>
            </div>
        `;
    return card;
  };

  const renderProfiles = (supervisors) => {
    container.innerHTML = "";
    supervisors.forEach((supervisor) => {
      const card = createSupervisorCard(supervisor);
      container.appendChild(card);
      card.querySelector(".edit-btn").addEventListener("click", (e) => {
        const uid = e.target.dataset.uid;
        const supervisorData = fetchedSupervisors.find((s) => s.uid === uid);
        if (supervisorData) openEditModal(supervisorData);
      });
    });
  };

  const openEditModal = (data) => {
    form.elements["uid"].value = data.uid;
    form.elements["fotoSupervisor"].value = data.fotoSupervisor || "";
    form.elements["titulo"].value = data.titulo || "";
    form.elements["email"].value = data.email || "";
    form.elements["abordagem"].value = data.abordagem || "";

    const conselhoSelect = form.elements["conselhoProfissional"];
    conselhoSelect.innerHTML = conselhos
      .map(
        (c) =>
          `<option value="${c}" ${
            c === (data.conselhoProfissional || "Nenhum") ? "selected" : ""
          }>${c}</option>`
      )
      .join("");

    form.elements["registroProfissional"].value =
      data.registroProfissional || "";
    form.elements["contato"].value = data.contato || "";

    const toText = (arr) => (Array.isArray(arr) ? arr.join("\n") : arr || "");
    form.elements["formacao"].value = toText(data.formacao);
    form.elements["especializacao"].value = toText(data.especializacao);
    form.elements["atuacao"].value = toText(data.atuacao);
    form.elements["supervisaoInfo"].value = toText(data.supervisaoInfo);

    const horariosContainer = document.getElementById(
      "horarios-editor-container"
    );
    horariosContainer.innerHTML = "";
    if (data.diasHorarios && Array.isArray(data.diasHorarios)) {
      data.diasHorarios.forEach((h) =>
        horariosContainer.appendChild(createHorarioRow(h))
      );
    }

    const fotoSupervisorInput = form.elements["fotoSupervisor"];
    fotoSupervisorInput.readOnly = !isAdmin;
    fotoSupervisorInput.title = isAdmin
      ? ""
      : "Apenas administradores podem alterar a URL da foto.";

    editModal.style.display = "flex";
  };

  const createHorarioRow = (horario = {}) => {
    const dias = [
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
      "Domingo",
    ];
    const row = document.createElement("div");
    row.className = "form-row";
    const diaOptions = dias
      .map(
        (dia) =>
          `<option value="${dia}" ${
            horario.dia === dia ? "selected" : ""
          }>${dia}</option>`
      )
      .join("");
    row.innerHTML = `
            <div class="form-group"><select name="horario_dia" class="form-control">${diaOptions}</select></div>
            <div class="form-group"><input type="time" name="horario_inicio" class="form-control" value="${
              horario.inicio || ""
            }"></div>
            <div class="form-group"><input type="time" name="horario_fim" class="form-control" value="${
              horario.fim || ""
            }"></div>
            <button type="button" class="action-button secondary-button remove-horario-btn">&times;</button>
        `;
    row
      .querySelector(".remove-horario-btn")
      .addEventListener("click", () => row.remove());
    return row;
  };

  async function saveProfileChanges(e) {
    e.preventDefault();
    const uid = form.elements["uid"].value;
    if (!uid) return;

    const fromText = (text) =>
      text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    const horarios = Array.from(
      document.querySelectorAll("#horarios-editor-container .form-row")
    )
      .map((row) => ({
        dia: row.querySelector('[name="horario_dia"]').value,
        inicio: row.querySelector('[name="horario_inicio"]').value,
        fim: row.querySelector('[name="horario_fim"]').value,
      }))
      .filter((h) => h.dia && h.inicio && h.fim);

    const dataToUpdate = {
      titulo: form.elements["titulo"].value,
      conselhoProfissional: form.elements["conselhoProfissional"].value,
      registroProfissional: form.elements["registroProfissional"].value,
      contato: form.elements["contato"].value,
      abordagem: form.elements["abordagem"].value,
      formacao: fromText(form.elements["formacao"].value),
      especializacao: fromText(form.elements["especializacao"].value),
      atuacao: fromText(form.elements["atuacao"].value),
      supervisaoInfo: fromText(form.elements["supervisaoInfo"].value),
      diasHorarios: horarios,
    };

    if (isAdmin) {
      dataToUpdate.fotoSupervisor = form.elements["fotoSupervisor"].value;
    }

    const saveBtn = document.getElementById("save-profile-btn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Salvando...";

    try {
      const userDocRef = doc(db, "usuarios", uid);
      await updateDoc(userDocRef, dataToUpdate);

      alert("Perfil salvo com sucesso!");
      editModal.style.display = "none";
      loadProfiles();
    } catch (error) {
      console.error("Erro ao salvar o perfil:", error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Salvar Alterações";
    }
  }

  async function loadProfiles() {
    container.innerHTML = '<div class="loading-spinner"></div>';
    try {
      let q;
      if (isAdmin) {
        q = query(
          collection(db, "usuarios"),
          where("funcoes", "array-contains", "supervisor")
        );
      } else {
        q = query(
          collection(db, "usuarios"),
          where(documentId(), "==", user.uid)
        );
      }
      const querySnapshot = await getDocs(q);

      fetchedSupervisors = querySnapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));

      if (fetchedSupervisors.length > 0) {
        renderProfiles(fetchedSupervisors);
      } else {
        container.innerHTML =
          '<p class="info-card">Nenhum perfil de supervisor encontrado.</p>';
      }
    } catch (error) {
      console.error("Erro ao carregar perfis:", error);
      container.innerHTML =
        '<p class="alert alert-error">Ocorreu um erro ao carregar os perfis.</p>';
    }
  }

  editModal
    .querySelector(".close-modal-btn")
    .addEventListener("click", () => (editModal.style.display = "none"));
  document.getElementById("add-horario-btn").addEventListener("click", () => {
    document
      .getElementById("horarios-editor-container")
      .appendChild(createHorarioRow());
  });
  form.addEventListener("submit", saveProfileChanges);

  // --- INÍCIO DA ALTERAÇÃO ---
  await carregarListaDeConselhos(); // Carrega a lista antes de carregar os perfis
  await loadProfiles();
  // --- FIM DA ALTERAÇÃO ---
}
