"use client";

import { useState } from "react";
import SearchWizard from "@/components/wizard/SearchWizard";
import DataDisplay from "@/components/DataDisplay";
import { getUnitDataAction, getVariableDataAction, getUnitsAction } from "@/app/actions";
import { AIQueryAnalysis } from "@/services/ai-processor";
import AgentSearch from "@/components/AgentSearch";

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'WIZARD' | 'GRID'>('WIZARD');
  const [searchMode, setSearchMode] = useState<'WIZARD' | 'AGENT'>('AGENT'); // Default to Agent for demo

  // State to hold selection context for DataDisplay
  const [resultContext, setResultContext] = useState<{
    analysis: AIQueryAnalysis;
    variables: any[];
  } | null>(null);

  const handleAgentDataFound = (items: any[], analysis: AIQueryAnalysis, variable: any) => {
    setData(items);
    setResultContext({
      analysis,
      variables: [variable]
    });
    setViewMode('GRID');
  };


  const handleWizardComplete = async (config: {
    variables: any[];
    unit: any;
    childLevel?: number;
    years: number[];
  }) => {
    setIsProcessing(true);

    // 1. Construct Analysis Object for compatibility with DataDisplay
    const isMultiUnit = config.childLevel !== undefined;

    // Map level to type name approximately
    const getUnitTypeName = (level: number) => {
      if (level === 2) return "województwo";
      if (level === 4) return "powiat";
      if (level === 5) return "gmina";
      if (level === 6) return "dzielnica";
      return "jednostka";
    };

    const analysis: AIQueryAnalysis = {
      intent: "data_retrieval",
      topic: config.variables.map(v => v.n1).join(", "),
      location: config.unit.name,
      // @ts-ignore
      unit: config.unit.name,
      scope: isMultiUnit ? 'multi_unit' : 'single_unit',
      targetUnitType: isMultiUnit ? getUnitTypeName(config.childLevel!) : undefined,
      years: config.years,
      explanation: "Manual selection"
    };

    setResultContext({
      analysis,
      variables: config.variables
    });

    try {
      if (isMultiUnit) {
        // --- MULTI-UNIT STRATEGY (Enforced Recursion) ---
        // GUS API response objects often lack the 'level' property, making verification impossible.
        // We MUST enforce strict hierarchy traversal based on TERYT rules.
        // Rule: If asking for Gminas (5) from Województwo (2), we MUST go through Powiats (4).

        const targetLevel = Number(config.childLevel);
        const parentLevel = Number(config.unit.level);
        let finalUnits: any[] = [];

        console.log(`[Fetch Strategy] Requesting Level ${targetLevel} units under ${config.unit.name} (Level ${parentLevel})...`);

        // EXPLICIT Drill Down for gaps
        if (parentLevel === 2 && targetLevel === 6) {
          console.log(`[Fetch Strategy] Detected Woj -> Gmina gap. Forcing 2-step fetch.`);

          // 1. Fetch Intermediates (Powiats - Level 4)
          const intermediateRes = await getUnitsAction(5, config.unit.id);
          // Filter to ensure we only have Level 4. Some API responses might include mixed levels or parent refs.
          const intermediates = (intermediateRes?.results || []).filter((u: any) => u.level === 5);

          if (intermediateRes?.results?.length && intermediateRes.results.length > intermediates.length) {
            console.warn(`[Fetch Strategy] Filtered out ${intermediateRes.results.length - intermediates.length} non-level-5 units from intermediates.`);
          }

          if (intermediates.length === 0) {
            console.warn("No intermediate units (Powiats) found.");
          } else {
            console.log(`[Fetch Strategy] Found ${intermediates.length} powiats. Drilling down...`);
          }

          // 2. Fetch Target (Gminas - Level 5) from Intermediates
          const drillPromises = intermediates.map((p: any) => getUnitsAction(6, p.id));
          const drillResults = await Promise.all(drillPromises);

          drillResults.forEach(res => {
            if (res?.results) {
              // Filter results to ensure they are actually Level 5
              const validGminas = res.results.filter((u: any) => u.level === 6);

              if (res.results.length > validGminas.length) {
                // Log sample of filtered out units to understand what's wrong
                const invalid = res.results.find((u: any) => u.level !== 6);
                console.warn(`[Fetch Strategy] Filtered out ${res.results.length - validGminas.length} non-level-6 units. Sample invalid: ${invalid?.name} (${invalid?.level})`);
              }

              finalUnits.push(...validGminas);
            }
          });
          console.log(`[Fetch Strategy] Recursion complete. Found ${finalUnits.length} gminas.`);

        } else {
          // Direct fetch for standard cases (e.g. 4->5, 2->4)
          // Or if the gap is not 2->5 (e.g. 2->6? unlikely used)
          const res = await getUnitsAction(targetLevel, config.unit.id);

          // Apply strict filtering for direct fetch too, just in case
          if (res?.results) {
            const filtered = res.results.filter((u: any) => u.level === targetLevel);
            if (res.results.length > filtered.length) {
              console.warn(`[Fetch Strategy] Direct fetch filtered out ${res.results.length - filtered.length} items with wrong level.`);
            }
            finalUnits = filtered;
          } else {
            finalUnits = [];
          }
        }

        const childUnits = finalUnits;


        if (childUnits.length === 0) {
          alert("No sub-units found for this region.");
          setIsProcessing(false);
          return;
        }

        console.log(`fetching data for ${childUnits.length} sub-units...`);

        // 2. For each child unit, fetch the variables.
        // We can batch this or do it in parallel.
        const variableIds = config.variables.map(v => v.id);

        // BATCHING: GUS API might have rate limits. Let's do batches of 10.
        const BATCH_SIZE = 10;
        const allUnitData: any[] = [];

        for (let i = 0; i < childUnits.length; i += BATCH_SIZE) {
          const batch = childUnits.slice(i, i + BATCH_SIZE);
          const batchPromises = batch.map(async (unit: any) => {
            try {
              // Fetch data for this specific unit
              const res = await getUnitDataAction(unit.id, variableIds, config.years);
              if (res && res.results) {
                // res.results is Array of { id, values: [ { year, val } ] } (variable objects)
                // But wait, getUnitData returns structure:
                // results: [ { id: varId, name: varName, values: [...] } ]
                // We need to reshape this to our grid format: Unit -> [Values]

                const values = res.results.flatMap((v: any) =>
                  (v.values || []).map((val: any) => ({
                    ...val,
                    variableId: v.id
                  }))
                );

                return {
                  id: unit.id,
                  name: unit.name,
                  values: values
                };
              }
            } catch (e) {
              console.error(`Failed to fetch for unit ${unit.name}`, e);
              return null;
            }
            return null;
          });

          const batchResults = await Promise.all(batchPromises);
          allUnitData.push(...batchResults.filter(u => u !== null));
        }

        const unifiedData = allUnitData;


        if (unifiedData.length === 0) {
          alert("No data found for the selected criteria.");
        } else {
          setData(unifiedData);
          setViewMode('GRID');
        }

      } else {
        // --- SINGLE-UNIT STRATEGY ---
        const varIds = config.variables.map(v => v.id);
        const response = await getUnitDataAction(config.unit.id, varIds, config.years);

        if (response?.results) {
          // In Single Unit mode, results is an array of variables with values
          setData(response.results);
          setViewMode('GRID');
        } else {
          alert("No data found.");
        }
      }

    } catch (e: any) {
      console.error("Fetch Error:", e);
      alert(`Error fetching data: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#000000] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
      {/* Background Gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#000000] to-[#000000] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-12 border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white">
              G
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              GUS Data <span className="text-gray-500 font-normal">Explorer</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {viewMode === 'WIZARD' && (
              <div className="flex bg-white/10 p-1 rounded-lg">
                <button
                  onClick={() => setSearchMode('WIZARD')}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${searchMode === 'WIZARD' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  Wizard
                </button>
                <button
                  onClick={() => setSearchMode('AGENT')}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${searchMode === 'AGENT' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  AI Agent
                </button>
              </div>
            )}

            {viewMode === 'GRID' && (
              <button
                onClick={() => setViewMode('WIZARD')}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                &larr; New Search
              </button>
            )}
          </div>
        </header>

        {viewMode === 'WIZARD' ? (
          searchMode === 'WIZARD' ? (
            <SearchWizard onComplete={handleWizardComplete} />
          ) : (
            <AgentSearch onDataFound={handleAgentDataFound} />
          )
        ) : (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            {resultContext && (
              <DataDisplay
                analysis={resultContext.analysis}
                data={data}
                candidateVars={resultContext.variables}
                onConfirm={() => { }} // No-op, just viewing
                isFetchingObject={isProcessing}
                metaMap={{}}
              />
            )}
          </div>
        )}

        {isProcessing && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center flex-col">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <div className="text-blue-300 font-medium animate-pulse">Fetching GUS Data...</div>
          </div>
        )}

      </div>
    </main>
  );
}
