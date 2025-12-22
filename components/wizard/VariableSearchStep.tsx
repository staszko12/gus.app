"use client";

import { useState } from "react";
import { GusClient } from "@/services/gus-client";

interface VariableSearchStepProps {
    onNext: (selectedVars: any[]) => void;
    initialSelected?: any[];
}

export default function VariableSearchStep({ onNext, initialSelected = [] }: VariableSearchStepProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [selected, setSelected] = useState<any[]>(initialSelected);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const gusClient = new GusClient(process.env.NEXT_PUBLIC_GUS_CLIENT_ID);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError("");
        try {
            const res = await gusClient.searchVariables(query, 5); // Default to level 5? Or general? 
            // The API searchVariables takes a level. Usually 5 (Gmina) or 6 is good for detailed data.
            // Let's try to search without level first if possible, or defaulting to 6 (most granular usually).
            // Reading gus-client.ts: it takes level as optional.
            // If we don't pass level, it returns mixed levels.
            // Let's stick to level 6 (local data) or 5. User wants "Gminas", which is level 5.
            // Let's rely on the user to refine, but default to broad search if possible.

            const response = await gusClient.searchVariables(query);
            setResults(response.results || []);
        } catch (err: any) {
            setError(err.message || "Failed to fetch variables");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (variable: any) => {
        setSelected(prev => {
            const exists = prev.find(v => v.id === variable.id);
            if (exists) return prev.filter(v => v.id !== variable.id);
            return [...prev, variable];
        });
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Step 1: What are you looking for?
                </h2>
                <p className="text-gray-400 text-sm mt-2">Search for variables like "Bezrobocie", "Ludność", "Mieszkania".</p>
            </div>

            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Enter topic..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                    {loading ? "Searching..." : "Search"}
                </button>
            </div>

            {error && (
                <div className="p-4 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm">
                    {error}
                </div>
            )}

            <div className="flex-1 min-h-[300px] flex gap-6 overflow-hidden">
                {/* Results List */}
                <div className="flex-1 flex flex-col bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/5">
                        <h3 className="text-sm font-semibold text-gray-300">Search Results ({results.length})</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {results.map(v => (
                            <div
                                key={v.id}
                                onClick={() => toggleSelect(v)}
                                className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-white/10 flex items-start gap-3 group ${selected.find(s => s.id === v.id) ? 'bg-blue-500/10 border-blue-500/50' : 'bg-transparent border-transparent'}`}
                            >
                                <div className={`w-5 h-5 rounded border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${selected.find(s => s.id === v.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-600 group-hover:border-gray-500'}`}>
                                    {selected.find(s => s.id === v.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <div>
                                    <div className="text-sm text-gray-200 font-medium">{v.n1}</div>
                                    <div className="text-xs text-gray-500 mt-1">{[v.n2, v.n3, v.n4, v.n5].filter(Boolean).join(" • ")}</div>
                                </div>
                            </div>
                        ))}
                        {results.length === 0 && !loading && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                                <svg className="w-8 h-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <span className="text-sm">Enter a search term to find variables.</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Selected List */}
                <div className="w-80 flex flex-col bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-gray-300">Selected ({selected.length})</h3>
                        {selected.length > 0 && (
                            <button
                                onClick={() => setSelected([])}
                                className="text-xs text-red-400 hover:text-red-300"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {selected.map(v => (
                            <div key={v.id} className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start justify-between group">
                                <div className="text-sm text-gray-200 pr-2">{v.n1}</div>
                                <button
                                    onClick={() => toggleSelect(v)}
                                    className="text-gray-500 hover:text-red-400 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                        {selected.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <span className="text-sm">No variables selected.</span>
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-white/5">
                        <button
                            onClick={() => onNext(selected)}
                            disabled={selected.length === 0}
                            className="w-full py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next Step &rarr;
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
