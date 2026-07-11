document.addEventListener('DOMContentLoaded', () => {
    const itemForm = document.getElementById('item-form');
    const itemNameInput = document.getElementById('item-name');
    const itemNotesInput = document.getElementById('item-notes');
    const itemTypeSelect = document.getElementById('item-type');
    const itemStatusSelect = document.getElementById('item-status'); 
    const itemListTypeSelect = document.getElementById('item-list-type'); 
    const itemsContainer = document.getElementById('items-container');
    const noItemsMessage = document.getElementById('no-items-message');
    const filterTypeSelect = document.getElementById('filter-type');
    const filterListVisibility = document.getElementById('filter-list-visibility'); 
    const toggleBtn = document.getElementById('toggle-theme');
    const siteLogo = document.querySelector('header .logo');

    const authSection = document.getElementById('auth-section');
    const duoSettingsSection = document.getElementById('duo-settings-section'); 
    const authForm = document.getElementById('auth-form');
    const authEmailInput = document.getElementById('auth-email');
    const authPasswordInput = document.getElementById('auth-password');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const authMessage = document.getElementById('auth-message');
    const userInfoSpan = document.getElementById('user-info');
    const logoutBtn = document.getElementById('logout-btn');
    const addItemSection = document.getElementById('add-item');
    const itemlistSection = document.getElementById('item-list');
    const statusTabsNav = document.getElementById('status-tabs-nav');
    
    const authExtraFields = document.getElementById('auth-extra-fields'); 
    const authNameInput = document.getElementById('auth-name');
    const authDuoInput = document.getElementById('auth-duo-code'); 
    const toggleAuthBtn = document.getElementById('toggle-auth-btn');

    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const forgotEmailForm = document.getElementById('forgot-email-form');
    const resetPasswordForm = document.getElementById('reset-password-form');
    const backToLoginBtn = document.getElementById('back-to-login-btn');
    const backToLoginFromEmailBtn = document.getElementById('back-to-login-from-email-btn');
    const submitResetBtn = document.getElementById('submit-reset-btn');
    const authTitle = document.getElementById('auth-title');
    let emailForRecovery = "";
    
    let isLoginMode = true;
    let currentActiveTabStatus = localStorage.getItem('activeTabStatus') || 'all'; 
    const ITEMS_PER_PAGE = 6; 
    let currentPage = 1; 
    let totalPages = 1; 
    const paginationContainer = document.createElement('div'); 
    paginationContainer.classList.add('pagination-container');
    itemlistSection.appendChild(paginationContainer); 

    let apiItems = [];
    let currentUserData = JSON.parse(localStorage.getItem('currentUserData')) || null;

    function applyTheme(theme) {
        if (theme === 'dark') { document.body.classList.add('dark'); if (siteLogo) siteLogo.src = 'logo.png'; toggleBtn.textContent = '☀️'; } 
        else { document.body.classList.remove('dark'); if (siteLogo) siteLogo.src = 'logo-dark.png'; toggleBtn.textContent = '🌙'; }
        localStorage.setItem('duoTheme', theme);
    }
    const savedTheme = localStorage.getItem('duoTheme');
    if (savedTheme) applyTheme(savedTheme); else applyTheme(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    toggleBtn.addEventListener('click', () => applyTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', () => { currentPage = 1; renderItems(); });

    const submitButton = itemForm.querySelector('button[type="submit"]');
    if (submitButton) {
        const formButtonsDiv = document.createElement('div');
        formButtonsDiv.classList.add('form-buttons');
        formButtonsDiv.appendChild(submitButton);
        const clearButton = document.createElement('button');
        clearButton.type = 'button'; clearButton.id = 'clear-form-btn'; clearButton.classList.add('clear-btn'); clearButton.textContent = 'Limpar';
        clearButton.addEventListener('click', () => { itemForm.reset(); submitButton.textContent = 'Adicionar à Lista'; delete submitButton.dataset.editingId; });
        formButtonsDiv.appendChild(clearButton);
        itemForm.appendChild(formButtonsDiv);
    }

    function getTagIcon(type) { return type === 'game' ? '🎮' : type === 'movie' ? '🎬' : '📺'; }
    function getStatusTag(status, type) {
        let text = status === 'to-watch-play' ? (type === 'game' ? 'Para Jogar' : 'Para Assistir') : status === 'watching-playing' ? (type === 'game' ? 'Jogando' : 'Assistindo') : (type === 'game' ? 'Jogado' : 'Assistido');
        let icon = status === 'to-watch-play' ? '⏱️' : status === 'watching-playing' ? '▶️' : '✅';
        return `<span class="status-tag ${status}">${icon} ${text}</span>`;
    }

    function renderPaginationControls(filteredItemsCount) {
        totalPages = Math.ceil(filteredItemsCount / ITEMS_PER_PAGE);
        paginationContainer.innerHTML = '';
        if (totalPages <= 1) { paginationContainer.style.display = 'none'; return; }
        paginationContainer.style.display = 'flex';
        const prevBtn = document.createElement('button'); prevBtn.textContent = 'Anterior'; prevBtn.disabled = currentPage === 1; prevBtn.classList.add('pagination-button', 'prev-button');
        prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderItems(); }}); paginationContainer.appendChild(prevBtn);
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button'); pageBtn.textContent = i; pageBtn.classList.add('pagination-button', 'page-number');
            if (i === currentPage) pageBtn.classList.add('active');
            pageBtn.addEventListener('click', () => { currentPage = i; renderItems(); }); paginationContainer.appendChild(pageBtn);
        }
        const nextBtn = document.createElement('button'); nextBtn.textContent = 'Próxima'; nextBtn.disabled = currentPage === totalPages; nextBtn.classList.add('pagination-button', 'next-button');
        nextBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderItems(); }}); paginationContainer.appendChild(nextBtn);
    }

    function renderItems() {
        if (!currentUserData) return;
        let filteredItems = apiItems;
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        if (filterTypeSelect.value !== 'all') filteredItems = filteredItems.filter(i => i.type === filterTypeSelect.value);
        if (currentActiveTabStatus !== 'all') filteredItems = filteredItems.filter(i => i.status === currentActiveTabStatus);
        if (filterListVisibility.value !== 'all') filteredItems = filteredItems.filter(i => i.list_type === filterListVisibility.value);
        if (searchTerm) filteredItems = filteredItems.filter(i => i.name.toLowerCase().includes(searchTerm) || (i.notes && i.notes.toLowerCase().includes(searchTerm)));

        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const itemsToDisplay = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

        itemsContainer.innerHTML = '';
        if (itemsToDisplay.length === 0) { noItemsMessage.style.display = 'block'; } 
        else {
            noItemsMessage.style.display = 'none';
            itemsToDisplay.forEach(item => {
                const itemCard = document.createElement('div'); itemCard.classList.add('item-card'); itemCard.dataset.id = item.id;
                let typeLabel = item.type === 'game' ? 'Jogo' : item.type === 'movie' ? 'Filme' : 'Série';
                let duoBadgeHtml = item.list_type === 'duo' ? `<span style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 12px; margin-left: 8px; font-size: 0.75rem; font-weight: 600;">💞 Duo</span>` : '';
                const coverUrl = item.image_url || (item.type === 'game' ? 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=500&q=60' : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=60');

                itemCard.innerHTML = `
                    <div class="item-tag">${getTagIcon(item.type)} ${typeLabel} ${duoBadgeHtml}</div>
                    <img src="${coverUrl}" alt="Capa de ${item.name}" class="item-cover" loading="lazy">
                    <div class="item-content">
                        <h3>${item.name}</h3><p class="notes-line ${item.notes ? '' : 'hidden-note'}"><strong>Notas:</strong> ${item.notes || 'Nenhuma'}</p>
                        <div class="item-meta">${getStatusTag(item.status, item.type)}</div>
                        <div class="status-change-buttons">
                            <button data-status="to-watch-play" class="${item.status === 'to-watch-play' ? 'current-status' : ''}">Para ${item.type === 'game' ? 'Jogar' : 'Assistir'}</button>
                            <button data-status="watching-playing" class="${item.status === 'watching-playing' ? 'current-status' : ''}">${item.type === 'game' ? 'Jogando' : 'Assistindo'}</button>
                            <button data-status="finished" class="${item.status === 'finished' ? 'current-status' : ''}">${item.type === 'game' ? 'Jogado' : 'Assistido'}</button>
                        </div>
                        <div class="item-actions"><button class="edit-btn">Editar</button><button class="delete-btn">Excluir</button></div>
                    </div>`;
                itemsContainer.appendChild(itemCard);
            });
        }
        renderPaginationControls(filteredItems.length);
    }

    async function fetchItems() {
        const token = localStorage.getItem('playframe_token');
        if (!token) return;
        try { const response = await fetch('https://playframe-api.onrender.com/items', { headers: { 'Authorization': `Bearer ${token}` } });
            if (response.ok) { apiItems = await response.json(); renderItems(); }
        } catch (error) { console.error("Erro ao buscar itens:", error); }
    }

    function updateUI() {
        if (currentUserData) {
            authSection.classList.add('hidden'); duoSettingsSection.classList.remove('hidden'); addItemSection.classList.remove('hidden'); itemlistSection.classList.remove('hidden');
            userInfoSpan.textContent = `Olá, ${currentUserData.name}!`; userInfoSpan.classList.remove('hidden'); logoutBtn.classList.remove('hidden');
            document.getElementById('display-duo-code').textContent = currentUserData.duo_code || "Nenhum";
            currentPage = 1; fetchItems(); 
        } else {
            authSection.classList.remove('hidden'); duoSettingsSection.classList.add('hidden'); addItemSection.classList.add('hidden'); itemlistSection.classList.add('hidden');
            userInfoSpan.classList.add('hidden'); logoutBtn.classList.add('hidden');
        }
    }

    const updateDuoBtn = document.getElementById('update-duo-btn');
    if(updateDuoBtn) {
        updateDuoBtn.addEventListener('click', async () => {
            const newCode = document.getElementById('update-duo-input').value.trim();
            const token = localStorage.getItem('playframe_token');
            const res = await fetch('https://playframe-api.onrender.com/user/duocode', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ duo_code: newCode }) });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('playframe_token', data.token); currentUserData.duo_code = data.duo_code; localStorage.setItem('currentUserData', JSON.stringify(currentUserData));
                document.getElementById('display-duo-code').textContent = data.duo_code || "Nenhum";
                const msg = document.getElementById('duo-update-message'); 
                msg.textContent = "Código vinculado com sucesso!";
                msg.style.display = 'block'; setTimeout(() => msg.style.display = 'none', 3000); fetchItems(); 
            }
        });
    }

    const generateDuoBtn = document.getElementById('generate-duo-btn');
    if(generateDuoBtn) {
        generateDuoBtn.addEventListener('click', async () => {
            if (currentUserData && currentUserData.duo_code) {
                const confirmChange = confirm("⚠️ ATENÇÃO: Você já possui uma Duo List ativa!\n\nGerar um novo código vai desconectar você da sua dupla atual e as listas compartilhadas sumirão da sua tela.\n\nTem certeza absoluta que deseja gerar um novo código?");
                if (!confirmChange) {
                    return; 
                }
            }

            const newCode = 'PLAY-' + Math.floor(100000 + Math.random() * 900000).toString();
            
            const token = localStorage.getItem('playframe_token');
            const res = await fetch('https://playframe-api.onrender.com/user/duocode', { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                body: JSON.stringify({ duo_code: newCode }) 
            });
            const data = await res.json();
            
            if (res.ok) {
                localStorage.setItem('playframe_token', data.token); 
                currentUserData.duo_code = data.duo_code; 
                localStorage.setItem('currentUserData', JSON.stringify(currentUserData));
                
                document.getElementById('display-duo-code').textContent = data.duo_code;
                
                const msg = document.getElementById('duo-update-message'); 
                msg.textContent = "Código gerado com sucesso! Agora é só enviar para o Player 2 se conectar.";
                msg.style.display = 'block'; 
                setTimeout(() => msg.style.display = 'none', 5000); 
                
                fetchItems(); 
            }
        });
    }

    if (toggleAuthBtn) {
        toggleAuthBtn.addEventListener('click', (e) => {
            e.preventDefault(); isLoginMode = !isLoginMode;
            authTitle.textContent = isLoginMode ? "Acesse sua Conta" : "Crie sua Conta";
            authExtraFields.style.display = isLoginMode ? 'none' : 'flex';
            loginBtn.style.display = isLoginMode ? 'block' : 'none'; registerBtn.style.display = isLoginMode ? 'none' : 'block';
            forgotPasswordLink.style.display = isLoginMode ? 'block' : 'none';
            document.getElementById('auth-switch-text').textContent = isLoginMode ? "Não tem uma conta ainda?" : "Já tem uma conta?";
            toggleAuthBtn.textContent = isLoginMode ? "Registre-se" : "Entrar";
            authMessage.textContent = isLoginMode ? "Faça login para acessar suas listas." : "Preencha seus dados para criar uma conta.";
            authMessage.style.color = "var(--text-color)";
        });
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    loginBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = authEmailInput.value; const password = authPasswordInput.value;
        if (!email || !password) { authMessage.textContent = "Preencha email e senha."; authMessage.style.color = "#ff4d4d"; return; }
        
        authMessage.textContent = "Conectando..."; authMessage.style.color = "var(--text-color)";
        try {
            const response = await fetch('https://playframe-api.onrender.com/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('playframe_token', data.token); currentUserData = data.user; localStorage.setItem('currentUserData', JSON.stringify(data.user));
                authMessage.textContent = "Login bem-sucedido!"; updateUI();
            } else { authMessage.textContent = data.error; authMessage.style.color = "#ff4d4d"; }
        } catch (error) { authMessage.textContent = "Erro de conexão."; authMessage.style.color = "#ff4d4d"; }
    });

    registerBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = authEmailInput.value;
        const payload = { name: authNameInput.value.trim(), email: email, password: authPasswordInput.value, duo_code: authDuoInput.value.trim() };
        
        if (!payload.name || !payload.email || !payload.password) { authMessage.textContent = "Preencha nome, email e senha."; authMessage.style.color = "#ff4d4d"; return; }
        if (!isValidEmail(email)) { authMessage.textContent = "Digite um e-mail com formato válido!"; authMessage.style.color = "#ff4d4d"; return; }
        if (payload.password.length < 6) { authMessage.textContent = "A senha deve ter pelo menos 6 caracteres."; authMessage.style.color = "#ff4d4d"; return; }

        authMessage.textContent = "Criando conta..."; authMessage.style.color = "var(--text-color)";
        try {
            const response = await fetch('https://playframe-api.onrender.com/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await response.json();
            if (response.ok) {
                authMessage.textContent = "Conta criada! Faça login."; authMessage.style.color = "#4CAF50";
                toggleAuthBtn.click(); 
            } else { authMessage.textContent = data.error || "Erro ao criar conta."; authMessage.style.color = "#ff4d4d"; }
        } catch (error) { authMessage.textContent = "Erro de conexão."; authMessage.style.color = "#ff4d4d"; }
    });

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        authTitle.textContent = "Recuperar Senha";
        authMessage.textContent = "Insira seu email para enviarmos um código de segurança.";
        authMessage.style.color = "var(--text-color)";
        authForm.style.display = 'none';
        forgotEmailForm.style.display = 'block';
    });

    backToLoginFromEmailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        authTitle.textContent = "Acesse sua Conta";
        authMessage.textContent = "Faça login para acessar suas listas.";
        authMessage.style.color = "var(--text-color)";
        forgotEmailForm.style.display = 'none';
        authForm.style.display = 'block';
        forgotEmailForm.reset();
    });

    backToLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        authTitle.textContent = "Acesse sua Conta";
        authMessage.textContent = "Faça login para acessar suas listas.";
        authMessage.style.color = "var(--text-color)";
        resetPasswordForm.style.display = 'none';
        authForm.style.display = 'block';
        resetPasswordForm.reset();
    });

    forgotEmailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        emailForRecovery = document.getElementById('reset-email-request').value;
        const sendCodeBtn = document.getElementById('send-code-btn');

        authMessage.textContent = "Buscando conta e enviando e-mail..."; authMessage.style.color = "var(--text-color)";
        sendCodeBtn.disabled = true;

        try {
            const response = await fetch('https://playframe-api.onrender.com/forgot-password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailForRecovery })
            });
            const data = await response.json();
            
            if (response.ok) {
                authMessage.textContent = data.message; authMessage.style.color = "#4CAF50";
                document.getElementById('reset-email-final').value = emailForRecovery;
                forgotEmailForm.style.display = 'none';
                resetPasswordForm.style.display = 'block';
            } else { 
                authMessage.textContent = data.error; authMessage.style.color = "#ff4d4d"; 
            }
        } catch (error) { 
            authMessage.textContent = "Erro de conexão com o servidor."; authMessage.style.color = "#ff4d4d"; 
        } finally {
            sendCodeBtn.disabled = false;
        }
    });

    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const resetCode = document.getElementById('reset-security-code').value.trim();
        const newPassword = document.getElementById('reset-new-password').value;
        const confirmPassword = document.getElementById('reset-confirm-password').value;
        const resetBtn = document.getElementById('submit-reset-btn');

        if (newPassword.length < 6) { 
            authMessage.textContent = "A nova senha deve ter pelo menos 6 caracteres."; 
            authMessage.style.color = "#ff4d4d"; 
            return; 
        }

        if (newPassword !== confirmPassword) {
            authMessage.textContent = "As senhas não coincidem. Digite novamente."; 
            authMessage.style.color = "#ff4d4d"; 
            return; 
        }

        authMessage.textContent = "Validando código e atualizando senha..."; authMessage.style.color = "var(--text-color)";
        resetBtn.disabled = true;

        try {
            const response = await fetch('https://playframe-api.onrender.com/reset-password', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailForRecovery, resetCode: resetCode, newPassword: newPassword })
            });
            const data = await response.json();
            
            if (response.ok) {
                authMessage.textContent = data.message; authMessage.style.color = "#4CAF50";
                setTimeout(() => backToLoginBtn.click(), 3000); 
            } else { 
                authMessage.textContent = data.error; authMessage.style.color = "#ff4d4d"; 
            }
        } catch (error) { 
            authMessage.textContent = "Erro de conexão."; authMessage.style.color = "#ff4d4d"; 
        } finally {
            resetBtn.disabled = false;
        }
    });

    logoutBtn.addEventListener('click', () => { currentUserData = null; localStorage.clear(); updateUI(); });

    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('playframe_token'); const submitBtn = itemForm.querySelector('.form-buttons button[type="submit"]'); const editingId = submitBtn.dataset.editingId;
        submitBtn.textContent = 'Salvando na nuvem...'; submitBtn.disabled = true;

        let imageUrl = ''; const itemName = itemNameInput.value; const itemType = itemTypeSelect.value;
        try {
            const tmdbApiKey = '24a36784d3ba32730043be56bafeeb04'; const rawgApiKey = '53c2aeae4862459689c7fc511b32a55e';
            if ((itemType === 'movie' || itemType === 'series') && tmdbApiKey) {
                const searchType = itemType === 'movie' ? 'movie' : 'tv';
                const res = await fetch(`https://api.themoviedb.org/3/search/${searchType}?api_key=${tmdbApiKey}&query=${encodeURIComponent(itemName)}&language=pt-BR`);
                const data = await res.json();
                if (data.results?.length > 0) imageUrl = `https://image.tmdb.org/t/p/w500${data.results[0].backdrop_path || data.results[0].poster_path}`;
            } else if (itemType === 'game' && rawgApiKey) {
                const res = await fetch(`https://api.rawg.io/api/games?key=${rawgApiKey}&search=${encodeURIComponent(itemName)}`);
                const data = await res.json();
                if (data.results?.length > 0) imageUrl = data.results[0].background_image;
            }
        } catch (error) { console.error("Erro na imagem:", error); }

        const payload = { name: itemName, notes: itemNotesInput.value, type: itemType, status: itemStatusSelect.value, list_type: itemListTypeSelect.value, image_url: imageUrl };

        try {
            if (editingId) { await fetch(`https://playframe-api.onrender.com/items/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) }); delete submitBtn.dataset.editingId; } 
            else { await fetch('https://playframe-api.onrender.com/items', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) }); }
            itemForm.reset(); submitBtn.textContent = 'Adicionar à Lista'; submitBtn.disabled = false; fetchItems(); 
        } catch (error) { alert("Erro ao salvar no banco!"); submitBtn.disabled = false; }
    });

    itemsContainer.addEventListener('click', async (e) => {
        const itemCard = e.target.closest('.item-card'); if (!itemCard || !currentUserData) return;
        const itemId = itemCard.dataset.id; const token = localStorage.getItem('playframe_token'); const itemToOperate = apiItems.find(item => item.id == itemId);

        if (e.target.classList.contains('delete-btn')) {
            if (confirm("Tem certeza que deseja excluir este item?")) { 
                
                itemCard.classList.add('removing');
                
                setTimeout(async () => {
                    await fetch(`https://playframe-api.onrender.com/items/${itemId}`, { 
                        method: 'DELETE', 
                        headers: { 'Authorization': `Bearer ${token}` }
                    }); 
                    fetchItems(); 
                }, 300);
            }
        }
        else if (e.target.classList.contains('edit-btn')) {
            itemNameInput.value = itemToOperate.name; itemNotesInput.value = itemToOperate.notes; itemTypeSelect.value = itemToOperate.type;
            itemStatusSelect.value = itemToOperate.status; itemListTypeSelect.value = itemToOperate.list_type || 'individual';
            const submitBtn = itemForm.querySelector('.form-buttons button[type="submit"]'); submitBtn.textContent = 'Atualizar Item'; submitBtn.dataset.editingId = itemId; document.getElementById('add-item').scrollIntoView({ behavior: 'smooth' });
        }
        else if (e.target.closest('.status-change-buttons')) {
            const statusBtn = e.target.closest('button');
            if (statusBtn) {
                const newStatus = statusBtn.dataset.status;
                if (itemToOperate.status !== newStatus) { await fetch(`https://playframe-api.onrender.com/items/${itemId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ ...itemToOperate, status: newStatus }) }); fetchItems(); }
            }
        }
    });

    filterTypeSelect.addEventListener('change', () => { currentPage = 1; renderItems(); }); filterListVisibility.addEventListener('change', () => { currentPage = 1; renderItems(); });
    if (statusTabsNav) {
        statusTabsNav.addEventListener('click', (e) => {
            const clickedBtn = e.target.closest('.tab-button');
            if (clickedBtn) { statusTabsNav.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active')); clickedBtn.classList.add('active'); currentActiveTabStatus = clickedBtn.dataset.filterStatus; currentPage = 1; renderItems(); }
        });
    }

    updateUI();
});