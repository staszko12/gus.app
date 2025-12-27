"use server";

import { AiProcessor, AIQueryAnalysis } from "@/services/ai-processor";

const aiProcessor = new AiProcessor();

export async function analyzeQueryAction(query: string): Promise<AIQueryAnalysis> {
    return await aiProcessor.analyzeQuery(query);
}

export async function reRankVariablesAction(query: string, candidates: any[]): Promise<any[]> {
    return await aiProcessor.reRankVariables(query, candidates);
}
