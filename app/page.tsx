"use client";

import { useState } from "react";
import SearchWizard from "@/components/wizard/SearchWizard";
import DataDisplay from "@/components/DataDisplay";
import { GusClient } from "@/services/gus-client";
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

  const gusClient = new GusClient(process.env.NEXT_PUBLIC_GUS_CLIENT_ID);

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
        // --- MULTI-UNIT STRATEGY (Optimized) ---
        // Fetch data for ALL child units for EACH variable

        const fetchPromises = config.variables.map(async (variable) => {
          // getVariableData(varId, unitLevel, years, parentId)
          // This returns a list of Child Units, each with values for this variable
          const res = await gusClient.getVariableData(
            variable.id,
            config.childLevel!,
            config.years,
            config.unit.id
          );
          return { variable, data: res?.results || [] };
        });

        const allResults = await Promise.all(fetchPromises);

        // Aggregate results: Map<UnitID, UnitObject>
        const unitMap = new Map<string, any>();

        allResults.forEach(({ variable, data }) => {
          // data is UnitData[]
          (data as any[]).forEach((unitItem: any) => {
            if (!unitMap.has(unitItem.id)) {
              unitMap.set(unitItem.id, {
                id: unitItem.id,
                name: unitItem.name,
                values: []
              });
            }
            const unitEntry = unitMap.get(unitItem.id);

            // Add values, tagged with variableId
            const taggedValues = (unitItem.values || []).map((val: any) => ({
              ...val,
              variableId: variable.id
            }));

            unitEntry.values.push(...taggedValues);
          });
        });

        const unifiedData = Array.from(unitMap.values());

        if (unifiedData.length === 0) {
          alert("No data found for the selected criteria.");
        } else {
          setData(unifiedData);
          setViewMode('GRID');
        }

      } else {
        // --- SINGLE-UNIT STRATEGY ---
        const varIds = config.variables.map(v => v.id);
        const response = await gusClient.getUnitData(config.unit.id, varIds, config.years);

        if (response?.results) {
          // In Single Unit mode, results is an array of variables with values
          // But DataDisplay handles this based on 'scope'. 
          // If scope is single_unit, it expects array of Variables.
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
