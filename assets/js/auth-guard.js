// assets/js/auth-service.js
// O "Porteiro" Global do seu Site

const authService = {
    _user: null,
    _userRoles: null, // Usaremos para guardar as funções (perfis) após a primeira busca

    /**
     * Pega o usuário autenticado no Firebase.
     * @returns {firebase.User|null}
     */
    getCurrentFirebaseUser() {
        return firebase.auth().currentUser;
    },

    /**
     * Busca as funções (perfis) do usuário no Firestore.
     * Faz a busca no banco de dados apenas uma vez e guarda o resultado.
     * @returns {Promise<string[]>} Uma promessa que resolve para um array de funções (ex: ['supervisor', 'admin'])
     */
    async getUserRoles() {
        // Se já buscamos as funções antes, retorna o resultado guardado
        if (this._userRoles !== null) {
            return this._userRoles;
        }

        const user = this.getCurrentFirebaseUser();
        if (!user) {
            this._userRoles = []; // Se não há usuário, não há funções
            return this._userRoles;
        }

        try {
            const userDoc = await firebase.firestore().collection('usuarios').doc(user.uid).get();
            if (userDoc.exists) {
                this._userRoles = userDoc.data().funcoes || []; // Guarda o resultado
            } else {
                this._userRoles = []; // Usuário autenticado mas sem registro no Firestore
            }
            return this._userRoles;
        } catch (error) {
            console.error("Erro ao buscar funções do usuário:", error);
            this._userRoles = []; // Em caso de erro, nega todas as permissões
            return this._userRoles;
        }
    },

    /**
     * Funções auxiliares para verificar perfis específicos.
     * Elas dependem que getUserRoles() já tenha sido chamado.
     */
    isAdmin() {
        return this._userRoles && this._userRoles.includes('admin');
    },

    isSupervisor() {
        return this._userRoles && this._userRoles.includes('supervisor');
    },

    /**
     * A FUNÇÃO MAIS IMPORTANTE: O "Guarda da Página"
     * Use esta função no início de cada página que você quer proteger.
     * @param {string[]} requiredRoles - Um array com os perfis que podem acessar a página. Ex: ['admin', 'supervisor']
     */
    async protectPage(requiredRoles = []) {
        const userRoles = await this.getUserRoles();

        // Se o usuário não está logado, redireciona para o login
        if (!this.getCurrentFirebaseUser()) {
            console.log("Usuário não logado. Redirecionando para login...");
            window.location.href = '/login.html'; // <-- MUDE AQUI para sua página de login
            return;
        }

        // Verifica se o usuário tem PELO MENOS UM dos perfis necessários
        const hasPermission = requiredRoles.some(role => userRoles.includes(role));

        if (!hasPermission) {
            console.log("Acesso negado. Redirecionando...");
            window.location.href = '/acesso-negado.html'; // <-- CRIE ESTA PÁGINA (ou use outra)
        }
        
        // Se chegou até aqui, o usuário tem permissão e a página pode carregar normalmente.
    }
};