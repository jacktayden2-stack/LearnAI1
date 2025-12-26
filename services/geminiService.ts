
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { BehaviorLog, KnowledgeNode, Achievement, AIAchievementSuggestion, FlashcardItem, QuizItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_FLASH = 'gemini-2.5-flash';
const MODEL_PRO = 'gemini-2.5-flash'; // Updated to 2.5 Flash as requested
const MODEL_FALLBACK = 'gemini-2.5-flash'; 
const MODEL_AUDIO = 'gemini-2.5-flash-native-audio-preview-09-2025'; 

// --- BASIC CHAT ---
export const sendMessageToGemini = async (message: string, history: any[], systemInstruction?: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FLASH,
            contents: [...history, { role: 'user', parts: [{ text: message }] }],
            config: {
                systemInstruction: systemInstruction,
            }
        });
        return response.text || "Xin lỗi, tôi không thể trả lời lúc này.";
    } catch (error: any) {
        console.error("Gemini Error:", error);
        // Fallback for chat if Flash 3 fails due to quota or other issues
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
             try {
                const response = await ai.models.generateContent({
                    model: MODEL_FALLBACK,
                    contents: [...history, { role: 'user', parts: [{ text: message }] }],
                    config: { systemInstruction: systemInstruction }
                });
                return response.text || "Xin lỗi, tôi không thể trả lời lúc này.";
             } catch (e) {
                 return "Hệ thống đang quá tải (Quota Exceeded). Vui lòng thử lại sau vài phút.";
             }
        }
        return "Đã xảy ra lỗi kết nối với AI.";
    }
};

export const askGeminiWithSearch = async (message: string, history: any[]): Promise<{ text: string, sources?: any[] }> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_PRO,
            contents: [...history, { role: 'user', parts: [{ text: message }] }],
            config: {
                tools: [{ googleSearch: {} }]
            }
        });
        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        return { 
            text: response.text || "Không tìm thấy thông tin.", 
            sources: grounding 
        };
    } catch (error) {
        console.error("Gemini Search Error:", error);
        return { text: "Lỗi tìm kiếm. (Thử tắt chế độ tìm kiếm nếu lỗi lặp lại)" };
    }
};

// --- ALCHEMY & CONTENT GENERATION ---

