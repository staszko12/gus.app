"use client";

import { useState } from "react";
import { GusClient } from "@/services/gus-client";

interface UnitSelectionStepProps {
    onNext: (selectedUnit: any, childLevel?: number) => void;
    onBack: () => void;
}

const UNIT_LEVELS = [
    { level: 2, label: "Voivodeship (Województwo)" },
    { level: 4, label: "District (Powiat)" },
    { level: 5, label: "Commune (Gmina)" },
    { level: 6, label: "Local District (Dzielnica/Delegatura)" },
];

export default function UnitSelectionStep({ onNext, onBack }: UnitSelectionStepProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [selectedUnit, setSelectedUnit] = useState<any | null>(null);
    const [childLevel, setChildLevel] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const gusClient = new GusClient(process.env.NEXT_PUBLIC_GUS_CLIENT_ID);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setError("");
        try {
            const response = await gusClient.searchUnits(query);
            setResults(response.results || []);
        } catch (err: any) {
            setError(err.message || "Failed to fetch units");
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (unit: any) => {
        setSelectedUnit(unit);
        // Reset child level if switching units
        setChildLevel(undefined);
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                    Step 2: Where? (Area Selection)
                </h2>
                <p className="text-gray-400 text-sm mt-2">Search for a region (e.g., "Wielkopolska", "Warszawa").</p>
            </div>

            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Enter area name..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                />
                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50"
                >
                    {loading ? "Locating..." : "Find"}
                </button>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[300px]">
                {/* Results List */}
                <div className="flex flex-col bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/5">
                        <h3 className="text-sm font-semibold text-gray-300">Results ({results.length})</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {results.map(u => (
                            <div
                                key={u.id}
                                onClick={() => handleSelect(u)}
                                className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-white/10 flex items-center justify-between group ${selectedUnit?.id === u.id ? 'bg-purple-500/10 border-purple-500/50' : 'bg-transparent border-transparent'}`}
                            >
                                <div>
                                    <div className="text-sm text-gray-200 font-medium">{u.name}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Level {u.level} • {UNIT_LEVELS.find(l => l.level === u.level)?.label || `Type ${u.level}`}
                                    </div>
                                </div>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedUnit?.id === u.id ? 'border-purple-500' : 'border-gray-600'}`}>
                                    {selectedUnit?.id === u.id && <div className="w-2 h-2 rounded-full bg-purple-500"></div>}
                                </div>
                            </div>
                        ))}
                        {results.length === 0 && !loading && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
                                <span className="text-sm opacity-50">Search for an area above.</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Configuration Panel */}
                <div className="flex flex-col bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/5">
                        <h3 className="text-sm font-semibold text-gray-300">Scope Configuration</h3>
                    </div>
                    <div className="flex-1 p-6 flex flex-col justify-center">
                        {selectedUnit ? (
                            <div className="space-y-6">
                                <div>
                                    <div className="text-sm text-gray-400 mb-1">Selected Area</div>
                                    <div className="text-xl font-bold text-white">{selectedUnit.name}</div>
                                    <div className="text-xs text-purple-400 mt-1">Level {selectedUnit.level}</div>
                                </div>

                                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                                    <label className="block text-sm font-medium text-gray-200 mb-3">Include Sub-units?</label>
                                    <div className="space-y-2">
                                        <label className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${childLevel === undefined ? 'bg-purple-500/20 border border-purple-500/50' : 'hover:bg-white/5 border border-transparent'}`}>
                                            <input
                                                type="radio"
                                                name="scope"
                                                checked={childLevel === undefined}
                                                onChange={() => setChildLevel(undefined)}
                                                className="text-purple-500 focus:ring-purple-500 bg-gray-900 border-gray-600"
                                            />
                                            <span className="text-sm">Just <b>{selectedUnit.name}</b> (Single Unit)</span>
                                        </label>

                                        {/* Logic: Show plausible child levels. E.g. if Woj (2), show Powiat (4) and Gmina (5). */}
                                        {selectedUnit.level < 4 && (
                                            <label className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${childLevel === 4 ? 'bg-purple-500/20 border border-purple-500/50' : 'hover:bg-white/5 border border-transparent'}`}>
                                                <input
                                                    type="radio"
                                                    name="scope"
                                                    checked={childLevel === 4}
                                                    onChange={() => setChildLevel(4)}
                                                    className="text-purple-500 focus:ring-purple-500 bg-gray-900 border-gray-600"
                                                />
                                                <span className="text-sm">Include all <b>Districts (Powiaty)</b> in this region</span>
                                            </label>
                                        )}

                                        {selectedUnit.level < 5 && (
                                            <label className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${childLevel === 5 ? 'bg-purple-500/20 border border-purple-500/50' : 'hover:bg-white/5 border border-transparent'}`}>
                                                <input
                                                    type="radio"
                                                    name="scope"
                                                    checked={childLevel === 5}
                                                    onChange={() => setChildLevel(5)}
                                                    className="text-purple-500 focus:ring-purple-500 bg-gray-900 border-gray-600"
                                                />
                                                <span className="text-sm">Include all <b>Communes (Gminy)</b> in this region</span>
                                            </label>
                                        )}

                                        {selectedUnit.level < 6 && (
                                            <label className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${childLevel === 6 ? 'bg-purple-500/20 border border-purple-500/50' : 'hover:bg-white/5 border border-transparent'}`}>
                                                <input
                                                    type="radio"
                                                    name="scope"
                                                    checked={childLevel === 6}
                                                    onChange={() => setChildLevel(6)}
                                                    className="text-purple-500 focus:ring-purple-500 bg-gray-900 border-gray-600"
                                                />
                                                <span className="text-sm">Include all <b>Local Units (Level 6)</b></span>
                                            </label>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500">
                                <p>Select a unit from the left to configure options.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-white/5 flex gap-4">
                        <button
                            onClick={onBack}
                            className="flex-1 py-3 bg-white/5 text-gray-300 rounded-xl font-medium hover:bg-white/10 transition-colors"
                        >
                            &larr; Back
                        </button>
                        <button
                            onClick={() => onNext(selectedUnit, childLevel)}
                            disabled={!selectedUnit}
                            className="flex-[2] py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next Step &rarr;
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
