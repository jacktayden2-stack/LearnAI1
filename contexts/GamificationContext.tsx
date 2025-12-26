
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { RankProfile, Achievement } from '../types';
import { getRankProfile, updateRankPoints } from '../services/mockBackend';

// --- TYPES ---
interface UserProgress {
    xp: number;
    level: number;
    streak: number;
    lastCheckIn: string; // ISO Date string of the last successful check-in
    lastLogin: string; 
    history: { id: string, amount: number, reason: string, timestamp: string }[];
    achievements: Achievement[]; // Added achievements array
}

interface GamificationContextType {
    progress: UserProgress;
    addXP: (amount: number, reason: string) => void;
    checkIn: () => void; // New function for daily streak
    isCheckedInToday: boolean; // Helper state
    levelUp: boolean; 
    closeLevelUp: () => void;
    
    // Achievement System
    unlockAchievement: (id: string) => void;
    updateAchievementProgress: (id: string, increment: number) => void;
    
    // AI Deep Learning Integration
    unlockHiddenAchievement: (achievement: Achievement) => void; // Unlocks a dynamic achievement from AI

    // Ranked System
    isRankedMode: boolean;
    toggleRankedMode: () => void;
    rankProfile: RankProfile;
    updateRank: (points: number) => void; // Wrapper for backend call
}

// --- INITIAL ACHIEVEMENTS (Seed Data) ---
const INITIAL_ACHIEVEMENTS: Achievement[] = [
    { id: 'first_node', title: 'Nhà Khai Hoang', description: 'Tạo nốt tri thức đầu tiên', icon: 'explore', category: 'Alchemy', progress: 0, goal: 1, rewardXP: 100 },
    { id: 'tutor_master', title: 'Triết Gia Trẻ', description: 'Thảo luận với Gia sư Biện chứng 5 lần', icon: 'psychology_alt', category: 'Tutor', progress: 0, goal: 5, rewardXP: 250 },
    { id: 'graph_connector', title: 'Kiến Trúc Sư Mạng Lưới', description: 'Tạo 20 liên kết trong sơ đồ', icon: 'hub', category: 'Graph', progress: 0, goal: 20, rewardXP: 300 },
    { id: 'pomodoro_pro', title: 'Bậc Thầy Tập Trung', description: 'Hoàn thành 10 phiên Pomodoro', icon: 'timer', category: 'General', progress: 0, goal: 10, rewardXP: 500 },
    { id: 'sharer', title: 'Người Truyền Lửa', description: 'Xuất bản 3 bài học lên thư viện', icon: 'public', category: 'Social', progress: 0, goal: 3, rewardXP: 400 },
    { id: 'video_learner', title: 'Học Giả Video', description: 'Chưng cất tri thức từ 1 video', icon: 'smart_display', category: 'Alchemy', progress: 0, goal: 1, rewardXP: 150 },
    { id: 'drive_keeper', title: 'Thủ Thư', description: 'Lưu trữ 5 tài liệu vào Drive', icon: 'folder', category: 'Drive', progress: 0, goal: 5, rewardXP: 200 },
    { id: 'rank_warrior', title: 'Chiến Binh', description: 'Thắng 3 trận đấu hạng', icon: 'swords', category: 'Social', progress: 0, goal: 3, rewardXP: 450 },
];

// --- DEFAULTS ---
const DEFAULT_PROGRESS: UserProgress = {
    xp: 0,
    level: 1,
    streak: 0,
    lastCheckIn: new Date(0).toISOString(), // Epoch time ensuring not checked in initially
    lastLogin: new Date().toISOString(),
    history: [],
    achievements: INITIAL_ACHIEVEMENTS
};

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

// --- HELPER: LEVEL CALCULATION ---
const calculateLevel = (xp: number) => Math.floor(xp / 1000) + 1;