export const generateLearningContent = async (sourceText: string, type: 'Flashcard' | 'Quiz' | 'Fill-in-the-blanks' | 'Spot the Error' | 'Case Study' | 'Ontology', options?: any): Promise<any> => {
    // Force 20 items for Flashcard and Quiz
    const quantityInstruction = (type === 'Flashcard' || type === 'Quiz') 
        ? "CRITICAL: Generate exactly 20 distinct items. If source text is short, infer related concepts to meet the count." 
        : "Create comprehensive content covering key points.";

    const prompt = `
    Analyze the source text provided below.
    
    CRITICAL TASK 1 (TAGGING): 
    Read the ENTIRE content. Analyze its semantic meaning, domain, and keywords. 
    Generate a list of 3-5 relevant tags.
    - If content contains code snippets, algorithms, or software terms -> Tag as "Coding", "Programming", "Tech", and the specific language (e.g., "Python").
    - If content contains formulas, equations, or geometric concepts -> Tag as "Math", "Algebra", "Calculus", etc.
    - If content is about past events -> Tag as "History".
    - If content is scientific -> Tag as "Physics", "Chemistry", "Biology".
    
    CRITICAL TASK 2 (GENERATION):
    Generate learning content of type '${type}'.
    Quantity: ${quantityInstruction}
    Complexity: ${options?.complexity || 'Medium'}.
    Language: ${options?.language || 'Vietnamese'}.
    
    Source Content:
    ${sourceText.substring(0, 30000)}
    
    Output STRICT JSON format matching the type structure. Ensure "tags" array is populated based on the analysis above:
    - Flashcard: { "title": "string", "tags": ["Coding", "React"], "summary": "string", "flashcards": [{ "front": "Question/Term", "back": "Answer/Definition" }] }
    - Quiz: { "title": "string", "tags": ["Math", "Geometry"], "summary": "string", "quiz": [{ "question": "string", "options": ["A", "B", "C", "D"], "correctAnswer": number (index 0-3), "explanation": "string" }] }
    - Fill-in-the-blanks: { "title": "string", "tags": ["History"], "summary": "string", "fillInBlanks": [{ "sentence": "string with ___", "answer": "string" }] }
    - Spot the Error: { "title": "string", "tags": ["Language"], "summary": "string", "spotErrors": [{ "text": "Incorrect sentence", "error": "Explanation", "correction": "Correct sentence" }] }
    - Case Study: { "title": "string", "tags": ["Business"], "summary": "string", "caseStudies": [{ "scenario": "string", "question": "string", "analysis": "string" }] }
    - Ontology: { "title": "string", "tags": ["Science"], "summary": "string", "nodes": [{ "id": "string", "label": "string" }], "edges": [{ "from": "string", "to": "string", "relation": "string" }] }
    `;

    const injectSM2 = (data: any) => {
        const defaultSM2 = { repetitions: 0, interval: 0, efactor: 2.5, nextReviewDate: new Date().toISOString() };
        if (data.flashcards) data.flashcards.forEach((i: any) => i.sm2 = defaultSM2);
        if (data.quiz) data.quiz.forEach((i: any) => i.sm2 = defaultSM2);
        if (data.fillInBlanks) data.fillInBlanks.forEach((i: any) => i.sm2 = defaultSM2);
        if (data.spotErrors) data.spotErrors.forEach((i: any) => i.sm2 = defaultSM2);
        if (data.caseStudies) data.caseStudies.forEach((i: any) => i.sm2 = defaultSM2);
        return data;
    };

    try {
        const response = await ai.models.generateContent({
            model: MODEL_PRO,
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 16000 } 
            }
        });
        const parsed = JSON.parse(response.text || '{}');
        return injectSM2(parsed);

    } catch (error: any) {
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            console.warn("Gemini Pro Quota Exceeded. Falling back to Flash 2.5.");
            try {
                const response = await ai.models.generateContent({
                    model: MODEL_FALLBACK,
                    contents: prompt,
                    config: { responseMimeType: "application/json" }
                });
                const parsed = JSON.parse(response.text || '{}');
                return injectSM2(parsed);
            } catch (e) {
                console.error("Fallback failed:", e);
                throw new Error("Failed to generate content (Quota Exceeded)");
            }
        }
        console.error(error);
        throw new Error("Failed to generate content");
    }
};

export const generateOntologyFromText = async (text: string) => {
    // Placeholder as Alchemy usually handles this via generateLearningContent('Ontology')
    return generateLearningContent(text, 'Ontology');
};

export const checkSemanticResonance = async (currentNode: {title: string, tags?: string[]}, userNodes: {id: string, title: string, tags?: string[]}[]): Promise<{ id: string, title: string, reason: string }[]> => {
    const nodesJson = JSON.stringify(userNodes.map(n => ({ id: n.id, title: n.title, tags: n.tags })));
    const prompt = `Analyze if "${currentNode.title}" has strong semantic connection with any of these nodes: ${nodesJson}.
    Return JSON: [{ "id": "nodeId", "title": "Node Title", "reason": "Short explanation" }] for matches. Max 3.`;
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FLASH,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '[]');
    } catch {
        // Fallback for resonance is silent fail (empty array)
        return [];
    }
};

// --- NOTE GENERATION (NEW) ---

