"use client";

import { useState } from "react";
import { AiProcessor, AIQueryAnalysis } from "@/services/ai-processor";
import { GusClient } from "@/services/gus-client";

interface AgentSearchProps {
    onDataFound: (data: any[], analysis: AIQueryAnalysis, variable: any) => void;
}

type Step = "IDLE" | "EXTRACTING" | "SEARCHING" | "MATCHING" | "QUERYING" | "DONE";

export default function AgentSearch({ onDataFound }: AgentSearchProps) {
    const [query, setQuery] = useState("");
    const [step, setStep] = useState<Step>("IDLE");
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const aiProcessor = new AiProcessor();
    const gusClient = new GusClient(process.env.NEXT_PUBLIC_GUS_CLIENT_ID);

    const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setStep("EXTRACTING");
        setLogs([]);
        setError(null);

        try {
            // 1. EXTRACT
            addLog(`🕵️ Extracting intent from "${query}"...`);
            const analysis = await aiProcessor.analyzeQuery(query);
            addLog(`✅ Extracted: Subject="${analysis.searchTerms}", Location="${analysis.location}"`);

            if (!analysis.searchTerms) {
                throw new Error("Could not identify variables to search for.");
            }

            // 2. SEARCH
            setStep("SEARCHING");
            addLog(`🔍 Searching GUS API for "${analysis.searchTerms}"...`);
            const searchRes = await gusClient.searchVariables(analysis.searchTerms);
            const candidates = searchRes.results || [];
            addLog(`✅ Found ${candidates.length} candidates.`);

            if (candidates.length === 0) {
                throw new Error(`No variables found for "${analysis.searchTerms}".`);
            }

            // 3. MATCH (Re-Ranking)
            setStep("MATCHING");
            addLog(`🧠 LLM Matching best variable...`);
            // We pass the candidates to the LLM to pick the best one
            const matchedVars = await aiProcessor.reRankVariables(query, candidates);

            if (matchedVars.length === 0) {
                throw new Error("LLM could not match any relevant variables.");
            }

            const bestMatch = matchedVars[0]; // Take the top 1
            addLog(`✅ Best Match: [${bestMatch.id}] ${bestMatch.n1}`);

            // 4. QUERY
            setStep("QUERYING");
            addLog(`📥 Querying data for ID ${bestMatch.id}...`);

            // Determine unit (simple logic for now, utilizing analysis)
            // If location is provided, we need to find the unit ID. This is a sub-step.
            let unitId = null;
            let unitName = analysis.location;

            if (analysis.location && analysis.location.toLowerCase() !== "polska") {
                addLog(`🗺️ Resolving unit ID for "${analysis.location}"...`);
                const unitRes = await gusClient.searchUnits(analysis.location);
                if (unitRes.results && unitRes.results.length > 0) {
                    unitId = unitRes.results[0].id;
                    unitName = unitRes.results[0].name;
                    addLog(`✅ Resolved Unit: ${unitName} (${unitId})`);
                } else {
                    addLog(`⚠️ Unit not found, defaulting to Polska.`);
                }
            }

            // Default params for data
            const years = analysis.years || [2022, 2023];

            let dataRes;
            if (unitId) {
                // Get data for this specific unit and variable
                dataRes = await gusClient.getUnitData(unitId, [bestMatch.id], years);
            } else {
                // Get aggregated data (e.g. by voivodship) if no specific unit, or just Polska?
                // For simplicity, let's use getVariableData which returns data for all units at a certain level.
                // Default to Level 5 (Gminas) or 2 (Voivodships) based on some logic?
                // Let's default to Level 2 (Województwa) if no unit specified but "Polska" meant broadly.
                // Or just fetch specific variable data.
                addLog(`ℹ️ No specific unit selected, fetching variable data for all Voivodships (Level 2)...`);
                dataRes = await gusClient.getVariableData(bestMatch.id, 2, years);
            }

            addLog(`✅ Data received: ${dataRes.results?.length || 0} records.`);

            onDataFound(dataRes.results || [], analysis, bestMatch);
            setStep("DONE");

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred.");
            setStep("IDLE");
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
            <h2 className="text-xl font-semibold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                AI Agent Search
            </h2>

            <form onSubmit={handleSearch} className="mb-6">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="E.g. How many people live in Warsaw?"
                        className="flex-1 bg-black/40 border border-white/20 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        disabled={step !== "IDLE" && step !== "DONE"}
                    />
                    <button
                        type="submit"
                        disabled={step !== "IDLE" && step !== "DONE" || !query.trim()}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {step === "IDLE" || step === "DONE" ? "Ask Agent" : "Processing..."}
                    </button>
                </div>
            </form>

            {(step !== "IDLE" || logs.length > 0) && (
                <div className="space-y-2 font-mono text-sm bg-black/30 p-4 rounded-lg border border-white/5">
                    {logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2 text-gray-300">
                            <span className="text-blue-500 mt-1">➜</span>
                            <span>{log}</span>
                        </div>
                    ))}
                    {step !== "IDLE" && step !== "DONE" && (
                        <div className="flex items-center gap-2 text-blue-400 animate-pulse">
                            <span className="w-2 h-2 bg-blue-400 rounded-full" />
                            Processing step: {step}...
                        </div>
                    )}
                    {error && (
                        <div className="text-red-400 mt-2 flex items-center gap-2">
                            <span>❌</span> {error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
