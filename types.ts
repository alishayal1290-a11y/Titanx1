
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // Storing plain passwords is bad practice, but per requirements.
  referralCode: string;
  referredBy?: string;
  walletBalance: number;
  joinedTournaments: string[];
  matchesPlayed: number;
  matchesWon: number;
  totalPrizeMoney: number;
}

export interface Tournament {
  id: string;
  name:string;
  game: string;
  mode: 'Solo' | 'Duo' | 'Squad';
  map: 'Bermuda' | 'Kalahari' | 'Solara' | 'Nextera';
  type: 'Per Kill' | 'Survival' | '1v1';
  entryFee: number;
  prizePool: number;
  schedule: string;
  status: 'Upcoming' | 'Ongoing' | 'Finished';
  participants: string[];
  credentials?: {
    id: string;
    pass: string;
  };
  winnerId?: string;
}

export enum TransactionType {
    DEPOSIT = 'deposit',
    WITHDRAW = 'withdraw',
    REFERRAL_BONUS = 'referral_bonus',
    TOURNAMENT_ENTRY = 'tournament_entry',
    TOURNAMENT_WIN = 'tournament_win'
}

export enum TransactionStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected'
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  timestamp: string;
  details: {
    // For deposit
    screenshot?: string; // base64
    // For withdraw
    method?: 'Easypaisa' | 'Jazzcash';
    accountNumber?: string;
    accountName?: string;
  };
}

export interface AppData {
  users: User[];
  tournaments: Tournament[];
  transactions: Transaction[];
}