export const generateNoteFromNode = async (node: KnowledgeNode): Promise<string> => {
    const nodeContent = JSON.stringify(node.data || {});
    const prompt = `
        You are an expert academic writer. 
        Create a comprehensive, well-structured study note (in Markdown) based on the following raw knowledge node data.
        
        Node Title: "${node.title}"
        Raw Data: ${nodeContent}
        
        Requirements:
        1. Start with a clear introduction/summary.
        2. Organize key concepts with H1, H2 headers.
        3. If there are flashcards or quiz items in the data, integrate them as "Key Takeaways" or "Self-Check" sections.
        4. Use bullet points for readability.
        5. Tone: Educational, encouraging, and clear.
        6. Language: Vietnamese.
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_PRO,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 16000 } // Max budget for high quality note synthesis
            }
        });
        return response.text || "";
    } catch (e: any) {
        console.error("Note generation failed", e);
        // Fallback
        const response = await ai.models.generateContent({
            model: MODEL_FALLBACK,
            contents: prompt
        });
        return response.text || "";
    }
};

// --- SOCRATIC TUTOR UTILS ---

export const evaluateChatSession = async (history: any[], topic: string): Promise<{ score: number, feedback: string }> => {
    const prompt = `Evaluate the user's understanding of "${topic}" based on this chat history. 
    Give a score (0-5) and feedback. JSON: { "score": number, "feedback": "string" }`;
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FLASH,
            contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{ "score": 0, "feedback": "Error" }');
    } catch {
        return { score: 0, feedback: "Service Unavailable" };
    }
};

export const analyzeTutorSentiment = async (history: any[]): Promise<{ emotion: string, shouldSwitchPersona?: string, suggestion?: string }> => {
    const prompt = `Analyze user sentiment. Return JSON: { "emotion": "frustrated"|"happy"|"confused", "shouldSwitchPersona": "feynman"|"strict"|null, "suggestion": "string" }`;
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FLASH,
            contents: [...history, { role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    } catch {
        return { emotion: "neutral" };
    }
};

// --- CRAM MODE UTILS ---

export const generateCheatSheet = async (topics: string[]): Promise<string> => {
    const prompt = `Create a concise cheat sheet for these topics: ${topics.join(', ')}. Use Markdown. Include formulas, key terms, and mnemonics.`;
    try {
        // Complex summary needs Pro
        const response = await ai.models.generateContent({
            model: MODEL_PRO,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 16000 } // Moderate thinking for cheat sheet
            }
        });
        return response.text || "";
    } catch (e: any) {
        if(e.status === 429 || (e.message && e.message.includes('429'))) {
             // Fallback
             const response = await ai.models.generateContent({
                model: MODEL_FALLBACK,
                contents: prompt
            });
            return response.text || "";
        }
        return "Error generating cheat sheet.";
    }
};

export const filterParetoNodes = async (titles: string[]): Promise<string[]> => {
    const prompt = `Apply Pareto Principle (80/20). Select the top 20% most critical topics from this list that cover 80% of the value/fundamentals: ${titles.join(', ')}. Return JSON string array.`;
    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '[]');
};

export const generateMnemonics = async (topic: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Create a memorable mnemonic for "${topic}" in Vietnamese or English.`
    });
    return response.text || "";
};

export const explainLikeFive = async (text: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Explain this like I'm 5 years old: "${text}"`
    });
    return response.text || "";
};

export const generateCramAudioScript = async (content: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: `Convert this study content into a short, engaging podcast script for audio learning: ${content}`
    });
    return response.text || "";
};

// --- VISION & AUDIO ---

export const extractTextFromImage = async (base64Image: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Or 2.5 flash
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Image.split(',')[1] } },
                    { text: "Extract text and describe diagrams in detail." }
                ]
            }
        });
        return response.text || "";
    } catch (e) {
        console.error(e);
        return "Lỗi đọc ảnh.";
    }
};

export const analyzeImageForDiscussion = async (base64Image: string, prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64Image.split(',')[1] } },
                    { text: prompt }
                ]
            }
        });
        return response.text || "";
    } catch (e) {
        return "Lỗi phân tích ảnh.";
    }
};

export const transcribeAudio = async (base64Audio: string): Promise<string> => {
    try {
        const cleanBase64 = base64Audio.split(',')[1] || base64Audio;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'audio/mp3', data: cleanBase64 } }, // Assuming mp3/wav
                    { text: "Transcribe this audio." }
                ]
            }
        });
        return response.text || "";
    } catch (e) {
        console.error(e);
        return "Lỗi dịch âm thanh.";
    }
};

// --- VIDEO ---

