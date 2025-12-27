"use server";

import { AiProcessor, AIQueryAnalysis } from "@/services/ai-processor";
import { GusClient } from "@/services/gus-client";

const aiProcessor = new AiProcessor();
// Initialize GusClient for server-side use (direct URL, server env key)
const serverGusClient = new GusClient(
    process.env.GUS_API_KEY || process.env.NEXT_PUBLIC_GUS_CLIENT_ID || "",
    "https://bdl.stat.gov.pl/api/v1"
);

export async function analyzeQueryAction(query: string): Promise<AIQueryAnalysis> {
    return await aiProcessor.analyzeQuery(query);
}

export async function reRankVariablesAction(query: string, candidates: any[]): Promise<any[]> {
    return await aiProcessor.reRankVariables(query, candidates);
}

// --- GUS API Server Actions ---

export async function searchVariablesAction(query: string) {
    return await serverGusClient.searchVariables(query);
}

export async function searchUnitsAction(name: string) {
    return await serverGusClient.searchUnits(name);
}

export async function getUnitDataAction(unitId: string, variableIds: number[], years: number[]) {
    return await serverGusClient.getUnitData(unitId, variableIds, years);
}

export async function getVariableDataAction(variableId: number, unitLevel: number, years: number[]) {
    return await serverGusClient.getVariableData(variableId, unitLevel, years);
}