export const GamificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);
    const [levelUp, setLevelUp] = useState(false);
    const [notification, setNotification] = useState<{ amount?: number, reason: string, type?: 'xp'|'lp'|'demote'|'badge' } | null>(null);
    const notificationTimeoutRef = useRef<any>(null);

    // Achievement Popup State
    const [popupAchievement, setPopupAchievement] = useState<Achievement | null>(null);

    // Ranked State
    const [isRankedMode, setIsRankedMode] = useState(false);
    const [rankProfile, setRankProfile] = useState<RankProfile>(getRankProfile());

    // 1. Load from LocalStorage on Mount
    useEffect(() => {
        const saved = localStorage.getItem('learnai_gamification');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                
                // --- ROBUST DATA MIGRATION CHECK ---
                // Ensure backward compatibility
                if (!parsed.lastCheckIn) parsed.lastCheckIn = new Date(0).toISOString();
                
                // Fix: If achievements is undefined or not array (old data), init it
                if (!parsed.achievements || !Array.isArray(parsed.achievements)) {
                    parsed.achievements = [...INITIAL_ACHIEVEMENTS];
                } else {
                    // Merge new seed achievements if missing (e.g. app update)
                    INITIAL_ACHIEVEMENTS.forEach(seed => {
                        if (!parsed.achievements.find((a: Achievement) => a.id === seed.id)) {
                            parsed.achievements.push(seed);
                        }
                    });
                }
                
                // Fix: Ensure history is array
                if (!parsed.history || !Array.isArray(parsed.history)) {
                    parsed.history = [];
                }

                setProgress(parsed);
            } catch (e) {
                console.error("Failed to load gamification data", e);
                // Fallback to defaults if corrupt
                setProgress(DEFAULT_PROGRESS);
            }
        }
        // Load Rank Profile
        setRankProfile(getRankProfile());
    }, []);

    // 2. Save to LocalStorage on Change
    useEffect(() => {
        localStorage.setItem('learnai_gamification', JSON.stringify(progress));
    }, [progress]);

    // Helper: Check if already checked in today
    const isCheckedInToday = React.useMemo(() => {
        const today = new Date().toDateString();
        const lastDate = new Date(progress.lastCheckIn).toDateString();
        return today === lastDate;
    }, [progress.lastCheckIn]);

    // Helper to show notification with auto-dismiss
    const showNotification = (reason: string, amount?: number, type: 'xp'|'lp'|'demote'|'badge' = 'xp') => {
        if (notificationTimeoutRef.current) {
            clearTimeout(notificationTimeoutRef.current);
        }
        setNotification({ amount, reason, type });
        notificationTimeoutRef.current = setTimeout(() => {
            setNotification(null);
        }, 4000); // Slightly longer for badges
    };

    // Show Achievement Popup
    const triggerAchievementPopup = (achievement: Achievement) => {
        setPopupAchievement(achievement);
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'); // Success sound
        audio.volume = 0.5;
        audio.play().catch(() => {});
        setTimeout(() => setPopupAchievement(null), 4500); // 4.5s display
    };

    // 3. Add XP Function
    const addXP = (amount: number, reason: string) => {
        setProgress(prev => {
            const newXP = prev.xp + amount;
            const oldLevel = prev.level;
            const newLevel = calculateLevel(newXP);
            
            if (newLevel > oldLevel) {
                setLevelUp(true);
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
                audio.volume = 0.5;
                audio.play().catch(() => {});
            }

            return {
                ...prev,
                xp: newXP,
                level: newLevel,
                history: [
                    { id: Date.now().toString(), amount, reason, timestamp: new Date().toISOString() },
                    ...prev.history
                ].slice(0, 50)
            };
        });
        showNotification(reason, amount, 'xp');
    };

    // Achievement: Unlock Standard
    const unlockAchievement = (id: string) => {
        updateAchievementProgress(id, 9999); // Force unlock by exceeding goal
    };

    // Achievement: Unlock Hidden (AI Generated)
    const unlockHiddenAchievement = (achievement: Achievement) => {
        setProgress(prev => {
            // Safety check
            const currentAchievements = prev.achievements || [];
            
            // Check if already exists
            if (currentAchievements.find(a => a.id === achievement.id)) return prev;

            const newAchievement = { 
                ...achievement, 
                unlockedAt: new Date().toISOString(),
                progress: achievement.goal 
            };

            // Trigger Popup async
            setTimeout(() => triggerAchievementPopup(newAchievement), 500);
            
            // Give Reward
            addXP(newAchievement.rewardXP, `Thành tựu ẩn: ${newAchievement.title}`);

            return {
                ...prev,
                achievements: [...currentAchievements, newAchievement]
            };
        });
    };

    // Achievement: Progress Update
    const updateAchievementProgress = (id: string, increment: number) => {
        setProgress(prev => {
            // Safety check
            if (!prev.achievements) return prev;
            
            const updatedAchievements = prev.achievements.map(a => {
                if (a.id === id && !a.unlockedAt) {
                    const newProgress = Math.min(a.goal, a.progress + increment);
                    if (newProgress >= a.goal) {
                        // Unlocked!
                        const unlockedAch = { ...a, progress: newProgress, unlockedAt: new Date().toISOString() };
                        setTimeout(() => triggerAchievementPopup(unlockedAch), 500);
                        addXP(a.rewardXP, `Thành tựu: ${a.title}`);
                        return unlockedAch;
                    }
                    return { ...a, progress: newProgress };
                }
                return a;
            });
            return { ...prev, achievements: updatedAchievements };
        });
    };

    // 4. Update Rank Function (Wrapper)
    const updateRank = (points: number) => {
        try {
            const result = updateRankPoints(points, points > 0 ? 'Victory' : 'Defeat');
            setRankProfile(result.newProfile);
            
            if (result.promoted) {
                showNotification("THĂNG HẠNG! " + result.newProfile.tier + " " + result.newProfile.division, points, 'lp');
            } else if (result.demoted) {
                showNotification("Rớt hạng xuống " + result.newProfile.tier + " " + result.newProfile.division, points, 'demote');
            } else {
                showNotification(points > 0 ? "Chiến thắng! +LP" : "Thất bại! -LP", points, points > 0 ? 'lp' : 'demote');
            }
        } catch (e) {
            console.error("Rank update failed (Guest?)");
        }
    };

    // 5. Daily Check-in Logic
    const checkIn = () => {
        if (isCheckedInToday) return;

        const today = new Date();
        const lastCheckInDate = new Date(progress.lastCheckIn);
        
        const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const lastMid = new Date(lastCheckInDate.getFullYear(), lastCheckInDate.getMonth(), lastCheckInDate.getDate());
        
        const diffTime = Math.abs(todayMid.getTime() - lastMid.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let newStreak = 1;
        
        if (diffDays === 1) {
            newStreak = progress.streak + 1;
        } else if (diffDays === 0) {
            newStreak = progress.streak; 
        } else {
            newStreak = 1;
        }

        setProgress(prev => ({
            ...prev,
            streak: newStreak,
            lastCheckIn: new Date().toISOString(),
            xp: prev.xp + 50
        }));

        showNotification(`Điểm danh ngày thứ ${newStreak}!`, 50);
    };

    return (
        <GamificationContext.Provider value={{ 
            progress, addXP, checkIn, isCheckedInToday, levelUp, closeLevelUp: () => setLevelUp(false),
            unlockAchievement, updateAchievementProgress, unlockHiddenAchievement,
            isRankedMode, toggleRankedMode: () => setIsRankedMode(!isRankedMode),
            rankProfile, updateRank
        }}>
            {children}
            
            {/* ACHIEVEMENT UNLOCKED POPUP */}
            {popupAchievement && (
                <div className="fixed top-1/4 left-1/2 -translate-x-1/2 z-[300] animate-bounce-in pointer-events-none">
                    <div className="bg-[#1e1e1e] border-2 border-yellow-400 p-6 rounded-3xl shadow-[0_0_50px_rgba(251,191,36,0.6)] flex flex-col items-center gap-2 relative overflow-hidden min-w-[300px]">
                        <div className="absolute inset-0 bg-yellow-500/10 animate-pulse"></div>
                        <div className="relative z-10 flex flex-col items-center">
                            <span className="material-symbols-outlined text-6xl text-yellow-400 mb-2 drop-shadow-lg">{popupAchievement.icon}</span>
                            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-1 text-center">
                                {popupAchievement.isAiGenerated ? "Thành Tựu Ẩn Đã Mở!" : "Thành Tựu Đã Mở!"}
                            </h3>
                            <p className="text-lg font-bold text-yellow-300 text-center">{popupAchievement.title}</p>
                            <p className="text-sm text-slate-300 text-center mb-2">{popupAchievement.description}</p>
                            <span className="bg-yellow-500 text-black font-bold px-3 py-1 rounded-full text-xs">+{popupAchievement.rewardXP} XP</span>
                        </div>
                        {/* Confetti-like particles (simple CSS) */}
                        <div className="absolute top-0 left-0 w-2 h-2 bg-red-500 rounded-full animate-ping" style={{top:'20%', left:'20%'}}></div>
                        <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full animate-ping" style={{top:'30%', right:'20%', animationDelay: '0.2s'}}></div>
                    </div>
                </div>
            )}

            {/* GLOBAL NOTIFICATION TOAST */}
            {notification && (
                <div key={Date.now()} className="fixed top-24 right-6 z-[200] animate-bounce pointer-events-none">
                    <div className={`backdrop-blur-md border px-6 py-3 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.3)] flex items-center gap-3 animate-pulse ${
                        notification.type === 'lp' ? 'bg-[#091428]/90 border-yellow-500/50 text-yellow-100' :
                        notification.type === 'demote' ? 'bg-red-900/90 border-red-500/50 text-red-100' :
                        notification.type === 'badge' ? 'bg-amber-500/90 border-white/50 text-black' :
                        'bg-[#1e1e1e]/90 border-amber-500/50 text-white'
                    }`}>
                        <div className={`rounded-full p-1 ${
                            notification.type === 'lp' ? 'bg-yellow-500 text-black' :
                            notification.type === 'demote' ? 'bg-red-500 text-white' :
                            notification.type === 'badge' ? 'bg-white text-amber-600' :
                            'bg-amber-500 text-black'
                        }`}>
                            <span className="material-symbols-outlined text-sm font-bold">
                                {notification.type === 'lp' ? 'military_tech' : notification.type === 'demote' ? 'trending_down' : notification.type === 'badge' ? 'emoji_events' : 'bolt'}
                            </span>
                        </div>
                        <div>
                            {notification.amount !== undefined && (
                                <span className={`font-black ${notification.type === 'lp' ? 'text-yellow-400' : notification.type === 'demote' ? 'text-red-300' : notification.type === 'badge' ? 'text-black' : 'text-amber-400'}`}>
                                    {notification.amount > 0 ? '+' : ''}{notification.amount} {notification.type === 'xp' ? 'XP' : notification.type === 'badge' ? 'XP' : 'LP'}
                                </span>
                            )}
                            <span className="text-xs ml-2 border-l border-current pl-2 opacity-80 font-bold">{notification.reason}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* GLOBAL LEVEL UP MODAL */}
            {levelUp && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.5s]">
                    <div className="bg-[#0f172a] border-2 border-amber-400 p-8 rounded-3xl text-center shadow-[0_0_100px_rgba(251,191,36,0.3)] relative overflow-hidden max-w-sm w-full mx-4 animate-bounce-in">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent animate-pulse"></div>
                        
                        <div className="relative z-10">
                            <span className="material-symbols-outlined text-8xl text-amber-400 mb-4 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]">military_tech</span>
                            <h2 className="text-3xl font-black text-white uppercase tracking-wider mb-2">Level Up!</h2>
                            <p className="text-amber-200 text-lg font-bold mb-6">Chào mừng đến với cấp độ {progress.level}</p>
                            
                            <div className="bg-white/10 rounded-xl p-4 mb-6 border border-white/5">
                                <p className="text-slate-300 text-sm">Phần thưởng:</p>
                                <p className="text-white font-bold flex items-center justify-center gap-2 mt-1">
                                    <span className="material-symbols-outlined text-cyan-400">diamond</span> 50 Stardust
                                </p>
                            </div>

                            <button 
                                onClick={() => setLevelUp(false)}
                                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-transform"
                            >
                                Tiếp tục hành trình
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </GamificationContext.Provider>
    );
};

export const useGamification = () => {
    const context = useContext(GamificationContext);
    if (!context) throw new Error("useGamification must be used within GamificationProvider");
    return context;
};
