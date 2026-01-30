"use client";

import { useState, useEffect } from "react";
import { getSubjectsAction, getVariablesBySubjectAction } from "@/app/actions";

interface CategoryBrowserProps {
    onSelectionChange: (selectedVars: any[]) => void;
    initialSelected?: any[];
}

export default function CategoryBrowser({ onSelectionChange, initialSelected = [] }: CategoryBrowserProps) {
    // --- STATE ---
    const [subjects, setSubjects] = useState<any[]>([]); // Current list of subjects to show
    const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]); // Navigation path
    const [variables, setVariables] = useState<any[]>([]); // Variables for current subject
    const [selectedBasket, setSelectedBasket] = useState<any[]>(initialSelected);

    const [isLoading, setIsLoading] = useState(false);
    const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

    // --- INITIAL LOAD ---
    useEffect(() => {
        loadRootSubjects();
    }, []);

    useEffect(() => {
        onSelectionChange(selectedBasket);
    }, [selectedBasket, onSelectionChange]);

    // --- ACTIONS ---

    const loadRootSubjects = async () => {
        setIsLoading(true);
        try {
            const res = await getSubjectsAction();
            setSubjects(res.results || []);
            setBreadcrumbs([]);
            setActiveSubjectId(null);
            setVariables([]);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubjectClick = async (subject: any) => {
        setIsLoading(true);
        try {
            // 1. Check if it has children?
            // The API doesn't explicitly say "hasChildren", but we can try to fetch children.
            // Or we can try to fetch variables.
            // Usually GUS subjects are nested. 
            // Strategy: Fetch children first. If empty, fetch variables.

            const childrenRes = await getSubjectsAction(subject.id);

            if (childrenRes.results && childrenRes.results.length > 0) {
                // It has sub-categories -> Drill down
                setBreadcrumbs([...breadcrumbs, subject]);
                setSubjects(childrenRes.results);
                setVariables([]); // Clear variables
                setActiveSubjectId(null);
            } else {
                // It's a leaf node -> Fetch variables
                // Keep current subjects view or...?
                // Ideally we want to stay in the current list but show variables for this item?
                // Let's mark it active
                setActiveSubjectId(subject.id);
                const varsRes = await getVariablesBySubjectAction(subject.id);
                setVariables(varsRes.results || []);
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
            loadRootSubjects();
            return;
        }

        // Target is breadcrumbs[index]
        const targetSubject = breadcrumbs[index];
        // We want to load children of this subject
        setIsLoading(true);
        try {
            const res = await getSubjectsAction(targetSubject.id);
            setSubjects(res.results || []);
            setBreadcrumbs(breadcrumbs.slice(0, index + 1));
            setVariables([]);
            setActiveSubjectId(null);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleVariable = (v: any) => {
        const exists = selectedBasket.find(item => item.id === v.id);
        if (exists) {
            setSelectedBasket(prev => prev.filter(item => item.id !== v.id));
        } else {
            setSelectedBasket(prev => [...prev, v]);
        }
    };

    const isSelected = (id: number) => !!selectedBasket.find(v => v.id === id);


    // --- RENDER ---
    return (
        <div className="flex flex-col h-[500px] bg-[#121212] rounded-xl border border-white/10 overflow-hidden">

            {/* 1. Breadcrumbs Header */}
            <div className="flex items-center gap-2 p-3 bg-white/5 border-b border-white/10 text-sm overflow-x-auto">
                <button
                    onClick={() => handleBreadcrumbClick(-1)}
                    className="text-blue-400 hover:text-blue-300 font-medium px-2 py-1 rounded hover:bg-white/5"
                >
                    All Categories
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

            <div className="flex flex-1 overflow-hidden">
                {/* 2. Categories List (Left) */}
                <div className="w-1/3 border-r border-white/10 flex flex-col min-w-[200px]">
                    <div className="p-3 bg-white/5 text-xs text-gray-500 font-bold uppercase tracking-wider">
                        Categories
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {subjects.map(sub => (
                            <button
                                key={sub.id}
                                onClick={() => handleSubjectClick(sub)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex justify-between items-center group
                  ${activeSubjectId === sub.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <span className="truncate">{sub.name}</span>
                                <span className="opacity-0 group-hover:opacity-100 text-xs">👉</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. Variables List (Middle) */}
                <div className="w-1/3 border-r border-white/10 flex flex-col min-w-[200px] bg-[#0a0a0a]">
                    <div className="p-3 bg-white/5 text-xs text-gray-500 font-bold uppercase tracking-wider flex justify-between">
                        <span>Variables</span>
                        {isLoading && <span className="text-blue-400 animate-pulse">Loading...</span>}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {variables.length === 0 && !isLoading && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 p-4 text-center text-sm">
                                {activeSubjectId
                                    ? "No variables found in this category."
                                    : "Select a category to view variables."
                                }
                            </div>
                        )}
                        {variables.map(v => (
                            <button
                                key={v.id}
                                onClick={() => toggleVariable(v)}
                                className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-all border flex flex-col gap-1
                   ${isSelected(v.id)
                                        ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                        : 'border-transparent bg-white/5 text-gray-300 hover:bg-white/10'
                                    }`}
                            >
                                <div className="font-medium mb-0.5">{v.n1}</div>
                                <div className="flex justify-between items-center w-full">
                                    {v.measureUnit && <div className="text-xs opacity-50">{v.measureUnit}</div>}
                                    {v.level !== undefined && (
                                        <div className="text-[10px] uppercase font-bold tracking-wider opacity-70 bg-white/10 px-1.5 py-0.5 rounded">
                                            Level {v.level}
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 4. Selected Basket (Right) */}
                <div className="w-1/3 flex flex-col min-w-[200px] bg-[#151515]">
                    <div className="p-3 bg-white/5 text-xs text-gray-500 font-bold uppercase tracking-wider flex justify-between items-center">
                        <span>Selected ({selectedBasket.length})</span>
                        {selectedBasket.length > 0 && (
                            <button
                                onClick={() => setSelectedBasket([])}
                                className="text-red-400 hover:text-red-300 text-[10px]"
                            >
                                CLEAR
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {selectedBasket.map(v => (
                            <div
                                key={v.id}
                                className="p-3 rounded-lg bg-emerald-900/10 border border-emerald-500/20 relative group"
                            >
                                <div className="text-sm text-emerald-200 pr-6">{v.n1}</div>
                                <button
                                    onClick={() => toggleVariable(v)}
                                    className="absolute top-2 right-2 text-emerald-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        {selectedBasket.length === 0 && (
                            <div className="h-full flex items-center justify-center text-gray-700 text-sm italic">
                                Basket is empty
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
