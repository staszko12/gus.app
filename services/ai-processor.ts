import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface AIQueryAnalysis {
    intent: string;
    topic?: string;
    searchTerms?: string; // Enhanced: specific terms for variable search
    unit?: string;
    location?: string; // Enhanced: specific location name
    years?: number[]; // Added to support multi-year analysis
    scope?: 'single_unit' | 'multi_unit';
    targetUnitType?: string; // e.g., 'gmina', 'powiat'
    explanation: string;
}

export class AiProcessor {
    async analyzeQuery(query: string): Promise<AIQueryAnalysis> {
        if (!API_KEY) {
            // throw new Error("Gemini API Key is missing");
            console.warn("Gemini API Key is missing. Using Fallback.");
            return this.getFallbackAnalysis(query);
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1" });

        const prompt = `
      Role: You are an expert Data Engineer specializing in the Polish GUS (Statistics Poland) BDL API. 
      Your goal is to translate natural language into technical search parameters that the system will use to call the API.

      Reference Knowledge:
      Variable Search: https://bdl.stat.gov.pl/api/v1/variables/search?name={keyword}
      Data Endpoint: https://bdl.stat.gov.pl/api/v1/data/by-variable/{variableId}?unit-level={level}
      Unit Search: https://bdl.stat.gov.pl/api/v1/units/search?name={cityName}

      Protocol:
      1. Identify Keywords: Extract the main statistical topic (e.g., "unemployment") and the location (e.g., "Kraków").
      2. Translate: If keywords are in English, translate them to Polish (e.g., "unemployment" -> "bezrobocie").
      3. Determine Search Term: Choose the best single Polish keyword to query the variables endpoint.

      User Query: "${query}"

      Output Format:
      Respond purely in JSON format with the following structure (do not include markdown code blocks):
      {
        "intent": "data_request" or "regional_analysis",
        "searchTerms": "The translated Polish keyword for variable search (e.g. 'bezrobocie')",
        "location": "The specific geographic unit name (e.g. 'Warszawa')",
        "years": [2023],
        "scope": "single_unit" or "multi_unit",
        "targetUnitType": "gmina", "powiat", or "województwo",
        "explanation": "Brief reasoning: Search Query Used [...]"
      }
    `;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            // Clean up json in case of markdown wrapping
            const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(jsonStr);

            // Backwards compatibility mappings if needed
            return {
                ...parsed,
                topic: parsed.searchTerms || parsed.topic,
                unit: parsed.location || parsed.unit
            };
        } catch (error) {
            console.error("AI Generation Error", error);
            // Fallback for Demo/Review
            console.warn("Falling back to Rule-Based logic due to AI error.");
            return this.getFallbackAnalysis(query);
        }
    }

    /**
     * Re-Ranking Step:
     * Takes the User's Query and a list of Technical Candidates from GUS API.
     * Returns the subset of candidates that best match the query.
     */
    async reRankVariables(query: string, candidates: any[]): Promise<any[]> {
        if (!candidates || candidates.length === 0) return [];
        if (!API_KEY) return candidates.slice(0, 10); // Fallback: return top 10

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1" });

        // Prepare simplified list for token efficiency
        const candidateList = candidates.map((c, i) =>
            `ID: ${c.id}, Name: ${c.n1} ${c.n2 ? '- ' + c.n2 : ''}`
        ).join("\n");

        const prompt = `
             User Query: "${query}"
             
             I have retrieved the following variables from the database. 
             Select the top 6 variables that are most semantically relevant to the user's query.
             Return ONLY a JSON array of their IDs.
             
             Candidates:
             ${candidateList}
             
             Response Format (JSON Only):
             [123, 456, 789]
           `;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const selectedIds: number[] = JSON.parse(jsonStr);

            // Filter original list
            const filtered = candidates.filter(c => selectedIds.includes(c.id));
            return filtered.length > 0 ? filtered : candidates.slice(0, 6); // Fallback if AI hallucinates known IDs
        } catch (e) {
            console.error("Re-ranking failed", e);
            return candidates.slice(0, 10); // Fail-safe
        }
    }

    private getFallbackAnalysis(query: string): AIQueryAnalysis {
        const isMulti = query.toLowerCase().includes("gmin") || query.toLowerCase().includes("powiat");

        // Simple heuristic: use the whole query or first noun as search term
        // Ideally we just pass the query.
        return {
            intent: "data_request",
            searchTerms: query, // Use the query itself as fallback
            topic: query,
            location: "Polska", // Default to Polska
            unit: "Polska",
            years: [2023],
            scope: isMulti ? "multi_unit" : "single_unit",
            targetUnitType: isMulti ? "gmina" : undefined,
            explanation: "Fallback: AI API Unreachable. Used original query."
        };
    }
}

export function getLevelFromUnitType(type?: string): number {
    if (!type) return 5; // Default to gmina? Or undefined.
    const t = type.toLowerCase();
    if (t.includes("wojew")) return 2;
    if (t.includes("powiat")) return 4;
    if (t.includes("gmin")) return 5;
    return 5;
}
