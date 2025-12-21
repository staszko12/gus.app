export interface GusXmlData {
    unit: {
        id: string;
        name: string;
        level?: number;
    };
    variables: {
        id: number;
        name: string;
        n1: string; // The hierarchical name parts from GUS API
        n2?: string;
        n3?: string;
        n4?: string;
        n5?: string;
        measureUnit: string;
    }[];
    results: any[]; // The raw response.results from getUnitData
}

export function generateGusXml(data: GusXmlData): string {
    const timestamp = new Date().toISOString();

    // Map variables specifically
    const variablesBlock = data.variables.map(v => {
        // Construct full name if needed, or use the parts
        return `    <Variable id="${v.id}">
      <Name>${escapeXml(v.n1)}</Name>
      <MeasureUnit>${escapeXml(v.measureUnit)}</MeasureUnit>
    </Variable>`;
    }).join("\n");

    // Map Results
    let resultsBlock = "";

    // The "results" array from getUnitData is an array of VariableData for the requested unit.
    // However, the input `results` here is likely exactly what we stored in `data`, which is an array of objects
    // where each object represents a VARIABLE's data sequence for that unit.

    // Schema: <Results> <Record varId="" year=""> ... 

    resultsBlock = data.results.map(variableResult => {
        const varId = variableResult.id;

        // Iterate over values (YearValue[])
        return (variableResult.values || []).map((val: any) => {
            const value = val.value ?? val.val;
            const attrId = val.attrId ?? val["attr-id"];

            let record = `    <Record varId="${varId}" year="${val.year}">\n`;
            record += `      <Value>${value}</Value>\n`;
            if (attrId !== undefined) {
                record += `      <AttributeId>${attrId}</AttributeId>\n`;
            }
            record += `    </Record>`;
            return record;
        }).join("\n");
    }).join("\n");


    return `<?xml version="1.0" encoding="UTF-8"?>
<GusData>
  <Metadata>
    <UnitId>${data.unit.id}</UnitId>
    <UnitName>${escapeXml(data.unit.name)}</UnitName>
    <LastUpdate>${timestamp}</LastUpdate>
    <Provider>Główny Urząd Statystyczny - BDL</Provider>
  </Metadata>

  <Variables>
${variablesBlock}
  </Variables>

  <Results>
${resultsBlock}
  </Results>
</GusData>`;
}

function escapeXml(unsafe: string): string {
    if (!unsafe) return "";
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
        return c;
    });
}
