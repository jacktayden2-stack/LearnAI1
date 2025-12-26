
import { MarketplaceItem, UserAccount, KnowledgeNode, RankProfile, LeaderboardEntry, RankTier, RankDivision } from "../types";

// KEYS
const DB_USERS_KEY = 'learnai_db_users';
const DB_POSTS_KEY = 'learnai_db_posts';
const SESSION_KEY = 'learnai_session';
const RANK_PROFILE_KEY = 'learnai_rank_profile';

// --- INITIALIZATION ---
const initDB = () => {
    if (!localStorage.getItem(DB_USERS_KEY)) {
        localStorage.setItem(DB_USERS_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(DB_POSTS_KEY)) {
        // Initial Seed Data
        const seedPosts: MarketplaceItem[] = [
            { id: '1', authorId: 'system', author: 'Ms. Hoa', title: 'IELTS 8.0 Vocab', type: 'Deck', price: 'Free', rating: 5, category: 'Language', students: 1200, timestamp: new Date().toISOString(), description: 'Bộ từ vựng IELTS nâng cao.' },
            { id: '4', authorId: 'system', author: 'React Team', title: 'React Docs (Official)', type: 'Link', price: 'Free', rating: 5, category: 'Tech', students: 5000, url: 'https://react.dev', timestamp: new Date().toISOString() },
        ];
        localStorage.setItem(DB_POSTS_KEY, JSON.stringify(seedPosts));
    }
};

// Call init immediately
initDB();

// --- AUTH SERVICES ---

// Helper to generate unique friend code
const generateFriendCode = (existingUsers: UserAccount[]): string => {
    let code = '';
    do {
        // Generate a random 6-character alphanumeric code
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (existingUsers.some(u => u.friendCode === code));
    return code;
};

export const registerUser = (email: string, password: string, name: string): { success: boolean, message?: string, user?: UserAccount } => {
    const users: UserAccount[] = JSON.parse(localStorage.getItem(DB_USERS_KEY) || '[]');
    
    // Check for duplicate email
    if (users.some(u => u.email === email)) {
        return { success: false, message: "Email đã tồn tại!" };
    }

    // Check for duplicate name (case insensitive)
    if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        return { success: false, message: "Tên người dùng đã được sử dụng. Vui lòng chọn tên khác." };
    }

    const newUser: UserAccount = {
        id: Date.now().toString(),
        email,
        password, // In a real app, hash this!
        name,
        friendCode: generateFriendCode(users), // Generate unique friend code
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        joinedDate: new Date().toISOString(),
        friends: []
    };

    users.push(newUser);
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
    
    // Auto login
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    return { success: true, user: newUser };
};

export const loginUser = (email: string, password: string): { success: boolean, message?: string, user?: UserAccount } => {
    const users: UserAccount[] = JSON.parse(localStorage.getItem(DB_USERS_KEY) || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return { success: true, user };
    }
    return { success: false, message: "Email hoặc mật khẩu không đúng." };
};

export const logoutUser = () => {
    localStorage.removeItem(SESSION_KEY);
};

export const getCurrentUser = (): UserAccount | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
};

// --- USER MANAGEMENT (NEW FOR BATTLE MODE) ---

export const getAllUsers = (): UserAccount[] => {
    const usersStr = localStorage.getItem(DB_USERS_KEY);
    return usersStr ? JSON.parse(usersStr) : [];
};

// --- FRIEND SYSTEM SERVICES ---

export const addFriend = (targetFriendCode: string): { success: boolean, message: string } => {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, message: "Bạn cần đăng nhập để kết bạn." };

    if (targetFriendCode === currentUser.friendCode) {
        return { success: false, message: "Bạn không thể kết bạn với chính mình." };
    }

    const users: UserAccount[] = getAllUsers();
    
    // Find Target
    const targetUserIndex = users.findIndex(u => u.friendCode === targetFriendCode);
    const currentUserIndex = users.findIndex(u => u.id === currentUser.id);

    if (targetUserIndex === -1 || currentUserIndex === -1) {
        return { success: false, message: "Không tìm thấy người dùng với mã này." };
    }

    const targetUser = users[targetUserIndex];
    const userInDb = users[currentUserIndex];

    // Check if already friends
    if (userInDb.friends.includes(targetUser.id)) {
        return { success: false, message: "Hai bạn đã là bạn bè rồi." };
    }

    // Add friend (bi-directional for simplicity in mock)
    userInDb.friends.push(targetUser.id);
    targetUser.friends.push(userInDb.id);

    // Save DB
    users[currentUserIndex] = userInDb;
    users[targetUserIndex] = targetUser;
    localStorage.setItem(DB_USERS_KEY, JSON.stringify(users));
    
    // Update Session
    localStorage.setItem(SESSION_KEY, JSON.stringify(userInDb));

    return { success: true, message: `Đã kết bạn với ${targetUser.name} thành công!` };
};

