"use client";

import { useState } from "react";
import SearchForm from "@/components/SearchForm";
import DataDisplay from "@/components/DataDisplay";
import { AiProcessor, AIQueryAnalysis, getLevelFromUnitType } from "@/services/ai-processor";
import { GusClient } from "@/services/gus-client";

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [workflowSteps, setWorkflowSteps] = useState<string[]>([]);

  // --- WORKFLOW STATE ---
  type WorkflowStage = 'INIT' | 'CONFIGURATION' | 'GRID_PREVIEW' | 'DONE';
  const [stage, setStage] = useState<WorkflowStage>('INIT');

  const [analysis, setAnalysis] = useState<AIQueryAnalysis | null>(null);

  // Configuration State
  const [candidateUnits, setCandidateUnits] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [unitSearchInput, setUnitSearchInput] = useState("");

  const [candidateVars, setCandidateVars] = useState<any[]>([]);
  const [selectedVarIds, setSelectedVarIds] = useState<number[]>([]);
  const [varSearchInput, setVarSearchInput] = useState("");

  const [targetYears, setTargetYears] = useState<number[]>([2022, 2023]);
  const [data, setData] = useState<any[]>([]);

  const aiProcessor = new AiProcessor();
  const gusClient = new GusClient(process.env.NEXT_PUBLIC_GUS_CLIENT_ID);
  const addStep = (step: string) => setWorkflowSteps(prev => [...prev, step]);

  // --- STAGE 1: DISCOVERY (Sequential + Re-Rank) ---
  const handleSearch = async (query: string) => {
    setIsProcessing(true);
    setWorkflowSteps([]);
    setStage('INIT');
    setData([]);
    setCandidateUnits([]);
    setCandidateVars([]);
    setSelectedUnitId(null);
    setSelectedVarIds([]); // Clear previous selections

    addStep(`🧠 Analyzing query: "${query}"...`);

    try {
      // 1. AI Analysis (Parse Intent)
      const result = await aiProcessor.analyzeQuery(query);
      if (result.intent === "error") throw new Error(result.explanation);

      setAnalysis(result);
      // Use efficient search term if available, else fall back to topic
      const searchTerms = result.searchTerms || result.topic || query;
      const location = result.location || result.unit || "Polska";

      addStep(`🤖 Intent: ${result.intent} | Location: ${location} | Terms: ${searchTerms} | Scope: ${result.scope || "single_unit"}`);

      if (result.years && result.years.length > 0) {
        setTargetYears(result.years);
      }

      // 2. Locate (Unit Search)
      addStep(`🗺️ Locating "${location}"...`);
      const unitRes = await gusClient.searchUnits(location);
      const units = unitRes?.results || [];

      if (units.length === 0) {
        throw new Error(`Could not find unit "${location}" in GUS.`);
      }

      // Set candidates and pick the best one for Level context
      setCandidateUnits(units);
      const bestUnit = units[0]; // Heuristic: Top result is usually best
      setSelectedUnitId(bestUnit.id);
      addStep(`📍 Found ${bestUnit.name} (Level ${bestUnit.level})`);

      // Determine Target Level for Variable Search
      // If Scope is MULTI_UNIT, we look for variables for the CHILD unit level (e.g. gmina level 5)
      // If Scope is SINGLE_UNIT, we look for variables for the PARENT unit level (e.g. woj level 2)
      let searchLevel = bestUnit.level;
      if (result.scope === 'multi_unit') {
        const targetLevel = getLevelFromUnitType(result.targetUnitType);
        addStep(`🔄 Multi-Unit Scope: Switching variable search to Level ${targetLevel} (${result.targetUnitType}).`);
        searchLevel = targetLevel;
      }

      // 3. Search Variables (Strict Level Filtering)
      addStep(`🔎 Searching variables for "${searchTerms}" (Level ${searchLevel})...`);
      const varRes = await gusClient.searchVariables(searchTerms, searchLevel);
      const initialVars = varRes?.results || [];

      if (initialVars.length === 0) {
        addStep(`⚠️ No variables found for "${searchTerms}" at Level ${searchLevel}. Try manual search.`);
        setCandidateVars([]);
      } else {
        // 4. AI Re-Ranking (Contextual Filter)
        addStep(`🧠 AI Ranking ${initialVars.length} candidates...`);
        const rankedVars = await aiProcessor.reRankVariables(query, initialVars);
        setCandidateVars(rankedVars);
        addStep(`✅ Selected TOP ${rankedVars.length} relevant variables.`);

        // Auto-select top 3
        setSelectedVarIds(rankedVars.slice(0, 3).map((v: any) => v.id));
      }

      setStage('CONFIGURATION');

    } catch (error: any) {
      console.error("Workflow Failed", error);
      addStep(`❌ Error: ${error.message || "Unknown error"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- STAGE 2 ACTIONS: SEARCH MORE ---
  const handleSearchMoreUnits = async () => {
    if (!unitSearchInput.trim()) return;
    setIsProcessing(true);
    try {
      const res = await gusClient.searchUnits(unitSearchInput);
      const newUnits = res?.results || [];

      // Merge unique units
      setCandidateUnits(prev => {
        const existingIds = new Set(prev.map(u => u.id));
        const uniqueNew = newUnits.filter((u: any) => !existingIds.has(u.id));
        return [...prev, ...uniqueNew];
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
      setUnitSearchInput("");
    }
  };

  const handleSearchMoreVars = async () => {
    if (!varSearchInput.trim()) return;
    setIsProcessing(true);
    try {
      // Get search level logic
      let searchLevel: number | undefined;

      if (analysis?.scope === 'multi_unit') {
         searchLevel = getLevelFromUnitType(analysis.targetUnitType);
      } else {
         const selectedUnit = candidateUnits.find(u => u.id === selectedUnitId);
         searchLevel = selectedUnit?.level;
      }

      const res = await gusClient.searchVariables(varSearchInput, searchLevel);
      const newVars = res?.results || [];

      if (newVars.length === 0) {
        alert(searchLevel ? `No variables found for "${varSearchInput}" at level ${searchLevel}.` : "No variables found.");
      }

      // Merge unique vars
      setCandidateVars(prev => {
        const existingIds = new Set(prev.map(v => v.id));
        const uniqueNew = newVars.filter((v: any) => !existingIds.has(v.id));
        return [...prev, ...uniqueNew];
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
      setVarSearchInput("");
    }
  };


  // --- STAGE 3: FETCH & PREVIEW ---
  const handleProceedToGrid = async () => {
    if (!selectedUnitId) {
      alert("Please select a Unit.");
      return;
    }
    if (selectedVarIds.length === 0) {
      alert("Please select at least one Variable.");
      return;
    }

    setIsProcessing(true);
    const unitName = candidateUnits.find(u => u.id === selectedUnitId)?.name || selectedUnitId;

    // Determine Fetch Strategy
    const isMultiUnit = analysis?.scope === 'multi_unit';

    addStep(`🚀 Fetching data for ${unitName} (${selectedVarIds.length} variables)... [Mode: ${isMultiUnit ? 'Multi-Unit' : 'Single-Unit'}]`);

    try {
      if (isMultiUnit) {
         // --- MULTI UNIT STRATEGY ---
         const targetLevel = getLevelFromUnitType(analysis?.targetUnitType);

         // Helper to fetch variable data for children
         // Note: GUS API '/data/by-variable/{id}' accepts unit-parent-id and unit-level
         // It returns results[] where each item is a UnitData

         // We need to fetch data for EACH selected variable
         const fetchPromises = selectedVarIds.map(async (varId) => {
             const res = await gusClient.getVariableData(varId, targetLevel, targetYears, selectedUnitId);
             // Response contains .results (list of UnitData)
             // We need to tag these results with varId because the raw UnitData doesn't have it easily accessible?
             // Actually getVariableData response (SingleVariableData) has 'variableId'.
             // But wait, gus-client.getVariableData returns GusResponse<any>.
             // Let's assume the standard structure.
             return { varId, data: res?.results }; // results is UnitData[]
         });

         const allResults = await Promise.all(fetchPromises);

         // Now we need to restructure this for DataDisplay.
         // DataDisplay (Multi-Mode) expects an array of Units, each having a list of values (Variables).
         // The fetched structure: List of Variables, each having a list of Units.
         // We need to PIVOT.

         const unitMap = new Map<string, any>(); // id -> { id, name, values: [] }

         allResults.forEach(({ varId, data }) => {
            if (!data) return;
            // data is UnitData[]: { id, name, values: [ {year, val} ] }
            (data as any[]).forEach((unitItem: any) => {
                if (!unitMap.has(unitItem.id)) {
                    unitMap.set(unitItem.id, {
                        id: unitItem.id,
                        name: unitItem.name,
                        values: []
                    });
                }

                const unitEntry = unitMap.get(unitItem.id);
                // Add variable values to this unit
                // We should tag them with variableId
                const enrichedValues = (unitItem.values || []).map((val: any) => ({
                    ...val,
                    variableId: varId
                }));

                unitEntry.values.push(...enrichedValues);
            });
         });

         const unifiedData = Array.from(unitMap.values());

         if (unifiedData.length > 0) {
             console.log("[DEBUG] Stage 3 Multi-Unit Response:", unifiedData);
             setData(unifiedData);
             setStage('GRID_PREVIEW');
             addStep(`👀 Generating Multi-Unit Data Grid Preview...`);
         } else {
             alert(`No child units found with data.`);
             addStep(`⚠️ No data found.`);
         }

      } else {
          // --- SINGLE UNIT STRATEGY (Legacy) ---
          const response = await gusClient.getUnitData(selectedUnitId, selectedVarIds, targetYears);

          if (response?.results && response.results.length > 0) {
            console.log("[DEBUG] Stage 3 Response:", response.results);
            setData(response.results);
            setStage('GRID_PREVIEW');
            addStep(`👀 Generating Data Grid Preview...`);
          } else {
            alert(`No data found for these variables in ${unitName}.\n\nTry selecting DIFFERENT variables that match the unit's administrative level.`);
            addStep(`⚠️ No data found. Please adjust variables.`);
          }
      }

    } catch (e: any) {
      addStep(`❌ Fetch Error: ${e.message}`);
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- STAGE 4: FINAL CONFIRMATION ---
  const handleFinalFetch = async () => {
    setStage('DONE');
    addStep(`🎉 Workflow Complete!`);
  };

  const toggleVariable = (id: number) => {
    setSelectedVarIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  return (
    <main className="min-h-screen bg-[#121212] text-white p-8 font-sans selection:bg-purple-500/30">
      <div className="max-w-7xl mx-auto pt-10">
        <header className="text-center mb-12 border-b border-white/10 pb-8">
          <div className="inline-block px-3 py-1 bg-white/5 rounded-full text-xs text-blue-300 mb-4 border border-white/10">
            API SDP Explorer v4.0 (AI Re-Rank)
          </div>
          <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 tracking-tight">
            Data Explorer
          </h1>
        </header>

        {/* SEARCH FORM (Stage 0) */}
        <SearchForm onSearch={handleSearch} isLoading={isProcessing} />

        {/* WORKFLOW LOGS */}
        {workflowSteps.length > 0 && (
          <div className="w-full max-w-2xl mx-auto mt-4 mb-8 bg-black/50 p-4 rounded-xl border border-white/10 font-mono text-sm space-y-1">
            {workflowSteps.map((step, i) => (
              <div key={i} className="text-gray-300">{step}</div>
            ))}
          </div>
        )}

        {/* STAGE 2: UNIFIED CONFIGURATION UI */}
        {stage === 'CONFIGURATION' && (
          <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">

            {/* LEFT: UNITS */}
            <div className="bg-[#1E1E1E] p-6 rounded-xl border border-white/10 flex flex-col h-[600px]">
              <h2 className="text-xl font-bold mb-4 text-purple-300 flex items-center gap-2">
                <span>1. Select Unit</span>
                <span className="text-xs bg-purple-500/20 px-2 py-1 rounded text-purple-400 font-normal">Single Select</span>
              </h2>

              {/* Add Unit Input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={unitSearchInput}
                  onChange={(e) => setUnitSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchMoreUnits()}
                  placeholder="Find more units..."
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                />
                <button onClick={handleSearchMoreUnits} className="px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20">Search</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {candidateUnits.map(u => (
                  <div key={u.id} onClick={() => setSelectedUnitId(u.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${selectedUnitId === u.id ? 'bg-purple-900/20 border-purple-500' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                    <span className="text-sm text-gray-200">{u.name} (Lvl {u.level})</span>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedUnitId === u.id ? 'border-purple-500' : 'border-gray-600'}`}>
                      {selectedUnitId === u.id && <div className="w-2 h-2 rounded-full bg-purple-500"></div>}
                    </div>
                  </div>
                ))}
                {candidateUnits.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No units found.</p>}
              </div>
            </div>

            {/* RIGHT: VARIABLES */}
            <div className="bg-[#1E1E1E] p-6 rounded-xl border border-white/10 flex flex-col h-[600px]">
              <h2 className="text-xl font-bold mb-4 text-blue-300 flex items-center gap-2">
                <span>2. Select Variables</span>
                <span className="text-xs bg-blue-500/20 px-2 py-1 rounded text-blue-400 font-normal">Multi Select ({selectedVarIds.length})</span>
              </h2>

              {/* Add Var Input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={varSearchInput}
                  onChange={(e) => setVarSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchMoreVars()}
                  placeholder="Find more variables..."
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <button onClick={handleSearchMoreVars} className="px-3 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20">Search</button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {candidateVars.map(v => (
                  <div key={v.id} onClick={() => toggleVariable(v.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-white/10 flex items-start gap-3 ${selectedVarIds.includes(v.id) ? 'bg-blue-900/10 border-blue-500/50' : 'bg-white/5 border-transparent'}`}>
                    <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${selectedVarIds.includes(v.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                      {selectedVarIds.includes(v.id) && <span className="text-xs text-white">✓</span>}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-200">{v.n1}</div>
                      <div className="text-xs text-gray-500 mt-1">{[v.n2, v.n3].filter(Boolean).join(" • ")}</div>
                    </div>
                  </div>
                ))}
                {candidateVars.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No variables found.</p>}
              </div>

              <div className="data-[t] pt-6 mt-4 border-t border-white/10">
                <button onClick={handleProceedToGrid}
                  disabled={!selectedUnitId || selectedVarIds.length === 0}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg">
                  Generate Report &rarr;
                </button>
              </div>
            </div>

          </div>
        )}

        {/* FINAL STAGE: DATA DISPLAY */}
        {(stage === 'GRID_PREVIEW' || stage === 'DONE') && (
          <DataDisplay
            analysis={analysis}
            data={data}
            candidateVars={candidateVars} // Need to pass this to resolve var names in multi-unit mode
            onConfirm={handleFinalFetch}
            isFetchingObject={isProcessing}
            metaMap={{}}
          />
        )}
      </div>
    </main>
  );
}
