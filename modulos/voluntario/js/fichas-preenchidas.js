// Arquivo: /modulos/voluntario/js/fichas-preenchidas.js
// Versão 2.1 (Com controle de permissão para campos de supervisor)

import {
  db,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

let currentUser;
let currentUserData;
let todasAsFichas = [];

/**
 * Função Principal (INIT): Ponto de entrada do módulo.
 */
export function init(user, userData) {
  setTimeout(() => {
    currentUser = user;
    currentUserData = userData;
    carregarFichas();
  }, 0);
}

/**
 * Controla a visibilidade entre a lista e o formulário.
 */
function alternarVisao(mostrar) {
  const listaView = document.getElementById("lista-view-container");
  const formView = document.getElementById("form-view-container");
  if (!listaView || !formView) return;

  if (mostrar === "lista") {
    listaView.style.display = "block";
    formView.style.display = "none";
    formView.innerHTML = "";
  } else {
    listaView.style.display = "none";
    formView.style.display = "block";
  }
}

/**
 * Busca as fichas do usuário no Firestore.
 */
async function carregarFichas() {
  alternarVisao("lista");
  const container = document.getElementById("lista-fichas-container");
  container.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const q = query(
      collection(db, "fichas-supervisao-casos"),
      where("psicologoUid", "==", currentUser.uid)
    );

    const querySnapshot = await getDocs(q);
    todasAsFichas = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (todasAsFichas.length > 0) {
      todasAsFichas.sort(
        (a, b) => (b.criadoEm?.toDate() || 0) - (a.criadoEm?.toDate() || 0)
      );
    }

    renderizarLista(todasAsFichas);
    popularFiltroPacientes(todasAsFichas);

    const filtroPaciente = document.getElementById("filtro-paciente");
    const newFiltro = filtroPaciente.cloneNode(true);
    filtroPaciente.parentNode.replaceChild(newFiltro, filtroPaciente);
    newFiltro.addEventListener("change", aplicarFiltro);
  } catch (error) {
    console.error("Erro ao carregar fichas:", error);
    container.innerHTML =
      '<p class="alert alert-error">Ocorreu um erro ao buscar seus acompanhamentos.</p>';
  }
}

/**
 * Renderiza a lista de fichas na tela.
 */
function renderizarLista(fichas) {
  const container = document.getElementById("lista-fichas-container");
  container.innerHTML = "";
  if (fichas.length === 0) {
    container.innerHTML =
      '<p class="no-fichas-message">Nenhum acompanhamento encontrado.</p>';
    return;
  }
  fichas.forEach((ficha) => {
    const dataSupervisao = ficha.identificacaoGeral?.dataSupervisao;
    const dataFormatada = dataSupervisao
      ? new Date(dataSupervisao + "T03:00:00").toLocaleDateString("pt-BR")
      : "N/D";

    const itemEl = document.createElement("div");
    itemEl.className = "ficha-item";
    itemEl.innerHTML = `
            <div class="ficha-item-col"><p class="label">Paciente</p><p class="value paciente">${
              ficha.identificacaoCaso?.iniciais || "N/A"
            }</p></div>
            <div class="ficha-item-col"><p class="label">Supervisor(a)</p><p class="value">${
              ficha.identificacaoGeral?.supervisorNome || "N/A"
            }</p></div>
            <div class="ficha-item-col"><p class="label">Data da Supervisão</p><p class="value">${dataFormatada}</p></div>
        `;
    itemEl.addEventListener("click", () => abrirFormularioParaEdicao(ficha.id));
    container.appendChild(itemEl);
  });
}

/**
 * Carrega o HTML do formulário de edição e inicia o seu preenchimento.
 */
async function abrirFormularioParaEdicao(docId) {
  alternarVisao("form");
  const formContainer = document.getElementById("form-view-container");
  formContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const response = await fetch("../page/editar-ficha.html");
    if (!response.ok)
      throw new Error("Falha ao carregar o HTML do formulário de edição.");
    formContainer.innerHTML = await response.text();

    await preencherEConfigurarFormularioDeEdicao(docId);

    const backButton = document.getElementById("btn-voltar-para-lista");
    if (backButton) {
      backButton.addEventListener("click", (e) => {
        e.preventDefault();
        carregarFichas();
      });
    }
  } catch (error) {
    console.error("Erro ao abrir formulário para edição:", error);
    formContainer.innerHTML =
      '<p class="alert alert-error">Não foi possível carregar o formulário de edição.</p>';
  }
}

/**
 * Preenche o formulário com os dados da ficha e aplica as regras de permissão.
 */
