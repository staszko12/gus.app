"use server";

import { AiProcessor, AIQueryAnalysis } from "@/services/ai-processor";
import { GusClient } from "@/services/gus-client";

console.log("Server Actions Init: Checking keys...");
if (!process.env.GEMINI_API_KEY) console.warn("⚠️ GEMINI_API_KEY is missing!");
if (!process.env.GUS_API_KEY && !process.env.NEXT_PUBLIC_GUS_CLIENT_ID) console.warn("⚠️ GUS_API_KEY is missing!");

const aiProcessor = new AiProcessor();
// Initialize GusClient for server-side use (direct URL, server env key)
const serverGusClient = new GusClient(
    process.env.GUS_API_KEY || process.env.NEXT_PUBLIC_GUS_CLIENT_ID || "",
    "https://bdl.stat.gov.pl/api/v1"
);

async function safeAction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    try {
        console.log(`[Action: ${name}] Starting...`);
        return await fn();
    } catch (error: any) {
        console.error(`[Action: ${name}] Error:`, error);
        // Ensure we throw a simple error message that can be serialized to client
        throw new Error(error.message || "An unexpected server error occurred");
    }
}

export async function analyzeQueryAction(query: string): Promise<AIQueryAnalysis> {
    return safeAction("analyzeQuery", () => aiProcessor.analyzeQuery(query));
}

export async function reRankVariablesAction(query: string, candidates: any[]): Promise<any[]> {
    return safeAction("reRankVariables", () => aiProcessor.reRankVariables(query, candidates));
}

// --- GUS API Server Actions ---

export async function searchVariablesAction(query: string) {
    return safeAction("searchVariables", () => serverGusClient.searchVariables(query));
}

export async function searchUnitsAction(name: string) {
    return safeAction("searchUnits", () => serverGusClient.searchUnits(name));
}

export async function getUnitDataAction(unitId: string, variableIds: number[], years: number[]) {
    return safeAction("getUnitData", () => serverGusClient.getUnitData(unitId, variableIds, years));
}

export async function getVariableDataAction(variableId: number, unitLevel: number, years: number[]) {
    return safeAction("getVariableData", () => serverGusClient.getVariableData(variableId, unitLevel, years));
}
