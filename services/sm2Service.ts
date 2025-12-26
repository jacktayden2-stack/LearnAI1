
import { KnowledgeNode, SM2Data } from "../types";

/**
 * SuperMemo-2 (SM-2) Algorithm Implementation for Individual Items
 * 
 * Quality (q) input:
 * 5 - Perfect response (Dễ)
 * 4 - Correct response after a hesitation (Được)
 * 3 - Correct response recalled with serious difficulty (Khó)
 * 2 - Incorrect response; where the correct one seemed easy to recall (Quên)
 * 1 - Incorrect response; the correct one remembered (Quên)
 * 0 - Complete blackout (Quên)
 */

export const calculateItemSM2 = (currentSM2: SM2Data | undefined, quality: number): SM2Data => {
    // Defensive initialization if sm2 data is missing
    const sm2 = currentSM2 || {
        repetitions: 0,
        interval: 0,
        efactor: 2.5,
        nextReviewDate: new Date().toISOString()
    };

    let reps = sm2.repetitions;
    let interval = sm2.interval;
    let ef = sm2.efactor;

    // 1. Update E-Factor
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    // EF cannot go below 1.3
    let newEf = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newEf < 1.3) newEf = 1.3;

    // 2. Update Repetitions & Interval (OPTIMIZED FOR AGGRESSIVE LEARNING)
    
    // User Requirement: 
    // - Weak/Unsteady (Quality < 4) -> Appear NOW (Today).
    // - Good/Easy (Quality >= 4) -> Future (Tomorrow+).

    if (quality >= 4) {
        // Good or Easy: Move to Future (Tomorrow or later)
        if (reps === 0) {
            interval = 1;
        } else if (reps === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * newEf);
        }
        reps++;
    } else {
        // Hard, Wrong, or Blackout: Keep it for TODAY (Immediate Review)
        // We reset interval to 0 so it stays in the "Due" bucket.
        reps = 0; 
        interval = 0; // 0 days added = Due Today
    }

    // 3. Calculate Next Review Date
    const nextDate = new Date();
    // Add interval days. If interval is 0, it stays Today.
    nextDate.setDate(nextDate.getDate() + interval);

    return {
        repetitions: reps,
        interval: interval,
        efactor: newEf,
        nextReviewDate: nextDate.toISOString()
    };
};

/**
 * Helper to preview the next interval text for UI Buttons
 */
export const getPredictedInterval = (currentSM2: SM2Data | undefined, quality: number): string => {
    const result = calculateItemSM2(currentSM2, quality);
    if (result.interval === 0) return "< 10 phút"; // Represents "Due Today/Immediately"
    return `${result.interval} ngày`;
};

/**
 * Helper to determine the status of a Node based on its internal items.
 * A node is "due" ONLY if AT LEAST ONE item inside it is due today or in the past.
 * Categories are determined by the count of 'struggling' items among those due.
 */
export const getNodeAggregateStatus = (node: KnowledgeNode): 'due' | 'future' | 'weak' | 'learning' => {
    if (!node.data) return 'future';

    const allItems: SM2Data[] = [];
    if (node.data.flashcards) node.data.flashcards.forEach(i => i && i.sm2 && allItems.push(i.sm2));
    if (node.data.quiz) node.data.quiz.forEach(i => i && i.sm2 && allItems.push(i.sm2));
    if (node.data.fillInBlanks) node.data.fillInBlanks.forEach(i => i && i.sm2 && allItems.push(i.sm2));
    if (node.data.spotErrors) node.data.spotErrors.forEach(i => i && i.sm2 && allItems.push(i.sm2));
    if (node.data.caseStudies) node.data.caseStudies.forEach(i => i && i.sm2 && allItems.push(i.sm2));

    if (allItems.length === 0) return 'future';

    const now = new Date();
    const todayStart = new Date(now.setHours(0,0,0,0)).getTime();

    // Filter items that are strictly due today or in the past
    const dueItems = allItems.filter(sm2 => {
        if (!sm2 || !sm2.nextReviewDate) return false;
        const reviewDate = new Date(sm2.nextReviewDate).setHours(0,0,0,0);
        return reviewDate <= todayStart;
    });

    // If no items are due (all marked easy/good and pushed to future), return future.
    if (dueItems.length === 0) return 'future';

    // Count items that define "struggle" within the DUE set.
    // E-Factor < 2.5 means it has been marked Hard/Again/Wrong reducing ease.
    // Repetitions < 3 means it's still in early learning stages or recently reset.
    const struggleCount = dueItems.filter(i => i.efactor < 2.5 || i.repetitions < 3).length;

    if (struggleCount > dueItems.length * 0.5) return 'weak'; // Mostly struggling
    if (dueItems.length > 0) return 'due'; // Just regular review

    return 'learning';
};

