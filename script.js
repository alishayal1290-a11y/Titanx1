
(function() {
    'use strict';

    const root = document.getElementById('root');
    if (!root) {
        console.error("Fatal Error: #root element not found.");
        return;
    }

    // --- CONSTANTS & ENUMS ---
    const ADMIN_EMAIL = "alishayal1290@gmail.com";
    const ADMIN_PASSWORD = "ali1290";
    const WHATSAPP_NUMBER = "03049155628";
    const SADAPAY_NUMBER = "03049155628";
    const REFERRER_BONUS_AMOUNT = 15;
    const NEW_USER_REFERRAL_BONUS_AMOUNT = 5;
    const TransactionType = { DEPOSIT: 'deposit', WITHDRAW: 'withdraw', REFERRAL_BONUS: 'referral_bonus', TOURNAMENT_ENTRY: 'tournament_entry', TOURNAMENT_WIN: 'tournament_win' };
    const TransactionStatus = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };

    // --- API / DATA STORE ---
    const STORAGE_KEY = 'titans_x_tournaments_data';
    const api = {
        _db: null,
        _delay: (ms) => new Promise(res => setTimeout(res, ms)),
        _migrateData(data) {
             data.users = data.users.map((user) => ({
                matchesPlayed: 0,
                matchesWon: 0,
                totalPrizeMoney: 0,
                ...user,
            }));
            data.tournaments = data.tournaments.map((t) => ({
                winnerId: t.winnerId || undefined,
                 ...t,
            }));
            return data;
        },
        _loadData() {
            try {
                const storedData = localStorage.getItem(STORAGE_KEY);
                if (storedData) {
                    this._db = this._migrateData(JSON.parse(storedData));
                } else {
                    const defaultDb = {
                        users: [],
                        tournaments: [
                            { id: 't1', name: 'Evening Scrims', game: 'Free Fire', mode: 'Squad', map: 'Bermuda', type: 'Survival', entryFee: 50, prizePool: 5000, schedule: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), status: 'Upcoming', participants: [] },
                            { id: 't2', name: 'Weekend Warriors', game: 'Free Fire', mode: 'Solo', map: 'Kalahari', type: 'Per Kill', entryFee: 100, prizePool: 10000, schedule: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), status: 'Upcoming', participants: [] }
                        ],
                        transactions: [],
                    };
                    this._db = JSON.parse(JSON.stringify(defaultDb));
                    this._saveData();
                }
            } catch (error) {
                console.error("Failed to load data, using default.", error);
                this._db = { users: [], tournaments: [], transactions: [] };
            }
        },
        _saveData() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this._db));
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
            authView: 'login', // 'login' or 'signup'
            userPanelView: 'tournaments',
            adminPanelTab: 'tournaments',
            isUserMenuOpen: false,
            isSubmitting: false,
            modal: null, // e.g., { type: 'deposit' }
            selectedTournamentId: null,
            viewingUserId: null,
            viewingScreenshot: null,
        }
    };

    // --- UTILS ---
    const simpleHash = s => { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h &= h; } return h.toString(); };
    const fileToBase64 = f => new Promise((res, rej) => { const r = new FileReader(); r.readAsDataURL(f); r.onload = () => res(r.result); r.onerror = e => rej(e); });
    const refreshIcons = () => { if (window.lucide) { try { window.lucide.createIcons(); } catch(e){ console.error("Lucide error:", e); } } };
    const deepCopy = obj => JSON.parse(JSON.stringify(obj));

    async function refreshData(rerender = true) {
        const latestData = await api.getData();
        state.data = latestData;

        if (state.currentUser && !state.isAdmin) {
            const updatedUser = latestData.users.find(u => u.id === state.currentUser.id);
            if (updatedUser) {
                state.currentUser = updatedUser;
            } else {
                handleLogout(); return; // User was deleted
            }
        }
        
        if (rerender) render();
    }

    // --- EVENT HANDLERS (LOGIC) ---
    const handleLogout = () => { state.currentUser = null; state.isAdmin = false; render(); };

    const handleLogin = async (email, pass) => {
        state.authError = undefined;
        const currentData = await api.getData();
        state.data = currentData; // Ensure data is fresh

        if (email === ADMIN_EMAIL && pass === ADMIN_PASSWORD) {
            state.isAdmin = true;
            state.currentUser = { id: 'admin', name: 'Admin', email: ADMIN_EMAIL };
        } else {
            const user = currentData.users.find(u => u.email === email);
            if (user && user.passwordHash === simpleHash(pass)) {
                state.currentUser = user;
                state.isAdmin = false;
            } else {
                state.authError = "Invalid email or password.";
            }
        }
        render();
    };

    const handleSignUp = async (name, email, pass, refCode) => {
        state.authError = undefined;
        let currentData = await api.getData();

        if (currentData.users.some(u => u.email === email)) {
            state.authError = "An account with this email already exists.";
            render();
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
                setTimeout(() => alert("Invalid referral code provided, but account created."), 100);
            }
        }
        currentData.users.push(newUser);
        await api._setData(currentData);
        state.currentUser = newUser;
        await refreshData();
    };
    
    const handleJoinTournament = async (tournamentId) => {
        const currentData = await api.getData();
        const tournament = currentData.tournaments.find(t => t.id === tournamentId);
        const user = currentData.users.find(u => u.id === state.currentUser.id);
        if (!tournament || !user) return alert("Error finding tournament or user.");
        if (tournament.status !== 'Upcoming') return alert("Registration is closed.");
        if (user.walletBalance < tournament.entryFee) return alert("Insufficient wallet balance.");
        
        user.walletBalance -= tournament.entryFee;
        user.joinedTournaments.push(tournamentId);
        tournament.participants.push(user.id);
        currentData.transactions.push({ id: `txn_entry_${Date.now()}`, userId: user.id, type: TransactionType.TOURNAMENT_ENTRY, amount: tournament.entryFee, status: TransactionStatus.APPROVED, timestamp: new Date().toISOString(), details: {} });

        await api._setData(currentData);
        await refreshData();
    };
    
    const handleRequestDeposit = async (amount, screenshot) => {
        const currentData = await api.getData();
        currentData.transactions.push({ id: `txn_${Date.now()}`, userId: state.currentUser.id, type: TransactionType.DEPOSIT, amount, status: TransactionStatus.PENDING, timestamp: new Date().toISOString(), details: { screenshot } });
        await api._setData(currentData);
        state.ui.modal = null;
        await refreshData();
        alert("Deposit request submitted for admin approval.");
    };

    const handleRequestWithdraw = async (method, accountNumber, accountName, amount) => {
        const currentData = await api.getData();
        const user = currentData.users.find(u => u.id === state.currentUser.id);
        if (amount > user.walletBalance) return alert("Insufficient balance.");
        
        currentData.transactions.push({ id: `txn_${Date.now()}`, userId: user.id, type: TransactionType.WITHDRAW, amount, status: TransactionStatus.PENDING, timestamp: new Date().toISOString(), details: { method, accountNumber, accountName } });
        await api._setData(currentData);
        state.ui.modal = null;
        await refreshData();
        alert("Withdrawal request submitted for admin approval.");
    };
    
    const handleAddTournament = async (t) => {
        const currentData = await api.getData();
        const newTournament = { ...t, id: `t_${Date.now()}`, participants: [], status: 'Upcoming' };
        currentData.tournaments.push(newTournament);
        await api._setData(currentData);
        state.ui.modal = null;
        await refreshData();
    };
    
    const handleDeleteTournament = async (id) => {
        if (!window.confirm("Are you sure? This cannot be undone.")) return;
        const currentData = await api.getData();
        currentData.tournaments = currentData.tournaments.filter(t => t.id !== id);
        await api._setData(currentData);
        await refreshData();
    };

    const handleUpdateTournamentCreds = async (id, creds) => {
        const currentData = await api.getData();
        const tournament = currentData.tournaments.find(t => t.id === id);
        if (tournament) tournament.credentials = creds;
        await api._setData(currentData);
        state.ui.modal = null;
        await refreshData();
    };
    
    const handleUpdateTournamentStatus = async (id, newStatus) => {
        const currentData = await api.getData();
        const tournament = currentData.tournaments.find(t => t.id === id);
        if (tournament) tournament.status = newStatus;
        await api._setData(currentData);
        await refreshData();
    };
    
    const handleSetTournamentWinner = async (tournamentId, winnerId) => {
        const currentData = await api.getData();
        const tournament = currentData.tournaments.find(t => t.id === tournamentId);
        const winner = currentData.users.find(u => u.id === winnerId);
        if (!tournament || !winner) return alert("Error: Tournament or winner not found.");
        if (tournament.winnerId) return alert("Winner already set.");

        tournament.winnerId = winnerId;
        winner.matchesWon += 1;
        winner.walletBalance += tournament.prizePool;
        winner.totalPrizeMoney += tournament.prizePool;
        currentData.transactions.push({ id: `txn_win_${Date.now()}`, userId: winner.id, type: TransactionType.TOURNAMENT_WIN, amount: tournament.prizePool, status: TransactionStatus.APPROVED, timestamp: new Date().toISOString(), details: {} });
        tournament.participants.forEach(pId => {
            const p = currentData.users.find(u => u.id === pId);
            if (p) p.matchesPlayed += 1;
        });

        await api._setData(currentData);
        state.ui.modal = null;
        await refreshData();
        alert(`${winner.name} set as winner!`);
    };

    const handleTransactionApproval = async (id, newStatus) => {
        const currentData = await api.getData();
        const transaction = currentData.transactions.find(t => t.id === id);
        if (!transaction) return;
        
        transaction.status = newStatus;
        if (newStatus === TransactionStatus.APPROVED) {
            const user = currentData.users.find(u => u.id === transaction.userId);
            if (user) {
                if (transaction.type === TransactionType.DEPOSIT) {
                    user.walletBalance += transaction.amount;
                } else if (transaction.type === TransactionType.WITHDRAW) {
                    if (user.walletBalance >= transaction.amount) {
                        user.walletBalance -= transaction.amount;
                    } else {
                        transaction.status = TransactionStatus.REJECTED;
                        alert("Withdrawal rejected due to insufficient funds at time of approval.");
                    }
                }
            }
        }
        await api._setData(currentData);
        await refreshData();
    };
    
    // --- HTML TEMPLATE HELPERS ---

    const getAnimatedButtonHTML = (text, { variant = 'primary', type = 'button', className = '', id = '', action = '', dataset = {} } = {}) => {
        const base = "px-6 py-3 font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2";
        const variants = { primary: 'bg-amber-500 text-slate-900 hover:bg-amber-600 focus:ring-amber-400', secondary: 'bg-slate-700 text-white hover:bg-slate-800 focus:ring-slate-600', danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500' };
        const dataAttrs = Object.entries(dataset).map(([k, v]) => `data-${k}="${v}"`).join(' ');
        const disabled = state.ui.isSubmitting ? 'disabled' : '';
        const btnText = state.ui.isSubmitting ? 'Submitting...' : text;
        return `<button type="${type}" id="${id}" class="${base} ${variants[variant]} ${className}" data-action="${action}" ${dataAttrs} ${disabled}>${btnText}</button>`;
    };

    const getModalHTML = (title, content) => `
        <div id="modal-container" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 animate-fade-in">
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
    
    const getTransactionStatusChip = (status) => {
        const colors = { pending: 'yellow', approved: 'green', rejected: 'red' };
        const color = colors[status] || 'gray';
        return `<span class="px-2 py-1 text-xs font-semibold text-${color}-800 bg-${color}-100 rounded-full">${status}</span>`;
    };
    
    // --- RENDER FUNCTIONS (VIEWS) ---
    
    function renderAuthScreen() {
        const { authView, isSubmitting } = state.ui;
        const error = state.authError ? `<p class="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">${state.authError}</p>` : '';
        const input = (type, name, placeholder, required = true) => `<input type="${type}" name="${name}" placeholder="${placeholder}" ${required ? 'required' : ''} class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 transition"/>`;
        
        let formContent, header, footer;

        if (authView === 'login') {
            header = `<div class="mb-6"><h2 class="text-2xl font-bold text-gray-800">Welcome Back!</h2><p class="text-gray-500">Sign in to continue</p></div>`;
            formContent = `
                <form id="login-form" class="space-y-6">
                    ${input('email', 'email', 'Email Address')}
                    ${input('password', 'password', 'Password')}
                    ${getAnimatedButtonHTML('Login', { type: 'submit', className: 'w-full' })}
                </form>`;
            footer = `<p class="text-center text-sm text-gray-600 mt-6">Don't have an account? <button data-action="show-signup" class="font-semibold text-amber-600 hover:underline ml-1">Sign Up</button></p>`;
        } else { // signup
            header = `<div class="mb-6"><h2 class="text-2xl font-bold text-gray-800">Create Account</h2><p class="text-gray-500">Join the community</p></div>`;
            formContent = `
                <form id="signup-form" class="space-y-4">
                    ${input('text', 'name', 'Full Name')}
                    ${input('email', 'email', 'Email Address')}
                    ${input('password', 'password', 'Password')}
                    ${input('text', 'refCode', 'Referral Code (Optional)', false)}
                    ${getAnimatedButtonHTML('Sign Up', { type: 'submit', className: 'w-full' })}
                </form>`;
            footer = `<p class="text-center text-sm text-gray-600 mt-6">Already have an account? <button data-action="show-login" class="font-semibold text-amber-600 hover:underline ml-1">Login</button></p>`;
        }

        return `
        <div class="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
          <div class="max-w-md w-full mx-auto">
            <div class="text-center mb-8"><h1 class="text-4xl font-bold text-slate-800">Titans <span class="text-amber-500">X</span></h1><p class="text-gray-500 mt-2">Your Ultimate Tournament Platform</p></div>
            <div class="bg-white p-8 rounded-2xl shadow-lg">
                ${header}
                ${error}
                ${formContent}
                ${footer}
            </div>
          </div>
        </div>`;
    }

    // ... All other render functions for User and Admin panels...
    function renderUserPanel() {
        const user = state.currentUser;
        const view = state.ui.userPanelView;
        const navItem = (icon, label, v) => `<button data-action="navigate-user" data-view="${v}" class="flex flex-col items-center justify-center w-full pt-3 pb-2 transition-colors duration-200 ${view === v ? 'text-amber-500' : 'text-gray-500 hover:text-amber-500'}"><i data-lucide="${icon}" class="w-6 h-6 mb-1"></i><span class="text-xs font-medium">${label}</span></button>`;
        const menu = `
            <div id="user-menu" class="${state.ui.isUserMenuOpen ? '' : 'hidden'} absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 py-1 ring-1 ring-black ring-opacity-5">
                <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><i data-lucide="message-square" class="w-4 h-4"></i> Support</a>
                <button data-action="logout" class="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><i data-lucide="log-out" class="w-4 h-4"></i> Logout</button>
            </div>`;

        let content = '';
        if (view === 'tournaments') content = renderUserTournaments();
        if (view === 'wallet') content = renderUserWallet();
        if (view === 'profile') content = renderUserProfile();
        
        return `
        <div class="min-h-screen bg-gray-50 pb-20">
            <header class="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
                <div>
                    <h1 class="text-xl font-bold text-slate-800">Titans <span class="text-amber-500">X</span></h1>
                    <div class="flex items-center gap-2 mt-1"><p class="text-sm text-gray-600">Welcome, ${user.name}!</p><div class="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full"><div class="w-2 h-2 bg-green-500 rounded-full"></div><span>Online</span></div></div>
                </div>
                <div class="flex items-center gap-4">
                    <div class="text-right"><p class="font-semibold text-gray-800 flex items-center justify-end"><i data-lucide="coins" class="w-4 h-4 mr-1 text-amber-500"></i>${user.walletBalance.toFixed(2)} TX</p><p class="text-xs text-gray-500">Wallet</p></div>
                    <div class="relative"><button data-action="toggle-user-menu" class="p-2 rounded-full hover:bg-gray-100"><i data-lucide="more-vertical" class="w-6 h-6 text-gray-700"></i></button>${menu}</div>
                </div>
            </header>
            <main class="transition-all duration-300 ${view === 'profile' ? 'pt-16' : ''}">${content}</main>
            <nav class="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] flex justify-around border-t border-gray-200">
                ${navItem('swords', 'Tournaments', 'tournaments')}
                ${navItem('wallet', 'Wallet', 'wallet')}
                ${navItem('user', 'Profile', 'profile')}
            </nav>
        </div>`;
    }
    
    function renderUserTournaments(){
        const active = state.data.tournaments.filter(t => t.status !== 'Finished');
        const user = state.currentUser;
        if (active.length === 0) return `<div class="p-4"><div class="text-center py-10 bg-white rounded-lg shadow-md"><p class="text-gray-500">No upcoming or ongoing tournaments right now.</p><p class="text-sm text-gray-400 mt-2">Please check back later!</p></div></div>`;
        return `
        <div class="p-4 space-y-4">
          <h2 class="text-2xl font-bold text-gray-800">Available Tournaments</h2>
          ${active.map(t => {
            const joined = user.joinedTournaments.includes(t.id);
            const actionBtn = t.status === 'Upcoming' 
                ? (joined ? `<button class="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold" disabled>Joined</button>` : getAnimatedButtonHTML('Join Now', { action: 'join-tournament', dataset: { tournamentid: t.id }, className: 'text-sm py-2 px-4' }))
                : `<span class="px-3 py-2 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">Ongoing</span>`;
            const creds = joined ? `
                <div class="mt-4 border-t pt-4"><h4 class="font-semibold text-gray-700">Tournament Credentials</h4>
                ${t.credentials ? `<div class="text-sm mt-2 p-3 bg-amber-50 rounded-lg"><p><strong>ID:</strong> ${t.credentials.id}</p><p><strong>Password:</strong> ${t.credentials.pass}</p></div>` : `<p class="text-sm text-gray-500 italic mt-2">Credentials will be provided by the admin before the match starts.</p>`}
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
                  </div>
                  <p class="text-sm text-gray-500 flex items-center">Prize Pool: <i data-lucide="coins" class="w-4 h-4 mx-1 text-amber-500"></i> ${t.prizePool.toLocaleString()} TX</p>
                  <p class="text-sm text-gray-500 flex items-center">Entry Fee: <i data-lucide="coins" class="w-4 h-4 mx-1 text-amber-500"></i> ${t.entryFee} TX</p>
                  <p class="text-sm text-gray-500">Schedule: ${new Date(t.schedule).toLocaleString()}</p>
                </div>
                <div class="flex-shrink-0 ml-4">${actionBtn}</div>
              </div>
              ${creds}
            </div>`;
          }).join('')}
        </div>`;
    }
    
    function renderUserWallet() {
        const user = state.currentUser;
        const txns = state.data.transactions.filter(t => t.userId === user.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return `
        <div class="p-4">
            <div class="bg-slate-800 text-white p-6 rounded-xl shadow-lg mb-6 text-center">
                <p class="text-sm opacity-80">Current Balance</p>
                <p class="text-4xl font-bold tracking-tight flex items-center justify-center"><i data-lucide="coins" class="w-10 h-10 mr-2 text-amber-400"></i>${user.walletBalance.toFixed(2)} <span class="text-2xl opacity-80 ml-2">TX</span></p>
            </div>
            <div class="flex gap-4 mb-6">
                ${getAnimatedButtonHTML('Deposit', { action: 'open-modal', dataset: { type: 'deposit' }, className: 'w-full' })}
                ${getAnimatedButtonHTML('Withdraw', { action: 'open-modal', dataset: { type: 'withdraw' }, variant: 'secondary', className: 'w-full' })}
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-4">Transaction History</h3>
            <div class="space-y-3">
            ${txns.length > 0 ? txns.map(t => {
                const isPos = [TransactionType.DEPOSIT, TransactionType.REFERRAL_BONUS, TransactionType.TOURNAMENT_WIN].includes(t.type);
                return `
                <div class="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                    <div><p class="font-semibold capitalize">${t.type.replace(/_/g, ' ')}</p><p class="text-xs text-gray-500">${new Date(t.timestamp).toLocaleString()}</p></div>
                    <div class="text-right"><p class="font-bold ${isPos ? 'text-green-600' : 'text-red-600'}">${isPos ? '+' : '-'}${t.amount.toFixed(2)} TX</p>${getTransactionStatusChip(t.status)}</div>
                </div>`
            }).join('') : `<p class="text-gray-500 text-center py-4">No transactions yet.</p>`}
            </div>
        </div>`;
    }
    
    function renderUserProfile() {
        const user = state.currentUser;
        const winRate = user.matchesPlayed > 0 ? ((user.matchesWon / user.matchesPlayed) * 100).toFixed(1) : 0;
        const StatCard = (label, value) => `<div class="bg-white p-4 rounded-xl shadow-md text-center"><div class="w-4 h-4 bg-amber-200 rounded-full mx-auto mb-2"></div><p class="text-2xl font-bold text-gray-800">${value}</p><p class="text-sm text-gray-500">${label}</p></div>`;
        return `
        <div class="p-4 space-y-6">
            <div class="bg-white p-6 rounded-xl shadow-lg text-center relative -mt-12">
                <div class="w-24 h-24 rounded-full mx-auto bg-gray-200 border-4 border-white shadow-md mb-4 -mt-12"></div>
                <h2 class="text-2xl font-bold text-gray-800">${user.name}</h2><p class="text-gray-500 text-sm">${user.email}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
                ${StatCard('Matches Played', user.matchesPlayed)}
                ${StatCard('Matches Won', user.matchesWon)}
                ${StatCard('Win Rate', `${winRate}%`)}
                ${StatCard('Total Winnings', `${user.totalPrizeMoney.toLocaleString()} TX`)}
            </div>
            <div class="bg-white p-6 rounded-xl shadow-lg text-center">
                <h3 class="font-bold text-lg text-gray-800">Refer & Earn</h3>
                <p class="text-sm text-gray-500 mt-1">Share your code and earn bonuses!</p>
                <div class="my-4 p-3 border-2 border-dashed border-amber-400 bg-amber-50 rounded-lg"><p class="text-2xl font-bold text-amber-600 tracking-widest">${user.referralCode}</p></div>
                ${getAnimatedButtonHTML('<i data-lucide="copy" class="w-4 h-4"></i> Copy Code', { action: 'copy-ref-code', dataset: { code: user.referralCode } })}
            </div>
        </div>`;
    }
    
    function renderAdminPanel() {
        const tab = state.ui.adminPanelTab;
        const TabButton = (title, t) => `<button data-action="navigate-admin" data-tab="${t}" class="px-4 py-2 -mb-px font-semibold text-sm border-b-2 transition-colors duration-200 ${tab === t ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">${title}</button>`;
        
        let content = '';
        if (tab === 'tournaments') content = renderAdminTournaments();
        if (tab === 'users') content = renderAdminUsers();
        if (tab === 'deposits') content = renderAdminTransactions(TransactionType.DEPOSIT);
        if (tab === 'withdrawals') content = renderAdminTransactions(TransactionType.WITHDRAW);

        return `
        <div class="min-h-screen bg-gray-100 p-8">
          <div class="max-w-7xl mx-auto">
            <header class="flex justify-between items-center mb-8">
                <div class="flex items-center gap-4">
                    <h1 class="text-3xl font-bold text-gray-800">Admin Panel</h1>
                    <div class="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full mt-1"><div class="w-2 h-2 bg-green-500 rounded-full"></div><span>Online</span></div>
                </div>
                ${getAnimatedButtonHTML('Logout', { action: 'logout', variant: 'secondary' })}
            </header>
            <div class="flex border-b border-gray-200 mb-6">
                ${TabButton('Tournaments', 'tournaments')}
                ${TabButton('Users', 'users')}
                ${TabButton('Deposits', 'deposits')}
                ${TabButton('Withdrawals', 'withdrawals')}
            </div>
            <div>${content}</div>
          </div>
        </div>`;
    }
    
    function renderAdminTournaments() {
        const { tournaments, users } = state.data;
        const getStatusChip = (t) => {
            const winner = t.winnerId ? users.find(u => u.id === t.winnerId) : null;
            if (t.status === 'Finished' && winner) return `<div class="flex flex-col"><span class="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full mb-1">Finished</span><span class="text-xs text-gray-600 font-semibold flex items-center justify-center"><i data-lucide="trophy" class="w-3 h-3 mr-1 text-amber-500"></i>${winner.name}</span></div>`;
            const colors = { Upcoming: 'blue', Ongoing: 'yellow', Finished: 'gray' };
            const color = colors[t.status];
            return `<span class="px-2 py-1 text-xs font-semibold text-${color}-800 bg-${color}-100 rounded-full">${t.status}</span>`;
        };
        return `
        <div>
            ${getAnimatedButtonHTML('Add Tournament', { action: 'open-modal', dataset: { type: 'addTournament' }, className: 'mb-4' })}
            <div class="bg-white rounded-lg shadow overflow-x-auto">
                <table class="min-w-full"><thead class="bg-gray-50"><tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tournament</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr></thead>
                <tbody class="bg-white divide-y divide-gray-200">
                ${tournaments.map(t => `
                    <tr>
                        <td class="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">${t.name}<div class="text-xs text-gray-500">${t.game}</div></td>
                        <td class="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">Fee: ${t.entryFee} TX<br>Prize: ${t.prizePool} TX</td>
                        <td class="px-6 py-4 text-sm text-gray-500">${t.participants.length}</td>
                        <td class="px-6 py-4 text-sm text-center">${getStatusChip(t)}</td>
                        <td class="px-6 py-4 text-sm font-medium space-x-2 whitespace-nowrap">
                            ${t.status === 'Upcoming' ? `<button data-action="start-tournament" data-id="${t.id}" class="text-blue-600 hover:text-blue-900 font-semibold">Start</button>` : ''}
                            ${t.status === 'Ongoing' ? `<button data-action="finish-tournament" data-id="${t.id}" class="text-green-600 hover:text-green-900 font-semibold">Finish</button>` : ''}
                            ${t.status === 'Finished' && !t.winnerId ? `<button data-action="open-modal" data-type="setWinner" data-tournamentid="${t.id}" class="text-purple-600 hover:text-purple-900 font-semibold">Set Winner</button>` : ''}
                            <button data-action="open-modal" data-type="setCreds" data-tournamentid="${t.id}" class="text-amber-600 hover:text-amber-900 font-semibold">Credentials</button>
                            <button data-action="delete-tournament" data-id="${t.id}" class="text-red-600 hover:text-red-900 font-semibold ${t.status !== 'Finished' ? 'opacity-50 cursor-not-allowed' : ''}" ${t.status !== 'Finished' ? 'disabled' : ''}>Delete</button>
                        </td>
                    </tr>
                `).join('')}
                </tbody></table>
            </div>
        </div>`;
    }
    
    function renderAdminUsers() {
        const viewingUser = state.data.users.find(u => u.id === state.ui.viewingUserId);
        if (viewingUser) {
            const user = viewingUser;
            const referrer = user.referredBy ? state.data.users.find(u => u.referralCode.toLowerCase() === user.referredBy.toLowerCase()) : null;
            const userTxns = state.data.transactions.filter(t => t.userId === user.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const InfoRow = (icon, label, value) => `<div class="flex items-center text-sm mb-2"><i data-lucide="${icon}" class="w-4 h-4 mr-3 text-gray-400"></i><span class="text-gray-600 font-medium">${label}:</span><span class="text-gray-800 ml-auto font-semibold">${value}</span></div>`;
            return `
            <div><button data-action="admin-back-to-users" class="flex items-center gap-2 text-amber-600 font-semibold mb-6 hover:underline"><i data-lucide="arrow-left" class="w-4 h-4"></i> Back to All Users</button>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="md:col-span-1 bg-white p-6 rounded-lg shadow space-y-4"><h3 class="text-xl font-bold text-gray-800">${user.name}</h3><p class="text-sm text-gray-500">${user.email}</p><div class="border-t pt-4">
                    ${InfoRow('wallet', 'Wallet Balance', `${user.walletBalance.toFixed(2)} TX`)}
                    ${InfoRow('gift', 'Referral Code', user.referralCode)}
                    ${referrer ? InfoRow('user-plus', 'Referred By', referrer.name) : ''}
                    ${InfoRow('swords', 'Matches Played', user.matchesPlayed)}
                    ${InfoRow('trophy', 'Matches Won', user.matchesWon)}
                </div></div>
                <div class="md:col-span-2 bg-white p-6 rounded-lg shadow"><h4 class="font-bold text-gray-800 mb-4">Transaction History</h4><div class="space-y-3 max-h-96 overflow-y-auto">
                    ${userTxns.length > 0 ? userTxns.map(t => {
                        const isPos = [TransactionType.DEPOSIT, TransactionType.REFERRAL_BONUS, TransactionType.TOURNAMENT_WIN].includes(t.type);
                        return `<div class="bg-gray-50 p-3 rounded-lg flex justify-between items-center"><div><p class="font-semibold capitalize text-sm">${t.type.replace(/_/g, ' ')}</p><p class="text-xs text-gray-500">${new Date(t.timestamp).toLocaleString()}</p></div><div class="text-right"><p class="font-bold text-sm ${isPos ? 'text-green-600' : 'text-red-600'}">${isPos ? '+' : '-'}${t.amount.toFixed(2)} TX</p>${getTransactionStatusChip(t.status)}</div></div>`
                    }).join('') : `<p class="text-sm text-gray-500 italic">No transactions found.</p>`}
                </div></div>
            </div></div>`;
        }
        return `
        <div class="bg-white rounded-lg shadow overflow-x-auto">
            <table class="min-w-full"><thead class="bg-gray-50"><tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
            </tr></thead>
            <tbody class="bg-white divide-y divide-gray-200">
            ${state.data.users.map(u => `
                <tr data-action="admin-view-user" data-id="${u.id}" class="cursor-pointer hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${u.name}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${u.email}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center"><i data-lucide="coins" class="w-4 h-4 mr-1 text-amber-500"></i>${u.walletBalance.toFixed(2)} TX</td>
                </tr>
            `).join('')}
            </tbody></table>
        </div>`;
    }
    
    function renderAdminTransactions(type) {
        const pending = state.data.transactions.filter(t => t.type === type && t.status === 'pending');
        const typeName = type.charAt(0).toUpperCase() + type.slice(1) + 's';
        return `
        <div class="bg-white rounded-lg shadow overflow-x-auto">
            <table class="min-w-full"><thead class="bg-gray-50"><tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody class="bg-white divide-y divide-gray-200">
            ${pending.length > 0 ? pending.map(t => {
                const user = state.data.users.find(u => u.id === t.userId);
                const details = type === TransactionType.DEPOSIT
                    ? `<button data-action="open-modal" data-type="viewScreenshot" data-screenshot="${t.details.screenshot}" class="text-amber-600 hover:underline">View Screenshot</button>`
                    : `${t.details.method} - ${t.details.accountNumber} (${t.details.accountName})`;
                return `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user?.name || 'N/A'}</td><td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${t.amount.toFixed(2)} TX</td><td class="px-6 py-4 text-sm text-gray-500">${details}</td>
                    <td class="px-6 py-4 whitespace-nowrap space-x-2"><button data-action="approve-txn" data-id="${t.id}" class="text-green-600 hover:text-green-900 font-semibold">Approve</button><button data-action="reject-txn" data-id="${t.id}" class="text-red-600 hover:text-red-900 font-semibold">Reject</button></td>
                </tr>`;
            }).join('') : `<tr><td colspan="4" class="text-center py-4 text-gray-500">No pending ${typeName}.</td></tr>`}
            </tbody></table>
        </div>`;
    }

    // --- MAIN RENDER FUNCTION ---
    function render() {
        if (state.isLoading) {
            root.innerHTML = `<div class="min-h-screen flex items-center justify-center bg-gray-50"><div class="w-16 h-16 border-4 border-amber-500 border-solid rounded-full animate-spin" style="border-top-color: transparent;"></div></div>`;
            return;
        }

        let html = '';
        if (state.isAdmin) html = renderAdminPanel();
        else if (state.currentUser) html = renderUserPanel();
        else html = renderAuthScreen();
        
        // Append modal if open
        if (state.ui.modal) {
            const modalType = state.ui.modal.type;
            const selectedTournament = state.data.tournaments.find(t => t.id === state.ui.selectedTournamentId);

            const modalContentMap = {
                deposit: () => `
                    <form id="deposit-form" class="space-y-4">
                        <p class="text-sm text-gray-600">Send payment to SadaPay: <strong class="font-mono">${SADAPAY_NUMBER}</strong></p>
                        <input type="number" name="amount" placeholder="Amount (TX)" required class="w-full px-4 py-2 border rounded-lg"/>
                        <input type="file" name="screenshot" accept="image/*" required class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"/>
                        ${getAnimatedButtonHTML('Submit Deposit Request', { type: 'submit', className: 'w-full' })}
                    </form>`,
                withdraw: () => `
                    <form id="withdraw-form" class="space-y-4">
                        <input type="number" name="amount" placeholder="Amount (TX)" max="${state.currentUser.walletBalance}" required class="w-full px-4 py-2 border rounded-lg"/>
                        <select name="method" class="w-full px-4 py-2 border rounded-lg bg-white"><option>Easypaisa</option><option>Jazzcash</option></select>
                        <input type="text" name="accountNumber" placeholder="Account Number" required class="w-full px-4 py-2 border rounded-lg"/>
                        <input type="text" name="accountName" placeholder="Account Name" required class="w-full px-4 py-2 border rounded-lg"/>
                        ${getAnimatedButtonHTML('Submit Withdraw Request', { type: 'submit', className: 'w-full' })}
                    </form>`,
                addTournament: () => `
                    <form id="add-tournament-form" class="space-y-4">
                        <input type="text" name="name" placeholder="Tournament Name" required class="w-full px-4 py-2 border rounded-lg"/>
                        <input type="text" name="game" value="Free Fire" placeholder="Game" required class="w-full px-4 py-2 border rounded-lg"/>
                        <select name="mode" class="w-full px-4 py-2 border rounded-lg bg-white"><option>Squad</option><option>Duo</option><option>Solo</option></select>
                        <select name="map" class="w-full px-4 py-2 border rounded-lg bg-white"><option>Bermuda</option><option>Kalahari</option><option>Solara</option><option>Nextera</option></select>
                        <select name="type" class="w-full px-4 py-2 border rounded-lg bg-white"><option>Survival</option><option>Per Kill</option><option>1v1</option></select>
                        <input type="number" name="entryFee" placeholder="Entry Fee (TX)" required class="w-full px-4 py-2 border rounded-lg"/>
                        <input type="number" name="prizePool" placeholder="Prize Pool (TX)" required class="w-full px-4 py-2 border rounded-lg"/>
                        <input type="datetime-local" name="schedule" required class="w-full px-4 py-2 border rounded-lg"/>
                        ${getAnimatedButtonHTML('Add Tournament', { type: 'submit', className: 'w-full' })}
                    </form>`,
                setCreds: () => `
                    <form id="set-creds-form" class="space-y-4">
                        <input type="text" name="roomId" placeholder="Room ID" required class="w-full px-4 py-2 border rounded-lg" value="${selectedTournament?.credentials?.id || ''}"/>
                        <input type="text" name="roomPass" placeholder="Room Password" required class="w-full px-4 py-2 border rounded-lg" value="${selectedTournament?.credentials?.pass || ''}"/>
                        ${getAnimatedButtonHTML('Set Credentials', { type: 'submit', className: 'w-full' })}
                    </form>`,
                setWinner: () => {
                    const participants = selectedTournament.participants.map(pId => state.data.users.find(u => u.id === pId)).filter(Boolean);
                    if (participants.length === 0) return `<p class="text-red-500">No participants in this tournament.</p>`;
                    return `
                    <form id="set-winner-form" class="space-y-4">
                        <label class="block text-sm font-medium text-gray-700">Select Winner</label>
                        <select name="winnerId" class="w-full px-4 py-2 border rounded-lg bg-white">${participants.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
                        ${getAnimatedButtonHTML('Confirm Winner', { type: 'submit', className: 'w-full' })}
                    </form>`;
                },
                viewScreenshot: () => `<img src="${state.ui.viewingScreenshot}" alt="Deposit Screenshot" class="w-full h-auto rounded-lg" />`,
            };

            const modalTitles = {
                deposit: 'Make a Deposit',
                withdraw: 'Request a Withdrawal',
                addTournament: 'Add New Tournament',
                setCreds: `Credentials for ${selectedTournament?.name}`,
                setWinner: `Set Winner for ${selectedTournament?.name}`,
                viewScreenshot: 'Deposit Screenshot'
            };

            html += getModalHTML(modalTitles[modalType], modalContentMap[modalType]());
        }

        root.innerHTML = html;
        refreshIcons();
    }
    

    // --- GLOBAL EVENT LISTENERS ---
    document.addEventListener('click', async e => {
        const target = e.target.closest('[data-action]');
        if (!target || state.ui.isSubmitting) return;
        
        const { action, id, view, type, tournamentid, tab, screenshot, code } = target.dataset;

        switch (action) {
            case 'logout': handleLogout(); break;
            case 'show-signup': state.ui.authView = 'signup'; render(); break;
            case 'show-login': state.ui.authView = 'login'; render(); break;
            case 'toggle-user-menu': state.ui.isUserMenuOpen = !state.ui.isUserMenuOpen; render(); break;
            case 'navigate-user': state.ui.userPanelView = view; render(); break;
            case 'navigate-admin': state.ui.adminPanelTab = tab; state.ui.viewingUserId = null; render(); break;
            case 'copy-ref-code': navigator.clipboard.writeText(code).then(() => alert('Referral code copied!')); break;
            case 'open-modal':
                if (tournamentid) state.ui.selectedTournamentId = tournamentid;
                if (screenshot) state.ui.viewingScreenshot = screenshot;
                state.ui.modal = { type };
                render();
                break;
            case 'close-modal': state.ui.modal = null; state.ui.selectedTournamentId = null; state.ui.viewingScreenshot = null; render(); break;
            case 'join-tournament': 
                state.ui.isSubmitting = true; render();
                await handleJoinTournament(tournamentid); 
                state.ui.isSubmitting = false; render();
                break;
            case 'start-tournament': await handleUpdateTournamentStatus(id, 'Ongoing'); break;
            case 'finish-tournament': await handleUpdateTournamentStatus(id, 'Finished'); break;
            case 'delete-tournament': await handleDeleteTournament(id); break;
            case 'admin-view-user': state.ui.viewingUserId = id; render(); break;
            case 'admin-back-to-users': state.ui.viewingUserId = null; render(); break;
            case 'approve-txn': await handleTransactionApproval(id, TransactionStatus.APPROVED); break;
            case 'reject-txn': await handleTransactionApproval(id, TransactionStatus.REJECTED); break;
        }
    });

    document.addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const data = new FormData(form);
        const entries = Object.fromEntries(data.entries());
        
        state.ui.isSubmitting = true;
        render(); // Re-render to show disabled buttons/loading state

        try {
            switch (form.id) {
                case 'login-form': await handleLogin(entries.email, entries.password); break;
                case 'signup-form': await handleSignUp(entries.name, entries.email, entries.password, entries.refCode); break;
                case 'deposit-form':
                    const screenshotFile = form.querySelector('input[type="file"]').files[0];
                    if (!screenshotFile) { alert("Screenshot is required."); break; }
                    const base64 = await fileToBase64(screenshotFile);
                    await handleRequestDeposit(parseFloat(entries.amount), base64);
                    break;
                case 'withdraw-form': await handleRequestWithdraw(entries.method, entries.accountNumber, entries.accountName, parseFloat(entries.amount)); break;
                case 'add-tournament-form':
                    const newTournament = { name: entries.name, game: entries.game, mode: entries.mode, map: entries.map, type: entries.type, entryFee: Number(entries.entryFee), prizePool: Number(entries.prizePool), schedule: entries.schedule };
                    await handleAddTournament(newTournament);
                    break;
                case 'set-creds-form': await handleUpdateTournamentCreds(state.ui.selectedTournamentId, { id: entries.roomId, pass: entries.roomPass }); break;
                case 'set-winner-form': await handleSetTournamentWinner(state.ui.selectedTournamentId, entries.winnerId); break;
            }
        } catch (error) {
            console.error("Form submission error:", error);
            alert("An unexpected error occurred. Please try again.");
        } finally {
             state.ui.isSubmitting = false;
             // The handler functions should call refreshData which triggers a render.
             // If a handler doesn't (e.g. on error), we might need an explicit render call here.
             // For now, most handlers do, so this should be fine.
        }
    });

    // --- INITIALIZATION ---
    async function init() {
        state.isLoading = true;
        render();
        await refreshData(false);
        state.isLoading = false;
        render();
    }
    
    document.addEventListener('DOMContentLoaded', init);

})();
