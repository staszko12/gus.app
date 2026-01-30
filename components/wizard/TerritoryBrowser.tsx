"use client";

import { useState, useEffect } from "react";
import { getUnitsAction } from "@/app/actions";

interface TerritoryBrowserProps {
    onSelect: (unit: any) => void;
    selectedUnit: any | null;
}


const UNIT_LEVELS = {
    2: "Województwo",
    4: "Podregion",
    5: "Powiat",
    6: "Gmina"
};

export default function TerritoryBrowser({ onSelect, selectedUnit }: TerritoryBrowserProps) {
    // --- STATE ---
    const [currentLevelList, setCurrentLevelList] = useState<any[]>([]); // Items to show in list
    const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]); // Navigation path (stack of parents)
    const [isLoading, setIsLoading] = useState(false);

    // --- INITIAL LOAD ---
    useEffect(() => {
        loadRootUnits();
    }, []);

    // --- ACTIONS ---

    const loadRootUnits = async () => {
        setIsLoading(true);
        try {
            // Fetch Level 2 (Voivodeships)
            const res = await getUnitsAction(2);
            // Sort alphabetically
            const sorted = (res.results || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
            setCurrentLevelList(sorted);
            setBreadcrumbs([]);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUnitClick = async (unit: any) => {
        // If unit is clicked, we treat it as "Drill Down" OR "Select".
        // Let's adopt a pattern: 
        // - Item click = Select the unit (update props) AND try to load children in next column?
        // - Or Item click = Drill down?
        // User wants to say "Where?". It could be "Mazowieckie" (Region) or "Warszawa" (City).

        // Proposal: 
        // Click navigates DOWN if it has children?
        // Or we provide a specific "Drill Down" button?
        // Let's do: Click = Select. Arrow icon = Drill down.
        // Actually, simpler: Click = Drill Down. 
        // To Select "Mazowieckie" itself without drilling down, maybe a "Select Current Level" button?

        // Better UX: 
        // Click on name = Selects it.
        // If it has children, it shows them?

        // Let's replicate the structure of CategoryBrowser but adapted.
        // Single Column Drill-down might be cleaner given the depth (only 3 levels usually).
        // Or Two Columns: Parent List | Child List.

        // Let's go with: 
        // Breadcrumbs on top.
        // Variable list of units below.
        // Click -> Selects it.
        // Double Click -> Drills down? 
        // Or a button "Open"?

        // Let's try: Click drills down AND selects it as the candidate.
        onSelect(unit);

        // Try to load children
        // Hierarchy BDL: 2 (Woj) -> 5 (Powiat) -> 6 (Gmina)
        // We skip 4 (Podregion) as it's a statistical grouping often confusing for end users.

        let nextLevel = 0;
        if (unit.level === 2) nextLevel = 5; // Woj -> Powiat
        else if (unit.level === 5) nextLevel = 6; // Powiat -> Gmina
        else return; // Stop at level 6

        setIsLoading(true);
        try {
            const res = await getUnitsAction(nextLevel, unit.id);
            if (res.results && res.results.length > 0) {
                // It has children, so we drill down
                const sorted = res.results.sort((a: any, b: any) => a.name.localeCompare(b.name));
                setCurrentLevelList(sorted);
                setBreadcrumbs([...breadcrumbs, unit]);
            } else {
                // No children (e.g. leaf unit), stay here
                // The selection is already updated via onSelect(unit) above
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };



    const handleBreadcrumbClick = async (index: number) => {
        // Navigate back
        if (index === -1) {
            loadRootUnits();
            onSelect(null); // Clear selection when going to root? Or keep? Let's keep for now but reset implies 'start over'
            return;
        }

        const targetUnit = breadcrumbs[index];
        // We want to load children OF this target unit
        // But breadcrumbs[index] IS the parent.
        // So we want to load children of breadcrumbs[index].

        let nextLevel = 0;
        if (targetUnit.level === 2) nextLevel = 5; // Woj -> Powiat
        else if (targetUnit.level === 5) nextLevel = 6; // Powiat -> Gmina
        else return;

        setIsLoading(true);
        try {
            const res = await getUnitsAction(nextLevel, targetUnit.id);
            const sorted = (res.results || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
            setCurrentLevelList(sorted);
            setBreadcrumbs(breadcrumbs.slice(0, index + 1));

            // When navigating up, normally we consider the 'current context' as selected?
            // Or we just update the view. Let's just update the view.
            // Selection stays as what was last clicked unless user clicks something else.
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };


    const handleBackUp = () => {
        if (breadcrumbs.length === 0) return;
        handleBreadcrumbClick(breadcrumbs.length - 2);
    };


    return (
        <div className="flex flex-col h-[500px] bg-[#121212] rounded-xl border border-white/10 overflow-hidden">

            {/* 1. Header & Breadcrumbs */}
            <div className="flex items-center gap-2 p-3 bg-white/5 border-b border-white/10 text-sm overflow-x-auto">
                <button
                    onClick={() => handleBreadcrumbClick(-1)}
                    className="text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded hover:bg-white/5 flex items-center gap-1"
                >
                    <span>🇵🇱 Polska</span>
                </button>
                {breadcrumbs.map((crumb, idx) => (
                    <div key={crumb.id} className="flex items-center gap-2">
                        <span className="text-gray-600">/</span>
                        <button
                            onClick={() => handleBreadcrumbClick(idx)}
                            className="text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-white/5 whitespace-nowrap"
                        >
                            {crumb.name}
                        </button>
                    </div>
                ))}
            </div>

            {/* 2. Instructions */}
            <div className="px-4 py-2 text-xs text-gray-500 bg-[#0a0a0a] border-b border-white/5 flex justify-between items-center">
                <span>Select a region to drill down.</span>
                {breadcrumbs.length > 0 && (
                    <button onClick={handleBackUp} className="text-blue-400 hover:underline">
                        &uarr; Go Up
                    </button>
                )}
            </div>

            {/* 3. Unit List */}
            <div className="flex-1 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 content-start">
                {isLoading && (
                    <div className="col-span-full py-10 flex justify-center">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}

                {!isLoading && currentLevelList.map(unit => (
                    <button
                        key={unit.id}
                        onClick={() => handleUnitClick(unit)}
                        className={`text-left p-3 rounded-lg border transition-all flex flex-col justify-center h-20 relative group
              ${selectedUnit?.id === unit.id
                                ? 'bg-purple-600/20 border-purple-500 text-white'
                                : 'bg-white/5 border-transparent text-gray-300 hover:bg-white/10 hover:border-white/20'
                            }`}
                    >
                        <div className="font-bold truncate w-full">{unit.name}</div>
                        <div className="text-[10px] opacity-60 uppercase tracking-wider mt-1">
                            {/* @ts-ignore */}
                            {UNIT_LEVELS[unit.level] || `Level ${unit.level}`}
                        </div>

                        {/* Visual indicator that it has children? Rough check based on level */}
                        {unit.level < 6 && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-30">
                                ➔
                            </div>
                        )}

                        {selectedUnit?.id === unit.id && (
                            <div className="absolute top-2 right-2 text-purple-400">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                        )}
                    </button>
                ))}

                {!isLoading && currentLevelList.length === 0 && (
                    <div className="col-span-full py-10 text-center text-gray-500">
                        No units found at this level.
                    </div>
                )}
            </div>

            {/* 4. Selection Confirmation Footer */}
            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-between items-center">
                <div className="text-sm">
                    {selectedUnit ? (
                        <>
                            <span className="text-gray-400">Selected: </span>
                            <span className="text-white font-bold">{selectedUnit.name}</span>
                        </>
                    ) : (
                        <span className="text-gray-500 italic">No area selected</span>
                    )}
                </div>
                {selectedUnit && breadcrumbs.length > 0 && selectedUnit.id !== breadcrumbs[breadcrumbs.length - 1].id && (
                    <div className="text-xs text-orange-400 animate-pulse">
                        Clicking selects the item.
                    </div>
                )}
            </div>
        </div>
    );
}