/**
 * Calculates a Mastery Score (0-100) for a node.
 * Updated for Scientific Research: Includes Time Decay.
 * If a node is overdue, its mastery degrades visually.
 */
export const calculateNodeMastery = (node: KnowledgeNode): number => {
    if (!node.data) return 0;
    
    const allItems: SM2Data[] = [];
    if (node.data.flashcards) node.data.flashcards.forEach(i => i && i.sm2 && allItems.push(i.sm2));
    if (node.data.quiz) node.data.quiz.forEach(i => i && i.sm2 && allItems.push(i.sm2));
    if (node.data.fillInBlanks) node.data.fillInBlanks.forEach(i => i && i.sm2 && allItems.push(i.sm2));
    if (node.data.spotErrors) node.data.spotErrors.forEach(i => i && i.sm2 && allItems.push(i.sm2));
    if (node.data.caseStudies) node.data.caseStudies.forEach(i => i && i.sm2 && allItems.push(i.sm2));

    if (allItems.length === 0) return 0;

    let totalScore = 0;
    const now = new Date().getTime();

    allItems.forEach(item => {
        if (!item) return;

        let itemScore = 0;
        // Base score based on Interval
        if (item.interval > 21) itemScore = 100;
        else if (item.interval > 7) itemScore = 70;
        else if (item.interval >= 1) itemScore = 30;
        else itemScore = 10; // Just learned/New

        // --- RESEARCH FEATURE: MEMORY DECAY ---
        // If the item is overdue, subtract mastery.
        if (item.nextReviewDate) {
            const reviewDate = new Date(item.nextReviewDate).getTime();
            if (now > reviewDate) {
                const daysOverdue = (now - reviewDate) / (1000 * 60 * 60 * 24);
                // Decay factor: Lose 10% mastery per day overdue, down to min 5%
                const decay = Math.min(itemScore - 5, daysOverdue * 10);
                itemScore -= Math.max(0, decay);
            }
        }

        totalScore += itemScore;
    });

    return Math.round(totalScore / allItems.length);
};

/**
 * Calculates global statistics for the user based on all nodes.
 */
export const getGlobalStats = (nodes: KnowledgeNode[]): { due: number; weak: number; new: number } => {
    let due = 0;
    let weak = 0;
    let newItems = 0;

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).getTime();

    nodes.forEach(node => {
        if (!node.data) return;

        const processItems = (items: any[]) => {
            if (!items) return;
            items.forEach(item => {
                if (!item || !item.sm2) return;
                const sm2 = item.sm2 as SM2Data;

                // New items: Repetitions = 0
                if (sm2.repetitions === 0) {
                    newItems++;
                } else {
                    // Studied items
                    if (sm2.nextReviewDate) {
                        const reviewDate = new Date(sm2.nextReviewDate).setHours(0, 0, 0, 0);
                        
                        // Is it due?
                        if (reviewDate <= todayStart) {
                            due++;
                        }
                    }
                    
                    // Is it weak? (EF < 2.5 implies struggle history)
                    if (sm2.efactor < 2.5) {
                        weak++;
                    }
                }
            });
        };

        if (node.data.flashcards) processItems(node.data.flashcards);
        if (node.data.quiz) processItems(node.data.quiz);
        if (node.data.fillInBlanks) processItems(node.data.fillInBlanks);
        if (node.data.spotErrors) processItems(node.data.spotErrors);
        if (node.data.caseStudies) processItems(node.data.caseStudies);
    });

    return { due, weak, new: newItems };
};
