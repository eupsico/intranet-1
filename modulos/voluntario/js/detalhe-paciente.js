// Arquivo: /modulos/voluntario/js/detalhe-paciente.js
// Responsável pela lógica da página de detalhes do paciente.
// *** CORREÇÃO: Ajustada a função init para receber pacienteId como argumento ***

import {
    db,
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy, // Para ordenar sessões
    addDoc,
    serverTimestamp,
    Timestamp,
    // functions, // Removido, pois httpsCallable não é mais usado diretamente aqui
    // httpsCallable, // Removido
} from "../../../assets/js/firebase-init.js"; // Caminho já estava correto

// --- Variáveis Globais do Módulo ---
let pacienteIdGlobal = null;
let pacienteDataGlobal = null;
let userDataGlobal = null; // Informações do usuário logado
let systemConfigsGlobal = null; // Configurações do sistema (textos, listas)
let salasPresenciaisGlobal = []; // Lista de salas
let dadosDaGradeGlobal = {}; // Dados da grade geral

// --- Inicialização da Página ---
// *** CORREÇÃO: Adicionado 'pacienteId' como terceiro argumento ***
export async function init(user, userData, pacienteId) {
    console.log("Inicializando detalhe-paciente.js");
    userDataGlobal = userData; // Armazena dados do usuário logado

    // *** CORREÇÃO: Usar o 'pacienteId' recebido como argumento ***
    pacienteIdGlobal = pacienteId;

    if (!pacienteIdGlobal) {
        console.error("ID do paciente não foi passado para a função init.");
        // Tenta pegar da URL como fallback, mas idealmente não deveria precisar
        const urlParams = new URLSearchParams(window.location.search);
        pacienteIdGlobal = urlParams.get('id');
        if (!pacienteIdGlobal) {
           document.getElementById('detalhe-paciente-view').innerHTML = '<p class="alert alert-error">Erro: ID do paciente não fornecido.</p>';
           return;
        }
         console.warn("ID do paciente obtido da URL como fallback:", pacienteIdGlobal);
    }

    try {
        // Carregar dados essenciais em paralelo
        await Promise.all([
            carregarDadosPaciente(pacienteIdGlobal),
            carregarSystemConfigs() // Carrega configs e salas
            // loadGradeData() // Carrega a grade (se necessário aqui, ou passar do userData)
        ]);

        if (!pacienteDataGlobal) {
             throw new Error("Paciente não encontrado no banco de dados.");
        }

        // Popular a interface
        renderizarCabecalhoInfoBar();
        preencherFormularios();
        await carregarSessoes(); // Carrega e renderiza a lista de sessões

        // Adicionar Event Listeners
        adicionarEventListenersGerais();
        adicionarEventListenersModais(); // Listeners específicos dos modais

    } catch (error) {
        console.error("Erro ao inicializar página de detalhes do paciente:", error);
        document.getElementById('detalhe-paciente-view').innerHTML = `<p class="alert alert-error">Erro ao carregar dados do paciente: ${error.message}</p>`;
    }
}

// --- Funções de Carregamento de Dados ---

async function carregarDadosPaciente(pacienteId) {
    try {
        const docRef = doc(db, "trilhaPaciente", pacienteId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            pacienteDataGlobal = { id: docSnap.id, ...docSnap.data() };
            console.log("Dados do paciente carregados:", pacienteDataGlobal);
        } else {
            console.warn(`Paciente com ID ${pacienteId} não encontrado.`);
            pacienteDataGlobal = null;
        }
    } catch (error) {
        console.error("Erro ao buscar dados do paciente:", error);
        pacienteDataGlobal = null;
        throw error; // Propaga o erro para o init tratar
    }
}

async function carregarSystemConfigs() {
    if (systemConfigsGlobal) return;
    try {
        const configRef = doc(db, "configuracoesSistema", "geral");
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
            systemConfigsGlobal = docSnap.data();
            salasPresenciaisGlobal = systemConfigsGlobal.listas?.salasPresenciais || [];
            console.log("Configurações do sistema carregadas:", systemConfigsGlobal);
        } else {
            console.warn("Documento de configurações do sistema não encontrado.");
            systemConfigsGlobal = { textos: {}, listas: {} };
            salasPresenciaisGlobal = [];
        }
         // Carregar dados da grade aqui também, se fizer sentido
        await loadGradeData();

    } catch (error) {
        console.error("Erro ao carregar configurações do sistema:", error);
        systemConfigsGlobal = { textos: {}, listas: {} };
        salasPresenciaisGlobal = [];
    }
}

async function loadGradeData() { // Função para carregar a grade
  try {
    const gradeRef = doc(db, "administrativo", "grades");
    const gradeSnap = await getDoc(gradeRef);
    if (gradeSnap.exists()) {
      dadosDaGradeGlobal = gradeSnap.data();
      console.log("Dados da grade carregados.");
    } else {
         console.warn("Documento da grade não encontrado.");
         dadosDaGradeGlobal = {};
    }
  } catch (error) {
    console.error("Erro ao carregar dados da grade:", error);
     dadosDaGradeGlobal = {};
  }
}

async function carregarSessoes() {
    const container = document.getElementById("session-list-container");
    const loading = document.getElementById("session-list-loading");
    const placeholder = document.getElementById("session-list-placeholder");

    loading.style.display = 'block';
    placeholder.style.display = 'none';
    container.querySelectorAll('.session-item').forEach(item => item.remove()); // Limpa lista antiga

    try {
        // --- DEFINIR A QUERY CORRETA PARA BUSCAR SESSÕES ---
        // Exemplo: Buscar da subcoleção 'sessoes' dentro do documento do paciente
        const sessoesRef = collection(db, "trilhaPaciente", pacienteIdGlobal, "sessoes");
        // Ordenar da mais recente para a mais antiga (ajustar campo 'dataHora' se necessário)
        const q = query(sessoesRef, orderBy("dataHora", "desc"));
        const querySnapshot = await getDocs(q);

        const sessoes = [];
        querySnapshot.forEach((doc) => {
            sessoes.push({ id: doc.id, ...doc.data() });
        });

        console.log("Sessões carregadas:", sessoes);

        if (sessoes.length === 0) {
            placeholder.style.display = 'block';
        } else {
            renderizarSessoes(sessoes);
        }

    } catch (error) {
        console.error("Erro ao carregar sessões:", error);
        container.innerHTML = `<p class="alert alert-error">Erro ao carregar sessões: ${error.message}</p>`;
         placeholder.style.display = 'none'; // Esconde placeholder se deu erro
    } finally {
        loading.style.display = 'none';
    }
}

// --- Funções de Renderização ---

function renderizarCabecalhoInfoBar() {
    if (!pacienteDataGlobal) return;

    document.getElementById('paciente-nome-header').textContent = pacienteDataGlobal.nomeCompleto || "Nome não encontrado";

    const infoBar = document.getElementById('paciente-info-bar-container');
    const status = pacienteDataGlobal.status || 'desconhecido';
    const idade = calcularIdade(pacienteDataGlobal.dataNascimento); // Requer a função calcularIdade
    const telefone = pacienteDataGlobal.telefoneCelular || 'Não informado';
    // Ajustar dataEncaminhamento para pegar a data correta (plantao OU PB)
     const dataEncaminhamentoRaw = pacienteDataGlobal.plantaoInfo?.dataEncaminhamento || pacienteDataGlobal.atendimentosPB?.[0]?.dataEncaminhamento; // Simplificado, pode precisar de mais lógica
     const dataEncaminhamento = dataEncaminhamentoRaw
       ? new Date(dataEncaminhamentoRaw + 'T03:00:00').toLocaleDateString('pt-BR')
       : 'N/A';
    const pendencias = 'Verificar'; // Placeholder - Adicionar lógica para buscar pendências

    // Usar textContent para segurança
    infoBar.querySelector('#info-status').textContent = formatarStatus(status); // Função auxiliar para formatar
    infoBar.querySelector('#info-idade').textContent = idade;
    infoBar.querySelector('#info-telefone').textContent = telefone;
    infoBar.querySelector('#info-data-encaminhamento').textContent = dataEncaminhamento;
    infoBar.querySelector('#info-pendencias').textContent = pendencias;

     // Adicionar classe ao status badge se necessário
    const statusBadge = infoBar.querySelector('#info-status');
    statusBadge.className = `value status-badge ${status}`; // Adiciona classe CSS baseada no status
}

function preencherFormularios() {
     if (!pacienteDataGlobal) return;

     // Informações Pessoais
     document.getElementById('dp-nome-completo').value = pacienteDataGlobal.nomeCompleto || '';
     document.getElementById('dp-telefone').value = pacienteDataGlobal.telefoneCelular || '';
     document.getElementById('dp-data-nascimento').value = pacienteDataGlobal.dataNascimento || '';
     document.getElementById('dp-cpf').value = pacienteDataGlobal.cpf || '';
     document.getElementById('dp-responsavel-nome').value = pacienteDataGlobal.responsavel?.nome || '';
     document.getElementById('dp-contato-emergencia-nome').value = pacienteDataGlobal.contatoEmergencia?.nome || '';
     document.getElementById('dp-contato-emergencia-telefone').value = pacienteDataGlobal.contatoEmergencia?.telefone || '';

     // Informações Financeiras
     document.getElementById('dp-valor-contribuicao').value = pacienteDataGlobal.valorContribuicao || '';

     // Acompanhamento Clínico (Carregar do local apropriado, ex: subcoleção ou campo no pacienteDataGlobal)
     // Exemplo: Se estiver num campo 'acompanhamentoClinico'
     const acompanhamento = pacienteDataGlobal.acompanhamentoClinico || {};
     document.getElementById('ac-avaliacao-demanda').value = acompanhamento.avaliacaoDemanda || '';
     document.getElementById('ac-definicao-objetivos').value = acompanhamento.definicaoObjetivos || '';
     document.getElementById('ac-diagnostico').value = acompanhamento.diagnostico || '';
     document.getElementById('ac-registro-encerramento').value = acompanhamento.registroEncerramento || '';
}

function renderizarSessoes(sessoes) {
    const container = document.getElementById("session-list-container");
    container.querySelectorAll('.session-item').forEach(item => item.remove()); // Limpa lista antiga

    sessoes.forEach(sessao => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'session-item';
        itemDiv.dataset.sessaoId = sessao.id;

        const dataHora = sessao.dataHora?.toDate ? sessao.dataHora.toDate() : null; // Converter Timestamp
        const dataFormatada = dataHora ? dataHora.toLocaleDateString('pt-BR') : 'Data Indefinida';
        const horaFormatada = dataHora ? dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
        const statusSessao = sessao.status || 'pendente'; // Ex: 'pendente', 'presente', 'ausente'

        let statusTexto = 'Pendente';
        let statusClasse = 'status-pendente';
        if (statusSessao === 'presente') {
            statusTexto = 'Realizada (Presente)';
            statusClasse = 'status-realizada status-presenca';
            itemDiv.classList.add('status-realizada');
        } else if (statusSessao === 'ausente') {
             statusTexto = 'Realizada (Ausente)';
             statusClasse = 'status-realizada status-ausente';
             itemDiv.classList.add('status-realizada');
        } else {
             itemDiv.classList.add('status-pendente');
        }

        itemDiv.innerHTML = `
            <div class="session-info">
                <div class="info-item">
                    <span class="label">Data</span>
                    <span class="value">${dataFormatada}</span>
                </div>
                <div class="info-item">
                    <span class="label">Horário</span>
                    <span class="value">${horaFormatada}</span>
                </div>
                 <div class="info-item">
                    <span class="label">Status</span>
                    <span class="value status ${statusClasse}">${statusTexto}</span>
                </div>
            </div>
            <div class="session-actions">
                ${statusSessao === 'pendente' ? `
                    <button type="button" class="btn-presenca" data-action="presente">Presente</button>
                    <button type="button" class="btn-ausencia" data-action="ausente">Ausente</button>
                ` : ''}
                <button type="button" class="action-button secondary-button btn-anotacoes" data-action="anotacoes">
                    ${sessao.anotacoes ? 'Ver/Editar' : 'Adicionar'} Anotações
                </button>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}


// --- Manipuladores de Eventos Gerais ---

function adicionarEventListenersGerais() {
    // Abas
    const tabLinks = document.querySelectorAll('.tab-link');
    tabLinks.forEach(link => {
        link.addEventListener('click', handleTabClick);
    });

    // Forms Editáveis
    document.getElementById('form-info-pessoais')?.addEventListener('submit', handleSalvarInfoPessoais);
    document.getElementById('form-info-financeiras')?.addEventListener('submit', handleSalvarInfoFinanceiras);
    document.getElementById('acompanhamento-clinico-form')?.addEventListener('submit', handleSalvarAcompanhamento);

     // Ações da Lista de Sessões (usando delegação de eventos)
     const sessionListContainer = document.getElementById('session-list-container');
     if (sessionListContainer) {
         sessionListContainer.addEventListener('click', (event) => {
             const button = event.target.closest('button');
             if (!button) return;

             const sessaoItem = button.closest('.session-item');
             const sessaoId = sessaoItem?.dataset.sessaoId;
             const action = button.dataset.action;

             if (!sessaoId) return;

             if (action === 'presente' || action === 'ausente') {
                 handlePresencaAusenciaClick(sessaoId, action, button);
             } else if (action === 'anotacoes') {
                 handleAbrirAnotacoes(sessaoId);
             }
         });
     }

     // Gerar Prontuário PDF
     document.getElementById('btn-gerar-prontuario-pdf')?.addEventListener('click', handleGerarProntuarioPDF);
}

function handleTabClick(event) {
    const clickedTab = event.target;
    const targetTabId = clickedTab.dataset.tab;

    // Remove 'active' das outras abas e conteúdos
    document.querySelectorAll('.tab-link.active').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content.active').forEach(content => content.classList.remove('active'));

    // Adiciona 'active' à aba clicada e ao conteúdo correspondente
    clickedTab.classList.add('active');
    document.getElementById(targetTabId)?.classList.add('active');
}

async function handleSalvarInfoPessoais(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

    try {
        const dataToUpdate = {
            telefoneCelular: form.querySelector('#dp-telefone').value,
            dataNascimento: form.querySelector('#dp-data-nascimento').value,
            // CPF e Nome não são editáveis aqui
            'responsavel.nome': form.querySelector('#dp-responsavel-nome').value,
            'contatoEmergencia.nome': form.querySelector('#dp-contato-emergencia-nome').value,
            'contatoEmergencia.telefone': form.querySelector('#dp-contato-emergencia-telefone').value,
            lastUpdate: serverTimestamp()
        };

        const docRef = doc(db, "trilhaPaciente", pacienteIdGlobal);
        await updateDoc(docRef, dataToUpdate);
        alert("Informações pessoais atualizadas com sucesso!");
        // Opcional: Recarregar dados ou apenas atualizar a UI localmente
        await carregarDadosPaciente(pacienteIdGlobal); // Recarrega
        renderizarCabecalhoInfoBar(); // Re-renderiza info bar

    } catch (error) {
        console.error("Erro ao salvar informações pessoais:", error);
        alert(`Erro ao salvar: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Alterações Pessoais';
    }
}