export const distillVideoContent = async (transcript: string, detailLevel: number): Promise<{ nodes: any[], stats: any }> => {
    const prompt = `Distill this video transcript into a linear learning path of key concepts. 
    Detail Level: ${detailLevel}%.
    Transcript: ${transcript.substring(0, 15000)}...
    
    Return JSON: { 
        "nodes": [{ "title": "string", "summary": "string", "tags": ["string"], "flashcards": [{"front":"", "back":""}] }],
        "stats": { "compressionRate": "string", "originalWords": number, "distilledWords": number, "noiseLevel": "Low"|"Medium"|"High" }
    }`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_PRO,
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 16000 } // Max thinking for Flash 2.5
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (e: any) {
        if(e.status === 429 || (e.message && e.message.includes('429'))) {
             const response = await ai.models.generateContent({
                model: MODEL_FALLBACK,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            return JSON.parse(response.text || '{}');
        }
        throw e;
    }
};

// --- MISC UTILS ---

export const generateAdaptiveSkillTree = async (weakTopics: string[]): Promise<any> => {
    const prompt = `Create an adaptive learning path (skill tree) to master these weak topics: ${weakTopics.join(', ')}.
    Return JSON: { "title": "string", "levels": [{ "id": "1", "title": "string", "description": "string", "status": "unlocked" }] }`;
    
    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
};

export const gradeUserAnswer = async (userAns: string, correctAns: string, question: string): Promise<{ score: number, feedback: string }> => {
    const prompt = `Question: ${question}
    Correct Answer: ${correctAns}
    User Answer: ${userAns}
    
    Grade the user answer from 1-5 (5 is perfect). Provide feedback.
    JSON: { "score": number, "feedback": "string" }`;

    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{ "score": 0, "feedback": "Error" }');
};

export const generateMentalModel = async (text: string): Promise<any> => {
    const prompt = `Extract key mental models from this text.
    JSON: { "models": [{ "title": "string", "description": "string", "application": "string" }] }
    Text: ${text}`;
    
    const response = await ai.models.generateContent({
        model: MODEL_PRO,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
};

export const scanUrlForContent = async (url: string): Promise<string> => {
    // Improved Prompt for HTML Extraction: Do not just summarize. Extract detailed content.
    const prompt = `
        You are a web scraper agent. Retrieve the comprehensive educational content from this URL: ${url}. 
        
        CRITICAL INSTRUCTIONS:
        1. Extract the FULL text content, main concepts, definitions, and examples found on the page.
        2. Do NOT summarize or condense significantly. I need the raw material to generate 20 detailed quiz questions later.
        3. If the page is very long, extract the most information-dense sections related to the topic.
        4. Ignore navigation menus, ads, and footers. Focus on the article/lesson body.
        
        Return the extracted content as plain text.
    `;
    
    const response = await ai.models.generateContent({
        model: MODEL_PRO,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    return response.text || "Could not retrieve content from URL.";
};

export const semanticFileClustering = async (files: {id: string, name: string, type: string}[]): Promise<{ clusters: {name: string, fileIds: string[]}[] }> => {
    const fileList = files.map(f => `${f.id}: ${f.name} (${f.type})`).join('\n');
    const prompt = `Group these files into semantic clusters based on their names.
    Files:
    ${fileList}
    
    JSON: { "clusters": [{ "name": "string", "fileIds": ["string"] }] }`;

    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{ "clusters": [] }');
};

export const decomposeComplexTask = async (task: string): Promise<{ content: string, priority: 1|2|3|4 }[]> => {
    const prompt = `Decompose this complex task into smaller, actionable subtasks with priorities (1=High, 4=Low).
    Task: ${task}
    JSON Array: [{ "content": "string", "priority": number }]`;

    const response = await ai.models.generateContent({
        model: MODEL_FLASH,
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '[]');
};

export const generateLevelContent = async (title: string, desc: string, type: 'Flashcard'|'Quiz', difficulty: string): Promise<{ flashcards?: FlashcardItem[], quiz?: QuizItem[] }> => {
    // Explicitly ask for 20 items in the prompt
    const quantityInstruction = "Generate exactly 20 distinct items.";
    
    const prompt = `Generate ${type} content for level "${title}": ${desc}. Difficulty: ${difficulty}. ${quantityInstruction}
    
    JSON Output Structure: 
    { "flashcards": [{ "front": "", "back": "", "sm2": {} }] } 
    OR 
    { "quiz": [{ "question": "", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "", "sm2": {} }] }`;
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_PRO,
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 16000 } // Use thinking for better quality generation
            }
        });
        const data = JSON.parse(response.text || '{}');
        
        // Inject default SM2 data
        const defaultSM2 = { repetitions: 0, interval: 0, efactor: 2.5, nextReviewDate: new Date().toISOString() };
        if (data.flashcards) data.flashcards.forEach((f: any) => f.sm2 = defaultSM2);
        if (data.quiz) data.quiz.forEach((q: any) => q.sm2 = defaultSM2);
        
        return data;
    } catch (e: any) {
        if(e.status === 429 || (e.message && e.message.includes('429'))) {
             const response = await ai.models.generateContent({
                model: MODEL_FALLBACK,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            // ... (Process data same as above)
            const data = JSON.parse(response.text || '{}');
             const defaultSM2 = { repetitions: 0, interval: 0, efactor: 2.5, nextReviewDate: new Date().toISOString() };
            if (data.flashcards) data.flashcards.forEach((f: any) => f.sm2 = defaultSM2);
            if (data.quiz) data.quiz.forEach((q: any) => q.sm2 = defaultSM2);
            return data;
        }
        throw e;
    }
};

// --- ANALYSIS ---

export const analyzeConversationForActions = async (lastUserMessage: string, lastAiMessage: string): Promise<{ 
    actions: { type: 'ALCHEMY' | 'GRAPH' | 'TODO' | 'NOTE', label: string, data: string, reason: string }[] 
}> => {
    const prompt = `
        Analyze conversation snippet.
        User: "${lastUserMessage}"
        AI: "${lastAiMessage}"
        Identify actionable items.
        JSON: { "actions": [{ "type": "ALCHEMY"|"GRAPH"|"TODO"|"NOTE", "label": "string", "data": "string", "reason": "string" }] }
    `;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_FLASH,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{ "actions": [] }');
    } catch (e) {
        return { actions: [] };
    }
};

export const analyzeAlchemyHabits = async (logs: BehaviorLog[]): Promise<any> => {
    const logStr = JSON.stringify(logs.slice(-20));
    const prompt = `Analyze user alchemy habits. Suggest optimization.
    Logs: ${logStr}
    JSON: { "message": "string", "recommendedMethod": "string", "recommendedDifficulty": number }`;
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_FLASH,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    } catch {
        return null;
    }
};

export const suggestPersonalizedAchievements = async (stats: any, nodes: any[], unlocked: string[], logs: BehaviorLog[]): Promise<{ suggestions: AIAchievementSuggestion[], analysis: string }> => {
    const prompt = `Suggest hidden achievements based on user data.
    Stats: ${JSON.stringify(stats)}
    Nodes Sample: ${JSON.stringify(nodes.map(n => n.title))}
    Unlocked: ${JSON.stringify(unlocked)}
    Logs: ${JSON.stringify(logs.slice(-20))}
    
    JSON: { 
        "suggestions": [{ "id": "string", "title": "string", "reason": "string", "task": "string", "potentialReward": "string", "difficulty": "Easy"|"Medium"|"Hard" }],
        "analysis": "string"
    }`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_PRO,
            contents: prompt,
            config: { 
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 16000 } // Max thinking for Flash 2.5
            }
        });
        return JSON.parse(response.text || '{ "suggestions": [], "analysis": "" }');
    } catch (e: any) {
        if(e.status === 429 || (e.message && e.message.includes('429'))) {
             const response = await ai.models.generateContent({
                model: MODEL_FALLBACK,
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            return JSON.parse(response.text || '{ "suggestions": [], "analysis": "" }');
        }
        return { suggestions: [], analysis: "" };
    }
};