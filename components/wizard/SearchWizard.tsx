"use client";

import { useState } from "react";
import VariableSearchStep from "./VariableSearchStep";
import UnitSelectionStep from "./UnitSelectionStep";
import TableConfigurationStep from "./TableConfigurationStep";

interface SearchWizardProps {
    onComplete: (config: {
        variables: any[];
        unit: any;
        childLevel?: number;
        years: number[];
    }) => void;
}

export default function SearchWizard({ onComplete }: SearchWizardProps) {
    const [step, setStep] = useState(1);
    const [variables, setVariables] = useState<any[]>([]);
    const [unit, setUnit] = useState<any>(null);
    const [childLevel, setChildLevel] = useState<number | undefined>(undefined);

    const handleVariablesNext = (selectedVars: any[]) => {
        setVariables(selectedVars);
        setStep(2);
    };

    const handleUnitNext = (selectedUnit: any, level?: number) => {
        setUnit(selectedUnit);
        setChildLevel(level);
        setStep(3);
    };

    const handleTableNext = (years: number[]) => {
        onComplete({
            variables,
            unit,
            childLevel,
            years
        });
    };

    return (
        <div className="w-full max-w-6xl mx-auto min-h-[600px] bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
            {/* Progress Bar */}
            <div className="h-1 w-full bg-white/5 flex">
                <div className={`h-full transition-all duration-500 ease-out bg-blue-500 ${step >= 1 ? 'w-1/3' : 'w-0'}`} />
                <div className={`h-full transition-all duration-500 ease-out bg-purple-500 ${step >= 2 ? 'w-1/3' : 'w-0'}`} />
                <div className={`h-full transition-all duration-500 ease-out bg-green-500 ${step >= 3 ? 'w-1/3' : 'w-0'}`} />
            </div>

            <div className="flex-1 p-8">
                {step === 1 && (
                    <VariableSearchStep
                        onNext={handleVariablesNext}
                        initialSelected={variables}
                    />
                )}
                {step === 2 && (
                    <UnitSelectionStep
                        onNext={handleUnitNext}
                        onBack={() => setStep(1)}
                    />
                )}
                {step === 3 && (
                    <TableConfigurationStep
                        onNext={handleTableNext}
                        onBack={() => setStep(2)}
                        selectedVars={variables}
                        selectedUnit={unit}
                        childLevel={childLevel}
                    />
                )}
            </div>

            {/* Step Indicators */}
            <div className="absolute top-6 right-6 flex gap-2">
                {[1, 2, 3].map(s => (
                    <div
                        key={s}
                        className={`w-2 h-2 rounded-full transition-colors ${step === s ? 'bg-white' : 'bg-white/20'}`}
                    />
                ))}
            </div>
        </div>
    );
}
