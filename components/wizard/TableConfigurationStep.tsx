"use client";

import { useState } from "react";

interface TableConfigurationStepProps {
    onNext: (years: number[]) => void;
    onBack: () => void;
    selectedVars: any[];
    selectedUnit: any;
    childLevel?: number;
}

const AVAILABLE_YEARS = Array.from({ length: 15 }, (_, i) => 2024 - i); // 2010-2024

export default function TableConfigurationStep({ onNext, onBack, selectedVars, selectedUnit, childLevel }: TableConfigurationStepProps) {
    const [selectedYears, setSelectedYears] = useState<number[]>([2023, 2022]);

    const toggleYear = (year: number) => {
        setSelectedYears(prev =>
            prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
        );
    };

    const handleSelectAll = () => setSelectedYears(AVAILABLE_YEARS);
    const handleClear = () => setSelectedYears([]);

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400">
                    Step 3: Setup Columns (Years)
                </h2>
                <p className="text-gray-400 text-sm mt-2">Choose which years should appear as columns in your report.</p>
            </div>

            <div className="flex-1 min-h-[300px] flex gap-8">

                {/* Left: Configuration */}
                <div className="flex-1 flex flex-col bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-gray-300">Select Years</h3>
                        <div className="flex gap-2">
                            <button onClick={handleSelectAll} className="text-xs text-blue-400 hover:text-blue-300">All</button>
                            <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-300">None</button>
                        </div>
                    </div>
                    <div className="flex-1 p-6">
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                            {AVAILABLE_YEARS.map(year => (
                                <button
                                    key={year}
                                    onClick={() => toggleYear(year)}
                                    className={`p-3 rounded-lg border text-sm font-medium transition-all ${selectedYears.includes(year) ? 'bg-green-500/20 border-green-500 text-white' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Summary Preview */}
                <div className="w-80 flex flex-col bg-[#1A1A1A] rounded-xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/5">
                        <h3 className="text-sm font-semibold text-gray-300">Summary</h3>
                    </div>
                    <div className="flex-1 p-6 space-y-6 text-sm">

                        <div>
                            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Row Data (Variables)</div>
                            <div className="text-gray-200 font-medium">{selectedVars.length} variables selected</div>
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {selectedVars.map(v => v.n1).join(", ")}
                            </div>
                        </div>

                        <div>
                            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Scope (Rows/Units)</div>
                            <div className="text-gray-200 font-medium">
                                {childLevel ? (
                                    <span>All sub-units (Level {childLevel}) in {selectedUnit?.name}</span>
                                ) : (
                                    <span>Single Unit: {selectedUnit?.name}</span>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Columns</div>
                            <div className="text-gray-200 font-medium">{selectedYears.length} years selected</div>
                            <div className="text-xs text-gray-500 mt-1">
                                {selectedYears.sort((a, b) => b - a).join(", ")}
                            </div>
                        </div>

                    </div>

                    <div className="p-4 border-t border-white/5 flex gap-4">
                        <button
                            onClick={onBack}
                            className="flex-1 py-3 bg-white/5 text-gray-300 rounded-xl font-medium hover:bg-white/10 transition-colors"
                        >
                            &larr; Back
                        </button>
                        <button
                            onClick={() => onNext(selectedYears)}
                            disabled={selectedYears.length === 0}
                            className="flex-[2] py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Generate Data &rarr;
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