async function preencherEConfigurarFormularioDeEdicao(docId) {
  const docRef = doc(db, "fichas-supervisao-casos", docId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error("Documento da ficha não encontrado no Firestore.");
  }
  const data = docSnap.data();

  // Função interna para carregar supervisores
  const loadSupervisores = async () => {
    const select = document.getElementById("supervisor-nome");
    if (!select) return;
    select.innerHTML = '<option value="">Carregando...</option>';
    try {
      const q = query(
        collection(db, "usuarios"),
        where("funcoes", "array-contains", "supervisor"),
        where("inativo", "==", false)
      );
      const querySnapshot = await getDocs(q);

      const supervisores = [];
      querySnapshot.forEach((doc) =>
        supervisores.push({ uid: doc.id, ...doc.data() })
      );
      supervisores.sort((a, b) => a.nome.localeCompare(b.nome));

      select.innerHTML = '<option value="">Selecione um supervisor</option>';
      supervisores.forEach((supervisor) => {
        select.innerHTML += `<option value="${supervisor.uid}" data-nome="${supervisor.nome}">${supervisor.nome}</option>`;
      });
    } catch (error) {
      console.error("Erro ao carregar supervisores:", error);
      select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  };

  // Função interna para setar valor dos campos
  const setFieldValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  };

  // Preenchimento dos campos
  await loadSupervisores();
  // (O restante do preenchimento de campos continua aqui)
  setFieldValue("supervisor-nome", data.identificacaoGeral?.supervisorUid);
  setFieldValue("data-supervisao", data.identificacaoGeral?.dataSupervisao);
  setFieldValue(
    "data-inicio-terapia",
    data.identificacaoGeral?.dataInicioTerapia
  );
  setFieldValue("psicologo-nome", data.psicologoNome);
  setFieldValue("psicologo-periodo", data.identificacaoPsicologo?.periodo);
  setFieldValue("abordagem-teorica", data.identificacaoPsicologo?.abordagem);
  setFieldValue("paciente-iniciais", data.identificacaoCaso?.iniciais);
  setFieldValue("paciente-idade", data.identificacaoCaso?.idade);
  setFieldValue("paciente-genero", data.identificacaoCaso?.genero);
  setFieldValue("paciente-sessoes", data.identificacaoCaso?.numSessoes);
  setFieldValue("queixa-demanda", data.identificacaoCaso?.queixa);
  setFieldValue("fase1-data", data.fase1?.data);
  setFieldValue("fase1-foco", data.fase1?.foco);
  setFieldValue("fase1-objetivos", data.fase1?.objetivos);
  setFieldValue("fase1-hipoteses", data.fase1?.hipoteses);
  setFieldValue("fase1-obs-supervisor", data.fase1?.obsSupervisor);
  setFieldValue("fase2-data", data.fase2?.data);
  setFieldValue("fase2-reavaliacao", data.fase2?.reavaliacao);
  setFieldValue("fase2-progresso", data.fase2?.progresso);
  setFieldValue("fase2-obs-supervisor", data.fase2?.obsSupervisor);
  setFieldValue("fase3-data", data.fase3?.data);
  setFieldValue("fase3-avaliacao", data.fase3?.avaliacao);
  setFieldValue("fase3-mudancas", data.fase3?.mudancas);
  setFieldValue("fase3-obs-supervisor", data.fase3?.obsSupervisor);
  setFieldValue("desfecho", data.observacoesFinais?.desfecho);
  setFieldValue("data-desfecho", data.observacoesFinais?.dataDesfecho);
  setFieldValue("obs-finais", data.observacoesFinais?.obsFinais);
  setFieldValue("obs-finais-supervisor", data.observacoesFinais?.obsSupervisor);
  setFieldValue(
    "assinatura-supervisor",
    data.observacoesFinais?.assinaturaSupervisor
  );

  // --- INÍCIO DA CORREÇÃO DE PERMISSÃO ---
  const funcoesUsuario = currentUserData.funcoes || [];
  const isSupervisor =
    funcoesUsuario.includes("supervisor") || funcoesUsuario.includes("admin");

  const form = document.getElementById("form-supervisao");
  if (form) {
    const supervisorFields = form.querySelectorAll(".supervisor-field");
    supervisorFields.forEach((fieldContainer) => {
      const inputElement = fieldContainer.querySelector("input, textarea");
      if (inputElement) {
        // Desabilita o campo se o usuário NÃO for supervisor
        inputElement.disabled = !isSupervisor;
      }
    });
  }
  // --- FIM DA CORREÇÃO DE PERMISSÃO ---

  setupAutoSave(docRef, isSupervisor); // Passa a permissão para a função de salvar
}

/**
 * Configura o salvamento automático para o formulário de edição.
 */
