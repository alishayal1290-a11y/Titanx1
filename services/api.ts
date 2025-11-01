import { AppData, Tournament, User, Transaction } from '../types';

const STORAGE_key = 'titans_x_tournaments_data';

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
    localStorage.setItem(STORAGE_key, JSON.stringify(db));
  } catch (error) {
    console.error("Failed to save data to localStorage", error);
  }
};

const migrateData = (data: any): AppData => {
  // For users, ensure stats fields exist
  data.users = data.users.map((user: any) => ({
      ...user,
      matchesPlayed: user.matchesPlayed || 0,
      matchesWon: user.matchesWon || 0,
      totalPrizeMoney: user.totalPrizeMoney || 0,
  }));

  // For tournaments, ensure new fields exist
  data.tournaments = data.tournaments.map((tournament: any) => ({
      ...tournament,
      game: tournament.game || 'Free Fire', // Default to Free Fire if missing
      winnerId: tournament.winnerId || undefined,
  }));

  return data;
}

const loadData = () => {
  try {
    const storedData = localStorage.getItem(STORAGE_key);
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
  createTournament: async (t: Omit<Tournament, 'id' | 'participants' | 'status'>): Promise<Tournament> => {
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
    db.tournaments = db.tournaments.filter(t => t.id !== id);
    saveData();
    return Promise.resolve();
  },
};
