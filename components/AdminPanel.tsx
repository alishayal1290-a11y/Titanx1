import React, { useState } from 'react';
import { User, Tournament, Transaction, TransactionStatus, TransactionType } from '../types.ts';
import { AnimatedButton } from './common/AnimatedButton.tsx';
import { Modal } from './common/Modal.tsx';

interface AdminPanelProps {
  data: {
    users: User[];
    tournaments: Tournament[];
    transactions: Transaction[];
  };
  onLogout: () => void;
  onAddTournament: (t: Omit<Tournament, 'id' | 'participants' | 'status' | 'winnerId'>) => Promise<void>;
  onDeleteTournament: (id: string) => Promise<void>;
  onUpdateTournamentCreds: (id: string, creds: { id: string, pass: string }) => Promise<void>;
  onUpdateTournamentStatus: (id: string, status: 'Ongoing' | 'Finished') => Promise<void>;
  onApproveTransaction: (id: string) => Promise<void>;
  onRejectTransaction: (id: string) => Promise<void>;
  onSetTournamentWinner: (tournamentId: string, winnerId: string) => Promise<void>;
  onConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ data, onLogout, onAddTournament, onDeleteTournament, onUpdateTournamentCreds, onUpdateTournamentStatus, onApproveTransaction, onRejectTransaction, onSetTournamentWinner, onConfirm }) => {
  const [activeTab, setActiveTab] = useState<'tournaments' | 'users' | 'deposits' | 'withdrawals'>('tournaments');
  const [isAddTournamentModalOpen, setAddTournamentModalOpen] = useState(false);
  const [isCredsModalOpen, setCredsModalOpen] = useState(false);
  const [isWinnerModalOpen, setWinnerModalOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  React.useEffect(() => {
    if (activeTab !== 'users') {
      setViewingUser(null);
    }
  }, [activeTab]);

  const AddTournamentModal = () => {
    const [name, setName] = useState('');
    const [game, setGame] = useState('Free Fire');
    const [entryFee, setEntryFee] = useState('');
    const [prizePool, setPrizePool] = useState('');
    const [schedule, setSchedule] = useState('');
    const [mode, setMode] = useState<'Solo' | 'Duo' | 'Squad'>('Squad');
    const [map, setMap] = useState<'Bermuda' | 'Kalahari' | 'Solara' | 'Nextera'>('Bermuda');
    const [type, setType] = useState<'Per Kill' | 'Survival' | '1v1'>('Survival');
    
    const handleSubmit = async () => {
        const numericEntryFee = parseFloat(entryFee);
        const numericPrizePool = parseFloat(prizePool);

        if (!name || !game || !schedule) {
            alert("Please fill all fields.");
            return;
        }
        if (isNaN(numericEntryFee) || numericEntryFee < 0) {
            alert("Please enter a valid entry fee.");
            return;
        }
        if (isNaN(numericPrizePool) || numericPrizePool <= 0) {
            alert("Please enter a valid, positive prize pool.");
            return;
        }

        setIsSubmitting(true);
        await onAddTournament({name, game, entryFee: numericEntryFee, prizePool: numericPrizePool, schedule, mode, map, type});
        setIsSubmitting(false);
        setAddTournamentModalOpen(false);
    }

    return (
        <Modal isOpen={isAddTournamentModalOpen} onClose={() => setAddTournamentModalOpen(false)} title="Add New Tournament">
            <div className="space-y-4">
                <input type="text" placeholder="Tournament Name" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
                <input type="text" placeholder="Game" value={game} onChange={e => setGame(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
                <select value={mode} onChange={e => setMode(e.target.value as any)} className="w-full px-4 py-2 border rounded-lg bg-white">
                    <option>Solo</option>
                    <option>Duo</option>
                    <option>Squad</option>
                </select>
                <select value={map} onChange={e => setMap(e.target.value as any)} className="w-full px-4 py-2 border rounded-lg bg-white">
                    <option>Bermuda</option>
                    <option>Kalahari</option>
                    <option>Solara</option>
                    <option>Nextera</option>
                </select>
                <select value={type} onChange={e => setType(e.target.value as any)} className="w-full px-4 py-2 border rounded-lg bg-white">
                    <option>Per Kill</option>
                    <option>Survival</option>
                    <option>1v1</option>
                </select>
                <input type="number" placeholder="Entry Fee (TX)" value={entryFee} onChange={e => setEntryFee(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
                <input type="number" placeholder="Prize Pool (TX)" value={prizePool} onChange={e => setPrizePool(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
                <input type="datetime-local" placeholder="Schedule" value={schedule} onChange={e => setSchedule(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
                <AnimatedButton onClick={handleSubmit} className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Tournament'}
                </AnimatedButton>
            </div>
        </Modal>
    )
  }
  
  const TournamentCredsModal = () => {
    const [roomId, setRoomId] = useState('');
    const [roomPass, setRoomPass] = useState('');
    
    const handleSubmit = async () => {
        if (selectedTournament) {
            setIsSubmitting(true);
            await onUpdateTournamentCreds(selectedTournament.id, { id: roomId, pass: roomPass });
            setIsSubmitting(false);
            setCredsModalOpen(false);
            setSelectedTournament(null);
        }
    }

    return (
        <Modal isOpen={isCredsModalOpen} onClose={() => {setCredsModalOpen(false); setSelectedTournament(null);}} title={`Credentials for ${selectedTournament?.name}`}>
            <div className="space-y-4">
                <input type="text" placeholder="Room ID" value={roomId} onChange={e => setRoomId(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
                <input type="text" placeholder="Room Password" value={roomPass} onChange={e => setRoomPass(e.target.value)} className="w-full px-4 py-2 border rounded-lg"/>
                <AnimatedButton onClick={handleSubmit} className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Setting...' : 'Set Credentials'}
                </AnimatedButton>
            </div>
        </Modal>
    )
  }

  const SetWinnerModal = () => {
    const [winnerId, setWinnerId] = useState<string>('');
    const participants = selectedTournament?.participants.map(pId => data.users.find(u => u.id === pId)).filter(Boolean) as User[];

    React.useEffect(() => {
        if (participants.length > 0) {
            setWinnerId(participants[0].id);
        }
    }, [selectedTournament]);

    const handleSubmit = async () => {
        if (selectedTournament && winnerId) {
            setIsSubmitting(true);
            await onSetTournamentWinner(selectedTournament.id, winnerId);
            setIsSubmitting(false);
            setWinnerModalOpen(false);
            setSelectedTournament(null);
        }
    }

    return (
        <Modal isOpen={isWinnerModalOpen} onClose={() => {setWinnerModalOpen(false); setSelectedTournament(null);}} title={`Set Winner for ${selectedTournament?.name}`}>
            <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">Select Winner</label>
                <select value={winnerId} onChange={e => setWinnerId(e.target.value)} className="w-full px-4 py-2 border rounded-lg bg-white">
                    {participants.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
                {participants.length === 0 && <p className="text-sm text-red-500">There are no participants in this tournament.</p>}
                <AnimatedButton onClick={handleSubmit} className="w-full" disabled={isSubmitting || participants.length === 0}>
                  {isSubmitting ? 'Setting...' : 'Confirm Winner'}
                </AnimatedButton>
            </div>
        </Modal>
    )
  }

  const handleDeleteTournament = (id: string) => {
    onConfirm(
      "Delete Tournament",
      "Are you sure you want to delete this tournament? This action cannot be undone.",
      () => onDeleteTournament(id)
    );
  }

  const getTournamentStatusChip = (status: 'Upcoming' | 'Ongoing' | 'Finished', winner?: User | null) => {
     if (status === 'Finished' && winner) {
        return <div className="flex flex-col">
            <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full mb-1">Finished</span>
            <span className="text-xs text-gray-600 font-semibold flex items-center justify-center">
                <i data-lucide="trophy" className="w-3 h-3 mr-1 text-amber-500"></i>
                {winner.name}
            </span>
        </div>
     }
    switch (status) {
      case 'Upcoming':
        return <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">Upcoming</span>;
      case 'Ongoing':
        return <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">Ongoing</span>;
      case 'Finished':
        return <span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 rounded-full">Finished</span>;
    }
  }

  const renderTournaments = () => (
    <div>
      <AnimatedButton onClick={() => setAddTournamentModalOpen(true)} className="mb-4">Add New Tournament</AnimatedButton>
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tournament</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.tournaments.map(t => {
              const winner = t.winnerId ? data.users.find(u => u.id === t.winnerId) : null;
              return (
              <tr key={t.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {t.name}
                    <div className="text-xs text-gray-500">{t.game}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>Fee: {t.entryFee} TX</div>
                  <div>Prize: {t.prizePool} TX</div>
                  <div>Mode: {t.mode}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.participants.length}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                  {getTournamentStatusChip(t.status, winner)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  {t.status === 'Upcoming' && <button onClick={() => onUpdateTournamentStatus(t.id, 'Ongoing')} className="text-blue-600 hover:text-blue-900 font-semibold">Start</button>}
                  {t.status === 'Ongoing' && <button onClick={() => onUpdateTournamentStatus(t.id, 'Finished')} className="text-green-600 hover:text-green-900 font-semibold">End</button>}
                  {t.status === 'Finished' && !t.winnerId && <button onClick={() => { setSelectedTournament(t); setWinnerModalOpen(true);}} className="text-purple-600 hover:text-purple-900 font-semibold">Set Winner</button>}
                  <button onClick={() => { setSelectedTournament(t); setCredsModalOpen(true);}} className="text-amber-600 hover:text-amber-900 font-semibold">Creds</button>
                  <button 
                    onClick={() => handleDeleteTournament(t.id)} 
                    className={`text-red-600 hover:text-red-900 font-semibold ${t.status !== 'Finished' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={t.status !== 'Finished'}
                    title={t.status !== 'Finished' ? 'Only finished tournaments can be deleted.' : 'Delete Tournament'}
                  >Delete</button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
  
  const getTransactionStatusChip = (status: TransactionStatus) => {
    const statusText: { [key in TransactionStatus]: string } = {
        [TransactionStatus.PENDING]: 'Pending',
        [TransactionStatus.APPROVED]: 'Approved',
        [TransactionStatus.REJECTED]: 'Rejected',
    };
    switch (status) {
      case TransactionStatus.PENDING:
        return <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">{statusText[status]}</span>;
      case TransactionStatus.APPROVED:
        return <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">{statusText[status]}</span>;
      case TransactionStatus.REJECTED:
        return <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">{statusText[status]}</span>;
    }
  }

  const renderUserDetailView = () => {
    if (!viewingUser) return null;

    const userTournaments = data.tournaments.filter(t => t.participants.includes(viewingUser.id));
    const userTransactions = data.transactions
      .filter(t => t.userId === viewingUser.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const referrer = viewingUser.referredBy ? data.users.find(u => u.referralCode.toLowerCase() === viewingUser.referredBy!.toLowerCase()) : null;

    return (
      <div>
        <button onClick={() => setViewingUser(null)} className="flex items-center gap-2 text-amber-600 font-semibold mb-6 hover:underline">
          <i data-lucide="arrow-left" className="w-4 h-4"></i> Back to All Users
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-6 rounded-lg shadow space-y-4">
                <h3 className="text-xl font-bold text-gray-800">{viewingUser.name}</h3>
                <p className="text-sm text-gray-500">{viewingUser.email}</p>
                <div className="border-t pt-4">
                    <InfoRow icon="wallet" label="Wallet Balance" value={`${viewingUser.walletBalance.toFixed(2)} TX`} />
                    <InfoRow icon="gift" label="Referral Code" value={viewingUser.referralCode} />
                    {referrer && <InfoRow icon="user-plus" label="Referred By" value={referrer.name} />}
                    <InfoRow icon="swords" label="Matches Played" value={viewingUser.matchesPlayed.toString()} />
                    <InfoRow icon="trophy" label="Matches Won" value={viewingUser.matchesWon.toString()} />
                </div>
            </div>

            <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h4 className="font-bold text-gray-800 mb-4">Joined Tournaments</h4>
                    {userTournaments.length > 0 ? (
                        <ul className="space-y-2">
                        {userTournaments.map(t => (
                            <li key={t.id} className="text-sm text-gray-600 p-2 bg-gray-50 rounded">{t.name}</li>
                        ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500 italic">Not joined in any tournaments yet.</p>
                    )}
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h4 className="font-bold text-gray-800 mb-4">Transaction History</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {userTransactions.length > 0 ? userTransactions.map(t => {
                          const isPositive = t.type === TransactionType.DEPOSIT || t.type === TransactionType.REFERRAL_BONUS || t.type === TransactionType.TOURNAMENT_WIN;
                          return (
                            <div key={t.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center">
                                <div>
                                    <p className="font-semibold capitalize text-sm">{t.type.replace('_', ' ')}</p>
                                    <p className="text-xs text-gray-500">{new Date(t.timestamp).toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                        {isPositive ? '+' : '-'}{t.amount.toFixed(2)} TX
                                    </p>
                                    {getTransactionStatusChip(t.status)}
                                </div>
                            </div>
                        )}) : <p className="text-sm text-gray-500 italic">No transactions found.</p>}
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  };
  
  const InfoRow: React.FC<{ icon: string; label: string; value: string; }> = ({ icon, label, value }) => (
    <div className="flex items-center text-sm mb-2">
        <i data-lucide={icon} className="w-4 h-4 mr-3 text-gray-400"></i>
        <span className="text-gray-600 font-medium">{label}:</span>
        <span className="text-gray-800 ml-auto font-semibold">{value}</span>
    </div>
  );

  const renderUsersList = () => (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {data.users.map(u => (
                    <tr key={u.id} onClick={() => setViewingUser(u)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center">
                            <i data-lucide="coins" className="w-4 h-4 mr-1 text-amber-500"></i>
                            {u.walletBalance.toFixed(2)} TX
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );
  
  const renderUsers = () => {
      return viewingUser ? renderUserDetailView() : renderUsersList();
  }

  const renderTransactions = (type: TransactionType.DEPOSIT | TransactionType.WITHDRAW, typeName: string) => {
    const transactions = data.transactions.filter(t => t.type === type && t.status === TransactionStatus.PENDING);
    return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full">
            <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map(t => {
                    const user = data.users.find(u => u.id === t.userId);
                    return (
                    <tr key={t.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user?.name || 'Unknown'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center">
                            <i data-lucide="coins" className="w-4 h-4 mr-1 text-amber-500"></i>
                            {t.amount.toFixed(2)} TX
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {type === TransactionType.DEPOSIT ? 
                                <button onClick={() => setViewingScreenshot(t.details.screenshot!)} className="text-amber-600 hover:underline">View Screenshot</button> :
                                `${t.details.method} - ${t.details.accountNumber} (${t.details.accountName})`
                            }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button onClick={() => onApproveTransaction(t.id)} className="text-green-600 hover:text-green-900">Approve</button>
                            <button onClick={() => onRejectTransaction(t.id)} className="text-red-600 hover:text-red-900">Reject</button>
                        </td>
                    </tr>
                    )
                })}
                 {transactions.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-4 text-gray-500">No pending {typeName}.</td></tr>
                )}
            </tbody>
        </table>
    </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-800">Admin Panel</h1>
            <div className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full mt-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Online</span>
            </div>
          </div>
          <AnimatedButton onClick={onLogout} variant="secondary">Logout</AnimatedButton>
        </header>

        <div className="flex border-b border-gray-200 mb-6">
          <TabButton title="Tournaments" active={activeTab === 'tournaments'} onClick={() => setActiveTab('tournaments')} />
          <TabButton title="Users" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
          <TabButton title="Deposits" active={activeTab === 'deposits'} onClick={() => setActiveTab('deposits')} />
          <TabButton title="Withdrawals" active={activeTab === 'withdrawals'} onClick={() => setActiveTab('withdrawals')} />
        </div>

        <div>
            {activeTab === 'tournaments' && renderTournaments()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'deposits' && renderTransactions(TransactionType.DEPOSIT, 'deposits')}
            {activeTab === 'withdrawals' && renderTransactions(TransactionType.WITHDRAW, 'withdrawals')}
        </div>

        <AddTournamentModal/>
        {selectedTournament && <TournamentCredsModal/>}
        {selectedTournament && <SetWinnerModal />}
        <Modal isOpen={!!viewingScreenshot} onClose={() => setViewingScreenshot(null)} title="Deposit Screenshot">
          <img src={viewingScreenshot!} alt="Deposit Screenshot" className="w-full h-auto rounded-lg" />
        </Modal>

      </div>
    </div>
  );
};

const TabButton: React.FC<{title: string, active: boolean, onClick: ()=>void}> = ({title, active, onClick}) => (
    <button onClick={onClick} className={`px-4 py-2 -mb-px font-semibold text-sm border-b-2 transition-colors duration-200 ${active ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
        {title}
    </button>
)
