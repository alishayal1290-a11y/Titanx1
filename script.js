(function() {
    'use strict';

    // --- DOM Root ---
    const root = document.getElementById('root');

    // --- CONSTANTS ---
    const ADMIN_EMAIL = "alishayal1290@gmail.com";
    const ADMIN_PASSWORD = "ali1290";
    const WHATSAPP_NUMBER = "03049155628";
    const SADAPAY_NUMBER = "03049155628";
    const REFERRER_BONUS_AMOUNT = 15;
    const NEW_USER_REFERRAL_BONUS_AMOUNT = 5;

    // --- ENUMS ---
    const TransactionType = { DEPOSIT: 'deposit', WITHDRAW: 'withdraw', REFERRAL_BONUS: 'referral_bonus', TOURNAMENT_ENTRY: 'tournament_entry', TOURNAMENT_WIN: 'tournament_win' };
    const TransactionStatus = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };
    
    // --- API / DATA STORE ---
    const STORAGE_key = 'titans_x_tournaments_data';
    const initialTournaments = [
        {id:'t1',name:'Evening Scrims',game:'Free Fire',mode:'Squad',map:'Bermuda',type:'Survival',entryFee:50,prizePool:5000,schedule:new Date(Date.now() + 172800000).toISOString(),status:'Upcoming',participants:[],winnerId:undefined,credentials:undefined},
        {id:'t2',name:'Weekend Warriors',game:'Free Fire',mode:'Solo',map:'Kalahari',type:'Per Kill',entryFee:100,prizePool:10000,schedule:new Date(Date.now() + 345600000).toISOString(),status:'Upcoming',participants:[],winnerId:undefined,credentials:undefined}
    ];
    const defaultDb = { users: [], tournaments: initialTournaments, transactions: [] };
    
    const api = {
        _db: null,
        _delay: (ms) => new Promise(res => setTimeout(res, ms)),
        _loadData() {
            try {
                const storedData = localStorage.getItem(STORAGE_key);
                if (storedData) {
                    const data = JSON.parse(storedData);
                    // Basic migration for new fields
                    data.users = data.users.map(user => ({ matchesPlayed: 0, matchesWon: 0, totalPrizeMoney: 0, ...user }));
                    data.tournaments = data.tournaments.map(t => ({ winnerId: undefined, ...t }));
                    this._db = data;
                } else {
                    this._db = JSON.parse(JSON.stringify(defaultDb));
                    this._saveData();
                }
            } catch (error) {
                console.error("Failed to load data, resetting.", error);
                this._db = JSON.parse(JSON.stringify(defaultDb));
            }
        },
        _saveData() {
            try {
                localStorage.setItem(STORAGE_key, JSON.stringify(this._db));
            } catch (error) {
                console.error("Failed to save data.", error);
            }
        },
        async getData() {
            await this._delay(300);
            if (!this._db) this._loadData();
            return JSON.parse(JSON.stringify(this._db));
        },
        async _setData(newData) {
            await this._delay(100);
            this._db = newData;
            this._saveData();
        }
    };
    
    // --- GLOBAL STATE ---
    let state = {
        data: { users: [], tournaments: [], transactions: [] },
        isLoading: true,
        currentUser: null,
        isAdmin: false,
        authError: undefined,
        ui: {
            userPanelView: 'tournaments',
            adminPanelView: 'tournaments',
            isUserMenuOpen: false,
            isSubmitting: false,
            viewingScreenshot: null,
            modal: null, // e.g., { type: 'deposit' }
            selectedTournamentId: null,
            viewingUserId: null,
        }
    };
    
    // --- UTILS ---
    const simpleHash = s => { let h=0; for(let i=0;i<s.length;i++) { h=((h<<5)-h)+s.charCodeAt(i); h&=h; } return h.toString(); };
    const fileToBase64 = f => new Promise((res, rej) => { const r=new FileReader(); r.readAsDataURL(f); r.onload=()=>res(r.result); r.onerror=e=>rej(e); });
    const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };
    
    async function refreshData(rerender = true) {
        const latestData = await api.getData();
        state.data = latestData;
        if (state.currentUser && !state.isAdmin) {
            const updatedUser = latestData.users.find(u => u.id === state.currentUser.id);
            if (updatedUser) {
                state.currentUser = updatedUser;
            } else {
                handleLogout(); // User was deleted
                return;
            }
        }
        if (rerender) {
            render();
        }
    }

    // --- HTML TEMPLATE GENERATORS ---
    
    function getAnimatedButtonHTML(text, { variant = 'primary', type = 'button', className = '', id = '', action = '', dataset = {} } = {}) {
        const baseClasses = "px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2";
        const variantClasses = {
            primary: 'bg-amber-500 text-slate-900 hover:bg-amber-600 focus:ring-amber-400',
            secondary: 'bg-slate-700 text-white hover:bg-slate-800 focus:ring-slate-600',
            danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        };
        const dataAttributes = Object.entries(dataset).map(([key, value]) => `data-${key}="${value}"`).join(' ');
        return `<button type="${type}" id="${id}" class="${baseClasses} ${variantClasses[variant]} ${className}" ${action ? `data-action="${action}"` : ''} ${dataAttributes}>${text}</button>`;
    }

    function getModalHTML(title, content) {
        return `
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" id="modal-backdrop">
              <div class="bg-white rounded-xl shadow-2xl w-full max-w-md m-4 transform transition-all duration-300 ease-in-out scale-95 animate-scale-in">
                <div class="flex justify-between items-center p-5 border-b border-gray-200">
                  <h3 class="text-xl font-bold text-gray-800">${title}</h3>
                  <button data-action="close-modal" class="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
                <div class="p-6">${content}</div>
              </div>
            </div>`;
    }

    // --- MAIN RENDER FUNCTION ---
    function render() {
        const appContainer = document.createElement('div');
        
        if (state.isLoading) {
            appContainer.innerHTML = `<div class="min-h-screen flex items-center justify-center bg-gray-50"><div class="w-16 h-16 border-4 border-amber-500 border-solid rounded-full animate-spin" style="border-top-color: transparent;"></div></div>`;
        } else if (state.isAdmin) {
            appContainer.innerHTML = "<div>Admin Panel Not Implemented.</div>"; // Simplified for this example
        } else if (state.currentUser) {
            appContainer.innerHTML = renderUserPanelHTML();
        } else {
            appContainer.innerHTML = renderAuthScreenHTML();
        }

        if (state.ui.modal) {
            const modalContainer = document.createElement('div');
            modalContainer.id = 'modal-root';
            modalContainer.innerHTML = renderModalHTML();
            appContainer.appendChild(modalContainer);
        }

        root.innerHTML = '';
        root.appendChild(appContainer);
        refreshIcons();
    }
    
    // --- AUTH ---
    function renderAuthScreenHTML() {
        return `<div class="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4"><div class="max-w-md w-full mx-auto"><div class="text-center mb-8"><h1 class="text-4xl font-bold text-slate-800">Titans <span class="text-amber-500">X</span></h1><p class="text-gray-500 mt-2">Your Ultimate Tournament Platform</p></div><div id="auth-form-container" class="bg-white p-8 rounded-2xl shadow-lg">${renderAuthFormHTML('login')}</div></div></div>`;
    }

    function renderAuthFormHTML(type) {
        const errorHtml = state.authError ? `<p class="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">${state.authError}</p>` : '';
        const baseInputClasses = "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition";

        if (type === 'login') {
            return `<div class="mb-6"><h2 class="text-2xl font-bold text-gray-800">Welcome Back!</h2><p class="text-gray-500">Sign in to continue</p></div> ${errorHtml} <form id="login-form" class="space-y-6"><input type="email" name="email" placeholder="Email Address" required class="${baseInputClasses}"/><input type="password" name="password" placeholder="Password" required class="${baseInputClasses}"/>${getAnimatedButtonHTML('Login', { type: 'submit', className: 'w-full' })}</form><p class="text-center text-sm text-gray-600 mt-6">Don't have an account? <button data-action="show-signup" class="font-semibold text-amber-600 hover:underline ml-1">Sign Up</button></p>`;
        } else {
            return `<div class="mb-6"><h2 class="text-2xl font-bold text-gray-800">Create Account</h2><p class="text-gray-500">Join the community</p></div> ${errorHtml} <form id="signup-form" class="space-y-4"><input type="text" name="name" placeholder="Full Name" required class="${baseInputClasses}"/><input type="email" name="email" placeholder="Email Address" required class="${baseInputClasses}"/><input type="password" name="password" placeholder="Password" required class="${baseInputClasses}"/><input type="text" name="refCode" placeholder="Referral Code (Optional)" class="${baseInputClasses}"/>${getAnimatedButtonHTML('Sign Up', { type: 'submit', className: 'w-full' })}</form><p class="text-center text-sm text-gray-600 mt-6">Already have an account? <button data-action="show-login" class="font-semibold text-amber-600 hover:underline ml-1">Login</button></p>`;
        }
    }
    
    // --- USER PANEL ---
    function renderUserPanelHTML() {
        const user = state.currentUser;
        let viewContent = '';
        switch(state.ui.userPanelView) {
            case 'tournaments': viewContent = renderUserTournamentsHTML(); break;
            // ... other views
            default: viewContent = renderUserTournamentsHTML();
        }

        return `
            <div class="min-h-screen bg-gray-50 pb-20">
                <header class="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h1 class="text-xl font-bold text-slate-800">Titans <span class="text-amber-500">X</span></h1>
                        <div class="flex items-center gap-2 mt-1"><p class="text-sm text-gray-600">Welcome, ${user.name}!</p><div class="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full"><div class="w-2 h-2 bg-green-500 rounded-full"></div><span>Online</span></div></div>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="text-right"><p class="font-semibold text-gray-800 flex items-center justify-end"><i data-lucide="coins" class="w-4 h-4 mr-1 text-amber-500"></i>${user.walletBalance.toFixed(2)} TX</p><p class="text-xs text-gray-500">Wallet</p></div>
                        <div class="relative"><button data-action="toggle-menu" class="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"><i data-lucide="more-vertical" class="w-6 h-6 text-gray-700"></i></button>
                        <div id="user-menu" class="${state.ui.isUserMenuOpen ? '' : 'hidden'} absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 py-1 ring-1 ring-black ring-opacity-5"><a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><i data-lucide="message-square" class="w-4 h-4"></i> Support</a><button data-action="logout" class="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><i data-lucide="log-out" class="w-4 h-4"></i> Logout</button></div></div>
                    </div>
                </header>
                <main class="${state.ui.userPanelView === 'profile' ? 'pt-16' : ''}">${viewContent}</main>
                <nav class="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] flex justify-around border-t border-gray-200">${renderBottomNavHTML()}</nav>
            </div>`;
    }

    function renderBottomNavHTML() {
        const activeView = state.ui.userPanelView;
        const items = [{icon:'swords', label:'Tournaments', view:'tournaments'}, {icon:'wallet', label:'Wallet', view:'wallet'}, {icon:'user', label:'Profile', view:'profile'}];
        return items.map(item => `<button data-action="navigate" data-view="${item.view}" class="flex flex-col items-center justify-center w-full pt-3 pb-2 transition-colors duration-200 ${activeView === item.view ? 'text-amber-500' : 'text-gray-500 hover:text-amber-500'}"><i data-lucide="${item.icon}" class="w-6 h-6 mb-1"></i><span class="text-xs font-medium">${item.label}</span></button>`).join('');
    }

    function renderUserTournamentsHTML() {
        const activeTournaments = state.data.tournaments.filter(t => t.status !== 'Finished');
        const user = state.currentUser;
        
        let tournamentsHtml = activeTournaments.length > 0 ? activeTournaments.map(t => {
            const isJoined = user.joinedTournaments.includes(t.id);
            const actionButton = t.status === 'Upcoming' 
                ? (isJoined 
                    ? `<button class="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold" disabled>Joined</button>`
                    : getAnimatedButtonHTML('Join Now', { action: 'join-tournament', className: 'text-sm py-2 px-4', dataset: { tournamentid: t.id } }))
                : `<span class="px-3 py-2 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">Ongoing</span>`;

            const credentialsHtml = isJoined ? `
                <div class="mt-4 border-t pt-4">
                  <h4 class="font-semibold text-gray-700">Tournament Credentials</h4>
                  ${t.credentials 
                    ? `<div class="text-sm mt-2 p-3 bg-amber-50 rounded-lg"><p><strong>ID:</strong> ${t.credentials.id}</p><p><strong>Password:</strong> ${t.credentials.pass}</p></div>` 
                    : `<p class="text-sm text-gray-500 italic mt-2">Credentials will be provided before the match starts.</p>`
                  }
                </div>` : '';

            return `
            <div class="bg-white p-5 rounded-lg shadow-md">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-bold text-lg text-gray-900">${t.name}</h3>
                  <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 my-2">
                    <span class="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full"><i data-lucide="gamepad-2" class="w-3 h-3 text-gray-400"></i>${t.game}</span>
                    <span class="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full"><i data-lucide="users" class="w-3 h-3 text-gray-400"></i>${t.mode}</span>
                    <span class="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full"><i data-lucide="map" class="w-3 h-3 text-gray-400"></i>${t.map}</span>
                    <span class="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full"><i data-lucide="target" class="w-3 h-3 text-gray-400"></i>${t.type}</span>
                  </div>
                  <p class="text-sm text-gray-500 flex items-center">Prize Pool: <i data-lucide="coins" class="w-4 h-4 mx-1 text-amber-500"></i> ${t.prizePool.toLocaleString()} TX</p>
                  <p class="text-sm text-gray-500 flex items-center">Entry Fee: <i data-lucide="coins" class="w-4 h-4 mx-1 text-amber-500"></i> ${t.entryFee} TX</p>
                  <p class="text-sm text-gray-500">Schedule: ${new Date(t.schedule).toLocaleString()}</p>
                </div>
                <div class="flex-shrink-0 ml-4">${actionButton}</div>
              </div>
              ${credentialsHtml}
            </div>`;
        }).join('') : `<div class="text-center py-10 bg-white rounded-lg shadow-md"><p class="text-gray-500">No upcoming or ongoing tournaments right now.</p><p class="text-sm text-gray-400 mt-2">Please check back later!</p></div>`;

        return `<div class="p-4 space-y-4"><h2 class="text-2xl font-bold text-gray-800">Available Tournaments</h2>${tournamentsHtml}</div>`;
    }

    // --- LOGIC HANDLERS ---
    async function handleLogin(email, pass) {
        state.authError = undefined;
        if (email === ADMIN_EMAIL && pass === ADMIN_PASSWORD) {
            state.isAdmin = true;
            state.currentUser = { id: 'admin', name: 'Admin' };
            await refreshData();
            return;
        }

        const data = await api.getData();
        const user = data.users.find(u => u.email === email);
        if (user && user.passwordHash === simpleHash(pass)) {
            state.currentUser = user;
            state.isAdmin = false;
            await refreshData();
        } else {
            state.authError = "Invalid email or password.";
            const authContainer = document.getElementById('auth-form-container');
            if (authContainer) authContainer.innerHTML = renderAuthFormHTML('login');
        }
    }

    async function handleSignUp(name, email, pass, refCode) {
        state.authError = undefined;
        let currentData = await api.getData();

        if (currentData.users.some(u => u.email === email)) {
            state.authError = "An account with this email already exists.";
            const authContainer = document.getElementById('auth-form-container');
            if (authContainer) authContainer.innerHTML = renderAuthFormHTML('signup');
            return;
        }

        const newUser = { id: `user_${Date.now()}`, name, email, passwordHash: simpleHash(pass), referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(), walletBalance: 0, referredBy: refCode, joinedTournaments: [], matchesPlayed: 0, matchesWon: 0, totalPrizeMoney: 0 };
        
        if (refCode) {
            const referrer = currentData.users.find(u => u.referralCode.toLowerCase() === refCode.toLowerCase());
            if (referrer) {
                newUser.walletBalance += NEW_USER_REFERRAL_BONUS_AMOUNT;
                currentData.transactions.push({ id: `txn_${Date.now()}`, userId: newUser.id, type: TransactionType.REFERRAL_BONUS, amount: NEW_USER_REFERRAL_BONUS_AMOUNT, status: TransactionStatus.APPROVED, timestamp: new Date().toISOString(), details: {} });
                
                referrer.walletBalance += REFERRER_BONUS_AMOUNT;
                currentData.transactions.push({ id: `txn_ref_${Date.now()}`, userId: referrer.id, type: TransactionType.REFERRAL_BONUS, amount: REFERRER_BONUS_AMOUNT, status: TransactionStatus.APPROVED, timestamp: new Date().toISOString(), details: {} });
            } else {
                alert("Invalid referral code provided, but account created.");
            }
        }
        currentData.users.push(newUser);
        await api._setData(currentData);
        state.currentUser = newUser;
        await refreshData();
    }

    function handleLogout() {
        state.currentUser = null;
        state.isAdmin = false;
        render();
    }

    // --- EVENT LISTENERS ---
    document.addEventListener('DOMContentLoaded', async () => {
        state.isLoading = true;
        render();
        await refreshData(false);
        state.isLoading = false;
        render();
    });

    document.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        
        switch(action) {
            case 'show-signup': 
                const authContainerSignup = document.getElementById('auth-form-container');
                if (authContainerSignup) authContainerSignup.innerHTML = renderAuthFormHTML('signup');
                break;
            case 'show-login': 
                const authContainerLogin = document.getElementById('auth-form-container');
                if (authContainerLogin) authContainerLogin.innerHTML = renderAuthFormHTML('login');
                break;
            case 'logout': handleLogout(); break;
            case 'toggle-menu': state.ui.isUserMenuOpen = !state.ui.isUserMenuOpen; render(); break;
            case 'navigate': state.ui.userPanelView = target.dataset.view; render(); break;
        }
    });

    document.addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        state.ui.isSubmitting = true;
        render(); // Re-render to show loading states if any

        try {
            if (form.id === 'login-form') {
                const data = new FormData(form);
                await handleLogin(data.get('email'), data.get('password'));
            } else if (form.id === 'signup-form') {
                const data = new FormData(form);
                await handleSignUp(data.get('name'), data.get('email'), data.get('password'), data.get('refCode'));
            }
        } finally {
            state.ui.isSubmitting = false;
            // The handlers themselves call render(), so no need to call it here unless there's an error state to clear
        }
    });

})();
