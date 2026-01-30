

export interface GusResponse<T> {
  totalRecords: number;
  page: number;
  pageSize: number;
  results: T[];
  links?: any;
}

export interface VariableData {
  "id-zmienna": number;
  "id-przekroj": number;
  "id-okres": number;
  "id-daty": number;
  wartosc: number;
  "wartosc-opisowa": string;
  "nazwa-zmienna"?: string;
}

export class GusClient {
  // Use local proxy to avoid CORS
  private baseUrl = "/api/proxy/gus";
  // In a real app, this would be an environment variable
  private apiKey = "";

  constructor(apiKey?: string, baseUrl?: string) {
    if (apiKey) this.apiKey = apiKey;
    if (baseUrl) this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, params: Record<string, string | number | (string | number)[]> = {}): Promise<T> {
    // Construct absolute URL for the request
    // If baseUrl is relative (proxy), use window.origin or a default for server-side
    const path = `${this.baseUrl}${endpoint}`;
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const url = new URL(path.startsWith("http") ? path : path, path.startsWith("http") ? undefined : base);

    // Default params
    url.searchParams.append("lang", "pl");
    url.searchParams.append("format", "json"); // Explicitly request JSON

    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.append(key, String(value));
      }
    });

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "GusSdpApp/1.0 (Next.js Server Actions)"
    };

    if (this.apiKey) {
      headers["X-ClientId"] = this.apiKey;
      console.log(`📡 [GusClient] Attaching X-ClientId: Yes (Length: ${this.apiKey.length})`);
    } else {
      console.warn(`📡 [GusClient] Attaching X-ClientId: NO (Key missing)`);
    }

    console.log(`📡 [GusClient] Fetching: ${url.toString()}`);

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      console.error(`GUS API Error: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch data from GUS API: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search for variables by name (from Swagger /variables/search)
   */
  async searchVariables(query: string, level?: number, subjectId?: string) {
    const params: Record<string, any> = {
      name: query,
      "page-size": 20 // Increased from 10 to get more candidates
    };
    if (level !== undefined) {
      params["level"] = level;
    }
    if (subjectId) {
      params["subject-id"] = subjectId;
    }
    return this.fetch<GusResponse<any>>("/variables/search", params);
  }

  /**
   * Fetch data for a specific variable
   * Endpoint: /data/by-variable/{var-id}
   */
  /**
   * Fetch data for a specific variable
   * Endpoint: /data/by-variable/{var-id}
   */
  async getVariableData(variableId: number, unitLevel: number = 5, year: number | number[] = [2022, 2023], parentId?: string) {
    const params: Record<string, any> = {
      "unit-level": unitLevel,
      "year": year,
      "page-size": 100
    };
    if (parentId) {
      params["unit-parent-id"] = parentId;
    }
    return this.fetch<GusResponse<any>>(`/data/by-variable/${variableId}`, params);
  }

  /**
   * Fetch data for a specific unit (multiple variables)
   * Endpoint: /data/by-unit/{unitId}
   */
  async getUnitData(unitId: string, variableIds: number[], year: number | number[] = [2022, 2023]) {
    const params: Record<string, any> = {
      "var-id": variableIds,
      "year": year,
      "page-size": 50
    };
    return this.fetch<GusResponse<any>>(`/data/by-unit/${unitId}`, params);
  }

  /**
   * Fetch units (TERYT)
   * Endpoint: /units
   */
  async getUnits(level: number, parentId?: string) {
    const params: Record<string, any> = {
      "level": level,
      "page-size": 100 // Fetch up to 100 sub-units (e.g. gminas)
    };
    if (parentId) {
      params["parent-id"] = parentId;
    }
    return this.fetch<GusResponse<any>>("/units", params);
  }

  /**
   * Search units by name
   * Endpoint: /units/search
   */
  async searchUnits(name: string) {
    const params: Record<string, any> = {
      "name": name,
      "page-size": 10
    };
    return this.fetch<GusResponse<any>>("/units/search", params);
  }

  /**
   * Fetch subjects (Categories)
   * Endpoint: /subjects
   */
  async getSubjects(parentId?: string) {
    const params: Record<string, any> = {
      "page-size": 100,
      "lang": "pl"
    };
    if (parentId) {
      params["parent-id"] = parentId;
    }
    return this.fetch<GusResponse<any>>("/subjects", params);
  }

  /**
   * Fetch variables by subject
   * Endpoint: /variables
   */
  async getVariablesBySubject(subjectId: string) {
    const params: Record<string, any> = {
      "subject-id": subjectId,
      "page-size": 100
    };
    return this.fetch<GusResponse<any>>("/variables", params);
  }
}