async function handleSalvarInfoFinanceiras(event) {
     event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

    try {
        const novoValor = form.querySelector('#dp-valor-contribuicao').value;
        const valorNumerico = parseFloat(novoValor.replace(',', '.')); // Tenta converter com vírgula

        if (isNaN(valorNumerico) || valorNumerico < 0) {
             throw new Error("Valor da contribuição inválido. Use números e, opcionalmente, vírgula ou ponto para centavos.");
        }

        const dataToUpdate = {
            valorContribuicao: valorNumerico, // Salva como número
            lastUpdate: serverTimestamp()
            // Adicionar lógica de histórico de contribuição se necessário
        };

        const docRef = doc(db, "trilhaPaciente", pacienteIdGlobal);
        await updateDoc(docRef, dataToUpdate);
        alert("Informação financeira atualizada com sucesso!");
        pacienteDataGlobal.valorContribuicao = valorNumerico; // Atualiza localmente

    } catch (error) {
        console.error("Erro ao salvar informação financeira:", error);
        alert(`Erro ao salvar: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Contribuição';
    }
}

async function handleSalvarAcompanhamento(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

    try {
        const dataToUpdate = {
            'acompanhamentoClinico.avaliacaoDemanda': form.querySelector('#ac-avaliacao-demanda').value,
            'acompanhamentoClinico.definicaoObjetivos': form.querySelector('#ac-definicao-objetivos').value,
            'acompanhamentoClinico.diagnostico': form.querySelector('#ac-diagnostico').value,
            'acompanhamentoClinico.registroEncerramento': form.querySelector('#ac-registro-encerramento').value,
             lastUpdate: serverTimestamp()
        };

        // Usa notação de ponto para atualizar campos aninhados
        const docRef = doc(db, "trilhaPaciente", pacienteIdGlobal);
        await updateDoc(docRef, dataToUpdate);
        alert("Acompanhamento clínico atualizado com sucesso!");
         // Atualiza dados locais (opcional)
        if (!pacienteDataGlobal.acompanhamentoClinico) pacienteDataGlobal.acompanhamentoClinico = {};
        pacienteDataGlobal.acompanhamentoClinico.avaliacaoDemanda = dataToUpdate['acompanhamentoClinico.avaliacaoDemanda'];
        pacienteDataGlobal.acompanhamentoClinico.definicaoObjetivos = dataToUpdate['acompanhamentoClinico.definicaoObjetivos'];
        pacienteDataGlobal.acompanhamentoClinico.diagnostico = dataToUpdate['acompanhamentoClinico.diagnostico'];
        pacienteDataGlobal.acompanhamentoClinico.registroEncerramento = dataToUpdate['acompanhamentoClinico.registroEncerramento'];


    } catch (error) {
        console.error("Erro ao salvar acompanhamento clínico:", error);
        alert(`Erro ao salvar: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Acompanhamento Clínico';
    }
}

async function handlePresencaAusenciaClick(sessaoId, novoStatus, button) {
    const actionButtons = button.parentElement.querySelectorAll('button');
    actionButtons.forEach(btn => btn.disabled = true); // Desabilita botões da linha

    try {
        const sessaoRef = doc(db, "trilhaPaciente", pacienteIdGlobal, "sessoes", sessaoId);
        await updateDoc(sessaoRef, {
            status: novoStatus, // 'presente' ou 'ausente'
            statusAtualizadoEm: serverTimestamp(),
            statusAtualizadoPor: { // Opcional: guardar quem atualizou
                id: userDataGlobal.uid,
                nome: userDataGlobal.nome
            }
        });
        console.log(`Status da sessão ${sessaoId} atualizado para ${novoStatus}`);
        // Recarregar a lista de sessões para refletir a mudança
        await carregarSessoes();

    } catch (error) {
        console.error(`Erro ao atualizar status da sessão ${sessaoId}:`, error);
        alert(`Erro ao marcar ${novoStatus}: ${error.message}`);
        actionButtons.forEach(btn => btn.disabled = false); // Reabilita em caso de erro
    }
    // Não precisa reabilitar se der sucesso, pois a lista será recarregada
}

async function handleAbrirAnotacoes(sessaoId) {
    const modal = document.getElementById('anotacoes-sessao-modal');
    const form = document.getElementById('anotacoes-sessao-form');
    form.reset();
    form.querySelector('#anotacoes-sessao-id').value = sessaoId;

    // Mostrar loading enquanto busca dados
    const fields = ['#anotacoes-ficha-evolucao', '#anotacoes-campo-compartilhado-prof', '#anotacoes-campo-compartilhado-admin'];
    fields.forEach(sel => form.querySelector(sel).disabled = true);
     form.querySelector('#btn-salvar-anotacoes').disabled = true;


    modal.style.display = 'flex';

    try {
        const sessaoRef = doc(db, "trilhaPaciente", pacienteIdGlobal, "sessoes", sessaoId);
        const sessaoSnap = await getDoc(sessaoRef);

        if (sessaoSnap.exists()) {
            const data = sessaoSnap.data();
            const anotacoes = data.anotacoes || {}; // Assume que as anotações estão em um subcampo
            form.querySelector('#anotacoes-ficha-evolucao').value = anotacoes.fichaEvolucao || '';
            form.querySelector('#anotacoes-campo-compartilhado-prof').value = anotacoes.compartilhadoProf || '';
            form.querySelector('#anotacoes-campo-compartilhado-admin').value = anotacoes.compartilhadoAdmin || '';
        } else {
            console.warn(`Sessão ${sessaoId} não encontrada para carregar anotações.`);
            // Deixa os campos vazios
        }
    } catch (error) {
        console.error(`Erro ao carregar anotações da sessão ${sessaoId}:`, error);
        alert("Erro ao carregar anotações existentes.");
        // Manter campos desabilitados ou fechar modal? Por ora, manter desabilitado.
        return; // Impede habilitação
    } finally {
         // Habilitar campos após carregar (ou falhar)
         fields.forEach(sel => form.querySelector(sel).disabled = false);
         form.querySelector('#btn-salvar-anotacoes').disabled = false;
    }
}

async function handleSalvarAnotacoes(event) {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('#btn-salvar-anotacoes');
    const sessaoId = form.querySelector('#anotacoes-sessao-id').value;
    const modal = document.getElementById('anotacoes-sessao-modal');

    if (!sessaoId) {
        alert("Erro: ID da sessão não encontrado.");
        return;
    }

    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

    try {
        const anotacoesData = {
            fichaEvolucao: form.querySelector('#anotacoes-ficha-evolucao').value,
            compartilhadoProf: form.querySelector('#anotacoes-campo-compartilhado-prof').value,
            compartilhadoAdmin: form.querySelector('#anotacoes-campo-compartilhado-admin').value,
        };

        const sessaoRef = doc(db, "trilhaPaciente", pacienteIdGlobal, "sessoes", sessaoId);
        await updateDoc(sessaoRef, {
            anotacoes: anotacoesData,
            anotacoesAtualizadasEm: serverTimestamp(),
             anotacoesAtualizadasPor: { // Opcional
                 id: userDataGlobal.uid,
                 nome: userDataGlobal.nome
             }
        });

        alert("Anotações salvas com sucesso!");
        modal.style.display = 'none';
        // Atualizar o botão na lista de sessões para "Ver/Editar Anotações" se necessário
        const sessaoItem = document.querySelector(`.session-item[data-sessao-id="${sessaoId}"]`);
        sessaoItem?.querySelector('.btn-anotacoes')?.textContent = 'Ver/Editar Anotações';


    } catch (error) {
        console.error(`Erro ao salvar anotações da sessão ${sessaoId}:`, error);
        alert(`Erro ao salvar anotações: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Anotações';
    }
}

function handleGerarProntuarioPDF() {
    console.log("Iniciando geração do PDF do prontuário...");
    const form = document.getElementById('form-gerar-prontuario');
    const selectedItems = Array.from(form.querySelectorAll('input[name="prontuario-item"]:checked')).map(cb => cb.value);

    if (selectedItems.length === 0) {
        alert("Selecione pelo menos um item para incluir no prontuário.");
        return;
    }

    alert(`Itens selecionados para o PDF: ${selectedItems.join(', ')}\n\n(Lógica de geração do PDF ainda não implementada)`);

    // --- LÓGICA DE GERAÇÃO DO PDF ---
    // 1. Coletar todos os dados necessários do pacienteDataGlobal, sessões, etc.
    // 2. Filtrar os dados com base nos 'selectedItems'.
    // 3. Usar uma biblioteca como jsPDF ou pdf-lib (client-side)
    //    OU chamar uma Cloud Function para gerar o PDF (server-side).
    // 4. Oferecer o PDF para download.
    // Exemplo (muito simplificado) com jsPDF:
    /*
    if (typeof jsPDF !== 'undefined') {
        const doc = new jsPDF();
        doc.text(`Prontuário de ${pacienteDataGlobal.nomeCompleto}`, 10, 10);
        // Adicionar conteúdo baseado em selectedItems...
        doc.save(`prontuario_${pacienteIdGlobal}.pdf`);
    } else {
        alert("Biblioteca jsPDF não carregada. Geração de PDF no cliente não disponível.");
    }
    */
}


// --- Funções Auxiliares ---

function calcularIdade(dataNascimento) {
    if (!dataNascimento || typeof dataNascimento !== 'string' || dataNascimento.trim() === '') {
        return "N/A";
    }
    try {
        const nasc = new Date(dataNascimento + 'T00:00:00');
        if (isNaN(nasc.getTime())) { return "N/A"; }
        const hoje = new Date();
        let idade = hoje.getFullYear() - nasc.getFullYear();
        const m = hoje.getMonth() - nasc.getMonth();
        if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
            idade--;
        }
        return idade >= 0 ? `${idade} anos` : "N/A";
    } catch (e) {
        console.warn("Erro ao calcular idade:", e);
        return "N/A";
    }
}

function formatarStatus(status) {
    // Mapeamento simples de status para texto legível
    const mapa = {
        em_atendimento_plantao: "Em Atendimento (Plantão)",
        aguardando_info_horarios: "Aguardando Horários (PB)",
        cadastrar_horario_psicomanager: "Horários Informados (PB)",
        em_atendimento_pb: "Em Atendimento (PB)",
        alta: "Alta",
        desistencia: "Desistência",
        encaminhado_grupo: "Encaminhado p/ Grupo",
        encaminhado_parceiro: "Encaminhado p/ Parceiro",
        // Adicionar outros status conforme necessário
         encaminhar_para_pb: "Encaminhado para PB",
         reavaliar_encaminhamento: "Reavaliar Encaminhamento",
    };
    return mapa[status] || status.replace(/_/g, " ") || "Desconhecido";
}

// --- LÓGICA DOS MODAIS (Adaptada de modals.js) ---

function adicionarEventListenersModais() {
     // Listener global para fechar modais pelo botão Cancelar/Fechar ou clique fora
     document.body.addEventListener("click", function (e) {
         // Botão Cancelar ou Fechar (X)
         if (
           e.target.matches(".modal-cancel-btn") ||
           e.target.closest(".modal-cancel-btn") ||
           e.target.matches(".close-button") || // Adiciona listener para spans com classe close-button
           e.target.closest(".close-button")
         ) {
           const modalAberto = e.target.closest(".modal-overlay, .modal");
           if (modalAberto) {
             modalAberto.style.display = "none";
           }
         }
          // Clique fora do modal-content
         if (e.target.matches(".modal-overlay")) {
              e.target.style.display = "none";
         }
     });

    // Submits dos Modais
    document.getElementById('btn-confirmar-solicitacao')?.addEventListener('click', handleSolicitarSessoesSubmit);
    document.getElementById('btn-gerar-enviar-whatsapp')?.addEventListener('click', handleMensagemSubmit);
    document.getElementById('btn-confirmar-alteracao-horario')?.addEventListener('click', handleAlterarHorarioSubmit);
    document.getElementById('btn-confirmar-reavaliacao')?.addEventListener('click', handleReavaliacaoSubmit);
    // Submit do encerramento (ligado ao form)
    document.getElementById('encerramento-form')?.addEventListener('submit', (e) => handleEncerramentoSubmit(e, userDataGlobal.uid, userDataGlobal)); // Passa user e userData
    // Submit do horarios-pb (ligado ao form)
    document.getElementById('horarios-pb-form')?.addEventListener('submit', (e) => handleHorariosPbSubmit(e, userDataGlobal.uid, userDataGlobal)); // Passa user e userData
     // Submit das anotações (ligado ao form)
    document.getElementById('anotacoes-sessao-form')?.addEventListener('submit', handleSalvarAnotacoes);
    // Submit do desfecho é adicionado dinamicamente em abrirModalDesfechoPb

    // -- Adicionar AQUI os event listeners para ABRIR os modais ---
     // Adicionar listeners aos botões PRINCIPAIS da página que ABREM os modais
     document.getElementById('btn-abrir-modal-mensagem')?.addEventListener('click', abrirModalMensagens);
     document.getElementById('btn-abrir-modal-solicitar-sessoes')?.addEventListener('click', abrirModalSolicitarSessoes);
     document.getElementById('btn-abrir-modal-alterar-horario')?.addEventListener('click', abrirModalAlterarHorario);
     document.getElementById('btn-abrir-modal-reavaliacao')?.addEventListener('click', abrirModalReavaliacao);
     document.getElementById('btn-abrir-modal-desfecho-pb')?.addEventListener('click', abrirModalDesfechoPb);
     document.getElementById('btn-abrir-modal-encerramento-plantao')?.addEventListener('click', abrirModalEncerramento);
     document.getElementById('btn-abrir-modal-horarios-pb')?.addEventListener('click', abrirModalHorariosPb); // Para aguardando_info_horarios


}

// Colar AQUI as funções adaptadas de modals.js:
// - abrirModalMensagens, preencherFormularioMensagem, atualizarPreviewMensagem, handleMensagemSubmit
// - abrirModalSolicitarSessoes, handleSolicitarSessoesSubmit, validarHorarioNaGrade
// - abrirModalAlterarHorario, handleAlterarHorarioSubmit
// - abrirModalReavaliacao, renderizarDatasDisponiveis, carregarHorariosReavaliacao, handleReavaliacaoSubmit
// - abrirModalDesfechoPb, handleDesfechoPbSubmit (ajustar dependências)
// - abrirModalEncerramento, handleEncerramentoSubmit (já adaptados)
// - abrirModalHorariosPb, construirFormularioHorarios, handleHorariosPbSubmit (já adaptados)

// --- Lógica do Modal de Mensagens (Adaptada) ---
let dadosParaMensagemGlobal = {}; // Usar uma variável global separada para mensagens
let templateOriginalGlobal = "";

function abrirModalMensagens(/* Não precisa de params, usa globais */) {
    if (!pacienteDataGlobal || !userDataGlobal || !systemConfigsGlobal) {
        alert("Dados necessários para abrir o modal de mensagens não estão carregados.");
        return;
    }
     // Pega o atendimento ativo (exemplo, ajustar se necessário)
     // Prioriza PB ativo, depois plantão ativo
     const atendimentoAtivo = pacienteDataGlobal.atendimentosPB?.find(at => at.statusAtendimento === 'ativo') ||
                              (pacienteDataGlobal.status === 'em_atendimento_plantao' ? pacienteDataGlobal.plantaoInfo : null);


    const modal = document.getElementById("enviar-mensagem-modal");
    const nomePacienteSpan = document.getElementById("mensagem-paciente-nome-selecao");
    const listaModelos = document.getElementById("lista-modelos-mensagem");
    const selecaoView = document.getElementById("mensagem-selecao-view");
    const formularioView = document.getElementById("mensagem-formulario-view");
    const btnWhatsapp = modal.querySelector("#btn-gerar-enviar-whatsapp");

     // Armazena dados específicos para esta função
    dadosParaMensagemGlobal = {
        paciente: pacienteDataGlobal,
        atendimento: atendimentoAtivo, // Passa o atendimento encontrado
        systemConfigs: systemConfigsGlobal,
        userData: userDataGlobal
    };

    nomePacienteSpan.textContent = pacienteDataGlobal.nomeCompleto;
    listaModelos.innerHTML = "";
    selecaoView.style.display = "block";
    formularioView.style.display = "none";
    if (btnWhatsapp) btnWhatsapp.style.display = "none";

    const templates = systemConfigsGlobal?.textos || {};
    if (Object.keys(templates).length === 0) {
        listaModelos.innerHTML = "<p>Nenhum modelo de mensagem configurado.</p>";
    } else {
        for (const key in templates) {
            const title = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
            const btn = document.createElement("button");
            btn.className = "action-button secondary-button"; // Usar classes do design system
            btn.textContent = title;
            btn.onclick = () => preencherFormularioMensagem(key, title);
            listaModelos.appendChild(btn);
        }
    }
    modal.style.display = "flex";

    document.getElementById("btn-voltar-selecao").onclick = () => {
        selecaoView.style.display = "block";
        formularioView.style.display = "none";
        if (btnWhatsapp) btnWhatsapp.style.display = "none";
    };
}

function preencherFormularioMensagem(templateKey, templateTitle) {
    const { systemConfigs, userData } = dadosParaMensagemGlobal; // Usa dados globais da mensagem

    const selecaoView = document.getElementById("mensagem-selecao-view");
    const formularioView = document.getElementById("mensagem-formulario-view");
    const formTitle = document.getElementById("mensagem-form-title");
    const formContainer = document.getElementById("mensagem-dynamic-form-container");
    const modal = document.getElementById("enviar-mensagem-modal");
    const btnWhatsapp = modal.querySelector("#btn-gerar-enviar-whatsapp");

    formTitle.textContent = templateTitle;
    formContainer.innerHTML = "";
    templateOriginalGlobal = systemConfigs.textos[templateKey] || ""; // Usa var global

    const variaveis = templateOriginalGlobal.match(/{[a-zA-Z0-9_]+}/g) || [];
    const variaveisUnicas = [...new Set(variaveis)];
    const variaveisFixas = ["{p}", "{nomePaciente}", "{t}", "{saudacao}", "{contractUrl}"];

    variaveisUnicas.forEach((variavel) => {
        if (variaveisFixas.includes(variavel)) return;
        const nomeVariavel = variavel.replace(/[{}]/g, "");
        const labelText = nomeVariavel.charAt(0).toUpperCase() + nomeVariavel.slice(1).replace(/_/g, " ");
        const formGroup = document.createElement("div");
        formGroup.className = "form-group";
        const label = document.createElement("label");
        let novoLabel = "";
        const nomeVariavelLower = nomeVariavel.toLowerCase();
        let campoElemento;

        // Switch case para criar campos (igual ao modals.js)
        switch (nomeVariavelLower) {
         case "prof": case "profissao":
            novoLabel = "Selecione sua profissão:";
            campoElemento = document.createElement("select");
            campoElemento.innerHTML = "<option value=''>Selecione...</option>";
            const profissoes = systemConfigs?.listas?.profissoes || [];
            profissoes.forEach(prof => campoElemento.innerHTML += `<option value="${prof}">${prof}</option>`);
            if (userData.profissao) campoElemento.value = userData.profissao;
            break;
         case "dia": case "diasemana":
            novoLabel = "Selecione o dia de atendimento:";
            campoElemento = document.createElement("select");
            const dias = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
            campoElemento.innerHTML = "<option value=''>Selecione...</option>";
            dias.forEach(dia => campoElemento.innerHTML += `<option value="${dia}">${dia}</option>`);
            break;
         case "mod": case "modalidade":
            novoLabel = "Selecione a modalidade:";
            campoElemento = document.createElement("select");
            campoElemento.innerHTML = "<option value=''>Selecione...</option><option value='Presencial'>Presencial</option><option value='Online'>Online</option>";
            break;
         case "data": case "datainicio":
            novoLabel = "Informe a data de inicio da terapia:";
            campoElemento = document.createElement("input");
            campoElemento.type = "date";
            break;
         case "hora": case "horario":
            novoLabel = "Informe a hora da sessão:";
            campoElemento = document.createElement("input");
            campoElemento.type = "time";
            break;
         case "v": case "valor":
            novoLabel = "Preencha o valor da sessão:";
            campoElemento = document.createElement("input");
            campoElemento.type = "text"; // Manter texto para R$ XX,YY
            break;
         case "px": case "pix":
            novoLabel = "Informe seu PIX:";
            campoElemento = document.createElement("input");
            campoElemento.type = "text";
            break;
         case "m":
            novoLabel = "Informe o Mês de referência (ex: Janeiro):";
            campoElemento = document.createElement("input");
            campoElemento.type = "text";
            break;
         case "d":
            novoLabel = "Informe o Dia do vencimento (ex: 10):";
            campoElemento = document.createElement("input");
            campoElemento.type = "text";
            break;
          default:
            novoLabel = `Preencha o campo "${labelText}":`;
            campoElemento = document.createElement("input");
            campoElemento.type = "text";
        }

        label.textContent = novoLabel;
        label.htmlFor = `var-${nomeVariavel}`;
        campoElemento.className = "form-control dynamic-var";
        campoElemento.id = `var-${nomeVariavel}`;
        campoElemento.dataset.variavel = variavel;
        campoElemento.oninput = () => atualizarPreviewMensagem(); // Chama a função global

        formGroup.appendChild(label);
        formGroup.appendChild(campoElemento);
        formContainer.appendChild(formGroup);
    });

    atualizarPreviewMensagem(); // Chama a função global
    selecaoView.style.display = "none";
    formularioView.style.display = "block";
    if (btnWhatsapp) btnWhatsapp.style.display = "inline-block";
}

function formatarDataParaTexto(dataString) { // Função auxiliar (igual modals.js)
    if (!dataString || !/^\d{4}-\d{2}-\d{2}$/.test(dataString)) return dataString;
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
}

function atualizarPreviewMensagem() { // Usa dados globais
    const { paciente, atendimento, userData } = dadosParaMensagemGlobal;
    const previewTextarea = document.getElementById("output-mensagem-preview");
    let mensagemAtualizada = templateOriginalGlobal; // Usa var global

    mensagemAtualizada = mensagemAtualizada
        .replace(/{p}/g, paciente.nomeCompleto)
        .replace(/{nomePaciente}/g, paciente.nomeCompleto)
        .replace(/{t}/g, userData.nome)
        .replace(/{saudacao}/g, "Olá"); // Ou lógica mais complexa de saudação

    if (templateOriginalGlobal.includes("{contractUrl}") && atendimento) {
        // Assume que atendimentoId existe no objeto atendimento
        // Tenta pegar de PB ou Plantão
        const atendimentoIdParaLink = atendimento.atendimentoId || atendimento.id; // plantaoInfo pode ter 'id'
        if (atendimentoIdParaLink) {
             const contractUrl = `${window.location.origin}/public/contrato-terapeutico.html?id=${paciente.id}&atendimentoId=${atendimentoIdParaLink}`;
             mensagemAtualizada = mensagemAtualizada.replace(/{contractUrl}/g, contractUrl);
        } else {
             console.warn("Não foi possível gerar link do contrato: ID do atendimento não encontrado.");
             mensagemAtualizada = mensagemAtualizada.replace(/{contractUrl}/g, "[Link do Contrato Indisponível]");
        }

    }

    const inputs = document.querySelectorAll(".dynamic-var");
    inputs.forEach(input => {
        const placeholder = input.dataset.variavel;
        let valor = input.value;
        if (input.type === "date") valor = formatarDataParaTexto(valor);
        mensagemAtualizada = mensagemAtualizada.replace(
            new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            valor || placeholder // Mantém o placeholder se vazio
        );
    });

    previewTextarea.value = mensagemAtualizada;
}

function handleMensagemSubmit() { // Usa dados globais
    const { paciente } = dadosParaMensagemGlobal;
    const telefone = paciente.telefoneCelular?.replace(/\D/g, "");
    const mensagem = document.getElementById("output-mensagem-preview").value;
    const modal = document.getElementById("enviar-mensagem-modal");

    if (telefone && mensagem && !mensagem.includes("{")) {
        window.open(`https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`, "_blank");
        modal.style.display = "none";
    } else {
        alert("Não foi possível gerar o link. Verifique se todos os campos foram preenchidos e se o paciente possui um telefone válido.");
    }
}


// --- Lógica do Modal de Solicitar Novas Sessões (Adaptada) ---

function abrirModalSolicitarSessoes(/* Usa globais */) {
     if (!pacienteDataGlobal || !userDataGlobal || !systemConfigsGlobal) {
        alert("Dados necessários para abrir o modal de solicitação não estão carregados.");
        return;
    }
     // Pega o atendimento ativo (exemplo, ajustar se necessário)
     const atendimentoAtivo = pacienteDataGlobal.atendimentosPB?.find(at => at.statusAtendimento === 'ativo');
     if (!atendimentoAtivo) {
          alert("Não há um atendimento de Psicoterapia Breve ativo para solicitar novas sessões.");
          // Ou adaptar para permitir solicitar mesmo sem atendimento PB ativo? Depende da regra.
          return;
     }

    const modal = document.getElementById("solicitar-sessoes-modal");
    modal.style.display = "flex";
    const form = document.getElementById("solicitar-sessoes-form");
    form.reset();
    form.classList.remove("was-validated");

    document.getElementById("solicitar-profissional-nome").value = userDataGlobal.nome;
    document.getElementById("solicitar-paciente-nome").value = pacienteDataGlobal.nomeCompleto;
    // Preencher IDs ocultos
    form.querySelector('#solicitar-paciente-id').value = pacienteIdGlobal;
    form.querySelector('#solicitar-atendimento-id').value = atendimentoAtivo.atendimentoId;


    const horarioSelect = document.getElementById("solicitar-horario");
    horarioSelect.innerHTML = ""; // Limpa opções
    for (let i = 7; i <= 21; i++) {
        const hora = `${String(i).padStart(2, "0")}:00`;
        horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
    }

    const salaSelect = document.getElementById("solicitar-sala");
    salaSelect.innerHTML = '<option value="Online">Online</option>';
    salasPresenciaisGlobal.forEach((sala) => { // Usa a lista global
        salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
    });

    const fieldsToWatch = ["solicitar-dia-semana", "solicitar-horario", "solicitar-tipo-atendimento", "solicitar-sala"];
    fieldsToWatch.forEach(id => document.getElementById(id).onchange = () => validarHorarioNaGrade(/* Usa globais */)); // Chama a função global

    const tipoAtendimentoSelect = document.getElementById("solicitar-tipo-atendimento");
    tipoAtendimentoSelect.onchange = () => {
        const tipo = tipoAtendimentoSelect.value.toLowerCase(); // Comparar em minúsculo
        const salaSelectEl = document.getElementById("solicitar-sala");
        salaSelectEl.disabled = tipo === "online";
        if (tipo === "online") salaSelectEl.value = "Online";
        else if (salaSelectEl.value === "Online") salaSelectEl.value = ""; // Limpa se mudou pra presencial
        validarHorarioNaGrade(/* Usa globais */); // Chama a função global
    };
    tipoAtendimentoSelect.dispatchEvent(new Event('change')); // Dispara para estado inicial
}

// handleSolicitarSessoesSubmit: Mantém a lógica igual a modals.js,
// mas usa pacienteIdGlobal, userDataGlobal e o atendimentoId do form.
async function handleSolicitarSessoesSubmit(evento) {
    evento.preventDefault();
    const form = document.getElementById("solicitar-sessoes-form");
    const modal = document.getElementById("solicitar-sessoes-modal");
    const btnSubmit = document.getElementById("btn-confirmar-solicitacao");

    // Usa IDs do form agora
    const pacienteId = form.querySelector('#solicitar-paciente-id').value;
    const atendimentoId = form.querySelector('#solicitar-atendimento-id').value;

    if (!pacienteId || !atendimentoId) {
          alert("Erro: IDs do paciente ou atendimento não encontrados no formulário.");
          return;
    }


    if (form.checkValidity() === false) {
        alert("Por favor, preencha todos os campos obrigatórios.");
        form.classList.add("was-validated");
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="loading-spinner-small"></span> Enviando...';

    try {
        const solicitacaoData = {
            tipo: "novas_sessoes",
            status: "Pendente",
            dataSolicitacao: serverTimestamp(),
            solicitanteId: userDataGlobal.uid, // Usa global
            solicitanteNome: userDataGlobal.nome, // Usa global
            pacienteId: pacienteId, // Usa do form
            pacienteNome: form.querySelector("#solicitar-paciente-nome").value, // Pega do form
            atendimentoId: atendimentoId, // Usa do form
            detalhes: {
                diaSemana: form.querySelector("#solicitar-dia-semana").value,
                horario: form.querySelector("#solicitar-horario").value,
                modalidade: form.querySelector("#solicitar-tipo-atendimento").value,
                sala: form.querySelector("#solicitar-sala").value,
                dataInicioPreferencial: form.querySelector("#solicitar-data-inicio").value,
            },
            adminFeedback: null,
        };

        await addDoc(collection(db, "solicitacoes"), solicitacaoData);
        console.log("Solicitação de novas sessões criada:", solicitacaoData);
        alert("Solicitação de novas sessões enviada com sucesso para o administrativo!");
        modal.style.display = "none";
        form.reset();
        form.classList.remove("was-validated");
    } catch (error) {
        console.error("Erro ao enviar solicitação de novas sessões:", error);
        alert(`Erro ao enviar solicitação: ${error.message}`);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Enviar Solicitação";
    }
}

// validarHorarioNaGrade: Mantém lógica igual, usa dadosDaGradeGlobal e salasPresenciaisGlobal
function validarHorarioNaGrade(/* Não precisa params, usa globais */) {
    const dia = document.getElementById("solicitar-dia-semana").value;
    const horarioCompleto = document.getElementById("solicitar-horario").value;
    const tipo = document.getElementById("solicitar-tipo-atendimento").value;
    const sala = document.getElementById("solicitar-sala").value;
    const feedbackDiv = document.getElementById("validacao-grade-feedback");

    const horaKey = horarioCompleto ? horarioCompleto.replace(":", "-") : null;
    let isOcupado = false;

    if (!horaKey) {
        feedbackDiv.style.display = "none";
        return;
    }

    // Usa dadosDaGradeGlobal e salasPresenciaisGlobal
    if (tipo.toLowerCase() === "online") { // Comparar em minúsculo
        for (let i = 0; i < 6; i++) { // Assumindo 6 colunas online
            if (dadosDaGradeGlobal?.online?.[dia]?.[horaKey]?.[`col${i}`]) {
                isOcupado = true;
                break;
            }
        }
    } else { // Presencial
        const salaIndex = salasPresenciaisGlobal?.indexOf(sala);
        if (salaIndex !== undefined && salaIndex !== -1 &&
            dadosDaGradeGlobal?.presencial?.[dia]?.[horaKey]?.[`col${salaIndex}`]) {
            isOcupado = true;
        }
    }

    feedbackDiv.style.display = "block";
    if (isOcupado) {
        feedbackDiv.className = "info-note exists alert alert-warning"; // Usa classes do design system
        feedbackDiv.innerHTML = "<strong>Atenção:</strong> Este horário já está preenchido na grade. <br>Sua solicitação será enviada mesmo assim para análise do administrativo.";
    } else {
        feedbackDiv.className = "info-note success alert alert-success"; // Usa classes do design system
        feedbackDiv.innerHTML = "<strong>Disponível:</strong> O horário selecionado parece livre na grade. A solicitação será enviada para análise do administrativo.";
    }
}


// --- Lógica do Modal de Alterar Horário (Adaptada) ---

function abrirModalAlterarHorario(/* Usa globais */) {
    if (!pacienteDataGlobal || !userDataGlobal || !systemConfigsGlobal) {
        alert("Dados necessários para abrir o modal de alteração não estão carregados.");
        return;
    }
     // Pega o atendimento ativo (exemplo, ajustar se necessário)
     const atendimentoAtivo = pacienteDataGlobal.atendimentosPB?.find(at => at.statusAtendimento === 'ativo');
     if (!atendimentoAtivo) {
          alert("Não há um atendimento de Psicoterapia Breve ativo para alterar o horário.");
          return;
     }

    const modal = document.getElementById("alterar-horario-modal");
    const form = document.getElementById("alterar-horario-form");
    form.reset();

    // Preenche dados fixos e IDs ocultos
    document.getElementById("alterar-paciente-nome").value = pacienteDataGlobal.nomeCompleto;
    document.getElementById("alterar-profissional-nome").value = userDataGlobal.nome;
    form.querySelector('#alterar-paciente-id').value = pacienteIdGlobal;
    form.querySelector('#alterar-atendimento-id').value = atendimentoAtivo.atendimentoId;


    // Preenche dados atuais
    const horarioAtual = atendimentoAtivo?.horarioSessoes || {}; // Usa horarioSessoes
    document.getElementById("alterar-dia-atual").value = horarioAtual.diaSemana || "N/A";
    document.getElementById("alterar-horario-atual").value = horarioAtual.horario || "N/A";
    document.getElementById("alterar-modalidade-atual").value = horarioAtual.tipoAtendimento || "N/A";

    // Preenche select de Horário
    const horarioSelect = document.getElementById("alterar-horario");
    horarioSelect.innerHTML = "<option value=''>Selecione...</option>";
    for (let i = 8; i <= 21; i++) {
        const hora = `${String(i).padStart(2, "0")}:00`;
        horarioSelect.innerHTML += `<option value="${hora}">${hora}</option>`;
    }

    // Preenche select de Salas
    const salaSelect = document.getElementById("alterar-sala");
    salaSelect.innerHTML = '<option value="Online">Online</option>';
    salasPresenciaisGlobal.forEach((sala) => { // Usa global
        if (sala && sala.trim() !== "") {
            salaSelect.innerHTML += `<option value="${sala}">${sala}</option>`;
        }
    });

    // Lógica para habilitar/desabilitar Sala
    const tipoAtendimentoSelect = document.getElementById("alterar-tipo-atendimento");
    tipoAtendimentoSelect.onchange = () => {
        const tipo = tipoAtendimentoSelect.value;
        salaSelect.disabled = tipo === "Online";
        if (tipo === "Online") {
            salaSelect.value = "Online";
        } else if (salasPresenciaisGlobal.length > 0 && salaSelect.value === "Online") {
             salaSelect.value = ""; // Força seleção se presencial e houver salas
        } else if (salasPresenciaisGlobal.length === 0 && tipo !== "Online") {
             // Se presencial mas não há salas, talvez desabilitar a opção presencial? Ou mostrar erro?
             console.warn("Modo presencial selecionado, mas não há salas configuradas.");
             salaSelect.value = "";
             salaSelect.disabled = true; // Desabilita sala se não há opções
        }
    };
    tipoAtendimentoSelect.dispatchEvent(new Event('change'));

    modal.style.display = "flex";
}

// handleAlterarHorarioSubmit: Mantém lógica igual, usa pacienteIdGlobal, userDataGlobal e IDs do form.
async function handleAlterarHorarioSubmit(evento) {
    evento.preventDefault();
    const form = document.getElementById("alterar-horario-form");
    const modal = document.getElementById("alterar-horario-modal");
    const btnSubmit = document.getElementById("btn-confirmar-alteracao-horario");

    // IDs do form
    const pacienteId = form.querySelector('#alterar-paciente-id').value;
    const atendimentoId = form.querySelector('#alterar-atendimento-id').value;

     if (!pacienteId || !atendimentoId) {
          alert("Erro: IDs do paciente ou atendimento não encontrados no formulário.");
          return;
     }
      // Pega o atendimento ativo para dados antigos (pode buscar novamente se preferir)
     const atendimentoAtivo = pacienteDataGlobal?.atendimentosPB?.find(at => at.atendimentoId === atendimentoId);
     if (!atendimentoAtivo) {
          console.error("Atendimento ativo não encontrado para pegar dados antigos.");
          // Continuar mesmo assim ou dar erro? Por ora, continua com N/A.
     }


    if (!form.checkValidity()) {
        alert("Por favor, preencha todos os campos obrigatórios (*) para a nova configuração.");
        form.classList.add("was-validated");
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="loading-spinner-small"></span> Enviando...';

    try {
        const horarioAntigo = atendimentoAtivo?.horarioSessoes || {}; // Usa horarioSessoes
        const dadosAntigos = {
            dia: horarioAntigo.diaSemana || "N/A",
            horario: horarioAntigo.horario || "N/A",
            modalidade: horarioAntigo.tipoAtendimento || "N/A",
            sala: horarioAntigo.salaAtendimento || "N/A", // Assume que existe esse campo
            frequencia: horarioAntigo.frequencia || "N/A",
        };

        const dadosNovos = {
            dia: form.querySelector("#alterar-dia-semana").value,
            horario: form.querySelector("#alterar-horario").value,
            modalidade: form.querySelector("#alterar-tipo-atendimento").value,
            frequencia: form.querySelector("#alterar-frequencia").value,
            sala: form.querySelector("#alterar-sala").value,
            dataInicio: form.querySelector("#alterar-data-inicio").value,
            alterarGrade: form.querySelector("#alterar-grade").value,
        };

        const solicitacaoData = {
            tipo: "alteracao_horario",
            status: "Pendente",
            dataSolicitacao: serverTimestamp(),
            solicitanteId: userDataGlobal.uid, // Usa global
            solicitanteNome: userDataGlobal.nome, // Usa global
            pacienteId: pacienteId, // Usa do form
            pacienteNome: form.querySelector("#alterar-paciente-nome").value, // Pega do form
            atendimentoId: atendimentoId, // Usa do form
            detalhes: {
                dadosAntigos: dadosAntigos,
                dadosNovos: dadosNovos,
                justificativa: form.querySelector("#alterar-justificativa").value || "",
            },
            adminFeedback: null,
        };

        await addDoc(collection(db, "solicitacoes"), solicitacaoData);
        console.log("Solicitação de alteração de horário criada:", solicitacaoData);
        alert("Solicitação de alteração de horário enviada com sucesso para o administrativo!");
        modal.style.display = "none";
        form.reset();
        form.classList.remove("was-validated");
    } catch (error) {
        console.error("Erro ao enviar solicitação de alteração de horário:", error);
        alert(`Erro ao enviar solicitação: ${error.message}`);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Enviar Solicitação de Alteração";
    }
}


// --- Lógica do Modal de Reavaliação (Adaptada) ---
let currentReavaliacaoConfigGlobal = {}; // Usa global

async function abrirModalReavaliacao(/* Usa globais */) {
    if (!pacienteDataGlobal || !userDataGlobal || !systemConfigsGlobal) {
        alert("Dados necessários para abrir o modal de reavaliação não estão carregados.");
        return;
    }
     // Pega o atendimento ativo (exemplo, ajustar se necessário)
     const atendimentoAtivo = pacienteDataGlobal.atendimentosPB?.find(at => at.statusAtendimento === 'ativo');
     // Permitir abrir mesmo sem atendimento ativo? Sim, parece fazer sentido.


    const modal = document.getElementById("reavaliacao-modal");
    const form = document.getElementById("reavaliacao-form");
    const msgSemAgenda = document.getElementById("reavaliacao-sem-agenda");
    const btnConfirmar = document.getElementById("btn-confirmar-reavaliacao");
    const tipoAtendimentoGroup = document.getElementById("reavaliacao-tipo-atendimento-group");
    const tipoAtendimentoSelect = document.getElementById("reavaliacao-tipo-atendimento");
    const datasContainer = document.getElementById("reavaliacao-datas-disponiveis");
    const dataSelecionadaInput = document.getElementById("reavaliacao-data-selecionada");
    const horariosContainer = document.getElementById("reavaliacao-horarios-disponiveis");

    // Resetar
    form.reset();
    msgSemAgenda.style.display = "none";
    form.style.display = "none";
    btnConfirmar.style.display = "none";
    datasContainer.innerHTML = "<p>Selecione uma modalidade para ver as datas.</p>";
    horariosContainer.innerHTML = "<p>Selecione uma data para ver os horários.</p>";
    dataSelecionadaInput.value = "";

    // Preencher dados fixos e ID oculto
    form.querySelector("#reavaliacao-paciente-id").value = pacienteIdGlobal;
    form.querySelector("#reavaliacao-atendimento-id").value = atendimentoAtivo?.atendimentoId || ''; // Guarda ID se houver
    document.getElementById("reavaliacao-profissional-nome").value = userDataGlobal.nome;
    document.getElementById("reavaliacao-paciente-nome").value = pacienteDataGlobal.nomeCompleto;
    document.getElementById("reavaliacao-valor-atual").value = pacienteDataGlobal.valorContribuicao || "";

    modal.style.display = "flex";

    try {
        const hoje = new Date().toISOString().split("T")[0];
        const agendaQuery = query(
            collection(db, "agendaConfigurada"),
            where("tipo", "==", "reavaliacao"),
            where("data", ">=", hoje)
        );
        const agendaSnapshot = await getDocs(agendaQuery);

        if (agendaSnapshot.empty) {
            msgSemAgenda.textContent = "Não há agenda de reavaliação disponível no momento."; // Mensagem mais clara
            msgSemAgenda.style.display = "block";
            msgSemAgenda.className = "alert alert-warning"; // Usa classes do design system
            return;
        }

        form.style.display = "block";
        btnConfirmar.style.display = "block";

        let agendasConfig = [];
        agendaSnapshot.forEach(doc => agendasConfig.push({ id: doc.id, ...doc.data() }));

        // Armazena config globalmente para esta função
        currentReavaliacaoConfigGlobal = {
             agendas: agendasConfig,
             // paciente e userData já estão nas vars globais do módulo
        };

        const modalidades = [...new Set(agendasConfig.map(a => a.modalidade))].filter(Boolean);
        tipoAtendimentoSelect.innerHTML = "";
        if (modalidades.length > 1) {
            tipoAtendimentoGroup.style.display = "block";
            tipoAtendimentoSelect.innerHTML = '<option value="">Selecione a modalidade...</option>';
            modalidades.forEach(mod => {
                const modFormatado = mod.charAt(0).toUpperCase() + mod.slice(1).toLowerCase();
                tipoAtendimentoSelect.innerHTML += `<option value="${mod}">${modFormatado}</option>`;
            });
            tipoAtendimentoSelect.required = true;
        } else if (modalidades.length === 1) {
            tipoAtendimentoGroup.style.display = "none";
            tipoAtendimentoSelect.innerHTML = `<option value="${modalidades[0]}" selected>${modalidades[0].charAt(0).toUpperCase() + modalidades[0].slice(1).toLowerCase()}</option>`;
            tipoAtendimentoSelect.required = false;
            renderizarDatasDisponiveis(modalidades[0]); // Já carrega datas
        } else {
            throw new Error("Agenda de reavaliação configurada de forma inválida (sem modalidade).");
        }

        // Listeners (usando funções globais)
        tipoAtendimentoSelect.onchange = () => {
            horariosContainer.innerHTML = "<p>Selecione uma data para ver os horários.</p>";
            dataSelecionadaInput.value = "";
            renderizarDatasDisponiveis(tipoAtendimentoSelect.value);
        };
        datasContainer.onclick = (e) => {
            const target = e.target.closest(".slot-time"); // Usar classe genérica .slot-time
            if (target && !target.disabled) {
                datasContainer.querySelector(".slot-time.selected")?.classList.remove("selected");
                target.classList.add("selected");
                dataSelecionadaInput.value = target.dataset.data;
                carregarHorariosReavaliacao(); // Chama função global
            }
        };
        horariosContainer.onclick = (e) => {
            const target = e.target.closest(".slot-time"); // Usar classe genérica .slot-time
            if (target && !target.disabled) {
                horariosContainer.querySelector(".slot-time.selected")?.classList.remove("selected");
                target.classList.add("selected");
            }
        };

    } catch (error) {
        console.error("Erro ao abrir modal de reavaliação:", error);
        msgSemAgenda.textContent = "Erro ao carregar a agenda de reavaliação. Tente novamente.";
        msgSemAgenda.style.display = "block";
         msgSemAgenda.className = "alert alert-error"; // Usa classes do design system
         form.style.display = "none"; // Esconde form se deu erro
         btnConfirmar.style.display = "none";
    }
}

// renderizarDatasDisponiveis: Mantém lógica igual, usa currentReavaliacaoConfigGlobal
function renderizarDatasDisponiveis(modalidade) {
    const datasContainer = document.getElementById("reavaliacao-datas-disponiveis");
    if (!modalidade) {
        datasContainer.innerHTML = "<p>Selecione uma modalidade para ver as datas.</p>";
        return;
    }

    const { agendas } = currentReavaliacaoConfigGlobal; // Usa global
    if (!agendas) {
         console.error("Configuração de reavaliação não carregada.");
         datasContainer.innerHTML = "<p>Erro ao carregar configuração.</p>";
         return;
    }


    const datasDisponiveis = [...new Set(agendas.filter(a => a.modalidade === modalidade).map(a => a.data))];
    datasDisponiveis.sort();

    if (datasDisponiveis.length === 0) {
        datasContainer.innerHTML = "<p>Nenhuma data disponível encontrada para esta modalidade.</p>";
        return;
    }

    const datasHtml = datasDisponiveis.map(dataISO => {
        const dataObj = new Date(dataISO + 'T03:00:00'); // Ajuste fuso se necessário
        const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'long' });
        const dataFormatada = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const diaSemanaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
        return `<button type="button" class="slot-time" data-data="${dataISO}">${diaSemanaCapitalizado} (${dataFormatada})</button>`; // Usa classe genérica
    }).join('');

    datasContainer.innerHTML = datasHtml;
}

// carregarHorariosReavaliacao: Mantém lógica igual, usa currentReavaliacaoConfigGlobal
async function carregarHorariosReavaliacao() {
    const modalidade = document.getElementById("reavaliacao-tipo-atendimento").value;
    const dataISO = document.getElementById("reavaliacao-data-selecionada").value;
    const horariosContainer = document.getElementById("reavaliacao-horarios-disponiveis");

    if (!modalidade || !dataISO) {
        horariosContainer.innerHTML = "<p>Por favor, selecione a modalidade e a data.</p>";
        return;
    }

    horariosContainer.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const { agendas } = currentReavaliacaoConfigGlobal; // Usa global
         if (!agendas) throw new Error("Configuração de reavaliação não carregada.");

        const agendasDoDia = agendas.filter(a => a.modalidade === modalidade && a.data === dataISO);

        if (agendasDoDia.length === 0) {
            horariosContainer.innerHTML = "<p>Nenhum horário configurado para este dia/modalidade.</p>";
            return;
        }

        let slotsDoDia = new Set();
        agendasDoDia.forEach(agenda => {
            const [hInicio, mInicio] = agenda.inicio.split(':').map(Number);
            const [hFim, mFim] = agenda.fim.split(':').map(Number);
            const inicioEmMinutos = hInicio * 60 + mInicio;
            const fimEmMinutos = hFim * 60 + mFim;

            for (let minutos = inicioEmMinutos; minutos < fimEmMinutos; minutos += 30) { // Assume slots de 30min
                const hAtual = Math.floor(minutos / 60);
                const mAtual = minutos % 60;
                const horaSlot = `${String(hAtual).padStart(2, '0')}:${String(mAtual).padStart(2, '0')}`;
                slotsDoDia.add(horaSlot);
            }
        });

        const slotsOrdenados = [...slotsDoDia].sort();

        if (slotsOrdenados.length === 0) {
            horariosContainer.innerHTML = "<p>Nenhum horário configurado para este dia.</p>";
            return;
        }

        const agendamentosQuery = query(
            collection(db, "agendamentos"),
            where("data", "==", dataISO),
            where("tipo", "==", "reavaliacao"),
            where("modalidade", "==", modalidade),
            where("status", "in", ["agendado", "confirmado"])
        );
        const agendamentosSnapshot = await getDocs(agendamentosQuery);
        const horariosOcupados = new Set(agendamentosSnapshot.docs.map(doc => doc.data().hora));

        let slotsHtml = slotsOrdenados.map(hora => {
            const isDisabled = horariosOcupados.has(hora);
            return `<button type="button" class="slot-time ${isDisabled ? 'disabled' : ''}" data-hora="${hora}" ${isDisabled ? 'disabled' : ''}>${hora}</button>`; // Usa classe genérica
        }).join('');

        horariosContainer.innerHTML = slotsHtml || "<p>Nenhum horário disponível neste dia.</p>";

    } catch (error) {
        console.error("Erro ao carregar horários:", error);
        horariosContainer.innerHTML = '<p class="alert alert-error">Erro ao carregar horários. Tente novamente.</p>'; // Usa classes do design system
    }
}


// handleReavaliacaoSubmit: Mantém lógica igual, usa pacienteIdGlobal, userDataGlobal e IDs do form.
async function handleReavaliacaoSubmit(evento) {
    evento.preventDefault();
    const form = document.getElementById("reavaliacao-form"); // Pega o form correto
    const modal = document.getElementById("reavaliacao-modal");
    const btnConfirmar = document.getElementById("btn-confirmar-reavaliacao");

    const pacienteId = form.querySelector('#reavaliacao-paciente-id').value;
    const atendimentoId = form.querySelector('#reavaliacao-atendimento-id').value || null; // Pega do form (pode ser null)

    if (!pacienteId) {
         alert("Erro: ID do paciente não encontrado no formulário.");
         return;
    }

    btnConfirmar.disabled = true;
    btnConfirmar.textContent = "Enviando...";

    try {
        const motivo = document.getElementById("reavaliacao-motivo").value;
        const valorAtual = document.getElementById("reavaliacao-valor-atual").value || "N/A";
        const modalidadePref = document.getElementById("reavaliacao-tipo-atendimento").value;
        const dataPref = document.getElementById("reavaliacao-data-selecionada").value;
        const selectedSlot = document.querySelector("#reavaliacao-horarios-disponiveis .slot-time.selected");
        const horaPref = selectedSlot ? selectedSlot.dataset.hora : null;

        if (!motivo) {
            throw new Error("Por favor, preencha o motivo da reavaliação.");
        }
         if (!dataPref || !horaPref) {
              console.warn("Data ou hora da reavaliação não selecionada.");
              // Decidir se é obrigatório ou não. Se for, descomentar:
              // throw new Error("Por favor, selecione uma data e um horário para a reavaliação.");
         }


        const solicitacaoData = {
            tipo: "reavaliacao",
            status: "Pendente",
            dataSolicitacao: serverTimestamp(),
            solicitanteId: userDataGlobal.uid, // Usa global
            solicitanteNome: userDataGlobal.nome, // Usa global
            pacienteId: pacienteId, // Usa do form
            pacienteNome: form.querySelector("#reavaliacao-paciente-nome").value, // Usa do form
            atendimentoId: atendimentoId, // Usa ID do atendimento ativo (se houver)
            detalhes: {
                motivo: motivo,
                valorContribuicaoAtual: valorAtual,
                preferenciaAgendamento: {
                    modalidade: modalidadePref || null,
                    data: dataPref || null,
                    hora: horaPref || null,
                },
            },
            adminFeedback: null,
        };

        await addDoc(collection(db, "solicitacoes"), solicitacaoData);
        console.log("Solicitação de reavaliação criada:", solicitacaoData);
        alert("Solicitação de reavaliação enviada com sucesso para o administrativo!");
        modal.style.display = "none";
    } catch (error) {
        console.error("Erro ao enviar solicitação de reavaliação:", error);
        alert(`Erro ao enviar solicitação: ${error.message}`);
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = "Enviar Solicitação";
    }
}


// --- Lógica do Modal de Desfecho PB (Adaptada) ---

async function abrirModalDesfechoPb(/* Usa globais */) {
     if (!pacienteDataGlobal || !userDataGlobal) {
        alert("Dados necessários para abrir o modal de desfecho não estão carregados.");
        return;
    }
     // Pega o atendimento ativo
     const atendimentoAtivo = pacienteDataGlobal.atendimentosPB?.find(at => at.statusAtendimento === 'ativo');
     if (!atendimentoAtivo) {
          alert("Não há um atendimento de Psicoterapia Breve ativo para registrar o desfecho.");
          return;
     }

    const modal = document.getElementById("desfecho-pb-modal");
    const body = document.getElementById("desfecho-pb-modal-body");
    const footer = document.getElementById("desfecho-pb-modal-footer");

    body.innerHTML = '<div class="loading-spinner"></div>';
    footer.style.display = "none";
    modal.style.display = "flex"; // Usar flex

    try {
        // Busca o HTML do formulário
        // Ajustar o caminho relativo ao JS, não ao HTML original
        // Assumindo que detalhe-paciente.html está em /modulos/voluntario/page/
        // E form-atendimento-pb.html também está lá
        const response = await fetch("./form-atendimento-pb.html"); // Caminho relativo CORRETO
        if (!response.ok) throw new Error(`Arquivo do formulário de desfecho (./form-atendimento-pb.html) não encontrado. Status: ${response.status}`);

        body.innerHTML = await response.text();
        footer.style.display = "flex";

        const form = body.querySelector("#form-atendimento-pb");
        if (!form) throw new Error("Formulário #form-atendimento-pb não encontrado no HTML carregado.");

        // Preencher dados fixos (incluindo IDs ocultos)
        form.querySelector('#desfecho-paciente-id').value = pacienteIdGlobal;
        form.querySelector('#desfecho-atendimento-id').value = atendimentoAtivo.atendimentoId;
        form.querySelector("#profissional-nome").value = atendimentoAtivo.profissionalNome || userDataGlobal.nome;
        form.querySelector("#paciente-nome").value = pacienteDataGlobal.nomeCompleto;
        form.querySelector("#valor-contribuicao").value = pacienteDataGlobal.valorContribuicao || "Não definido";

        const dataInicioRaw = atendimentoAtivo.horarioSessoes?.dataInicio; // Usa horarioSessoes
        form.querySelector("#data-inicio-atendimento").value = dataInicioRaw
            ? new Date(dataInicioRaw + 'T03:00:00').toLocaleDateString('pt-BR')
            : "N/A";

        // Lógica de exibição condicional
        const desfechoSelect = form.querySelector("#desfecho-acompanhamento");
        const motivoContainer = form.querySelector("#motivo-alta-desistencia-container");
        const encaminhamentoContainer = form.querySelector("#encaminhamento-container");

        if (!desfechoSelect || !motivoContainer || !encaminhamentoContainer) {
             throw new Error("Elementos do formulário de desfecho não encontrados.");
        }


        desfechoSelect.addEventListener('change', () => {
            const value = desfechoSelect.value;
            motivoContainer.style.display = ['Alta', 'Desistencia'].includes(value) ? 'block' : 'none';
            encaminhamentoContainer.style.display = value === 'Encaminhamento' ? 'block' : 'none';

             // Ajusta required
            form.querySelector("#motivo-alta-desistencia").required = ['Alta', 'Desistencia'].includes(value);
            form.querySelector("#encaminhado-para").required = value === 'Encaminhamento';
            form.querySelector("#motivo-encaminhamento").required = value === 'Encaminhamento';
            // Campos opcionais dentro de encaminhamento não precisam de required dinâmico
        });
        desfechoSelect.dispatchEvent(new Event('change')); // Estado inicial

        // Adiciona listener de submit AGORA, pois o form foi carregado
         // Remove listener antigo se existir para evitar duplicação
        form.removeEventListener('submit', handleDesfechoPbSubmit);
        form.addEventListener('submit', handleDesfechoPbSubmit);


    } catch (error) {
        body.innerHTML = `<p class="alert alert-error"><b>Erro ao carregar modal:</b> ${error.message}</p>`;
        footer.style.display = "flex"; // Mostra o footer mesmo com erro para poder fechar
        console.error(error);
    }
}

// handleDesfechoPbSubmit: Mantém lógica igual, usa pacienteIdGlobal, userDataGlobal e ID do atendimento ativo.
async function handleDesfechoPbSubmit(evento) {
    evento.preventDefault();
    const form = evento.target; // O form que disparou o evento
    const modal = form.closest(".modal-overlay");
    const botaoSalvar = modal.querySelector("#btn-salvar-desfecho-submit");

     // IDs do form
     const pacienteId = form.querySelector('#desfecho-paciente-id').value;
     const atendimentoId = form.querySelector('#desfecho-atendimento-id').value;

     if (!pacienteId || !atendimentoId || pacienteId !== pacienteIdGlobal) {
          alert("Erro: Inconsistência nos IDs do formulário.");
          return;
     }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Enviando...";

    try {
        const desfechoTipo = form.querySelector("#desfecho-acompanhamento").value;
        if (!desfechoTipo) throw new Error("Selecione um tipo de desfecho.");

        let detalhesDesfecho = {};
        if (desfechoTipo === "Encaminhamento") {
            detalhesDesfecho = {
                servicoEncaminhado: form.querySelector("#encaminhado-para").value,
                motivoEncaminhamento: form.querySelector("#motivo-encaminhamento").value,
                demandaPaciente: form.querySelector("#demanda-paciente").value || "",
                // Verificar se o campo 'continua-atendimento' existe no HTML e pegar o valor
                continuaAtendimentoEuPsico: form.querySelector("#continua-atendimento")?.value || 'Não informado',
                relatoCaso: form.querySelector("#relato-caso").value || "",
            };
            if (!detalhesDesfecho.servicoEncaminhado || !detalhesDesfecho.motivoEncaminhamento) {
                throw new Error("Para encaminhamento, o serviço e o motivo são obrigatórios.");
            }
        } else if (['Alta', 'Desistencia'].includes(desfechoTipo)) {
            detalhesDesfecho = {
                motivo: form.querySelector("#motivo-alta-desistencia").value,
            };
            if (!detalhesDesfecho.motivo) {
                throw new Error(`O motivo é obrigatório para ${desfechoTipo}.`);
            }
        }
        const dataDesfechoInput = form.querySelector("#data-desfecho");
        if (!dataDesfechoInput || !dataDesfechoInput.value) {
             throw new Error("A data do desfecho é obrigatória.");
        }
        detalhesDesfecho.dataDesfecho = dataDesfechoInput.value;


        const solicitacaoData = {
            tipo: "desfecho",
            status: "Pendente",
            dataSolicitacao: serverTimestamp(),
            solicitanteId: userDataGlobal.uid, // Usa global
            solicitanteNome: userDataGlobal.nome, // Usa global
            pacienteId: pacienteId, // Usa do form
            pacienteNome: form.querySelector("#paciente-nome").value, // Usa do form
            atendimentoId: atendimentoId, // Usa do form
            detalhes: {
                tipoDesfecho: desfechoTipo,
                ...detalhesDesfecho,
                sessoesRealizadas: form.querySelector("#quantidade-sessoes-realizadas")?.value || "N/A",
                observacoesGerais: form.querySelector("#observacoes-gerais")?.value || "",
            },
            adminFeedback: null,
        };

        await addDoc(collection(db, "solicitacoes"), solicitacaoData);
        console.log("Solicitação de desfecho criada:", solicitacaoData);
        alert("Registro de desfecho enviado com sucesso para o administrativo!");
        modal.style.display = "none";
        // Recarregar dados do paciente pode ser necessário para atualizar status/UI
         await carregarDadosPaciente(pacienteIdGlobal);
         renderizarCabecalhoInfoBar();

    } catch (error) {
        console.error("Erro ao enviar solicitação de desfecho:", error);
        alert(`Falha ao enviar: ${error.message}`);
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar Desfecho";
    }
}


// --- Funções do Plantão (Movidas de modals.js, adaptadas) ---

function abrirModalEncerramento(/* Usa globais */) {
    if (!pacienteDataGlobal || !userDataGlobal) {
        alert("Dados necessários para abrir o modal de encerramento não estão carregados.");
        return;
    }
     // Verificar se o status atual é 'em_atendimento_plantao'
     if (pacienteDataGlobal.status !== 'em_atendimento_plantao') {
          alert("Este paciente não está em atendimento de Plantão ativo.");
          return;
     }

    const modal = document.getElementById("encerramento-modal");
    const form = document.getElementById("encerramento-form");
    form.reset();
    form.querySelector("#paciente-id-modal").value = pacienteIdGlobal; // Usa global ID

    document.getElementById("motivo-nao-pagamento-container").classList.add("hidden");
    const novaDisponibilidadeContainer = document.getElementById("nova-disponibilidade-container");
    novaDisponibilidadeContainer.classList.add("hidden");
    novaDisponibilidadeContainer.innerHTML = "";

    // Lógica da disponibilidade (igual modals.js, mas usa pacienteDataGlobal)
    const disponibilidadeEspecifica = pacienteDataGlobal.disponibilidadeEspecifica || [];
    const textoDisponibilidade = disponibilidadeEspecifica.length > 0
        ? disponibilidadeEspecifica.map(item => {
            const [periodo, hora] = item.split('_');
            const periodoFormatado = periodo.replace('-', ' (').replace('-', ' ') + ')';
            return `${periodoFormatado.charAt(0).toUpperCase() + periodoFormatado.slice(1)} ${hora}`;
          }).join(', ')
        : "Nenhuma disponibilidade específica informada.";
    document.getElementById("disponibilidade-atual").textContent = textoDisponibilidade;

    const pagamentoSelect = form.querySelector("#pagamento-contribuicao");
    pagamentoSelect.onchange = () => {
        document.getElementById("motivo-nao-pagamento-container").classList.toggle("hidden", pagamentoSelect.value !== "nao");
        document.getElementById("motivo-nao-pagamento").required = pagamentoSelect.value === "nao";
    };

    const dispSelect = form.querySelector("#manter-disponibilidade");
    dispSelect.onchange = async () => {
        const mostrar = dispSelect.value === 'nao';
        novaDisponibilidadeContainer.classList.toggle('hidden', !mostrar);
        if (mostrar && novaDisponibilidadeContainer.innerHTML.trim() === '') {
            novaDisponibilidadeContainer.innerHTML = '<div class="loading-spinner"></div>';
            try {
                // Ajustar caminho se necessário - relativo ao detalhe-paciente.html
                const response = await fetch("../../../public/fichas-de-inscricao.html");
                if (!response.ok) throw new Error(`Erro ${response.status} ao buscar fichas-de-inscricao.html`);
                const text = await response.text();
                const parser = new DOMParser();
                const docHtml = parser.parseFromString(text, 'text/html');
                const disponibilidadeHtml = docHtml.getElementById('disponibilidade-section')?.innerHTML;
                if(disponibilidadeHtml){
                     novaDisponibilidadeContainer.innerHTML = disponibilidadeHtml;
                     // Adicionar required aos checkboxes se 'nao' for selecionado
                     novaDisponibilidadeContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.required = true);

                } else {
                     throw new Error("Seção de disponibilidade não encontrada no arquivo HTML.");
                }

            } catch (error) {
                console.error("Erro ao carregar HTML da disponibilidade:", error);
                novaDisponibilidadeContainer.innerHTML = '<p class="alert alert-error">Erro ao carregar opções.</p>';
            }
        } else if (!mostrar) {
             // Remover required dos checkboxes se 'sim' for selecionado
             novaDisponibilidadeContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.required = false);
        }
    };
    // Resetar estado inicial dos listeners
    pagamentoSelect.dispatchEvent(new Event('change'));
    dispSelect.dispatchEvent(new Event('change'));


    modal.style.display = 'flex'; // Usar flex
}

// handleEncerramentoSubmit: Lógica mantida, usa globais userDataGlobal, pacienteIdGlobal
async function handleEncerramentoSubmit(evento, userUid, userData) { // Recebe user e userData como antes
    evento.preventDefault();
    const form = evento.target;
    const modal = form.closest(".modal-overlay"); // Achar o overlay
    const botaoSalvar = modal.querySelector('#modal-save-btn'); // Botão correto
    botaoSalvar.disabled = true;
    botaoSalvar.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

    const pacienteId = form.querySelector("#paciente-id-modal").value; // Pega do form
    if (pacienteId !== pacienteIdGlobal) {
         console.error("Inconsistência de ID de paciente no modal de encerramento!");
         alert("Erro interno. Recarregue a página.");
         botaoSalvar.disabled = false;
         botaoSalvar.textContent = "Salvar";
         return;
    }

    const encaminhamentos = Array.from(form.querySelectorAll('input[name="encaminhamento"]:checked')).map(cb => cb.value);

    // Validações (mantidas de modals.js)
     if (encaminhamentos.length === 0) { alert("Selecione ao menos uma opção de encaminhamento."); botaoSalvar.disabled=false; botaoSalvar.textContent="Salvar"; return; }
     if (!form.querySelector("#data-encerramento").value) { alert("A data de encerramento é obrigatória."); botaoSalvar.disabled=false; botaoSalvar.textContent="Salvar"; return; }
     if (!form.querySelector("#quantidade-sessoes").value) { alert("A quantidade de sessões é obrigatória."); botaoSalvar.disabled=false; botaoSalvar.textContent="Salvar"; return; }
     if (!form.querySelector("#pagamento-contribuicao").value) { alert("Informe se o pagamento foi efetuado."); botaoSalvar.disabled=false; botaoSalvar.textContent="Salvar"; return; }
     if (form.querySelector("#pagamento-contribuicao").value === "nao" && !form.querySelector("#motivo-nao-pagamento").value) { alert("Informe o motivo do não pagamento."); botaoSalvar.disabled=false; botaoSalvar.textContent="Salvar"; return; }
     if (!form.querySelector("#relato-encerramento").value) { alert("O breve relato é obrigatório."); botaoSalvar.disabled=false; botaoSalvar.textContent="Salvar"; return; }
     const manterDispValue = form.querySelector("#manter-disponibilidade").value;
     if (!manterDispValue) { alert("Informe sobre a disponibilidade."); botaoSalvar.disabled=false; botaoSalvar.textContent="Salvar"; return; }


    // Busca dados atuais do paciente para disponibilidade (necessário aqui)
    let dadosDoPacienteAtual = null;
    try {
        const docRef = doc(db, "trilhaPaciente", pacienteId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            dadosDoPacienteAtual = docSnap.data();
        } else {
            throw new Error("Paciente não encontrado ao tentar salvar encerramento.");
        }
    } catch (error) {
        console.error("Erro ao buscar dados do paciente para encerramento:", error);
        alert(`Erro ao buscar dados do paciente: ${error.message}`);
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar";
        return;
    }


    let novoStatus = encaminhamentos.includes('Alta') ? 'alta'
                      : encaminhamentos.includes('Desistência') ? 'desistencia'
                      : 'encaminhar_para_pb'; // Ou outra lógica se encaminhar para grupo/parceiro

    const encerramentoData = {
        responsavelId: userUid, // Usa ID recebido
        responsavelNome: userData.nome, // Usa nome recebido
        encaminhamento: encaminhamentos,
        dataEncerramento: form.querySelector("#data-encerramento").value,
        sessoesRealizadas: form.querySelector("#quantidade-sessoes").value,
        pagamentoEfetuado: form.querySelector("#pagamento-contribuicao").value,
        motivoNaoPagamento: form.querySelector("#motivo-nao-pagamento").value || null,
        relato: form.querySelector("#relato-encerramento").value,
        encerradoEm: serverTimestamp(),
    };

    let dadosParaAtualizar = {
        status: novoStatus,
        'plantaoInfo.encerramento': encerramentoData, // Notação de ponto
        lastUpdate: serverTimestamp(),
    };

    if (manterDispValue === 'nao') {
        const checkboxes = form.querySelectorAll('#nova-disponibilidade-container input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            alert("Se a disponibilidade mudou, por favor, selecione os novos horários disponíveis.");
            botaoSalvar.disabled = false;
            botaoSalvar.textContent = "Salvar";
            return;
        }
        dadosParaAtualizar.disponibilidadeEspecifica = Array.from(checkboxes).map(cb => cb.value);
    } else { // 'sim'
        // Mantém a disponibilidade existente (já está em dadosDoPacienteAtual)
        dadosParaAtualizar.disponibilidadeEspecifica = dadosDoPacienteAtual.disponibilidadeEspecifica || [];
    }


    try {
        await updateDoc(doc(db, "trilhaPaciente", pacienteId), dadosParaAtualizar);
        alert("Encerramento salvo com sucesso!");
        modal.style.display = "none";
        // Recarregar dados da página
        await carregarDadosPaciente(pacienteIdGlobal);
        renderizarCabecalhoInfoBar(); // Atualiza o status na barra
        // Opcional: recarregar a página inteira: location.reload();

    } catch (error) {
        console.error("Erro ao salvar encerramento:", error);
        alert(`Erro ao salvar: ${error.message}`);
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar";
    }
}


// --- Funções Horários PB (Movidas de modals.js, adaptadas) ---

function abrirModalHorariosPb(/* Usa globais */) {
    if (!pacienteDataGlobal || !userDataGlobal) {
        alert("Dados necessários para abrir o modal de horários PB não estão carregados.");
        return;
    }
     // Verificar se o status atual permite informar horários (ex: 'aguardando_info_horarios')
     if (pacienteDataGlobal.status !== 'aguardando_info_horarios') {
          // Talvez permitir abrir mesmo assim para corrigir? Ou dar alerta?
          console.warn("Abrindo modal de horários PB, mas status do paciente não é 'aguardando_info_horarios'. Status atual:", pacienteDataGlobal.status);
          // alert("O status atual do paciente não permite informar horários de PB.");
          // return;
     }
      // Encontrar o atendimento PB que está aguardando horários
      // Precisa checar se o profissionalId no atendimento corresponde ao user logado
     const atendimentoPbAguardando = pacienteDataGlobal.atendimentosPB?.find(
         at => at.profissionalId === userDataGlobal.uid && at.statusAtendimento === 'aguardando_horarios' // Checa ID e Status
     );
     if (!atendimentoPbAguardando) {
          alert("Não foi encontrado um atendimento PB aguardando definição de horários atribuído a você para este paciente.");
          return;
     }


    const modal = document.getElementById("horarios-pb-modal");
    const form = document.getElementById("horarios-pb-form");
    form.reset();
    form.querySelector("#paciente-id-horarios-modal").value = pacienteIdGlobal;
    form.querySelector("#atendimento-id-horarios-modal").value = atendimentoPbAguardando.atendimentoId; // Usa ID do atendimento encontrado

    // Resetar visibilidade dos containers
    const motivoContainer = document.getElementById("motivo-nao-inicio-pb-container");
    const continuacaoContainer = document.getElementById("form-continuacao-pb");
    const desistenciaContainer = document.getElementById("motivo-desistencia-container");
    const solicitacaoContainer = document.getElementById("detalhar-solicitacao-container");
    [motivoContainer, continuacaoContainer, desistenciaContainer, solicitacaoContainer].forEach(el => el.classList.add('hidden'));
    continuacaoContainer.innerHTML = ""; // Limpa formulário dinâmico

    // Resetar required
    document.getElementById("motivo-desistencia-pb").required = false;
    document.getElementById("detalhes-solicitacao-pb").required = false;

    // Listeners dos radios (igual modals.js)
    const iniciouRadio = form.querySelectorAll('input[name="iniciou-pb"]');
    iniciouRadio.forEach(radio => {
        radio.onchange = () => {
            const mostrarFormulario = radio.value === 'sim' && radio.checked;
            const mostrarMotivo = radio.value === 'nao' && radio.checked;
            continuacaoContainer.classList.toggle('hidden', !mostrarFormulario);
            motivoContainer.classList.toggle('hidden', !mostrarMotivo);

            if(mostrarFormulario) {
                 desistenciaContainer.classList.add('hidden');
                 solicitacaoContainer.classList.add('hidden');
                 document.getElementById("motivo-desistencia-pb").required = false;
                 document.getElementById("detalhes-solicitacao-pb").required = false;

                 if (continuacaoContainer.innerHTML === "") {
                     // Passar salas para a função que constrói o form
                     continuacaoContainer.innerHTML = construirFormularioHorarios(userDataGlobal.nome, salasPresenciaisGlobal);
                 }
                 // Ajusta required dos campos dinâmicos
                  continuacaoContainer.querySelectorAll("select, input, textarea").forEach(el => {
                       if (el.id !== 'observacoes-pb-horarios') el.required = true; // Requerido se 'sim'
                  });

            } else { // Se for 'não' ou não selecionado
                 // Garante que campos do formulário de continuação não sejam required
                  continuacaoContainer.querySelectorAll("select, input, textarea").forEach(el => el.required = false);
                 // Resetar os radios de motivo 'não iniciou' para evitar estado inconsistente
                  form.querySelectorAll('input[name="motivo-nao-inicio"]').forEach(r => r.checked = false);
                  desistenciaContainer.classList.add('hidden');
                  solicitacaoContainer.classList.add('hidden');
                  document.getElementById("motivo-desistencia-pb").required = false;
                  document.getElementById("detalhes-solicitacao-pb").required = false;

            }
        };
    });

     const motivoNaoInicioRadio = form.querySelectorAll('input[name="motivo-nao-inicio"]');
     motivoNaoInicioRadio.forEach(radio => {
          radio.onchange = () => {
               if(radio.checked){
                    const eDesistiu = radio.value === 'desistiu';
                    desistenciaContainer.classList.toggle('hidden', !eDesistiu);
                    solicitacaoContainer.classList.toggle('hidden', eDesistiu);
                    document.getElementById("motivo-desistencia-pb").required = eDesistiu;
                    document.getElementById("detalhes-solicitacao-pb").required = !eDesistiu;
               }
          };
     });

    modal.style.display = 'flex'; // Usar flex
}

// construirFormularioHorarios: Atualizado para receber e usar a lista de salas
function construirFormularioHorarios(nomeProfissional, salasDisponiveis = []) {
    let horasOptions = "";
    for (let i = 8; i <= 21; i++) {
        const hora = `${String(i).padStart(2, '0')}:00`;
        horasOptions += `<option value="${hora}">${hora}</option>`;
    }

    let salasOptions = '<option value="Online">Online</option>'; // Online sempre primeiro
    salasDisponiveis.forEach(sala => {
        if(sala && sala !== "Online") { // Evita duplicar Online
             salasOptions += `<option value="${sala}">${sala}</option>`;
        }
    });


    // Adiciona required aos campos corretos
    return `
    <div class="form-group">
      <label>Nome Profissional:</label>
      <input type="text" value="${nomeProfissional}" class="form-control" readonly>
    </div>
    <div class="form-group">
      <label for="dia-semana-pb">Dia da semana:*</label>
      <select id="dia-semana-pb" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Segunda-feira">Segunda-feira</option>
        <option value="Terça-feira">Terça-feira</option>
        <option value="Quarta-feira">Quarta-feira</option>
        <option value="Quinta-feira">Quinta-feira</option>
        <option value="Sexta-feira">Sexta-feira</option>
        <option value="Sábado">Sábado</option>
      </select>
    </div>
    <div class="form-group">
      <label for="horario-pb">Horário:*</label>
      <select id="horario-pb" class="form-control" required>
        <option value="">Selecione...</option>
        ${horasOptions}
      </select>
    </div>
    <div class="form-group">
      <label for="tipo-atendimento-pb-voluntario">Tipo de atendimento:*</label>
      <select id="tipo-atendimento-pb-voluntario" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Presencial">Presencial</option>
        <option value="Online">Online</option>
      </select>
    </div>
     <div class="form-group">
        <label for="sala-atendimento-pb">Sala:*</label>
        <select id="sala-atendimento-pb" class="form-control" required>
            <option value="">Selecione...</option>
            ${salasOptions}
        </select>
    </div>
    <div class="form-group">
      <label for="alterar-grade-pb">Alterar/Incluir na grade?*</label>
      <select id="alterar-grade-pb" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Sim">Sim</option>
        <option value="Não">Não</option>
      </select>
    </div>
    <div class="form-group">
      <label for="frequencia-atendimento-pb">Frequência:*</label>
      <select id="frequencia-atendimento-pb" class="form-control" required>
        <option value="">Selecione...</option>
        <option value="Semanal">Semanal</option>
        <option value="Quinzenal">Quinzenal</option>
        <option value="Mensal">Mensal</option>
      </select>
    </div>
    <div class="form-group">
      <label for="data-inicio-sessoes">Data de início:*</label>
      <input type="date" id="data-inicio-sessoes" class="form-control" required>
    </div>
    <div class="form-group">
      <label for="observacoes-pb-horarios">Observações:</label>
      <textarea id="observacoes-pb-horarios" rows="3" class="form-control"></textarea>
    </div>
    <script>
      // Adiciona listener para desabilitar sala se online (dentro do HTML dinâmico)
      // É importante que este script execute APÓS os elementos serem adicionados ao DOM
      (function() {
          const tipoSelect = document.getElementById('tipo-atendimento-pb-voluntario');
          const salaSelect = document.getElementById('sala-atendimento-pb');
          if(tipoSelect && salaSelect) {
               const handleChange = () => {
                    const isOnline = tipoSelect.value === 'Online';
                    salaSelect.disabled = isOnline;
                    if (isOnline) salaSelect.value = 'Online';
                    else if (salaSelect.value === 'Online') salaSelect.value = ''; // Limpa se mudou pra presencial
               };
               tipoSelect.addEventListener('change', handleChange);
               // Trigger inicial
               handleChange();
          } else {
               console.error("Não foi possível adicionar listener dinâmico para tipo/sala no form de horários PB");
          }
      })();
    </script>
  `;
}


// handleHorariosPbSubmit: Lógica mantida, usa globais userDataGlobal e IDs do form.
async function handleHorariosPbSubmit(evento, userUid, userData) { // Recebe user e userData
    evento.preventDefault();
    const formulario = evento.target;
    const modal = formulario.closest(".modal-overlay"); // Achar o overlay
    const botaoSalvar = modal.querySelector('button[type="submit"]');
    botaoSalvar.disabled = true;
    botaoSalvar.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

    const pacienteId = formulario.querySelector("#paciente-id-horarios-modal").value;
    const atendimentoId = formulario.querySelector("#atendimento-id-horarios-modal").value;

    if (pacienteId !== pacienteIdGlobal) {
        console.error("Inconsistência de ID de paciente no modal de horários PB!");
        alert("Erro interno. Recarregue a página.");
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar";
        return;
    }
    const docRef = doc(db, "trilhaPaciente", pacienteId);


    try {
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) throw new Error("Paciente não encontrado!");

        const dadosDoPaciente = docSnap.data();
        const atendimentos = [...(dadosDoPaciente.atendimentosPB || [])]; // Cria cópia
        const indiceDoAtendimento = atendimentos.findIndex(at => at.atendimentoId === atendimentoId);

        if (indiceDoAtendimento === -1) {
            throw new Error("Atendimento não encontrado para este paciente!");
        }

        const iniciou = formulario.querySelector('input[name="iniciou-pb"]:checked')?.value;
        if (!iniciou) throw new Error("Por favor, selecione se o paciente iniciou o atendimento.");

        let dadosParaAtualizar = {};
        let novoStatusPaciente = dadosDoPaciente.status;
        let gerarSolicitacaoGrade = false;
        let horarioSessaoDataParaSolicitacao = null; // Para a solicitação da grade


        if (iniciou === "sim") {
            const horarioSessaoData = {
                responsavelId: userUid,
                responsavelNome: userData.nome,
                diaSemana: formulario.querySelector("#dia-semana-pb").value,
                horario: formulario.querySelector("#horario-pb").value,
                tipoAtendimento: formulario.querySelector("#tipo-atendimento-pb-voluntario").value,
                alterarGrade: formulario.querySelector("#alterar-grade-pb").value,
                frequencia: formulario.querySelector("#frequencia-atendimento-pb").value,
                salaAtendimento: formulario.querySelector("#sala-atendimento-pb").value,
                dataInicio: formulario.querySelector("#data-inicio-sessoes").value,
                observacoes: formulario.querySelector("#observacoes-pb-horarios").value || "",
                definidoEm: serverTimestamp(),
            };

            // Validação dos campos do formulário dinâmico
            if (!horarioSessaoData.diaSemana || !horarioSessaoData.horario || !horarioSessaoData.tipoAtendimento ||
                !horarioSessaoData.alterarGrade || !horarioSessaoData.frequencia || !horarioSessaoData.salaAtendimento ||
                !horarioSessaoData.dataInicio) {
                 throw new Error("Preencha todos os detalhes do horário obrigatórios (*).");
            }
             // Validação Sala vs Tipo Atendimento
             if (horarioSessaoData.tipoAtendimento === 'Online' && horarioSessaoData.salaAtendimento !== 'Online') {
                 throw new Error("Para atendimento Online, a sala deve ser 'Online'.");
             }
             if (horarioSessaoData.tipoAtendimento === 'Presencial' && horarioSessaoData.salaAtendimento === 'Online') {
                  throw new Error("Para atendimento Presencial, selecione uma sala física.");
             }


            // Atualiza o atendimento específico na cópia do array
            atendimentos[indiceDoAtendimento].horarioSessoes = horarioSessaoData;
            atendimentos[indiceDoAtendimento].statusAtendimento = "ativo";
            novoStatusPaciente = "em_atendimento_pb";

            dadosParaAtualizar = {
                atendimentosPB: atendimentos,
                status: novoStatusPaciente,
                lastUpdate: serverTimestamp(),
            };

            if (horarioSessaoData.alterarGrade === "Sim") {
                 gerarSolicitacaoGrade = true;
                 horarioSessaoDataParaSolicitacao = horarioSessaoData;
            }

        } else { // iniciou === "nao"
            const motivoNaoInicio = formulario.querySelector('input[name="motivo-nao-inicio"]:checked')?.value;
            if (!motivoNaoInicio) throw new Error("Por favor, selecione o motivo do não início.");

            if (motivoNaoInicio === "desistiu") {
                const motivoDescricao = formulario.querySelector("#motivo-desistencia-pb").value;
                if (!motivoDescricao) throw new Error("Por favor, descreva o motivo da desistência.");

                atendimentos[indiceDoAtendimento].statusAtendimento = "desistencia_antes_inicio";
                atendimentos[indiceDoAtendimento].motivoNaoInicio = motivoDescricao;
                atendimentos[indiceDoAtendimento].naoIniciouEm = serverTimestamp();
                novoStatusPaciente = "desistencia"; // Atualiza status geral do paciente
            } else { // outra_modalidade
                const detalhesSolicitacao = formulario.querySelector("#detalhes-solicitacao-pb").value;
                if (!detalhesSolicitacao) throw new Error("Por favor, detalhe a solicitação do paciente.");

                atendimentos[indiceDoAtendimento].statusAtendimento = "solicitado_reencaminhamento";
                atendimentos[indiceDoAtendimento].motivoNaoInicio = motivoNaoInicio;
                atendimentos[indiceDoAtendimento].solicitacaoReencaminhamento = detalhesSolicitacao;
                atendimentos[indiceDoAtendimento].naoIniciouEm = serverTimestamp();
                novoStatusPaciente = "reavaliar_encaminhamento"; // Atualiza status geral
            }
            dadosParaAtualizar = {
                atendimentosPB: atendimentos,
                status: novoStatusPaciente,
                lastUpdate: serverTimestamp(),
            };
        }

        // Atualiza a trilha do paciente
        await updateDoc(docRef, dadosParaAtualizar);

        // Gera solicitação para grade SE necessário (após sucesso da atualização principal)
        if (gerarSolicitacaoGrade && horarioSessaoDataParaSolicitacao) {
            const solicitacaoGradeData = {
                tipo: "inclusao_alteracao_grade", // Ou um tipo mais específico se preferir
                status: "Pendente",
                dataSolicitacao: serverTimestamp(),
                solicitanteId: userUid,
                solicitanteNome: userData.nome,
                pacienteId: pacienteId,
                pacienteNome: dadosDoPaciente.nomeCompleto,
                atendimentoId: atendimentoId,
                detalhes: { ...horarioSessaoDataParaSolicitacao }, // Envia todos os detalhes do horário
                adminFeedback: null,
            };
            try {
                await addDoc(collection(db, "solicitacoes"), solicitacaoGradeData);
                console.log("Solicitação para inclusão/alteração na grade criada.");
            } catch (gradeError) {
                console.error("Erro ao criar solicitação para grade:", gradeError);
                // Informa o usuário, mas não reverte a atualização da trilha
                alert("Atenção: Houve um erro ao gerar a solicitação para alteração da grade, por favor, notifique o administrativo manualmente.");
            }
        }


        alert("Informações salvas com sucesso!");
        modal.style.display = "none";
        // Recarregar dados da página
        await carregarDadosPaciente(pacienteIdGlobal);
        renderizarCabecalhoInfoBar();
        await carregarSessoes(); // Recarrega sessões também, se aplicável


    } catch (error) {
        console.error("Erro ao salvar informações de Horários PB:", error);
        alert(`Erro ao salvar: ${error.message}`);
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar";
    }
}