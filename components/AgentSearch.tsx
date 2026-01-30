"use client";

import { useState, useEffect } from "react";
import { AIQueryAnalysis } from "@/services/ai-processor";
import {
    analyzeQueryAction,
    reRankVariablesAction,
    searchVariablesAction,
    searchUnitsAction,
    getUnitDataAction,
    getVariableDataAction,
    getSubjectsAction
} from "@/app/actions";
import CategoryBrowser from "@/components/wizard/CategoryBrowser";

interface AgentSearchProps {
    onDataFound: (data: any[], analysis: AIQueryAnalysis, variable: any) => void;
}

type Step = "IDLE" | "EXTRACTING" | "SEARCHING" | "MATCHING" | "CONFIRMATION" | "QUERYING" | "DONE";

export default function AgentSearch({ onDataFound }: AgentSearchProps) {
    const [query, setQuery] = useState("");
    const [step, setStep] = useState<Step>("IDLE");
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // State for the confirmation step
    const [analysisResult, setAnalysisResult] = useState<AIQueryAnalysis | null>(null);
    const [confirmedVars, setConfirmedVars] = useState<any[]>([]);
    const [browserKey, setBrowserKey] = useState(0); // Forcing re-mount of CategoryBrowser
    const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);

    useEffect(() => {
        // Pre-fetch subjects for context
        getSubjectsAction().then(res => {
            if (res && res.results) {
                setAvailableSubjects(res.results);
            }
        });
    }, []);

    const addLog = (msg: string) => setLogs((prev) => [...prev, msg]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setStep("EXTRACTING");
        setLogs([]);
        setError(null);
        setConfirmedVars([]);

        try {
            // 1. EXTRACT
            addLog(`🕵️ Extracting intent from "${query}"...`);
            // Pass available subjects to help LLM pick the right domain
            const analysis = await analyzeQueryAction(query, availableSubjects);

            addLog(`✅ Extracted: Subject="${analysis.searchTerms}", CategoryID=${analysis.targetSubjectId || 'None'}, Location="${analysis.location}"`);

            if (analysis.intent?.includes("fallback")) {
                addLog(`⚠️ ${analysis.explanation}`);
                // Make sure we have valid search terms
                if (!analysis.searchTerms || analysis.searchTerms.length < 3) {
                    setError("AI Service Unavailable and could not extract keywords. Please try simpler keywords.");
                    setStep("IDLE");
                    return;
                }
            }

            setAnalysisResult(analysis);

            if (!analysis.searchTerms) {
                throw new Error("Could not identify variables to search for.");
            }

            // 2. SEARCH
            setStep("SEARCHING");
            // Use targetSubjectId to scope the search if available
            const scopeLog = analysis.targetSubjectId ? ` (Scoped to Category ${analysis.targetSubjectId})` : "";
            addLog(`🔍 Searching GUS API for "${analysis.searchTerms}"${scopeLog}...`);

            const searchRes = await searchVariablesAction(analysis.searchTerms, analysis.targetSubjectId);
            const candidates = searchRes.results || [];
            addLog(`✅ Found ${candidates.length} candidates.`);

            // If scoped search fails, fallback to global search?
            if (candidates.length === 0 && analysis.targetSubjectId) {
                addLog(`⚠️ No results in category. Retrying global search...`);
                const fallbackRes = await searchVariablesAction(analysis.searchTerms);
                if (fallbackRes.results) {
                    candidates.push(...fallbackRes.results);
                    addLog(`✅ Found ${candidates.length} candidates in global search.`);
                }
            }

            if (candidates.length === 0) {
                throw new Error(`No variables found for "${analysis.searchTerms}".`);
            }

            // 3. MATCH (Re-Ranking)
            setStep("MATCHING");
            addLog(`🧠 LLM Matching best variable...`);
            const matchedVars = await reRankVariablesAction(query, candidates);

            if (matchedVars.length === 0) {
                throw new Error("LLM could not match any relevant variables.");
            }

            const bestMatch = matchedVars[0]; // Take the top 1
            addLog(`✅ Best Match: [${bestMatch.id}] ${bestMatch.n1}`);

            // PAUSE FOR CONFIRMATION
            setConfirmedVars([bestMatch]);
            setBrowserKey(Date.now()); // Force re-render of browser with new initial value
            setStep("CONFIRMATION");

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred.");
            setStep("IDLE");
        }
    };

    const handleConfirm = async () => {
        if (confirmedVars.length === 0) {
            setError("Please select at least one variable.");
            return;
        }
        if (!analysisResult) return;

        try {
            // 4. QUERY
            setStep("QUERYING");
            // Use the FIRST confirmed variable for the logs/logic for now, 
            // but in reality we might support multi-variable if the DataDisplay supports it.
            // valid for single-variable flow:
            const primaryVar = confirmedVars[0];

            addLog(`📥 Querying data for ID ${primaryVar.id}...`);

            // Determine unit
            let unitId = null;
            let unitName = analysisResult.location;

            if (analysisResult.location && analysisResult.location.toLowerCase() !== "polska") {
                addLog(`🗺️ Resolving unit ID for "${analysisResult.location}"...`);
                const unitRes = await searchUnitsAction(analysisResult.location);
                if (unitRes.results && unitRes.results.length > 0) {
                    unitId = unitRes.results[0].id;
                    unitName = unitRes.results[0].name;
                    addLog(`✅ Resolved Unit: ${unitName} (${unitId})`);
                } else {
                    addLog(`⚠️ Unit not found, defaulting to Polska.`);
                }
            }

            const years = analysisResult.years || [2022, 2023];

            let dataRes;
            if (unitId) {
                // Get data for this specific unit and variable
                // If multiple variables selected, we might need to change getUnitDataAction signature or call multiple times
                // For now, assuming single variable support or just taking the first one if backend limitation exists?
                // The current getUnitDataAction takes `variableIds: number[]`.
                const varIds = confirmedVars.map(v => v.id);
                dataRes = await getUnitDataAction(unitId, varIds, years);
            } else {
                // No specific unit, fetch variable data for all units at Level 2 (Voivodships)
                addLog(`ℹ️ No specific unit selected, fetching variable data for all Voivodships (Level 2)...`);
                // limiting to primary var for this path as getVariableDataAction typically takes one ID?
                // checked actions.ts: getVariableDataAction(variableId: number, ...)
                // So for multiple variables without a unit, we'd need multiple calls.
                // Let's stick to primaryVar for this branch or loop.
                dataRes = await getVariableDataAction(primaryVar.id, 2, years);
            }

            addLog(`✅ Data received: ${dataRes.results?.length || 0} records.`);

            onDataFound(dataRes.results || [], analysisResult, primaryVar);
            setStep("DONE");

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An error occurred during data fetch.");
            setStep("CONFIRMATION"); // Go back to confirmation state on error so they can retry
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
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
                        disabled={step !== "IDLE" && step !== "DONE" && step !== "CONFIRMATION"}
                    />
                    <button
                        type="submit"
                        disabled={(step !== "IDLE" && step !== "DONE" && step !== "CONFIRMATION") || !query.trim()}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {step === "IDLE" || step === "DONE" || step === "CONFIRMATION" ? "Ask Agent" : "Processing..."}
                    </button>
                </div>
            </form>

            {(step !== "IDLE" || logs.length > 0) && (
                <div className="space-y-4">
                    {/* Logs Area */}
                    <div className={`space-y-2 font-mono text-sm bg-black/30 p-4 rounded-lg border border-white/5 ${step === "CONFIRMATION" ? "max-h-32 overflow-y-auto opacity-75" : ""}`}>
                        {logs.map((log, i) => (
                            <div key={i} className="flex items-start gap-2 text-gray-300">
                                <span className="text-blue-500 mt-1">➜</span>
                                <span>{log}</span>
                            </div>
                        ))}
                        {step !== "IDLE" && step !== "DONE" && step !== "CONFIRMATION" && (
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

                    {/* Confirmation Area */}
                    {step === "CONFIRMATION" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="text-lg font-medium text-white">Confirm Data Selection</h3>
                                <div className="text-xs text-gray-400">
                                    The AI selected the following variable. You can change it if needed.
                                </div>
                            </div>

                            <CategoryBrowser
                                key={browserKey}
                                initialSelected={confirmedVars}
                                onSelectionChange={setConfirmedVars}
                            />

                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={handleConfirm}
                                    className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-green-500/20 active:scale-95 flex items-center gap-2"
                                >
                                    <span>Confirm & Fetch Data</span>
                                    <span>🚀</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
