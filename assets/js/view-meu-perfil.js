(function() {
    if (!window.firebase || !firebase.apps.length) { return; }
    const auth = firebase.auth();
    const db = firebase.firestore();
    const gridContainer = document.getElementById('supervisor-grid-container');
    const editModal = document.getElementById('edit-profile-modal');
    const detailsModal = document.getElementById('details-profile-modal');
    const agendamentoModal = document.getElementById('agendamento-modal');

    window.fetchedSupervisors = []; 
    let isAdmin = false;

    function openAgendamentoModal(supervisorUid) {
        if (!agendamentoModal) {
            console.error("O modal de agendamento não foi encontrado no HTML.");
            return;
        }
        const supervisorData = window.fetchedSupervisors.find(s => s.uid === supervisorUid);
        if (!supervisorData) return;

        if (window.agendamentoController) {
            window.agendamentoController.open(supervisorData);
        } else {
            console.error("O controller de agendamento (agendamento.js) não foi encontrado.");
        }
        
        detailsModal.style.display = 'none';
        agendamentoModal.style.display = 'flex';
    }


    function openDetailsModal(supervisorUid) {
        if (!detailsModal) return;
        const supervisorData = window.fetchedSupervisors.find(s => s.uid === supervisorUid);
        if (!supervisorData) return;
        
        const modalTitle = detailsModal.querySelector('.modal-header h2');
        if(modalTitle) {
            modalTitle.textContent = `Perfil de ${supervisorData.nome}`;
        }

        const detailsBody = document.getElementById('details-modal-body');
        const toList = (data) => {
            if (!data || data.length === 0) return '<ul><li>Não informado</li></ul>';
            const items = Array.isArray(data) ? data : [data];
            return `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
        };

        let horariosHtml = '<ul><li>Nenhum horário informado</li></ul>';
        if (supervisorData.diasHorarios && Array.isArray(supervisorData.diasHorarios) && supervisorData.diasHorarios.length > 0) {
            horariosHtml = '<ul>';
            supervisorData.diasHorarios.forEach(horario => {
                if(horario.dia && horario.inicio && horario.fim) {
                    horariosHtml += `<li>${horario.dia}: ${horario.inicio} - ${horario.fim}</li>`;
                }
            });
            horariosHtml += '</ul>';
        }

        detailsBody.innerHTML = `
            <div class="profile-section"><h4>Formação</h4>${toList(supervisorData.formacao)}</div>
            <div class="profile-section"><h4>Especialização</h4>${toList(supervisorData.especializacao)}</div>
            <div class="profile-section"><h4>Áreas de Atuação</h4>${toList(supervisorData.atuacao)}</div>
            <div class="profile-section"><h4>Informações de Supervisão</h4>${toList(supervisorData.supervisaoInfo)}</div>
            <div class="profile-section">
                <h4>Dias e Horários para Supervisão</h4>
                ${horariosHtml}
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <button class="action-button" id="agendar-supervisao-btn" data-supervisor-uid="${supervisorUid}">Agendar Supervisão</button>
            </div>
        `;
        detailsModal.style.display = 'flex';
    }

    if (detailsModal) {
        detailsModal.querySelector('.close-modal-btn').addEventListener('click', () => {
            detailsModal.style.display = 'none';
        });

        detailsModal.addEventListener('click', (e) => {
            if (e.target.id === 'agendar-supervisao-btn') {
                const supervisorUid = e.target.dataset.supervisorUid;
                openAgendamentoModal(supervisorUid);
            }
        });
    }

    if (agendamentoModal) {
        agendamentoModal.querySelector('.close-modal-btn').addEventListener('click', () => {
            agendamentoModal.style.display = 'none';
        });
        agendamentoModal.querySelector('#agendamento-cancel-btn').addEventListener('click', () => {
            agendamentoModal.style.display = 'none';
        });
    }

    gridContainer.addEventListener('click', (e) => {
        const editButton = e.target.closest('.edit-supervisor-btn');
        const card = e.target.closest('.supervisor-card');
        if (editButton) {
            e.stopPropagation();
            const uid = editButton.dataset.uid;
            openEditModal(uid);
        } else if (card && window.PROFILE_VIEW_MODE === 'all') {
             const uid = card.dataset.uid;
             openDetailsModal(uid);
        }
    });

    function createSupervisorCard(supervisor, podeEditar) {
        const card = document.createElement('div');
        card.className = 'supervisor-card'; card.dataset.uid = supervisor.uid;
        
        const toList = (data) => {
            if (!data || (Array.isArray(data) && data.length === 0)) return '<li>Não informado</li>';
            const items = Array.isArray(data) ? data : [data];
            return items.map(item => `<li>${item}</li>`).join('');
        };

        // --- INÍCIO DA CORREÇÃO ---
        // Cria o HTML dos detalhes apenas se não estivermos na vitrine pública
        let detailsHtml = '';
        if (window.PROFILE_VIEW_MODE !== 'all') {
            let horariosHtmlCard = '<li>Não informado</li>';
            if (supervisor.diasHorarios && Array.isArray(supervisor.diasHorarios)) {
                horariosHtmlCard = supervisor.diasHorarios.map(h => {
                    if (h && h.dia && h.inicio && h.fim) {
                        return `<li>${h.dia}: ${h.inicio} - ${h.fim}</li>`;
                    }
                    return ''; // Retorna string vazia para objetos malformados
                }).join('');
            }
            if (!horariosHtmlCard) horariosHtmlCard = '<li>Não informado</li>';

            detailsHtml = `
                <div class="profile-section"><h4>Formação</h4><ul>${toList(supervisor.formacao)}</ul></div>
                <div class="profile-section"><h4>Especialização</h4><ul>${toList(supervisor.especializacao)}</ul></div>
                <div class="profile-section"><h4>Áreas de Atuação</h4><ul>${toList(supervisor.atuacao)}</ul></div>
                <div class="profile-section"><h4>Informações de Supervisão</h4><ul>${toList(supervisor.supervisaoInfo)}</ul></div>
                <div class="profile-section"><h4>Dias e Horários</h4><ul>${horariosHtmlCard}</ul></div>
            `;
        }
        // --- FIM DA CORREÇÃO ---

        const pathPrefix = window.location.pathname.includes('/pages/') ? '../' : './';
        const photoPath = supervisor.fotoUrl ? pathPrefix + supervisor.fotoUrl : pathPrefix + 'assets/img/default-user.png';
        const editButtonHtml = podeEditar ? `<button class="edit-supervisor-btn" data-uid="${supervisor.uid}">Editar <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg></button>` : '';
        const crpHtml = supervisor.crp ? `<p><strong>CRP:</strong> ${supervisor.crp}</p>` : '';
        const titleText = supervisor.titulo ? supervisor.titulo.toUpperCase() : 'SUPERVISOR(A)';
        
        card.innerHTML = `
            <div class="supervisor-card-left">
                <div class="photo-container"><img src="${photoPath}" alt="Foto de ${supervisor.nome}" class="supervisor-photo" onerror="this.onerror=null;this.src='${pathPrefix}assets/img/default-user.png';"></div>
                <div class="supervisor-identity"><h2>${supervisor.nome || 'Nome Indisponível'}</h2><div class="title-box">${titleText}</div></div>
                <div class="supervisor-contact">${crpHtml}<p><strong>Telefone:</strong> ${supervisor.telefone || 'N/A'}</p><p><strong>Email:</strong> ${supervisor.email || 'N/A'}</p><p>www.eupsico.org.br</p></div>
                <div class="logo-container"><img src="${pathPrefix}assets/img/logo-branca.png" alt="Logo EuPsico"></div>
            </div>
            <div class="supervisor-card-right">
                ${editButtonHtml}
                <div class="profile-header"><h3>PERFIL PROFISSIONAL</h3></div>
                <div id="card-details-content">
                    ${detailsHtml}
                </div>
            </div>`;
        return card;
    }
    
    if(editModal) {
        const form = document.getElementById('edit-profile-form');
        const horariosContainer = document.getElementById('horarios-editor-container');
        const addHorarioBtn = document.getElementById('add-horario-btn');
        const diasDaSemana = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
        const createHorarioRow = (horario = {}) => {
            const row = document.createElement('div');
            row.className = 'horario-row';
            const diaOptions = diasDaSemana.map(dia => `<option value="${dia}" ${horario.dia === dia ? 'selected' : ''}>${dia}</option>`).join('');
            row.innerHTML = `
                <div class="form-group"><label>Dia</label><select name="horario_dia">${diaOptions}</select></div>
                <div class="form-group"><label>Início</label><input type="time" name="horario_inicio" value="${horario.inicio || '19:00'}"></div>
                <div class="form-group"><label>Fim</label><input type="time" name="horario_fim" value="${horario.fim || '20:00'}"></div>
                <button type="button" class="remove-horario-btn">X</button>`;
            return row;
        };
        addHorarioBtn.addEventListener('click', () => { horariosContainer.appendChild(createHorarioRow()); });
        horariosContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-horario-btn')) { e.target.closest('.horario-row').remove(); }
        });
        form.addEventListener('submit', saveProfileChanges);
        function openEditModal(supervisorUid) {
            const supervisorData = window.fetchedSupervisors.find(s => s.uid === supervisorUid); if (!supervisorData) return;
            form.elements['editing-uid'].value = supervisorData.uid; form.elements['edit-titulo'].value = supervisorData.titulo || '';
            document.getElementById('edit-fotoUrl').value = supervisorData.fotoUrl || '';
            const pathPrefix = window.location.pathname.includes('/pages/') ? '../' : './';
            document.getElementById('profile-photo-preview').src = supervisorData.fotoUrl ? pathPrefix + supervisorData.fotoUrl : pathPrefix + 'assets/img/default-user.png';
            form.elements['edit-abordagem'].value = supervisorData.abordagem || ''; form.elements['edit-crp'].value = supervisorData.crp || '';
            form.elements['edit-email'].value = supervisorData.email || ''; form.elements['edit-telefone'].value = supervisorData.telefone || '';
            form.elements['edit-formacao'].value = Array.isArray(supervisorData.formacao) ? supervisorData.formacao.join('\n') : supervisorData.formacao || '';
            form.elements['edit-especializacao'].value = Array.isArray(supervisorData.especializacao) ? supervisorData.especializacao.join('\n') : '';
            form.elements['edit-atuacao'].value = Array.isArray(supervisorData.atuacao) ? supervisorData.atuacao.join('\n') : '';
            form.elements['edit-supervisaoInfo'].value = Array.isArray(supervisorData.supervisaoInfo) ? supervisorData.supervisaoInfo.join('\n') : '';
            horariosContainer.innerHTML = '';
            if (supervisorData.diasHorarios && Array.isArray(supervisorData.diasHorarios)) {
                supervisorData.diasHorarios.forEach(horario => { horariosContainer.appendChild(createHorarioRow(horario)); });
            }
            editModal.style.display = 'flex';
        }
        function closeEditModal() { editModal.style.display = 'none'; form.reset(); }
        async function saveProfileChanges(e) {
            e.preventDefault(); const uid = form.elements['editing-uid'].value; if (!uid) return;
            const novosHorarios = [];
            const horarioRows = horariosContainer.querySelectorAll('.horario-row');
            horarioRows.forEach(row => {
                const dia = row.querySelector('[name="horario_dia"]').value;
                const inicio = row.querySelector('[name="horario_inicio"]').value;
                const fim = row.querySelector('[name="horario_fim"]').value;
                if (dia && inicio && fim) { novosHorarios.push({ dia, inicio, fim }); }
            });
            const dataToUpdate = {
                titulo: form.elements['edit-titulo'].value.trim(), fotoUrl: document.getElementById('edit-fotoUrl').value.trim(),
                abordagem: form.elements['edit-abordagem'].value.trim(), crp: form.elements['edit-crp'].value.trim(),
                email: form.elements['edit-email'].value.trim(), telefone: form.elements['edit-telefone'].value.trim(),
                formacao: form.elements['edit-formacao'].value.split('\n').filter(Boolean),
                especializacao: form.elements['edit-especializacao'].value.split('\n').filter(Boolean),
                atuacao: form.elements['edit-atuacao'].value.split('\n').filter(Boolean),
                supervisaoInfo: form.elements['edit-supervisaoInfo'].value.split('\n').filter(Boolean),
                diasHorarios: novosHorarios,
            };
            try {
                await db.collection('usuarios').doc(uid).update(dataToUpdate);
                closeEditModal(); loadProfiles(auth.currentUser);
            } catch (error) { console.error("Erro ao salvar:", error); alert("Erro ao salvar."); }
        }
        editModal.querySelector('.close-modal-btn').addEventListener('click', closeEditModal);
        document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
    }

    async function loadProfiles(user) {
        if (!gridContainer) return;
        try {
            const userDoc = await db.collection('usuarios').doc(user.uid).get(); if (!userDoc.exists) throw new Error("Usuário não encontrado.");
            const userData = userDoc.data(); isAdmin = (userData.funcoes || []).includes('admin');
            const podeEditar = isAdmin || (userData.funcoes || []).includes('supervisor');
            let query;
            if (window.PROFILE_VIEW_MODE === 'all' || isAdmin) {
                query = db.collection('usuarios').where('funcoes', 'array-contains', 'supervisor').where('inativo', '==', false).orderBy('nome');
            } else {
                query = db.collection('usuarios').where(firebase.firestore.FieldPath.documentId(), '==', user.uid);
            }
            const snapshot = await query.get(); 
            window.fetchedSupervisors = [];
            if (snapshot.empty) { gridContainer.innerHTML = '<p>Nenhum supervisor encontrado.</p>'; return; }
            snapshot.forEach(doc => window.fetchedSupervisors.push({ uid: doc.id, ...doc.data() }));
            gridContainer.innerHTML = '';
            window.fetchedSupervisors.forEach(supervisor => {
                const cardElement = createSupervisorCard(supervisor, podeEditar);
                gridContainer.appendChild(cardElement);
            });
        } catch (error) { console.error("Erro ao carregar perfis:", error); gridContainer.innerHTML = '<p style="color:red;">Ocorreu um erro ao carregar perfis.</p>'; }
    }

    auth.onAuthStateChanged(user => {
        if (user) { loadProfiles(user); } 
        else { if(gridContainer) { gridContainer.innerHTML = '<p style="color:red;">Autenticação necessária.</p>'; } }
    });
})();