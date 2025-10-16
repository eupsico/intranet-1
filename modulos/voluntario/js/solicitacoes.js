// Arquivo: /modulos/voluntario/js/solicitacoes.js
// Versão: 1.1 (Adiciona suporte para deep linking de abas)

export function init(db, user, userData, tabToOpen) {
    const view = document.querySelector('.view-container');
    if (!view) return;

    // --- Lógica das Abas ---
    const tabContainer = view.querySelector('.tabs-container');
    const contentSections = view.querySelectorAll('.tab-content');

    if (tabContainer) {
        tabContainer.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.classList.contains('tab-link')) {
                const tabId = e.target.dataset.tab;

                tabContainer.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');

                contentSections.forEach(section => {
                    section.style.display = section.id === tabId ? 'block' : 'none';
                });
            }
        });
    }

    // --- INÍCIO DA ALTERAÇÃO ---
    // Verifica se uma aba específica deve ser aberta
    if (tabToOpen) {
        const tabButton = tabContainer.querySelector(`.tab-link[data-tab="${tabToOpen}"]`);
        if (tabButton) {
            tabButton.click(); // Simula o clique para ativar a aba correta
        }
    }
    // --- FIM DA ALTERAÇÃO ---

    // --- Lógica do Modal do Pipefy ---
    const modal = document.getElementById("pipefyModal");
    const btn = document.getElementById("openPipefyModalBtn");
    const span = document.getElementById("closePipefyModalBtn");

    if (modal && btn && span) {
        btn.onclick = function() {
            modal.style.display = "block";
        }
        span.onclick = function() {
            modal.style.display = "none";
        }
        window.addEventListener('click', function(event) {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        });
    }
}