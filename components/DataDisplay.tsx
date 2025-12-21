import { useState, useMemo } from "react";
import { AIQueryAnalysis } from "../services/ai-processor";
import { generateGusXml, GusXmlData } from "../services/xml-generator";

interface DataDisplayProps {
    data: any[];
    analysis: AIQueryAnalysis | null;
    candidateVars?: any[]; // Added to resolve names for multi-unit mode
    onConfirm: () => void;
    isFetchingObject: boolean;
    metaMap?: Record<number, string>;
}

export default function DataDisplay({ data, analysis, candidateVars, onConfirm, isFetchingObject, metaMap }: DataDisplayProps) {
    const [orientation, setOrientation] = useState<'vars-cols' | 'years-cols'>('vars-cols');
    const [showAttributes, setShowAttributes] = useState(false);
    const isMultiUnit = analysis?.scope === 'multi_unit';

    // Helper to get unique years from all variables
    const getAllYears = () => {
        if (!data || data.length === 0) return [];
        const years = new Set<number>();
        // Check structure based on scope
        if (isMultiUnit) {
             // Multi-Unit: data is Array of Units. Each unit has values: [{ variableId, year, value }]
             data.forEach(unit => unit.values?.forEach((val: any) => years.add(val.year)));
        } else {
             // Single-Unit: data is Array of Variables. Each var has values: [{ year, value }]
             data.forEach(v => v.values?.forEach((val: any) => years.add(val.year)));
        }
        return Array.from(years).sort((a, b) => a - b);
    };

    const allYears = useMemo(() => getAllYears(), [data, isMultiUnit]);

    // Generate XML String
    const xmlContent = useMemo(() => {
        if (!data || data.length === 0 || !analysis) return "";

        // Resolve variables metadata
        // For Multi-Unit, we need to find what variables exist in the data
        let variablesList: any[] = [];
        if (isMultiUnit) {
            const varIds = new Set<number>();
            data.forEach(u => u.values?.forEach((v: any) => varIds.add(v.variableId)));
            variablesList = Array.from(varIds).map(vid => {
                const found = candidateVars?.find(c => c.id === vid);
                return {
                    id: vid,
                    name: found?.n1 || `Variable ${vid}`,
                    n1: found?.n1 || `Variable ${vid}`,
                    measureUnit: found?.["measure-unit"] || "-"
                };
            });
        } else {
             variablesList = data.map(v => ({
                id: v.id,
                name: v.name,
                n1: v.name,
                measureUnit: v["measure-unit"] || "-"
            }));
        }

        const xmlData: GusXmlData = {
            scope: isMultiUnit ? 'multi_unit' : 'single_unit',
            unit: {
                id: isMultiUnit ? (analysis.location || "Multiple") : (data[0]?.["unit-id"] || "unknown"),
                name: analysis.unit || analysis.location || "Unknown Unit"
            },
            variables: variablesList,
            results: data
        };
        return generateGusXml(xmlData);
    }, [data, analysis, isMultiUnit, candidateVars]);


    const downloadCSV = () => {
        if (!data || data.length === 0) return;

        let csvContent = "";

        if (isMultiUnit) {
            // Multi-Unit CSV Strategy
            // Rows: Units
            // Cols: Variables (maybe suffix with year if multiple years?)
            // Let's assume grouping by Unit, then Year, then Vars

            // Resolve var names
            const varIds = new Set<number>();
            data.forEach(u => u.values?.forEach((v: any) => varIds.add(v.variableId)));
            const uniqueVars = Array.from(varIds);

            // Header: UnitId, UnitName, Year, Var1Name, Var2Name...
            const header = ["UnitId", "UnitName", "Year", ...uniqueVars.map(vid => {
                const found = candidateVars?.find(c => c.id === vid);
                return `"${found?.n1 || vid}"`;
            })].join(",");

            const rows: string[] = [];
            data.forEach(unit => {
                allYears.forEach(year => {
                    const rowVals = [unit.id, `"${unit.name}"`, year];
                    let hasData = false;
                    uniqueVars.forEach(vid => {
                        const valObj = unit.values?.find((v: any) => v.variableId === vid && v.year === year);
                        if (valObj) hasData = true;
                        rowVals.push(valObj ? (valObj.value ?? valObj.val ?? "") : "");
                    });
                    if (hasData) rows.push(rowVals.join(","));
                });
            });
            csvContent = header + "\n" + rows.join("\n");

        } else {
            // Existing Single-Unit CSV Strategy
            if (orientation === 'vars-cols') {
                // Header: Year, Var1, Var2...
                const header = ["Year", ...data.map(v => `"${v.name}"`)].join(",");
                const rows = allYears.map(year => {
                    const rowVals = [year];
                    data.forEach(v => {
                        const valObj = v.values?.find((val: any) => val.year === year);
                        rowVals.push(valObj ? (valObj.value ?? valObj.val ?? "") : "");
                    });
                    return rowVals.join(",");
                }).join("\n");
                csvContent = header + "\n" + rows;
            } else {
                // Header: Variable, 2022, 2023...
                const header = ["Variable", ...allYears].join(",");
                const rows = data.map(v => {
                    const rowVals = [`"${v.name}"`];
                    allYears.forEach(year => {
                        const valObj = v.values?.find((val: any) => val.year === year);
                        rowVals.push(valObj ? (valObj.value ?? valObj.val ?? "") : "");
                    });
                    return rowVals.join(",");
                }).join("\n");
                csvContent = header + "\n" + rows;
            }
        }

        const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `gus_data_${analysis?.intent || "export"}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const downloadXML = () => {
        const blob = new Blob([xmlContent], { type: "text/xml;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "gus_data_export.xml");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!analysis) return null;

    return (
        <div className="w-full max-w-6xl mx-auto mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* 1. Analysis Summary */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-xl font-semibold text-blue-400 mb-2">Analysis Context</h3>
                        <p className="text-gray-300 text-sm max-w-2xl">{analysis.explanation}</p>
                    </div>
                    {(analysis.years && analysis.years.length > 0) && (
                        <div className="text-right">
                            <span className="text-xs text-gray-500 uppercase tracking-widest">Time Range</span>
                            <div className="text-orange-400 font-mono font-medium">
                                {analysis.years.join(", ")}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-4">
                    {(analysis.topic || analysis.searchTerms) && (
                        <div className="px-3 py-1 rounded bg-purple-500/10 text-purple-400 text-xs border border-purple-500/20">
                            Topic: {analysis.topic || analysis.searchTerms}
                        </div>
                    )}
                    {(analysis.unit || analysis.location) && (
                        <div className="px-3 py-1 rounded bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20">
                            Unit: {analysis.unit || analysis.location}
                        </div>
                    )}
                    {isMultiUnit && (
                         <div className="px-3 py-1 rounded bg-orange-500/10 text-orange-400 text-xs border border-orange-500/20">
                            Scope: Multi-Unit ({analysis.targetUnitType})
                        </div>
                    )}
                </div>
            </div>

            {/* Loading State */}
            {isFetchingObject && (
                <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-emerald-400 font-mono">Fetching Data for Grid...</p>
                </div>
            )}

            {/* GRID & EXPORT */}
            {data && data.length > 0 && !isFetchingObject && (
                <div className="space-y-6">

                    {/* View Controls */}
                    <div className="flex flex-wrap justify-between items-center gap-4">
                        <h2 className="text-xl font-bold text-white">Data Preview</h2>
                        <div className="flex items-center gap-4">

                            {/* Attribute Toggle */}
                            <label className="flex items-center space-x-2 cursor-pointer text-sm text-gray-400 hover:text-white">
                                <input
                                    type="checkbox"
                                    checked={showAttributes}
                                    onChange={() => setShowAttributes(!showAttributes)}
                                    className="form-checkbox bg-black/50 border-white/20 rounded text-purple-500"
                                />
                                <span>Show Attributes</span>
                            </label>

                            {!isMultiUnit && (
                            <div className="flex bg-[#2d2d2d] rounded-lg p-1 border border-white/10">
                                <button
                                    onClick={() => setOrientation('vars-cols')}
                                    className={`px-4 py-1.5 rounded-md text-sm transition-all ${orientation === 'vars-cols' ? 'bg-[#121212] text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Mode A: Compare Vars
                                </button>
                                <button
                                    onClick={() => setOrientation('years-cols')}
                                    className={`px-4 py-1.5 rounded-md text-sm transition-all ${orientation === 'years-cols' ? 'bg-[#121212] text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Mode B: Time Series
                                </button>
                            </div>
                            )}
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-400">
                            <thead className="bg-[#121212] text-gray-200 uppercase font-mono text-xs sticky top-0">
                                {isMultiUnit ? (
                                    <tr>
                                        <th className="px-4 py-3 bg-[#121212] min-w-[150px]">Unit</th>
                                        {/* Identify Unique Vars from Data to render columns */}
                                        {(() => {
                                            const varIds = new Set<number>();
                                            data.forEach(u => u.values?.forEach((v: any) => varIds.add(v.variableId)));
                                            const uniqueVars = Array.from(varIds);
                                            return uniqueVars.map(vid => {
                                                 const found = candidateVars?.find(c => c.id === vid);
                                                 const name = found?.n1 || `Var ${vid}`;
                                                 return allYears.map(y => (
                                                     <th key={`${vid}-${y}`} className="px-4 py-3 min-w-[120px]" title={name}>
                                                         {name} ({y})
                                                     </th>
                                                 ));
                                            });
                                        })()}
                                    </tr>
                                ) : (
                                    <tr>
                                    {orientation === 'vars-cols' ? (
                                        <>
                                            <th className="px-4 py-3 bg-[#121212]">Year</th>
                                            {data.map(v => (
                                                <th key={v.id} className="px-4 py-3 min-w-[150px]">{v.name}</th>
                                            ))}
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-4 py-3 bg-[#121212] min-w-[200px]">Variable</th>
                                            {allYears.map(y => (
                                                <th key={y} className="px-4 py-3">{y}</th>
                                            ))}
                                        </>
                                    )}
                                </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isMultiUnit ? (
                                    data.map((unit) => {
                                        // Calc unique vars again - optimize this later ideally
                                        const varIds = new Set<number>();
                                        data.forEach(u => u.values?.forEach((v: any) => varIds.add(v.variableId)));
                                        const uniqueVars = Array.from(varIds);

                                        return (
                                        <tr key={unit.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-medium text-white">{unit.name}</td>
                                            {uniqueVars.map(vid => (
                                                allYears.map(year => {
                                                    const valObj = unit.values?.find((v: any) => v.variableId === vid && v.year === year);
                                                    return (
                                                        <td key={`${unit.id}-${vid}-${year}`} className="px-4 py-3 text-emerald-400 font-mono">
                                                             {valObj ? (valObj.value ?? valObj.val ?? "-") : "-"}
                                                        </td>
                                                    );
                                                })
                                            ))}
                                        </tr>
                                        );
                                    })
                                ) : (
                                    orientation === 'vars-cols' ? (
                                    allYears.map(year => (
                                        <tr key={year} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-mono text-white bg-white/5">{year}</td>
                                            {data.map(v => {
                                                const valObj = v.values?.find((val: any) => val.year === year);
                                                return (
                                                    <td key={`${v.id}-${year}`} className="px-4 py-3 text-emerald-400 font-mono">
                                                        {valObj ? (valObj.value ?? valObj.val ?? "-") : "-"}
                                                        {showAttributes && valObj?.attrId !== undefined && (
                                                            <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded">
                                                                [{valObj.attrId}]
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                ) : (
                                    data.map(v => (
                                        <tr key={v.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 font-medium text-white max-w-xs truncate" title={v.name}>{v.name}</td>
                                            {allYears.map(year => {
                                                const valObj = v.values?.find((val: any) => val.year === year);
                                                return (
                                                    <td key={`${v.id}-${year}`} className="px-4 py-3 text-emerald-400 font-mono">
                                                        {valObj ? (valObj.value ?? valObj.val ?? "-") : "-"}
                                                        {showAttributes && valObj?.attrId !== undefined && (
                                                            <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded">
                                                                [{valObj.attrId}]
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* XML Preview */}
                        <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="bg-[#2d2d2d] px-4 py-2 border-b border-white/5 flex justify-between items-center">
                                <span className="text-xs text-gray-400 font-mono">XML Output (Unified Schema)</span>
                                <span className="text-xs text-emerald-500">Structured & Valid</span>
                            </div>
                            <pre className="p-4 text-xs font-mono text-blue-300 overflow-x-auto h-64">
                                {xmlContent}
                            </pre>
                        </div>

                        {/* Actions */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-center">
                            <h4 className="text-lg font-medium text-white mb-2">Final Data Export</h4>
                            <p className="text-gray-400 text-sm mb-6">
                                Download the processed data in your preferred format.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={downloadXML}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/20"
                                >
                                    <span>Download XML</span>
                                </button>
                                <button
                                    onClick={downloadCSV}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20"
                                >
                                    <span>Download CSV</span>
                                </button>
                                <button
                                    onClick={onConfirm} // Mark as DONE
                                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all"
                                >
                                    Finish Workflow
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
