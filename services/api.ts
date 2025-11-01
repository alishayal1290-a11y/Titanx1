import { AppData, Tournament, User, Transaction, TransactionType, TransactionStatus } from '../types.ts';

const STORAGE_KEY = 'titans_x_tournaments_data';

// Helper to return a deep copy to prevent direct state mutation
const deepCopy = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// Helper to simulate network delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


const initialTournaments: Tournament[] = [
    {
      id: 't1',
      name: 'Evening Scrims',
      game: 'Free Fire',
      mode: 'Squad',
      map: 'Bermuda',
      type: 'Survival',
      entryFee: 50,
      prizePool: 5000,
      schedule: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Upcoming',
      participants: [],
    },
    {
      id: 't2',
      name: 'Weekend Warriors',
      game: 'Free Fire',
      mode: 'Solo',
      map: 'Kalahari',
      type: 'Per Kill',
      entryFee: 100,
      prizePool: 10000,
      schedule: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Upcoming',
      participants: [],
    }
];

const defaultDb: AppData = {
  users: [],
  tournaments: initialTournaments,
  transactions: [],
};

// In-memory "database" that syncs with localStorage
let db: AppData;

const saveData = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (error) {
    console.error("Failed to save data to localStorage", error);
  }
};

const migrateData = (data: any): AppData => {
  // Guard against invalid top-level data
  if (typeof data !== 'object' || data === null) {
    return deepCopy(defaultDb);
  }

  // Safely process users
  const users = Array.isArray(data.users) 
    ? data.users.filter(u => u && typeof u === 'object').map((user: any): User => ({
        id: user.id || `user_${Date.now()}_${Math.random()}`,
        name: user.name || 'Unknown User',
        email: user.email || '',
        passwordHash: user.passwordHash || '',
        referralCode: user.referralCode || '',
        referredBy: user.referredBy,
        walletBalance: typeof user.walletBalance === 'number' ? user.walletBalance : 0,
        joinedTournaments: Array.isArray(user.joinedTournaments) ? user.joinedTournaments : [],
        matchesPlayed: user.matchesPlayed || 0,
        matchesWon: user.matchesWon || 0,
        totalPrizeMoney: user.totalPrizeMoney || 0,
      }))
    : [];

  // Safely process tournaments
  const tournaments = Array.isArray(data.tournaments) 
    ? data.tournaments.filter(t => t && typeof t === 'object').map((tournament: any): Tournament => ({
        id: tournament.id || `t_${Date.now()}_${Math.random()}`,
        name: tournament.name || 'Unnamed Tournament',
        game: tournament.game || 'Free Fire',
        mode: tournament.mode || 'Squad',
        map: tournament.map || 'Bermuda',
        type: tournament.type || 'Survival',
        entryFee: typeof tournament.entryFee === 'number' ? tournament.entryFee : 0,
        prizePool: typeof tournament.prizePool === 'number' ? tournament.prizePool : 0,
        schedule: tournament.schedule || new Date().toISOString(),
        status: tournament.status || 'Upcoming',
        participants: Array.isArray(tournament.participants) ? tournament.participants : [],
        credentials: tournament.credentials,
        winnerId: tournament.winnerId,
      }))
    : [];
  
  // Safely process transactions
  const transactions = Array.isArray(data.transactions) 
    ? data.transactions.filter(t => t && typeof t === 'object').map((transaction: any): Transaction => ({
        id: transaction.id || `txn_${Date.now()}_${Math.random()}`,
        userId: transaction.userId || '',
        type: transaction.type || TransactionType.DEPOSIT,
        amount: typeof transaction.amount === 'number' ? transaction.amount : 0,
        status: transaction.status || TransactionStatus.PENDING,
        timestamp: transaction.timestamp || new Date().toISOString(),
        details: transaction.details && typeof transaction.details === 'object' ? transaction.details : {},
      }))
    : [];

  return { users, tournaments, transactions };
};

const loadData = () => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      db = migrateData(parsedData);
    } else {
      db = deepCopy(defaultDb);
      saveData();
    }
  } catch (error) {
    console.error("Failed to load data from localStorage", error);
    db = deepCopy(defaultDb);
  }
};

// Initial load
loadData();

// This object simulates a backend API
export const api = {
  // Fetches the entire current state of the database.
  getData: async (): Promise<AppData> => {
    await delay(300); // Simulate network latency
    if (!db) loadData(); // Ensure db is loaded
    return deepCopy(db);
  },

  // Updates the entire database. Used internally for simplicity after mutations.
  _setData: async (newData: AppData): Promise<void> => {
    await delay(100);
    db = newData;
    saveData();
    return Promise.resolve();
  },
  
  // Creates a new tournament and adds it to the database.
  createTournament: async (t: Omit<Tournament, 'id' | 'participants' | 'status' | 'winnerId'>): Promise<Tournament> => {
    await delay(400);
    const newTournament: Tournament = {
        ...t,
        id: `t_${Date.now()}`,
        participants: [],
        status: 'Upcoming'
    };
    db.tournaments.push(newTournament);
    saveData();
    return deepCopy(newTournament);
  },

  // Deletes a tournament from the database by its ID.
  deleteTournament: async (id: string): Promise<void> => {
    await delay(400);
    const tournament = db.tournaments.find(t => t.id === id);
    if (tournament && tournament.status !== 'Finished') {
      console.warn("Attempted to delete a tournament that is not finished. Action blocked.");
      return Promise.resolve(); // Or reject with an error
    }
    db.tournaments = db.tournaments.filter(t => t.id !== id);
    saveData();
    return Promise.resolve();
  },
};