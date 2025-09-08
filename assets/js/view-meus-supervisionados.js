// assets/js/view-meus-supervisionados.js
(function() {
    if (!db || !auth.currentUser) return;

    const currentUser = auth.currentUser;
    const listaContainer = document.getElementById('lista-supervisionados-container');
    const filtroPacienteSelect = document.getElementById('filtro-paciente');
    const filtroProfissionalSelect = document.getElementById('filtro-profissional');

    let todosOsRegistros = []; 

    function renderizarLista(registros) {
        listaContainer.innerHTML = '';
        if (registros.length === 0) {
            listaContainer.innerHTML = '<p>Nenhum acompanhamento encontrado com os filtros atuais.</p>';
            return;
        } 
        
        registros.forEach(registro => {
            const dataFormatada = registro.supervisaoData ? new Date(registro.supervisaoData + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A';
            const div = document.createElement('div');
            div.className = 'registro-item';
            div.dataset.id = registro.id;
            div.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; text-align: left; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 10px; cursor: pointer;";
            div.innerHTML = `
                <div><strong>Paciente:</strong><br>${registro.pacienteIniciais || 'N/A'}</div>
                <div><strong>Profissional Supervisionado:</strong><br>${registro.psicologoNome || 'N/A'}</div>
                <div><strong>Data da Supervisão:</strong><br>${dataFormatada}</div>
            `;
            listaContainer.appendChild(div);
        });
    }

    function popularFiltroPacientes() {
        const uidProfissional = filtroProfissionalSelect.value;
        
        let registrosParaFiltrar = todosOsRegistros;
        if (uidProfissional) {
            registrosParaFiltrar = todosOsRegistros.filter(reg => reg.psicologoUid === uidProfissional);
        }

        const pacientes = new Map();
        registrosParaFiltrar.forEach(reg => {
            if (reg.pacienteIniciais) {
                pacientes.set(reg.pacienteIniciais.toLowerCase(), reg.pacienteIniciais);
            }
        });

        filtroPacienteSelect.innerHTML = '<option value="">Todos os Pacientes</option>';
        pacientes.forEach((nome, chave) => {
            const option = document.createElement('option');
            option.value = chave;
            option.textContent = nome;
            filtroPacienteSelect.appendChild(option);
        });
    }

    function aplicarFiltros() {
        const termoPaciente = filtroPacienteSelect.value;
        const uidProfissional = filtroProfissionalSelect.value;

        const registrosFiltrados = todosOsRegistros.filter(reg => {
            const matchPaciente = !termoPaciente || (reg.pacienteIniciais && reg.pacienteIniciais.toLowerCase() === termoPaciente);
            const matchProfissional = !uidProfissional || reg.psicologoUid === uidProfissional;
            return matchPaciente && matchProfissional;
        });

        renderizarLista(registrosFiltrados);
    }

    async function carregarSupervisionados() {
        listaContainer.innerHTML = '<div class="loading-spinner"></div>'; 

        try {
            const snapshot = await db.collection('supervisao')
                .where('supervisorUid', '==', currentUser.uid)
                .orderBy('supervisaoData', 'desc')
                .get();

            if (snapshot.empty) {
                document.getElementById('filtros-supervisionados-container').style.display = 'none';
                listaContainer.innerHTML = '<p>Nenhum acompanhamento encontrado para sua supervisão.</p>';
                return;
            } 
            
            todosOsRegistros = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const profissionais = new Map();
            todosOsRegistros.forEach(reg => {
                if (reg.psicologoUid && reg.psicologoNome) {
                    profissionais.set(reg.psicologoUid, reg.psicologoNome);
                }
            });

            filtroProfissionalSelect.innerHTML = ''; // Limpa antes de popular
            const defaultOptionProf = document.createElement('option');
            defaultOptionProf.value = '';
            defaultOptionProf.textContent = 'Todos os Profissionais';
            filtroProfissionalSelect.appendChild(defaultOptionProf);

            profissionais.forEach((nome, uid) => {
                const option = document.createElement('option');
                option.value = uid;
                option.textContent = nome;
                filtroProfissionalSelect.appendChild(option);
            });

            filtroProfissionalSelect.addEventListener('change', () => {
                popularFiltroPacientes();
                aplicarFiltros();
            });
            filtroPacienteSelect.addEventListener('change', aplicarFiltros);

            popularFiltroPacientes(); 
            renderizarLista(todosOsRegistros);

        } catch (error) {
            console.error("Erro ao carregar supervisionados:", error);
            listaContainer.innerHTML = `<p style="color:red;">Ocorreu um erro ao carregar a lista.</p>`;
        }
    }
    
    listaContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.registro-item');
        if (item) {
            const docId = item.dataset.id;
            if (window.loadFormularioView) {
                window.loadFormularioView(docId);
            }
        }
    });

    carregarSupervisionados();
})();