export const getFriendsList = (): UserAccount[] => {
    const currentUser = getCurrentUser();
    if (!currentUser) return [];

    const allUsers = getAllUsers();
    // Re-fetch current user from DB to ensure latest friends list
    const freshCurrentUser = allUsers.find(u => u.id === currentUser.id);
    if (!freshCurrentUser) return [];

    return allUsers.filter(u => freshCurrentUser.friends.includes(u.id));
};

// --- DATA SEGREGATION (SANDBOXING) ---
// Each user has their own "userNodes" stored in a specific key: learnai_nodes_{userId}

export const getUserNodes = (): KnowledgeNode[] => {
    const user = getCurrentUser();
    if (!user) return [];
    const key = `learnai_nodes_${user.id}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

export const getUserNodesByUserId = (userId: string): KnowledgeNode[] => {
    const key = `learnai_nodes_${userId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
};

export const saveUserNodes = (nodes: KnowledgeNode[]) => {
    const user = getCurrentUser();
    if (!user) return;
    const key = `learnai_nodes_${user.id}`;
    localStorage.setItem(key, JSON.stringify(nodes));
};

// --- MARKETPLACE SERVICES (SHARING) ---

export const getMarketplaceFeed = (): MarketplaceItem[] => {
    return JSON.parse(localStorage.getItem(DB_POSTS_KEY) || '[]');
};

export const publishItem = (item: Omit<MarketplaceItem, 'id' | 'authorId' | 'author' | 'timestamp' | 'students' | 'rating'>) => {
    const user = getCurrentUser();
    if (!user) throw new Error("Must be logged in to publish");

    const posts: MarketplaceItem[] = JSON.parse(localStorage.getItem(DB_POSTS_KEY) || '[]');
    
    const newPost: MarketplaceItem = {
        ...item,
        id: Date.now().toString(),
        authorId: user.id,
        author: user.name,
        students: 0,
        rating: 0,
        timestamp: new Date().toISOString()
    };

    // Add to top
    posts.unshift(newPost);
    localStorage.setItem(DB_POSTS_KEY, JSON.stringify(posts));
    return newPost;
};

export const importItem = (itemId: string): boolean => {
    const posts: MarketplaceItem[] = getMarketplaceFeed();
    const item = posts.find(p => p.id === itemId);
    
    if (item && item.type === 'Deck' && item.payload) {
        // Import Logic
        const currentNodes = getUserNodes();
        
        // Clone nodes and assign unique IDs to prevent conflict, but KEEP author info
        const newNodes = (item.payload as KnowledgeNode[]).map(n => ({
            ...n,
            id: Date.now().toString() + Math.random().toString().substr(2, 5),
            title: n.title, // Keep original title
            originalAuthor: item.author, // Tag the imported node with the creator's name
            status: 'new' // Reset status for the new user
        } as KnowledgeNode));
        
        saveUserNodes([...currentNodes, ...newNodes]);
        
        // Update stats (mock increment student count)
        const updatedPosts = posts.map(p => p.id === itemId ? { ...p, students: p.students + 1 } : p);
        localStorage.setItem(DB_POSTS_KEY, JSON.stringify(updatedPosts));
        
        return true;
    }
    return false;
};

// --- RANKED SYSTEM SERVICES (LEAGUE STYLE) ---

const TIERS: RankTier[] = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Challenger'];
const DIVISIONS: RankDivision[] = ['IV', 'III', 'II', 'I'];

const DEFAULT_RANK: RankProfile = {
    tier: 'Iron',
    division: 'IV',
    lp: 0,
    totalWins: 0,
    totalLosses: 0,
    seasonPoints: { daily: 0, weekly: 0, monthly: 0 },
    matchHistory: []
};

// Helper: Get Rank Profile by Specific User ID
export const getRankProfileByUserId = (userId: string): RankProfile => {
    const key = `${RANK_PROFILE_KEY}_${userId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : DEFAULT_RANK;
};

export const getRankProfile = (): RankProfile => {
    const user = getCurrentUser();
    if (!user) return DEFAULT_RANK;
    return getRankProfileByUserId(user.id);
};

export const updateRankPoints = (pointsDelta: number, result: 'Victory' | 'Defeat'): { newProfile: RankProfile, promoted: boolean, demoted: boolean } => {
    const user = getCurrentUser();
    if (!user) throw new Error("No user");

    const key = `${RANK_PROFILE_KEY}_${user.id}`;
    let profile = getRankProfile();
    let promoted = false;
    let demoted = false;

    // Update Points
    profile.lp += pointsDelta;
    if (result === 'Victory') profile.totalWins++;
    else profile.totalLosses++;

    // Update Periodic Points (Only add, never subtract for cumulative score)
    if (pointsDelta > 0) {
        profile.seasonPoints.daily += pointsDelta;
        profile.seasonPoints.weekly += pointsDelta;
        profile.seasonPoints.monthly += pointsDelta;
    }

    // Promotion Logic
    if (profile.lp >= 100) {
        const currentTierIdx = TIERS.indexOf(profile.tier);
        const currentDivIdx = DIVISIONS.indexOf(profile.division);

        if (currentDivIdx < 3) {
            // Promote Division (e.g., IV -> III)
            profile.division = DIVISIONS[currentDivIdx + 1];
            profile.lp -= 100;
            promoted = true;
        } else if (currentTierIdx < TIERS.length - 1) {
            // Promote Tier (e.g., Silver I -> Gold IV)
            profile.tier = TIERS[currentTierIdx + 1];
            profile.division = 'IV';
            profile.lp -= 100;
            promoted = true;
        } else {
            // Cap at Challenger
            profile.lp = Math.min(profile.lp, 2000); // Soft cap for Challenger LP
        }
    }

    // Demotion Logic
    if (profile.lp < 0) {
        const currentTierIdx = TIERS.indexOf(profile.tier);
        const currentDivIdx = DIVISIONS.indexOf(profile.division);

        if (currentDivIdx > 0) {
            // Demote Division (e.g., III -> IV)
            profile.division = DIVISIONS[currentDivIdx - 1];
            profile.lp = 75; // Reset to 75 LP
            demoted = true;
        } else if (currentTierIdx > 0) {
            // Demote Tier (e.g., Gold IV -> Silver I)
            profile.tier = TIERS[currentTierIdx - 1];
            profile.division = 'I';
            profile.lp = 75;
            demoted = true;
        } else {
            // Floor at Iron IV
            profile.lp = 0;
        }
    }

    // Add History
    profile.matchHistory.unshift({
        id: Date.now().toString(),
        result,
        lpChange: pointsDelta,
        timestamp: new Date().toISOString()
    });
    if (profile.matchHistory.length > 20) profile.matchHistory.pop();

    localStorage.setItem(key, JSON.stringify(profile));
    return { newProfile: profile, promoted, demoted };
};

// Generate Real Leaderboard from Local Data
export const getLeaderboardData = (): LeaderboardEntry[] => {
    const allUsers = getAllUsers();
    
    // Weight map for sorting
    const tiersWeight: {[key: string]: number} = {
        'Challenger': 8000, 'Master': 7000, 'Diamond': 6000, 'Platinum': 5000, 
        'Gold': 4000, 'Silver': 3000, 'Bronze': 2000, 'Iron': 1000
    };

    const divisionWeight: {[key: string]: number} = {
        'I': 300, 'II': 200, 'III': 100, 'IV': 0
    };

    let leaderboard: LeaderboardEntry[] = allUsers.map(user => {
        const rank = getRankProfileByUserId(user.id);
        const score = tiersWeight[rank.tier] + divisionWeight[rank.division] + rank.lp;
        
        return {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            tier: rank.tier,
            lp: rank.lp,
            rank: 0, // Calculated after sort
            rawScore: score // Internal use
        };
    });

    // Sort Descending by Score
    leaderboard.sort((a, b) => (b.rawScore || 0) - (a.rawScore || 0));

    // Assign Ranks
    leaderboard = leaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1
    }));

    return leaderboard.slice(0, 100); // Return Top 100
};
