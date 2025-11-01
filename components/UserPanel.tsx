import React, { useState, useMemo, useEffect } from 'react';
import { User, Tournament, Transaction, TransactionType, TransactionStatus } from '../types';
import { AnimatedButton } from './common/AnimatedButton';
import { Modal } from './common/Modal';
import { WHATSAPP_NUMBER, SADAPAY_NUMBER } from '../constants';

interface UserPanelProps {
  user: User;
  tournaments: Tournament[];
  transactions: Transaction[];
  onLogout: () => void;
  onJoinTournament: (tournamentId: string) => Promise<void>;
  onRequestDeposit: (amount: number, screenshot: string) => Promise<void>;
  onRequestWithdraw: (method: 'Easypaisa' | 'Jazzcash', accountNumber: string, accountName: string, amount: number) => Promise<void>;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

type ActiveView = 'tournaments' | 'wallet' | 'profile';

export const UserPanel: React.FC<UserPanelProps> = ({ user, tournaments, transactions, onLogout, onJoinTournament, onRequestDeposit, onRequestWithdraw }) => {
  const [activeView, setActiveView] = useState<ActiveView>('tournaments');
  const [isDepositModalOpen, setDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [activeView, tournaments, transactions, isDepositModalOpen, isWithdrawModalOpen, isMenuOpen]);

  const userTransactions = useMemo(() => transactions.filter(t => t.userId === user.id).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [transactions, user.id]);

  const handleJoin = async (tournamentId: string) => {
    setIsSubmitting(true);
    await onJoinTournament(tournamentId);
    setIsSubmitting(false);
  };

  const renderTournaments = () => {
    const activeTournaments = tournaments.filter(t => t.status !== 'Finished');
    return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Available Tournaments</h2>
      {activeTournaments.length > 0 ? activeTournaments.map(t => (
        <div key={t.id} className="bg-white p-5 rounded-lg shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg text-gray-900">{t.name}</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 my-2">
                <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full"><i data-lucide="gamepad-2" className="w-3 h-3 text-gray-400"></i>{t.game}</span>
                <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full"><i data-lucide="users" className="w-3 h-3 text-gray-400"></i>{t.mode}</span>
                <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full"><i data-lucide="map" className="w-3 h-3 text-gray-400"></i>{t.map}</span>
                <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full"><i data-lucide="target" className="w-3 h-3 text-gray-400"></i>{t.type}</span>
              </div>
              <p className="text-sm text-gray-500 flex items-center">Prize Pool: <i data-lucide="coins" className="w-4 h-4 mx-1 text-amber-500"></i> {t.prizePool.toLocaleString()} TX</p>
              <p className="text-sm text-gray-500 flex items-center">Entry Fee: <i data-lucide="coins" className="w-4 h-4 mx-1 text-amber-500"></i> {t.entryFee} TX</p>
              <p className="text-sm text-gray-500">Schedule: {new Date(t.schedule).toLocaleString()}</p>
            </div>
            <div className="flex-shrink-0 ml-4">
            {t.status === 'Upcoming' ? (
               user.joinedTournaments.includes(t.id) ? (
                 <button className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold" disabled>Joined</button>
               ) : (
                <AnimatedButton onClick={() => handleJoin(t.id)} className="text-sm py-2 px-4" disabled={isSubmitting}>
                  {isSubmitting ? 'Joining...' : 'Join Now'}
                </AnimatedButton>
               )
            ) : ( // Ongoing
                <span className="px-3 py-2 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">Ongoing</span>
            )}
            </div>
          </div>
            {user.joinedTournaments.includes(t.id) && (
              <div className="mt-4 border-t pt-4">
                  <h4 className="font-semibold text-gray-700">Tournament Credentials</h4>
                  {t.credentials ? (
                    <div className="text-sm mt-2 p-3 bg-amber-50 rounded-lg">
                        <p><strong>ID:</strong> {t.credentials.id}</p>
                        <p><strong>Password:</strong> {t.credentials.pass}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic mt-2">Credentials will be provided by the admin before the match starts.</p>
                  )}
              </div>
            )}
        </div>
      )) : (
        <div className="text-center py-10 bg-white rounded-lg shadow-md">
            <p className="text-gray-500">No upcoming or ongoing tournaments right now.</p>
            <p className="text-sm text-gray-400 mt-2">Please check back later!</p>
        </div>
      )}
    </div>
  )
  };

