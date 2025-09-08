// assets/js/view-meu-perfil.js (Versão 6 - Com caminhos relativos)
(function() {
    if (!window.firebase || !auth || !db) {
        console.error("Firebase não inicializado.");
        document.getElementById('supervisor-grid-container').innerHTML = '<p style="color:red;">Erro de inicialização.</p>';
        return;
    }

    const currentUser = auth.currentUser;
    const gridContainer = document.getElementById('supervisor-grid-container');
    let fetchedSupervisors = []; 
    let isAdmin = false; 

    const modal = document.getElementById('edit-profile-modal');
    if(modal) {
        const form = document.getElementById('edit-profile-form');
        const photoEditSection = document.querySelector('.photo-edit-section');

        function openEditModal(supervisorUid) {
            const supervisorData = fetchedSupervisors.find(s => s.uid === supervisorUid);
            if (!supervisorData) return;

            form.elements['editing-uid'].value = supervisorData.uid;

            document.getElementById('edit-fotoUrl').value = supervisorData.fotoUrl || '';

            const pathPrefix = window.location.pathname.includes('/pages/') ? '../' : './';
            document.getElementById('profile-photo-preview').src = supervisorData.fotoUrl ? pathPrefix + supervisorData.fotoUrl : pathPrefix + 'assets/img/default-user.png';

            // NOVO: Preenche os novos campos no formulário de edição
            form.elements['edit-abordagem'].value = supervisorData.abordagem || '';
            form.elements['edit-crp'].value = supervisorData.crp || '';
            form.elements['edit-email'].value = supervisorData.email || '';
            form.elements['edit-telefone'].value = supervisorData.telefone || '';
            // FIM DA ALTERAÇÃO

            form.elements['edit-formacao'].value = supervisorData.formacao || '';
            form.elements['edit-especializacao'].value = Array.isArray(supervisorData.especializacao) ? supervisorData.especializacao.join('\n') : supervisorData.especializacao || '';
            form.elements['edit-atuacao'].value = Array.isArray(supervisorData.atuacao) ? supervisorData.atuacao.join('\n') : supervisorData.atuacao || '';
            form.elements['edit-supervisaoInfo'].value = Array.isArray(supervisorData.supervisaoInfo) ? supervisorData.supervisaoInfo.join('\n') : supervisorData.supervisaoInfo || '';
            form.elements['edit-diasHorarios'].value = Array.isArray(supervisorData.diasHorarios) ? supervisorData.diasHorarios.join('\n') : supervisorData.diasHorarios || '';
            
            if (photoEditSection) {
                photoEditSection.style.display = isAdmin ? 'block' : 'none';
            }
            modal.style.display = 'flex';
        }

        function closeEditModal() {
            modal.style.display = 'none';
            form.reset();
        }

        async function saveProfileChanges(e) {
            e.preventDefault();
            const uid = form.elements['editing-uid'].value;
            if (!uid) return;

            // NOVO: Adiciona os novos campos ao objeto que será salvo no banco
            const dataToUpdate = {
                fotoUrl: document.getElementById('edit-fotoUrl').value.trim(),
                abordagem: form.elements['edit-abordagem'].value.trim(), // NOVO
                crp: form.elements['edit-crp'].value.trim(),             // NOVO
                email: form.elements['edit-email'].value.trim(),         // NOVO
                telefone: form.elements['edit-telefone'].value.trim(),   // NOVO
                formacao: form.elements['edit-formacao'].value,
                especializacao: form.elements['edit-especializacao'].value.split('\n').filter(line => line.trim() !== ''),
                atuacao: form.elements['edit-atuacao'].value.split('\n').filter(line => line.trim() !== ''),
                supervisaoInfo: form.elements['edit-supervisaoInfo'].value.split('\n').filter(line => line.trim() !== ''),
                diasHorarios: form.elements['edit-diasHorarios'].value.split('\n').filter(line => line.trim() !== ''),
            };

            try {
                await db.collection('usuarios').doc(uid).update(dataToUpdate);
                closeEditModal();
                loadProfiles();
            } catch (error) {
                console.error("Erro ao salvar alterações:", error);
                alert("Não foi possível salvar as alterações.");
            }
        }
        
        modal.querySelector('.close-modal-btn').addEventListener('click', closeEditModal);
        document.getElementById('cancel-edit-btn').addEventListener('click', closeEditModal);
        document.getElementById('save-profile-btn').addEventListener('click', saveProfileChanges);
        
        gridContainer.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('edit-supervisor-btn')) {
                const uid = e.target.dataset.uid;
                openEditModal(uid);
            }
        });
    }

    async function loadProfiles() {
        if (!currentUser || !gridContainer) return;
        
        try {
            const forceAll = window.PROFILE_VIEW_MODE === 'all';
            window.PROFILE_VIEW_MODE = null;

            const userDoc = await db.collection('usuarios').doc(currentUser.uid).get();
            if (!userDoc.exists) throw new Error("Usuário logado não encontrado.");
            
            const userData = userDoc.data();
            const funcoes = userData.funcoes || [];
            isAdmin = funcoes.includes('admin');
            const podeEditar = funcoes.includes('admin') || funcoes.includes('supervisor');

            let query;
            if (forceAll || isAdmin) {
                query = db.collection('usuarios').where('funcoes', 'array-contains', 'supervisor').where('inativo', '==', false).orderBy('nome');
            } else {
                query = db.collection('usuarios').where(firebase.firestore.FieldPath.documentId(), '==', currentUser.uid);
            }

            const snapshot = await query.get();
            fetchedSupervisors = []; 

            if (snapshot.empty) {
                gridContainer.innerHTML = '<p>Nenhum perfil de supervisor foi encontrado.</p>';
                return;
            }

            snapshot.forEach(doc => fetchedSupervisors.push({ uid: doc.id, ...doc.data() }));

            gridContainer.innerHTML = ''; 
            fetchedSupervisors.forEach(supervisor => {
                const cardElement = createSupervisorCard(supervisor, podeEditar);
                gridContainer.appendChild(cardElement);
            });

        } catch (error) {
            console.error("Erro ao carregar perfis:", error);
            gridContainer.innerHTML = '<p style="color:red;">Ocorreu um erro ao carregar os perfis.</p>';
        }
    }

