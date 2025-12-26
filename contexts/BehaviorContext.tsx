
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BehaviorLog, InteractionType, Achievement } from '../types';
import { useGamification } from './GamificationContext';

// Initialize Gemini for Behavioral Analysis
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

interface UserPersona {
    learningStyle: 'Visual' | 'Auditory' | 'Kinesthetic' | 'Reading' | 'Mixed';
    focusTime: 'Morning' | 'Afternoon' | 'Night' | 'Erratic';
    strengths: string[];
    weaknesses: string[];
    suggestion: string;
}

interface BehaviorContextType {
    logAction: (type: InteractionType, context: string, detail?: string) => void;
    analyzeBehavior: () => Promise<void>;
    persona: UserPersona | null;
    isAnalyzing: boolean;
    logs: BehaviorLog[];
}

const BehaviorContext = createContext<BehaviorContextType | undefined>(undefined);

export const BehaviorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [logs, setLogs] = useState<BehaviorLog[]>([]);
    const [persona, setPersona] = useState<UserPersona | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // UseRef to track timeout IDs for safe cleanup
    const analysisTimeoutRef = useRef<any>(null);

    // Connect to Gamification Context to unlock achievements
    const { unlockHiddenAchievement } = useGamification();
    
    // Load logs from local storage on mount
    useEffect(() => {
        const savedLogs = localStorage.getItem('learnai_behavior_logs');
        const savedPersona = localStorage.getItem('learnai_user_persona');
        if (savedLogs) {
            try {
                const parsed = JSON.parse(savedLogs);
                if (Array.isArray(parsed)) {
                    setLogs(parsed);
                } else {
                    setLogs([]); // Reset if corrupt
                }
            } catch (e) {
                console.error("Failed to parse logs", e);
                setLogs([]);
            }
        }
        if (savedPersona) {
            try {
                setPersona(JSON.parse(savedPersona));
            } catch (e) { console.error("Failed to parse persona", e); }
        }
    }, []);

    // Save logs to local storage
    useEffect(() => {
        localStorage.setItem('learnai_behavior_logs', JSON.stringify(logs.slice(-500))); // Keep last 500
    }, [logs]);

    const logAction = (type: InteractionType, context: string, detail?: string) => {
        const newLog: BehaviorLog = {
            timestamp: Date.now(),
            type,
            context,
            detail
        };
        // Add log and keep array size manageable
        setLogs(prev => [...prev, newLog].slice(-200)); 
    };

    const analyzeBehavior = async () => {
        if (logs.length < 5) return; // Need some data
        setIsAnalyzing(true);

        try {
            // Prepare data for the "Deep Learning" model (Gemini)
            const behavioralData = JSON.stringify(logs.slice(-50)); // Analyze last 50 actions
            
            const prompt = `
                Analyze the following user behavior logs from a learning app. 
                
                Task 1: Identify patterns in their learning style, preferred times, and struggle points.
                Task 2: Based on these unique patterns, generate 0 or 1 "Hidden Achievement" that the user has unlocked by their specific behavior.
                Examples of Hidden Achievements: "Night Owl" (learning late), "Speedster" (fast interactions), "Deep Diver" (using complex features), "Social Butterfly" (community actions).
                
                Logs: ${behavioralData}

                Return a JSON object with this exact schema:
                {
                    "persona": {
                        "learningStyle": "Visual" | "Auditory" | "Kinesthetic" | "Reading" | "Mixed",
                        "focusTime": "Morning" | "Afternoon" | "Night" | "Erratic",
                        "strengths": ["string"],
                        "weaknesses": ["string"],
                        "suggestion": "A specific, actionable recommendation to improve their learning right now."
                    },
                    "unlockedAchievement": {
                        "id": "string (unique id like 'night_owl')",
                        "title": "string",
                        "description": "string (Why they got this)",
                        "icon": "string (Material Symbol name)",
                        "category": "General",
                        "rewardXP": 200,
                        "goal": 1
                    } | null
                }
            `;

            let response;
            try {
                // Attempt 1: Use Flash Model with Thinking Budget for psychoanalysis
                response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        thinkingConfig: { thinkingBudget: 24576 } // Max for 2.5 Flash
                    }
                });
            } catch (err: any) {
                // Check for Quota/Rate Limit errors (429)
                if (err.status === 429 || err.code === 429 || (err.message && err.message.includes('429'))) {
                    console.warn("⚠️ Gemini Quota Exceeded (429). Falling back without thinking.");
                    // Attempt 2: Fallback to Flash Model without thinking (Cheaper, Higher Quota)
                    response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: prompt,
                        config: {
                            responseMimeType: "application/json"
                        }
                    });
                } else {
                    throw err; // Re-throw other errors
                }
            }

            if (response && response.text) {
                const data = JSON.parse(response.text);
                
                // Update Persona
                if (data.persona) {
                    setPersona(data.persona);
                    localStorage.setItem('learnai_user_persona', JSON.stringify(data.persona));
                }

                // Handle Hidden Achievement (Async Unlock)
                if (data.unlockedAchievement) {
                    const ach: Achievement = {
                        ...data.unlockedAchievement,
                        progress: 1,
                        isAiGenerated: true,
                        isSecret: true
                    };
                    unlockHiddenAchievement(ach);
                }
            }
        } catch (error) {
            console.error("Behavior analysis failed:", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Auto-analyze every 10 interactions using useRef for safe timeout management
    useEffect(() => {
        if (logs.length > 0 && logs.length % 10 === 0) {
            // Clear existing timeout if any
            if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
            }
            
            // Schedule analysis
            analysisTimeoutRef.current = setTimeout(() => {
                analyzeBehavior();
            }, 1000);
        }
        
        // Cleanup function
        return () => {
             if (analysisTimeoutRef.current) {
                clearTimeout(analysisTimeoutRef.current);
            }
        };
    }, [logs.length]);

    return (
        <BehaviorContext.Provider value={{ logAction, analyzeBehavior, persona, isAnalyzing, logs }}>
            {children}
        </BehaviorContext.Provider>
    );
};

export const useBehavior = () => {
    const context = useContext(BehaviorContext);
    if (!context) throw new Error("useBehavior must be used within BehaviorProvider");
    return context;
};