function setupAutoSave(docRef, isSupervisor) {
  const form = document.getElementById("form-supervisao");
  const statusEl = document.getElementById("autosave-status");
  let saveTimeout;

  const getFormData = () => {
    const supervisorSelect = document.getElementById("supervisor-nome");
    const selectedOption =
      supervisorSelect.options[supervisorSelect.selectedIndex];

    // Coleta todos os dados que um usuário comum pode editar
    const dataToSave = {
      lastUpdated: serverTimestamp(),
      identificacaoGeral: {
        supervisorUid: document.getElementById("supervisor-nome").value,
        supervisorNome: selectedOption.dataset.nome || "",
        dataSupervisao: document.getElementById("data-supervisao").value,
        dataInicioTerapia: document.getElementById("data-inicio-terapia").value,
      },
      identificacaoPsicologo: {
        periodo: document.getElementById("psicologo-periodo").value,
        abordagem: document.getElementById("abordagem-teorica").value,
      },
      identificacaoCaso: {
        iniciais: document
          .getElementById("paciente-iniciais")
          .value.toUpperCase(),
        idade: document.getElementById("paciente-idade").value,
        genero: document.getElementById("paciente-genero").value,
        numSessoes: document.getElementById("paciente-sessoes").value,
        queixa: document.getElementById("queixa-demanda").value,
      },
      fase1: {
        data: document.getElementById("fase1-data").value,
        foco: document.getElementById("fase1-foco").value,
        objetivos: document.getElementById("fase1-objetivos").value,
        hipoteses: document.getElementById("fase1-hipoteses").value,
      },
      fase2: {
        data: document.getElementById("fase2-data").value,
        reavaliacao: document.getElementById("fase2-reavaliacao").value,
        progresso: document.getElementById("fase2-progresso").value,
      },
      fase3: {
        data: document.getElementById("fase3-data").value,
        avaliacao: document.getElementById("fase3-avaliacao").value,
        mudancas: document.getElementById("fase3-mudancas").value,
      },
      observacoesFinais: {
        desfecho: document.getElementById("desfecho").value,
        dataDesfecho: document.getElementById("data-desfecho").value,
        obsFinais: document.getElementById("obs-finais").value,
      },
    };

    // --- INÍCIO DA CORREÇÃO DE PERMISSÃO NO SALVAMENTO ---
    // Adiciona os campos de supervisor ao objeto de salvamento APENAS se o usuário for um supervisor
    if (isSupervisor) {
      dataToSave.fase1.obsSupervisor = document.getElementById(
        "fase1-obs-supervisor"
      ).value;
      dataToSave.fase2.obsSupervisor = document.getElementById(
        "fase2-obs-supervisor"
      ).value;
      dataToSave.fase3.obsSupervisor = document.getElementById(
        "fase3-obs-supervisor"
      ).value;
      dataToSave.observacoesFinais.obsSupervisor = document.getElementById(
        "obs-finais-supervisor"
      ).value;
      dataToSave.observacoesFinais.assinaturaSupervisor =
        document.getElementById("assinatura-supervisor").value;
    }
    // --- FIM DA CORREÇÃO DE PERMISSÃO NO SALVAMENTO ---

    return dataToSave;
  };

  const handleFormChange = () => {
    clearTimeout(saveTimeout);
    statusEl.textContent = "Salvando...";
    statusEl.className = "status-saving";

    saveTimeout = setTimeout(async () => {
      const dataToSave = getFormData();
      try {
        await updateDoc(docRef, dataToSave);
        statusEl.textContent = "Salvo!";
        statusEl.className = "status-success";
      } catch (error) {
        console.error("Erro no salvamento automático:", error);
        statusEl.textContent = "Erro ao salvar.";
        statusEl.className = "status-error";
      }
    }, 1500);
  };

  form.addEventListener("input", handleFormChange);
}

/**
 * Popula e aplica os filtros da lista.
 */
function popularFiltroPacientes(fichas) {
  const filtroSelect = document.getElementById("filtro-paciente");
  const iniciais = [
    ...new Set(fichas.map((f) => f.identificacaoCaso?.iniciais)),
  ]
    .filter(Boolean)
    .sort();

  filtroSelect.innerHTML = '<option value="todos">Todos os Pacientes</option>';
  iniciais.forEach((i) => {
    filtroSelect.innerHTML += `<option value="${i}">${i}</option>`;
  });
}

function aplicarFiltro() {
  const valor = document.getElementById("filtro-paciente").value;
  const fichasFiltradas =
    valor === "todos"
      ? todasAsFichas
      : todasAsFichas.filter((f) => f.identificacaoCaso?.iniciais === valor);
  renderizarLista(fichasFiltradas);
}
