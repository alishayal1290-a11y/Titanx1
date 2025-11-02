import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api.ts';
import { AppData, User, Tournament, Transaction, TransactionType, TransactionStatus } from './types.ts';
import { ADMIN_EMAIL, ADMIN_PASSWORD, REFERRER_BONUS_AMOUNT, NEW_USER_REFERRAL_BONUS_AMOUNT } from './constants.ts';
import { AuthScreen } from './components/AuthScreen.tsx';
import { UserPanel } from './components/UserPanel.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import { Modal } from './components/common/Modal.tsx';
import { AnimatedButton } from './components/common/AnimatedButton.tsx';

// A simple hash function (for demonstration purposes, not for production security)
const simpleHash = (s: string) => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        const char = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
};

const App: React.FC = () => {
    const [data, setData] = useState<AppData>({ users: [], tournaments: [], transactions: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [authError, setAuthError] = useState<string | undefined>(undefined);
    const [infoModal, setInfoModal] = useState<{ title: string; message: string } | null>(null);
    const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void; } | null>(null);

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        setIsAdmin(false);
    }, []);

    const refreshData = useCallback(async () => {
        const latestData = await api.getData();
        setData(latestData);
        // Also refresh the currentUser object, using functional update to avoid dependency
        setCurrentUser(prevUser => {
             if (prevUser && !isAdmin) {
                const updatedUser = latestData.users.find(u => u.id === prevUser.id);
                if (updatedUser) {
                    return updatedUser;
                } else { // User was deleted
                    handleLogout();
                    return null;
                }
            }
            return prevUser;
        });
    }, [isAdmin, handleLogout]);

    useEffect(() => {
        const initialLoad = async () => {
            setIsLoading(true);
            const initialData = await api.getData();
            setData(initialData);
            setIsLoading(false);
        };
        initialLoad();
    }, []); // <-- This effect now runs only once on initial mount.
    
    const handleLogin = async (email: string, pass: string) => {
        setAuthError(undefined);
        if (email === ADMIN_EMAIL && pass === ADMIN_PASSWORD) {
            setIsAdmin(true);
            setCurrentUser({ id: 'admin', name: 'Admin', email: ADMIN_EMAIL, passwordHash: '', referralCode: '', walletBalance: 0, joinedTournaments: [], matchesPlayed: 0, matchesWon: 0, totalPrizeMoney: 0 });
            return;
        }

        const currentData = await api.getData();
        const user = currentData.users.find(u => u.email === email);
        if (user && user.passwordHash === simpleHash(pass)) {
            setCurrentUser(user);
            setIsAdmin(false);
            setData(currentData);
        } else {
            setAuthError("Invalid email or password.");
        }
    };

    const handleSignUp = async (name: string, email: string, pass: string, refCode?: string) => {
        setAuthError(undefined);
        let currentData = await api.getData();

        if (currentData.users.some(u => u.email === email)) {
            setAuthError("An account with this email already exists.");
            return;
        }

        const newUser: User = {
            id: `user_${Date.now()}`,
            name,
            email,
            passwordHash: simpleHash(pass),
            referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
            walletBalance: 0,
            referredBy: refCode,
            joinedTournaments: [],
            matchesPlayed: 0,
            matchesWon: 0,
            totalPrizeMoney: 0,
        };
        
        if (refCode) {
            const referrer = currentData.users.find(u => u.referralCode.toLowerCase() === refCode.toLowerCase());
            if (referrer) {
                // New user gets bonus
                newUser.walletBalance += NEW_USER_REFERRAL_BONUS_AMOUNT;
                const newUserBonusTransaction: Transaction = {
                    id: `txn_${Date.now()}`,
                    userId: newUser.id,
                    type: TransactionType.REFERRAL_BONUS,
                    amount: NEW_USER_REFERRAL_BONUS_AMOUNT,
                    status: TransactionStatus.APPROVED,
                    timestamp: new Date().toISOString(),
                    details: {}
                };
                currentData.transactions.push(newUserBonusTransaction);

                // Referrer gets bonus
                referrer.walletBalance += REFERRER_BONUS_AMOUNT;
                const referrerBonusTransaction: Transaction = {
                    id: `txn_ref_${Date.now()}`,
                    userId: referrer.id,
                    type: TransactionType.REFERRAL_BONUS,
                    amount: REFERRER_BONUS_AMOUNT,
                    status: TransactionStatus.APPROVED,
                    timestamp: new Date().toISOString(),
                    details: {}
                };
                currentData.transactions.push(referrerBonusTransaction);
            } else {
                setAuthError("Invalid referral code provided, but account was created.");
            }
        }

        currentData.users.push(newUser);

        await api._setData(currentData);
        // Set state directly to avoid flicker from redundant refresh
        setData(currentData);
        setCurrentUser(newUser);
        setIsAdmin(false);
    };

    const handleJoinTournament = async (tournamentId: string) => {
        if (!currentUser) return;
        const currentData = await api.getData();
        const tournament = currentData.tournaments.find(t => t.id === tournamentId);
        const user = currentData.users.find(u => u.id === currentUser.id);

        if (!tournament || !user) {
            setInfoModal({title: "Error", message: "An error occurred. Please try again."});
            return;
        }
        
        if (tournament.status !== 'Upcoming') {
            setInfoModal({title: "Registration Closed", message: "This tournament is not open for registration."});
            return;
        }

        if (user.walletBalance < tournament.entryFee) {
            setInfoModal({title: "Insufficient Balance", message: "You do not have enough funds in your wallet to join this tournament."});
            return;
        }
        
        // Update data
        user.walletBalance -= tournament.entryFee;
        user.joinedTournaments.push(tournamentId);
        tournament.participants.push(user.id);

        const entryFeeTransaction: Transaction = {
            id: `txn_entry_${Date.now()}`,
            userId: currentUser.id,
            type: TransactionType.TOURNAMENT_ENTRY,
            amount: tournament.entryFee,
            status: TransactionStatus.APPROVED,
            timestamp: new Date().toISOString(),
            details: {}
        };
        currentData.transactions.push(entryFeeTransaction);

        await api._setData(currentData);
        await refreshData();
    };
    
    const handleRequestDeposit = async (amount: number, screenshot: string) => {
        if (!currentUser) return;
        const currentData = await api.getData();
        const newTransaction: Transaction = {
            id: `txn_${Date.now()}`,
            userId: currentUser.id,
            type: TransactionType.DEPOSIT,
            amount,
            status: TransactionStatus.PENDING,
            timestamp: new Date().toISOString(),
            details: { screenshot }
        };
        currentData.transactions.push(newTransaction);
        await api._setData(currentData);
        await refreshData();
        setInfoModal({title: "Request Submitted", message: "Your deposit request has been submitted. Please wait for admin approval."});
    };

    const handleRequestWithdraw = async (method: 'Easypaisa' | 'Jazzcash', accountNumber: string, accountName: string, amount: number) => {
        if (!currentUser) return;
        const currentData = await api.getData();
        const newTransaction: Transaction = {
            id: `txn_${Date.now()}`,
            userId: currentUser.id,
            type: TransactionType.WITHDRAW,
            amount,
            status: TransactionStatus.PENDING,
            timestamp: new Date().toISOString(),
            details: { method, accountNumber, accountName }
        };
        currentData.transactions.push(newTransaction);
        await api._setData(currentData);
        await refreshData();
        setInfoModal({title: "Request Submitted", message: "Your withdrawal request has been submitted. Please wait for admin approval."});
    };
    
    // Admin functions
    const handleAddTournament = async (t: Omit<Tournament, 'id' | 'participants' | 'status' | 'winnerId'>) => {
        await api.createTournament(t);
        await refreshData();
    };
    
    const handleDeleteTournament = async (id: string) => {
        await api.deleteTournament(id);
        await refreshData();
    };

    const handleUpdateTournamentCreds = async (id: string, creds: { id: string, pass: string }) => {
        const currentData = await api.getData();
        const tournament = currentData.tournaments.find(t => t.id === id);
        if (tournament) {
            tournament.credentials = creds;
            await api._setData(currentData);
            await refreshData();
        }
    };
    
    const handleUpdateTournamentStatus = async (id: string, newStatus: 'Ongoing' | 'Finished') => {
        const currentData = await api.getData();
        const tournament = currentData.tournaments.find(t => t.id === id);
        if (tournament) {
            tournament.status = newStatus;
            await api._setData(currentData);
            await refreshData();
        }
    };
    
    const handleSetTournamentWinner = async (tournamentId: string, winnerId: string) => {
        const currentData = await api.getData();
        const tournament = currentData.tournaments.find(t => t.id === tournamentId);
        const winner = currentData.users.find(u => u.id === winnerId);

        if (!tournament || !winner) {
            setInfoModal({ title: "Error", message: "Error setting winner. Tournament or user not found." });
            return;
        }

        if (tournament.winnerId) {
            setInfoModal({ title: "Winner Already Set", message: "A winner has already been set for this tournament." });
            return;
        }

        // 1. Set winner on tournament
        tournament.winnerId = winnerId;

        // 2. Update winner's stats & wallet
        winner.matchesWon += 1;
        winner.walletBalance += tournament.prizePool;
        winner.totalPrizeMoney += tournament.prizePool;

        // 3. Create a transaction for the prize money
        const prizeTransaction: Transaction = {
            id: `txn_win_${Date.now()}`,
            userId: winner.id,
            type: TransactionType.TOURNAMENT_WIN,
            amount: tournament.prizePool,
            status: TransactionStatus.APPROVED,
            timestamp: new Date().toISOString(),
            details: {}
        };
        currentData.transactions.push(prizeTransaction);

        // 4. Update all participants' matches played count
        tournament.participants.forEach(participantId => {
            const participant = currentData.users.find(u => u.id === participantId);
            if (participant) {
                participant.matchesPlayed += 1;
            }
        });

        await api._setData(currentData);
        await refreshData();
        setInfoModal({ title: "Winner Set!", message: `${winner.name} has been set as the winner!` });
    };

    const handleTransactionApproval = async (id: string, newStatus: TransactionStatus) => {
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
                    // Check balance again before deducting, just in case
                    if(user.walletBalance >= transaction.amount) {
                      user.walletBalance -= transaction.amount;
                    } else {
                      transaction.status = TransactionStatus.REJECTED;
                      setInfoModal({ title: "Approval Failed", message: "Withdrawal rejected due to insufficient funds at time of approval."});
                    }
                }
            }
        }
        
        await api._setData(currentData);
        await refreshData();
    }

    const showConfirmModal = (title: string, message: string, onConfirm: () => void) => {
        setConfirmModal({ title, message, onConfirm });
    };

    const renderModals = () => (
        <>
            {infoModal && (
                <Modal isOpen={!!infoModal} onClose={() => setInfoModal(null)} title={infoModal.title}>
                    <p className="text-gray-600">{infoModal.message}</p>
                    <AnimatedButton onClick={() => setInfoModal(null)} className="w-full mt-6">
                        Close
                    </AnimatedButton>
                </Modal>
            )}
            {confirmModal && (
                <Modal isOpen={!!confirmModal} onClose={() => setConfirmModal(null)} title={confirmModal.title}>
                    <p className="text-gray-600">{confirmModal.message}</p>
                    <div className="flex gap-4 mt-6">
                        <AnimatedButton onClick={() => setConfirmModal(null)} variant="secondary" className="w-full">
                            Cancel
                        </AnimatedButton>
                        <AnimatedButton onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="w-full">
                            Confirm
                        </AnimatedButton>
                    </div>
                </Modal>
            )}
        </>
    );

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-16 h-16 border-4 border-amber-500 border-solid rounded-full animate-spin border-t-transparent"></div>
                <style>{`
                    .border-t-transparent { border-top-color: transparent; }
                `}</style>
            </div>
        );
    }

    const renderContent = () => {
        if (isAdmin) {
            return <AdminPanel 
                        data={data} 
                        onLogout={handleLogout} 
                        onAddTournament={handleAddTournament}
                        onDeleteTournament={handleDeleteTournament}
                        onUpdateTournamentCreds={handleUpdateTournamentCreds}
                        onUpdateTournamentStatus={handleUpdateTournamentStatus}
                        onSetTournamentWinner={handleSetTournamentWinner}
                        onApproveTransaction={(id) => handleTransactionApproval(id, TransactionStatus.APPROVED)}
                        onRejectTransaction={(id) => handleTransactionApproval(id, TransactionStatus.REJECTED)}
                        onConfirm={showConfirmModal}
                    />;
        }
        if (currentUser) {
            return <UserPanel 
                        user={currentUser} 
                        tournaments={data.tournaments} 
                        transactions={data.transactions}
                        onLogout={handleLogout} 
                        onJoinTournament={handleJoinTournament}
                        onRequestDeposit={handleRequestDeposit}
                        onRequestWithdraw={handleRequestWithdraw}
                    />;
        }
        return <AuthScreen onLogin={handleLogin} onSignUp={handleSignUp} error={authError} />;
    };

    return (
        <>
            {renderContent()}
            {renderModals()}
        </>
    )
};

declare global {
    interface Window {
        lucide: any;
    }
}

export default App;