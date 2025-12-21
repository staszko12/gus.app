import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export interface AIQueryAnalysis {
    intent: string;
    topic?: string;
    searchTerms?: string; // Enhanced: specific terms for variable search
    unit?: string;
    location?: string; // Enhanced: specific location name
    years?: number[]; // Added to support multi-year analysis
    explanation: string;
}

export class AiProcessor {
    async analyzeQuery(query: string): Promise<AIQueryAnalysis> {
        if (!API_KEY) {
            throw new Error("Gemini API Key is missing");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }, { apiVersion: "v1" });

        const prompt = `
      You are an expert data assistant for the Polish GUS SDP API.
      User Query: "${query}"

      Your goal is to extract technical search parameters:
      1. intent: "data_request" (default) or "regional_analysis".
      2. searchTerms: The specific statistical keyword to search for variables (e.g., "stopa bezrobocia", "dochody", "ludność"). Avoid generic words.
      3. location: The specific geographic unit name (e.g., "Poznań", "Warszawa").
      4. years: An array of target years (e.g., [2021, 2022, 2023]). If "last 3 years" is asked, calculate from 2024.

      Respond purely in JSON format:
      {
        "intent": "string",
        "searchTerms": "string",
        "location": "string",
        "years": [number],
        "explanation": "brief reasoning"
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
        return {
            intent: "data_request",
            searchTerms: "Ludność",
            topic: "Ludność",
            location: "Polska",
            unit: "Polska",
            years: [2023],
            explanation: "Fallback: AI API Unreachable."
        };
    }
}
