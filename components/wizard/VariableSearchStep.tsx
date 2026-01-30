"use client";

import { useState } from "react";
import CategoryBrowser from "./CategoryBrowser";

interface VariableSearchStepProps {
    onNext: (selectedVars: any[]) => void;
    initialSelected?: any[];
}

export default function VariableSearchStep({ onNext, initialSelected = [] }: VariableSearchStepProps) {
    const [selected, setSelected] = useState<any[]>(initialSelected);

    return (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="mb-4 text-center">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Step 1: Browse Data Categories
                </h2>
                <p className="text-gray-400 text-sm mt-2">
                    Navigate through GUS topics to find exact variables. Click to add them to your basket.
                </p>
            </div>

            <div className="flex-1 min-h-[500px] flex flex-col gap-4">
                <CategoryBrowser
                    onSelectionChange={setSelected}
                    initialSelected={initialSelected}
                />

                <div className="flex justify-end pt-4 border-t border-white/5">
                    <button
                        onClick={() => onNext(selected)}
                        disabled={selected.length === 0}
                        className="px-8 py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        Next Step (Area Selection) &rarr;
                    </button>
                </div>
            </div>
        </div>
    );
}