// ATUALIZE ESTA FUNÇÃO no arquivo assets/js/view-meu-perfil.js

function createSupervisorCard(supervisor, podeEditar) {
    const card = document.createElement('div');
    card.className = 'supervisor-card';

    const toList = (data) => {
        if (!data) return '<li>Não informado</li>';
        return Array.isArray(data) ? data.map(item => `<li>${item}</li>`).join('') : `<li>${data}</li>`;
    };
    
    // --- LÓGICA DO CAMINHO RELATIVO ---
    const pathPrefix = window.location.pathname.includes('/pages/') ? '../' : './';
    const photoPath = supervisor.fotoUrl ? pathPrefix + supervisor.fotoUrl : pathPrefix + 'assets/img/default-user.png';

    // NOVO: Lógica para exibir campos apenas se existirem
    const abordagemHtml = supervisor.abordagem ? `<h3>${supervisor.abordagem}</h3>` : '';
    const crpHtml = supervisor.crp ? `<li><strong>CRP:</strong> ${supervisor.crp}</li>` : '';
    // FIM DA ALTERAÇÃO

    // VERSÃO CORRIGIDA DO HTML
    card.innerHTML = `
        <div class="supervisor-card-left">
            <h2>${supervisor.nome || 'Nome Indisponível'}</h2>
            ${abordagemHtml}
            <ul class="contact-info">
                ${crpHtml}
                <li><strong>Telefone:</strong> ${supervisor.telefone || 'N/A'}</li>
                <li><strong>Email:</strong> ${supervisor.email || 'N/A'}<br>www.eupsico.org.br</li>
            </ul>
            <div class="photo-container">
                <img src="${photoPath}" alt="Foto de ${supervisor.nome}" class="supervisor-photo" onerror="this.onerror=null;this.src='../assets/img/default-user.png';">
                <img src="${pathPrefix}assets/img/logo-branca.png" alt="Logo EuPsico" class="overlay-logo">
            </div>
        </div>
        <div class="supervisor-card-right">
            ${podeEditar ? `<button class="edit-supervisor-btn" data-uid="${supervisor.uid}">Editar</button>` : ''}
            <div class="profile-header">PERFIL PROFISSIONAL</div>
            <h4>Formação</h4>
            <ul><li>${supervisor.formacao || 'Não informado'}</li></ul>
            <h4>Especialização</h4>
            <ul>${toList(supervisor.especializacao)}</ul>
            <h4>Áreas de Atuação</h4>
            <ul>${toList(supervisor.atuacao)}</ul>
            <h4>Informações de Supervisão</h4>
            <ul>${toList(supervisor.supervisaoInfo)}</ul>
            <h4>Dias e Horários</h4>
            <ul>${toList(supervisor.diasHorarios)}</ul>
        </div>
    `;
    return card;
}

    loadProfiles();
})();
