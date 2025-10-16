// Arquivo: /modulos/voluntario/js/meus-supervisionados-view.js
// Versão: 2.0 (Atualizado para a sintaxe modular do Firebase v9)

import {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "../../../assets/js/firebase-init.js";

export async function init(user, userData) {
  const listaView = document.getElementById("supervisionados-lista-view");
  const formView = document.getElementById("supervisionados-form-view");
  const listaContainer = document.getElementById("lista-fichas-container");

  if (!listaView || !formView || !listaContainer) {
    console.error("Componentes da aba 'Meus Supervisionados' não encontrados.");
    return;
  }

  function alternarVisao(mostrar) {
    if (mostrar === "lista") {
      listaView.style.display = "block";
      formView.style.display = "none";
      formView.innerHTML = "";
    } else {
      listaView.style.display = "none";
      formView.style.display = "block";
    }
  }

  function renderizarLista(fichas) {
    listaContainer.innerHTML = "";
    if (fichas.length === 0) {
      listaContainer.innerHTML =
        '<p class="no-fichas-message">Nenhuma ficha de supervisão encontrada para você.</p>';
      return;
    }

    fichas.forEach((ficha) => {
      const dataFormatada = ficha.identificacaoGeral?.dataSupervisao
        ? new Date(
            ficha.identificacaoGeral.dataSupervisao + "T03:00:00"
          ).toLocaleDateString("pt-BR")
        : "N/D";

      const itemEl = document.createElement("div");
      itemEl.className = "ficha-item";
      itemEl.innerHTML = `
                <div class="ficha-item-col"><p class="label">Paciente</p><p class="value paciente">${
                  ficha.identificacaoCaso?.iniciais || "N/A"
                }</p></div>
                <div class="ficha-item-col"><p class="label">Psicólogo(a)</p><p class="value">${
                  ficha.psicologoNome || "N/A"
                }</p></div>
                <div class="ficha-item-col"><p class="label">Data da Supervisão</p><p class="value">${dataFormatada}</p></div>
            `;
      itemEl.addEventListener("click", () =>
        abrirFormularioParaEdicao(ficha.id)
      );
      listaContainer.appendChild(itemEl);
    });
  }

  async function abrirFormularioParaEdicao(docId) {
    alternarVisao("form");
    formView.innerHTML = '<div class="loading-spinner"></div>';

    try {
      const response = await fetch("../page/editar-ficha.html");
      if (!response.ok)
        throw new Error("Falha ao carregar o HTML do formulário de edição.");
      formView.innerHTML = await response.text();

      const docRef = doc(db, "fichas-supervisao-casos", docId); // v9
      const docSnap = await getDoc(docRef); // v9
      if (!docSnap.exists())
        throw new Error("Documento da ficha não encontrado.");
      const data = docSnap.data();

      const setFieldValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || "";
      };

      const loadSupervisores = async () => {
        const select = document.getElementById("supervisor-nome");
        if (!select) return;
        try {
          const q = query(
            collection(db, "usuarios"),
            where("funcoes", "array-contains", "supervisor")
          ); // v9
          const supervisoresSnapshot = await getDocs(q); // v9
          select.innerHTML = '<option value="">Selecione...</option>';
          supervisoresSnapshot.forEach((doc) => {
            const supervisor = doc.data();
            select.innerHTML += `<option value="${doc.id}" data-nome="${supervisor.nome}">${supervisor.nome}</option>`;
          });
        } catch (error) {
          console.error("Erro ao carregar supervisores:", error);
        }
      };
      await loadSupervisores();

      // Preenche todos os campos
      setFieldValue("supervisor-nome", data.identificacaoGeral?.supervisorUid);
      setFieldValue("data-supervisao", data.identificacaoGeral?.dataSupervisao);
      setFieldValue(
        "data-inicio-terapia",
        data.identificacaoGeral?.dataInicioTerapia
      );
      setFieldValue("psicologo-nome", data.psicologoNome);
      setFieldValue("psicologo-periodo", data.identificacaoPsicologo?.periodo);
      setFieldValue(
        "abordagem-teorica",
        data.identificacaoPsicologo?.abordagem
      );
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
      setFieldValue(
        "obs-finais-supervisor",
        data.observacoesFinais?.obsSupervisor
      );
      setFieldValue(
        "assinatura-supervisor",
        data.observacoesFinais?.assinaturaSupervisor
      );

      // Trava/Destrava campos
      const camposEditaveisSupervisor = [
        "fase1-obs-supervisor",
        "fase2-obs-supervisor",
        "fase3-obs-supervisor",
        "obs-finais-supervisor",
        "assinatura-supervisor",
      ];
      const form = formView.querySelector("#form-supervisao");
      form.querySelectorAll("input, textarea, select").forEach((el) => {
        el.disabled = !camposEditaveisSupervisor.includes(el.id);
      });

      const backButton = formView.querySelector("#btn-voltar-para-lista");
      if (backButton) {
        backButton.addEventListener("click", (e) => {
          e.preventDefault();
          alternarVisao("lista");
          carregarFichas();
        });
      }
      setupAutoSave(docRef);
    } catch (error) {
      console.error("Erro ao abrir formulário para edição:", error);
      formView.innerHTML = `<p class="alert alert-error">Não foi possível carregar o formulário de edição.</p><button id="btn-voltar" class="action-button">Voltar</button>`;
      formView
        .querySelector("#btn-voltar")
        .addEventListener("click", () => alternarVisao("lista"));
    }
  }

  function setupAutoSave(docRef) {
    const form = formView.querySelector("#form-supervisao");
    const statusEl = formView.querySelector("#autosave-status");
    if (!form || !statusEl) return;

    let saveTimeout;
    const handleFormChange = (e) => {
      const camposEditaveis = [
        "fase1-obs-supervisor",
        "fase2-obs-supervisor",
        "fase3-obs-supervisor",
        "obs-finais-supervisor",
        "assinatura-supervisor",
      ];
      if (camposEditaveis.includes(e.target.id)) {
        clearTimeout(saveTimeout);
        statusEl.textContent = "Salvando...";
        statusEl.className = "status-saving";

        saveTimeout = setTimeout(async () => {
          const dataToSave = {
            "fase1.obsSupervisor": document.getElementById(
              "fase1-obs-supervisor"
            ).value,
            "fase2.obsSupervisor": document.getElementById(
              "fase2-obs-supervisor"
            ).value,
            "fase3.obsSupervisor": document.getElementById(
              "fase3-obs-supervisor"
            ).value,
            "observacoesFinais.obsSupervisor": document.getElementById(
              "obs-finais-supervisor"
            ).value,
            "observacoesFinais.assinaturaSupervisor": document.getElementById(
              "assinatura-supervisor"
            ).value,
            lastUpdated: serverTimestamp(), // v9
          };

          try {
            await updateDoc(docRef, dataToSave); // v9
            statusEl.textContent = "Salvo!";
            statusEl.className = "status-success";
          } catch (error) {
            console.error("Erro no salvamento automático:", error);
            statusEl.textContent = "Erro ao salvar.";
            statusEl.className = "status-error";
          }
        }, 1500);
      }
    };
    form.addEventListener("input", handleFormChange);
  }

  async function carregarFichas() {
    listaContainer.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const q = query(
        collection(db, "fichas-supervisao-casos"),
        where("identificacaoGeral.supervisorUid", "==", user.uid)
      ); // v9
      const querySnapshot = await getDocs(q); // v9
      const fichas = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      fichas.sort(
        (a, b) => (b.criadoEm?.toDate() || 0) - (a.criadoEm?.toDate() || 0)
      );
      renderizarLista(fichas);
    } catch (error) {
      console.error("Erro ao carregar fichas dos supervisionados:", error);
      listaContainer.innerHTML =
        '<p class="alert alert-error">Ocorreu um erro ao buscar as fichas.</p>';
    }
  }

  carregarFichas();
}
