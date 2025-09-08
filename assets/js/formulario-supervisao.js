// assets/js/formulario-supervisao.js (Versão 9 - Completo e Corrigido)
(function() {
    if (!db || !auth.currentUser) {
        console.error("Firestore ou usuário não autenticado não encontrado.");
        return;
    }

    const currentUser = auth.currentUser;
    const supervisaoCollection = db.collection('supervisao');
    
    const listaContainer = document.getElementById('lista-acompanhamentos-container');
    const formContainer = document.getElementById('form-container');
    const form = document.getElementById('ficha-supervisao');
    const saveStatus = document.getElementById('save-status');
    const supervisorSelect = document.getElementById('supervisor-nome');
    const psicologoSelect = document.getElementById('psicologo-nome');
    const listaRegistros = document.getElementById('lista-registros');
    const pdfBtn = document.getElementById('pdf-btn');
    const documentIdField = document.getElementById('document-id');
    const filtrosContainer = document.getElementById('filtros-container');
    const filtroSupervisorView = document.getElementById('filtro-supervisor-view');
    const filtroPsicologoSelect = document.getElementById('filtro-psicologo');
    const filtroPacienteInput = document.getElementById('filtro-paciente');
    
    let todosOsRegistros = [];
    let isSupervisor = false;

    function debounce(func, delay) {
        let timeout;
        return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); };
    }

    async function popularSelects() {
        try {
            const supervisoresQuery = db.collection('usuarios').where('funcoes', 'array-contains', 'supervisor').where('inativo', '==', false);
            const psicologosQuery = db.collection('usuarios').where('profissao', 'in', ['Psicólogo', 'Psicopedagoga', 'Musicoterapeuta']).where('inativo', '==', false);
            const [supervisoresSnapshot, psicologosSnapshot] = await Promise.all([supervisoresQuery.get(), psicologosQuery.get()]);
            supervisorSelect.innerHTML = '<option value="">Selecione um supervisor</option>';
            psicologoSelect.innerHTML = '<option value="">Selecione um psicólogo</option>';
            let isCurrentUserAPsicologo = false;
            psicologosSnapshot.forEach(doc => {
                const user = doc.data();
                if (user && user.nome && user.uid) {
                    psicologoSelect.innerHTML += `<option value="${user.uid}">${user.nome}</option>`;
                    if (user.uid === currentUser.uid) { isCurrentUserAPsicologo = true; }
                }
            });
            supervisoresSnapshot.forEach(doc => {
                const user = doc.data();
                if (user && user.nome && user.uid) { supervisorSelect.innerHTML += `<option value="${user.uid}">${user.nome}</option>`; }
            });
            if (isCurrentUserAPsicologo) { psicologoSelect.value = currentUser.uid; }
        } catch (error) {
            console.error("Erro ao popular selects:", error);
            supervisorSelect.innerHTML = '<option value="">Erro ao carregar</option>';
            psicologoSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    function renderizarLista(registrosParaRenderizar) {
        if (!listaRegistros) return;
        listaRegistros.innerHTML = '';
        if (registrosParaRenderizar.length === 0) {
            listaRegistros.innerHTML = '<p>Nenhum acompanhamento encontrado com os filtros atuais.</p>';
            return;
        }
        const registrosOrdenados = registrosParaRenderizar.sort((a, b) => new Date(b.supervisaoData) - new Date(a.supervisaoData));
        registrosOrdenados.forEach(registro => {
            const div = document.createElement('div');
            div.className = 'registro-item';
            div.dataset.id = registro.id;
            div.innerHTML = `<span><strong>Paciente:</strong> ${registro.pacienteIniciais || 'N/A'}</span><span><strong>Psicólogo(a):</strong> ${registro.psicologoNome || 'N/A'}</span><span><strong>Data:</strong> ${registro.supervisaoData ? new Date(registro.supervisaoData + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</span>`;
            listaRegistros.appendChild(div);
        });
    }

    function aplicarFiltros() {
        if (!filtroPacienteInput || !filtroPsicologoSelect) return;
        const pacienteTermo = filtroPacienteInput.value.toLowerCase();
        const psicologoUidSelecionado = isSupervisor ? filtroPsicologoSelect.value : '';
        let registrosFiltrados = todosOsRegistros.filter(reg => {
            const pacienteMatch = !pacienteTermo || (reg.pacienteIniciais && reg.pacienteIniciais.toLowerCase().includes(pacienteTermo));
            const psicologoMatch = !isSupervisor || !psicologoUidSelecionado || reg.psicologoUid === psicologoUidSelecionado;
            return pacienteMatch && psicologoMatch;
        });
        renderizarLista(registrosFiltrados);
    }
    
    async function carregarRegistros() {
        if (!listaRegistros) return;
        listaRegistros.innerHTML = '<p>Carregando...</p>';
        try {
            const comoPsicologoQuery = supervisaoCollection.where('psicologoUid', '==', currentUser.uid);
            const comoSupervisorQuery = supervisaoCollection.where('supervisorUid', '==', currentUser.uid);
            const [psicologoSnapshot, supervisorSnapshot] = await Promise.all([ comoPsicologoQuery.get(), comoSupervisorQuery.get() ]);
            const registrosMap = new Map();
            psicologoSnapshot.forEach(doc => registrosMap.set(doc.id, { id: doc.id, ...doc.data() }));
            supervisorSnapshot.forEach(doc => registrosMap.set(doc.id, { id: doc.id, ...doc.data() }));
            todosOsRegistros = Array.from(registrosMap.values());
            if (isSupervisor) {
                const psicologosSupervisionados = new Map();
                todosOsRegistros.forEach(reg => {
                    if(reg.psicologoUid && reg.psicologoNome) { psicologosSupervisionados.set(reg.psicologoUid, reg.psicologoNome); }
                });
                filtroPsicologoSelect.innerHTML = '<option value="">Todos os Profissionais</option>';
                psicologosSupervisionados.forEach((nome, uid) => { filtroPsicologoSelect.innerHTML += `<option value="${uid}">${nome}</option>`; });
            }
            aplicarFiltros();
        } catch (error) {
            console.error("Erro ao carregar registros:", error);
            listaRegistros.innerHTML = '<p style="color:red;">Ocorreu um erro ao buscar os dados.</p>';
        }
    }
    
    function preencherFormulario(dados) {
        if (!form) return;
        form.reset();
        documentIdField.value = dados.id || '';
        for (const key in dados) {
            if (Object.prototype.hasOwnProperty.call(dados, key)) {
                const field = form.elements[key];
                if (field) {
                    if (field.tagName === 'SELECT') {
                        if (key === 'psicologoNome') field.value = dados.psicologoUid || '';
                        else if (key === 'supervisorNome') field.value = dados.supervisorUid || '';
                        else field.value = dados[key];
                    } else { field.value = dados[key]; }
                }
            }
        }
        if(listaContainer) listaContainer.style.display = 'none';
        if(formContainer) formContainer.style.display = 'block';
        if(pdfBtn) pdfBtn.style.display = 'block';
        document.getElementById('paciente-iniciais').disabled = true;
        if (psicologoSelect) psicologoSelect.disabled = true;
    }

    function verificarCamposGatilho() {
        if (!form) return false;
        const supervisor = form.elements['supervisorNome'].value;
        const inicioTerapia = form.elements['terapiaInicio'].value;
        const pacienteIniciais = form.elements['pacienteIniciais'].value;
        const pacienteIdade = form.elements['pacienteIdade'].value;
        const pacienteGenero = form.elements['pacienteGenero'].value;
        const pacienteSessoes = form.elements['pacienteSessoes'].value;
        const pacienteApresentacao = form.elements['pacienteApresentacao'].value;
        return supervisor && inicioTerapia && pacienteIniciais && pacienteIdade && pacienteGenero && pacienteSessoes && pacienteApresentacao;
    }

    const autoSaveForm = async () => {
        if (!verificarCamposGatilho()) {
            if (saveStatus) saveStatus.textContent = 'Preencha os campos de Identificação para salvar.';
            return;
        }
        if (saveStatus) saveStatus.textContent = 'Salvando...';
        const formData = new FormData(form);
        const dataToSave = Object.fromEntries(formData.entries());
        dataToSave.psicologoUid = psicologoSelect.value;
        dataToSave.supervisorUid = supervisorSelect.value;
        dataToSave.psicologoNome = psicologoSelect.options[psicologoSelect.selectedIndex]?.text || '';
        dataToSave.supervisorNome = supervisorSelect.options[supervisorSelect.selectedIndex]?.text || '';
        dataToSave.lastUpdated = new Date();
        try {
            const docId = documentIdField.value;
            if (docId) {
                await supervisaoCollection.doc(docId).set(dataToSave, { merge: true });
            } else {
                const newDocRef = await supervisaoCollection.add(dataToSave);
                documentIdField.value = newDocRef.id;
            }
            if (saveStatus) {
                saveStatus.textContent = 'Salvo ✓';
                setTimeout(() => { saveStatus.textContent = ''; }, 2500);
            }
        } catch (error) {
            console.error("Erro ao salvar:", error);
            if (saveStatus) saveStatus.textContent = 'Erro ao salvar!';
        }
    };

    if(listaRegistros) {
        listaRegistros.addEventListener('click', async (e) => {
            const item = e.target.closest('.registro-item');
            if (item) {
                const docId = item.dataset.id;
                try {
                    const docSnap = await supervisaoCollection.doc(docId).get();
                    if (docSnap.exists) {
                        await popularSelects();
                        preencherFormulario({ id: docId, ...docSnap.data() });
                    } else {
                        alert("Este registro não foi encontrado. Pode ter sido excluído.");
                        carregarRegistros();
                    }
                } catch (error) {
                    console.error("Erro ao abrir registro:", error);
                    alert("Não foi possível carregar os detalhes deste registro.");
                }
            }
        });
    }

    if(form) {
        form.addEventListener('input', debounce(autoSaveForm, 2000));
        form.addEventListener('change', debounce(autoSaveForm, 2000));
    }

    if(pdfBtn) {
        pdfBtn.addEventListener('click', function() {
            this.textContent = 'Gerando PDF...';
            this.disabled = true;
            const elementToPrint = document.getElementById('form-container');
            const paciente = form.elements['pacienteIniciais'].value || 'paciente';
            const data = form.elements['supervisaoData'].value || new Date().toISOString().split('T')[0];
            const filename = `Acompanhamento_${paciente.replace(/\s+/g, '_')}_${data}.pdf`;
            const options = { margin: 10, filename: filename, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
            html2pdf().from(elementToPrint).set(options).save().then(() => {
                this.textContent = 'Exportar para PDF';
                this.disabled = false;
            }).catch(err => {
                console.error("Erro ao gerar PDF:", err);
                this.textContent = 'Erro! Tente Novamente';
                this.disabled = false;
            });
        });
    }
    
    async function init() {
        const userDoc = await db.collection("usuarios").doc(currentUser.uid).get();
        if (userDoc.exists && userDoc.data().funcoes?.includes('supervisor')) {
            isSupervisor = true;
            if(filtroSupervisorView) filtroSupervisorView.style.display = 'block';
        }
        if(filtrosContainer) filtrosContainer.style.display = 'flex';
        
        if (window.formSupervisaoInitialDocId) {
            const docId = window.formSupervisaoInitialDocId;
            const docSnap = await supervisaoCollection.doc(docId).get();
            if (docSnap.exists) {
                await popularSelects();
                preencherFormulario({ id: docId, ...docSnap.data() });
            }
            window.formSupervisaoInitialDocId = null;
        }
        else if (window.formSupervisaoMode === 'new') {
            if(listaContainer) listaContainer.style.display = 'none';
            if(formContainer) formContainer.style.display = 'block';
            if(pdfBtn) pdfBtn.style.display = 'none';
            const pacienteIniciaisInput = document.getElementById('paciente-iniciais');
            if(pacienteIniciaisInput) pacienteIniciaisInput.disabled = false;
            if(psicologoSelect) psicologoSelect.disabled = false;
            if(form) form.reset();
            if(documentIdField) documentIdField.value = '';
            await popularSelects();
            if (psicologoSelect && psicologoSelect.value === currentUser.uid) {
                psicologoSelect.disabled = true;
            }
        } else {
            if(listaContainer) listaContainer.style.display = 'block';
            if(formContainer) formContainer.style.display = 'none';
            carregarRegistros();
        }
        
        if(filtroPacienteInput) filtroPacienteInput.addEventListener('input', aplicarFiltros);
        if(filtroPsicologoSelect) filtroPsicologoSelect.addEventListener('change', aplicarFiltros);
    }

    init();
})();
