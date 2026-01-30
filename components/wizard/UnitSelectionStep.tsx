"use client";

import { useState } from "react";
import TerritoryBrowser from "./TerritoryBrowser";

interface UnitSelectionStepProps {
    onNext: (unit: any, childLevel?: number) => void;
    onBack: () => void;
    initialUnit?: any;
}

export default function UnitSelectionStep({ onNext, onBack, initialUnit }: UnitSelectionStepProps) {
    const [selectedUnit, setSelectedUnit] = useState<any | null>(initialUnit || null);
    const [childLevel, setChildLevel] = useState<number | undefined>(undefined);

    const handleNext = () => {
        if (selectedUnit) {
            onNext(selectedUnit, childLevel);
        }
    };

    const handleSelectUnit = (unit: any) => {
        setSelectedUnit(unit);
        setChildLevel(undefined); // Reset scope when unit changes
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="mb-4 text-center">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-orange-400">
                    Step 2: Where? (Area Selection)
                </h2>
                <p className="text-gray-400 text-sm mt-2">
                    Click to drill down. Select a unit to configure data granularity.
                </p>
            </div>

            <div className="flex-1 min-h-[500px] flex gap-4">

                {/* Left: Browser */}
                <div className="flex-[2]">
                    <TerritoryBrowser
                        onSelect={handleSelectUnit}
                        selectedUnit={selectedUnit}
                    />
                </div>

                {/* Right: Configuration Panel */}
                <div className="flex-1 bg-[#121212] rounded-xl border border-white/10 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-white/10 bg-white/5">
                        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Configuration</h3>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto">
                        {selectedUnit ? (
                            <div className="space-y-6">
                                <div className="text-center p-4 bg-white/5 rounded-lg border border-white/5">
                                    <div className="text-xs text-gray-500 uppercase mb-1">Selected Area</div>
                                    <div className="text-xl font-bold text-white">{selectedUnit.name}</div>
                                    <div className="text-[10px] text-pink-400 mt-1">
                                        Level {selectedUnit.level}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide text-xs">
                                        Data Division Mode
                                    </label>
                                    <div className="space-y-2">
                                        {/* Option 1: Just this unit */}
                                        <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${childLevel === undefined ? 'bg-pink-500/10 border-pink-500/50' : 'bg-transparent border-white/5 hover:bg-white/5'}`}>
                                            <input
                                                type="radio"
                                                name="scope"
                                                checked={childLevel === undefined}
                                                onChange={() => setChildLevel(undefined)}
                                                className="mt-1 text-pink-500 focus:ring-pink-500 bg-gray-900 border-gray-600"
                                            />
                                            <div>
                                                <div className="text-sm font-medium text-gray-200">Single Unit</div>
                                                <div className="text-xs text-gray-500">Get data only for {selectedUnit.name}.</div>
                                            </div>
                                        </label>


                                        {/* Option 2: Sub-units (Contextual) */}
                                        {selectedUnit.level < 5 && (
                                            <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${childLevel === 5 ? 'bg-pink-500/10 border-pink-500/50' : 'bg-transparent border-white/5 hover:bg-white/5'}`}>
                                                <input
                                                    type="radio"
                                                    name="scope"
                                                    checked={childLevel === 5}
                                                    onChange={() => setChildLevel(5)}
                                                    className="mt-1 text-pink-500 focus:ring-pink-500 bg-gray-900 border-gray-600"
                                                />
                                                <div>
                                                    <div className="text-sm font-medium text-gray-200">Divide by Powiats</div>
                                                    <div className="text-xs text-gray-500">List all counties within {selectedUnit.name}.</div>
                                                </div>
                                            </label>
                                        )}

                                        {selectedUnit.level < 6 && (
                                            <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${childLevel === 6 ? 'bg-pink-500/10 border-pink-500/50' : 'bg-transparent border-white/5 hover:bg-white/5'}`}>
                                                <input
                                                    type="radio"
                                                    name="scope"
                                                    checked={childLevel === 6}
                                                    onChange={() => setChildLevel(6)}
                                                    className="mt-1 text-pink-500 focus:ring-pink-500 bg-gray-900 border-gray-600"
                                                />
                                                <div>
                                                    <div className="text-sm font-medium text-gray-200">Divide by Gminas</div>
                                                    <div className="text-xs text-gray-500">List all communes within {selectedUnit.name}.</div>
                                                </div>
                                            </label>
                                        )}

                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 text-center text-sm p-4">
                                <div className="mb-2 text-2xl opacity-20">📍</div>
                                Select a region from the left to configure data output.
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-white/10 flex gap-3 bg-[#0a0a0a]">
                        <button
                            onClick={onBack}
                            className="flex-1 py-3 text-gray-400 hover:text-white font-medium transition-colors text-sm"
                        >
                            &larr; Back
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={!selectedUnit}
                            className="flex-[2] py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg text-sm"
                        >
                            Next Step &rarr;
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
