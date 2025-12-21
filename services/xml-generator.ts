export interface GusXmlData {
    scope: 'single_unit' | 'multi_unit';
    unit: {
        id: string;
        name: string;
        level?: number;
    };
    variables: {
        id: number;
        name: string;
        n1: string;
        n2?: string;
        n3?: string;
        n4?: string;
        n5?: string;
        measureUnit: string;
    }[];
    // For single_unit: results contains Variable objects with values for that unit.
    // For multi_unit: results is an array of Units, each containing values for variables.
    // To keep it generic, we can stick to 'any[]' but define structure logic in generator.
    results: any[];
}

export function generateGusXml(data: GusXmlData): string {
    const timestamp = new Date().toISOString();

    // Map variables
    const variablesBlock = data.variables.map(v => {
        return `    <Variable id="${v.id}">
      <Name>${escapeXml(v.n1)}</Name>
      <MeasureUnit>${escapeXml(v.measureUnit)}</MeasureUnit>
    </Variable>`;
    }).join("\n");

    let resultsBlock = "";

    if (data.scope === 'multi_unit') {
        // Multi-Unit Logic
        // data.results is expected to be an array of Units
        // Each Unit object: { id, name, values: [ { variableId, year, value } ] }
        // Wait, how do we structure the passed 'results'?
        // The most flexible way: Pass an array of Units. Each Unit has a list of Records.

        resultsBlock = data.results.map((unit: any) => {
            const unitBlock = `    <Unit id="${unit.id}" name="${escapeXml(unit.name)}">`;
            const records = (unit.values || []).map((val: any) => {
                let record = `      <Record varId="${val.variableId}" year="${val.year}">\n`;
                record += `        <Value>${val.value}</Value>\n`;
                if (val.attrId !== undefined) {
                    record += `        <AttributeId>${val.attrId}</AttributeId>\n`;
                }
                record += `      </Record>`;
                return record;
            }).join("\n");
            return `${unitBlock}\n${records}\n    </Unit>`;
        }).join("\n");

    } else {
        // Single-Unit Logic (Legacy)
        // data.results is array of Variables, each with values
        resultsBlock = data.results.map(variableResult => {
            const varId = variableResult.id;
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
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<GusData>
  <Metadata>
    <Scope>${data.scope}</Scope>
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