  const DepositModalContent = () => {
    const [amount, setAmount] = useState('');
    const [screenshot, setScreenshot] = useState<File | null>(null);

    const handleDeposit = async () => {
        if (!amount || !screenshot) {
            alert("Please provide amount and screenshot.");
            return;
        }
        setIsSubmitting(true);
        const base64Screenshot = await fileToBase64(screenshot);
        await onRequestDeposit(parseFloat(amount), base64Screenshot);
        setIsSubmitting(false);
        setDepositModalOpen(false);
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-600">Please send the payment to our SadaPay account:</p>
            <div className="bg-gray-100 p-3 rounded-lg text-center">
                <p className="font-mono font-bold text-lg text-gray-800">{SADAPAY_NUMBER}</p>
            </div>
            <p className="text-sm text-gray-600">Then, enter the amount and upload the transaction screenshot below.</p>
            <input type="number" placeholder="Amount (TX)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
            <input type="file" accept="image/*" onChange={e => setScreenshot(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"/>
            <AnimatedButton onClick={handleDeposit} className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Deposit Request'}</AnimatedButton>
        </div>
    );
  }

  const WithdrawModalContent = () => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState<'Easypaisa' | 'Jazzcash'>('Easypaisa');
    const [accountNumber, setAccountNumber] = useState('');
    const [accountName, setAccountName] = useState('');

    const handleWithdraw = async () => {
        if(!amount || !accountNumber || !accountName) {
            alert("Please fill all fields.");
            return;
        }
        if(parseFloat(amount) > user.walletBalance) {
            alert("Insufficient balance.");
            return;
        }
        setIsSubmitting(true);
        await onRequestWithdraw(method, accountNumber, accountName, parseFloat(amount));
        setIsSubmitting(false);
        setWithdrawModalOpen(false);
    }
    
    return (
        <div className="space-y-4">
            <input type="number" placeholder="Amount (TX)" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
            <select value={method} onChange={e => setMethod(e.target.value as any)} className="w-full px-4 py-2 border rounded-lg bg-white">
                <option>Easypaisa</option>
                <option>Jazzcash</option>
            </select>
            <input type="text" placeholder="Account Number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
            <input type="text" placeholder="Account Name" value={accountName} onChange={e => setAccountName(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
            <AnimatedButton onClick={handleWithdraw} className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Withdraw Request'}</AnimatedButton>
        </div>
    );
  }

  const getTransactionStatusChip = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.PENDING:
        return <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">{status}</span>;
      case TransactionStatus.APPROVED:
        return <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">{status}</span>;
      case TransactionStatus.REJECTED:
        return <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">{status}</span>;
    }
  }

  const renderWallet = () => (
    <div className="p-4">
      <div className="bg-slate-800 text-white p-6 rounded-xl shadow-lg mb-6 text-center">
        <p className="text-sm opacity-80">Current Balance</p>
        <p className="text-4xl font-bold tracking-tight flex items-center justify-center">
             <i data-lucide="coins" className="w-10 h-10 mr-2 text-amber-400"></i>
            {user.walletBalance.toFixed(2)} <span className="text-2xl opacity-80 ml-2">TX</span></p>
      </div>
      <div className="flex gap-4 mb-6">
        <AnimatedButton onClick={() => setDepositModalOpen(true)} className="w-full">Deposit</AnimatedButton>
        <AnimatedButton onClick={() => setWithdrawModalOpen(true)} variant="secondary" className="w-full">Withdraw</AnimatedButton>
      </div>
       <h3 className="text-xl font-bold text-gray-800 mb-4">Transaction History</h3>
        <div className="space-y-3">
            {userTransactions.length > 0 ? userTransactions.map(t => {
                 const isPositive = t.type === TransactionType.DEPOSIT || t.type === TransactionType.REFERRAL_BONUS || t.type === TransactionType.TOURNAMENT_WIN;
                 return (
                    <div key={t.id} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                        <div>
                            <p className="font-semibold capitalize">{t.type.replace('_', ' ')}</p>
                            <p className="text-xs text-gray-500">{new Date(t.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                            <p className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                {isPositive ? '+' : '-'}{t.amount.toFixed(2)} TX
                            </p>
                            {getTransactionStatusChip(t.status)}
                        </div>
                    </div>
                )
            }) : <p className="text-gray-500 text-center py-4">No transactions yet.</p>}
        </div>
    </div>
  );

   const StatCard: React.FC<{label: string, value: string | number}> = ({label, value}) => (
    <div className="bg-white p-4 rounded-xl shadow-md text-center">
        <div className="w-4 h-4 bg-amber-200 rounded-full mx-auto mb-2"></div>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
    </div>
   );

   const renderProfile = () => {
    const winRate = user.matchesPlayed > 0 ? ((user.matchesWon / user.matchesPlayed) * 100).toFixed(1) : 0;
    return (
      <div className="p-4 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-lg text-center relative -mt-12">
            <div className="w-24 h-24 rounded-full mx-auto bg-gray-200 border-4 border-white shadow-md mb-4 -mt-12">
                {/* Placeholder circle, icon removed to match screenshot */}
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{user.name}</h2>
            <p className="text-gray-500 text-sm">{user.email}</p>
          </div>

         <div className="grid grid-cols-2 gap-4">
            <StatCard label="Matches Played" value={user.matchesPlayed} />
            <StatCard label="Matches Won" value={user.matchesWon} />
            <StatCard label="Win Rate" value={`${winRate}%`} />
            <StatCard label="Total Winnings" value={`${user.totalPrizeMoney.toLocaleString()} TX`} />
         </div>
      
        <div className="bg-white p-6 rounded-xl shadow-lg text-center">
          <h3 className="font-bold text-lg text-gray-800">Refer & Earn</h3>
          <p className="text-sm text-gray-500 mt-1">Share your code and earn bonuses!</p>
          <div className="my-4 p-3 border-2 border-dashed border-amber-400 bg-amber-50 rounded-lg">
            <p className="text-2xl font-bold text-amber-600 tracking-widest">{user.referralCode}</p>
          </div>
          <AnimatedButton onClick={() => navigator.clipboard.writeText(user.referralCode)}>
            <i data-lucide="copy" className="w-4 h-4"></i> Copy Code
          </AnimatedButton>
        </div>
      </div>
    );
  }

  const renderActiveView = () => {
    switch (activeView) {
      case 'tournaments':
        return renderTournaments();
      case 'wallet':
        return renderWallet();
      case 'profile':
        return renderProfile();
      default:
        return renderTournaments();
    }
  };

  const NavItem: React.FC<{ icon: string; label: string; view: ActiveView }> = ({ icon, label, view }) => {
    const isActive = activeView === view;
    return (
      <button
        onClick={() => setActiveView(view)}
        className={`flex flex-col items-center justify-center w-full pt-3 pb-2 transition-colors duration-200 ${
          isActive ? 'text-amber-500' : 'text-gray-500 hover:text-amber-500'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <i data-lucide={icon} className="w-6 h-6 mb-1"></i>
        <span className="text-xs font-medium">{label}</span>
      </button>
    );
  };

  const BottomNavBar = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] flex justify-around border-t border-gray-200">
      <NavItem icon="swords" label="Tournaments" view="tournaments" />
      <NavItem icon="wallet" label="Wallet" view="wallet" />
      <NavItem icon="user" label="Profile" view="profile" />
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20"> {/* Padding for bottom nav */}
        <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
            <div>
                <h1 className="text-xl font-bold text-slate-800">Titans <span className="text-amber-500">X</span></h1>
                 <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-600">Welcome, {user.name}!</p>
                    <div className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Online</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                 <div className="text-right">
                     <p className="font-semibold text-gray-800 flex items-center justify-end">
                        <i data-lucide="coins" className="w-4 h-4 mr-1 text-amber-500"></i>
                        {user.walletBalance.toFixed(2)} TX
                     </p>
                     <p className="text-xs text-gray-500">Wallet</p>
                </div>
                <div className="relative">
                    <button 
                      id="menu-button"
                      aria-expanded={isMenuOpen}
                      aria-haspopup="true"
                      onClick={() => setIsMenuOpen(!isMenuOpen)} 
                      className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                        <i data-lucide="more-vertical" className="w-6 h-6 text-gray-700"></i>
                    </button>
                    {isMenuOpen && (
                        <div 
                          className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 py-1 ring-1 ring-black ring-opacity-5"
                          role="menu" aria-orientation="vertical" aria-labelledby="menu-button"
                        >
                            <a 
                                href={`https://wa.me/${WHATSAPP_NUMBER}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                role="menuitem"
                            >
                                <i data-lucide="message-square" className="w-4 h-4"></i> Support
                            </a>
                            <button 
                                onClick={() => { onLogout(); setIsMenuOpen(false); }}
                                className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                role="menuitem"
                            >
                                <i data-lucide="log-out" className="w-4 h-4"></i> Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>

        <main className={`transition-all duration-300 ${activeView === 'profile' ? 'pt-16' : ''}`}>
            {renderActiveView()}
        </main>
        
        <BottomNavBar />
        
        <Modal isOpen={isDepositModalOpen} onClose={() => setDepositModalOpen(false)} title="Make a Deposit">
           <DepositModalContent />
        </Modal>

        <Modal isOpen={isWithdrawModalOpen} onClose={() => setWithdrawModalOpen(false)} title="Request a Withdrawal">
            <WithdrawModalContent />
        </Modal>
    </div>
  );
};