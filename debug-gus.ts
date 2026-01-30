
import { GusClient } from "./services/gus-client";
import * as fs from 'fs';
import * as path from 'path';

function getEnvKey() {
    try {
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (line.startsWith('GUS_API_KEY=')) return line.split('=')[1].trim();
                if (line.startsWith('NEXT_PUBLIC_GUS_CLIENT_ID=')) return line.split('=')[1].trim();
            }
        }
    } catch (e) {
        console.error("Error reading .env.local", e);
    }
    return process.env.GUS_API_KEY || "";
}

const gusKey = getEnvKey();


async function debug() {
    console.log("--- DEBUG START ---");
    const client = new GusClient(gusKey, "https://bdl.stat.gov.pl/api/v1");

    // 1. Fetch Podkarpackie to get ID
    console.log("\n1. Searching for Podkarpackie...");
    const searchRes = await client.searchUnits("PODKARPACKIE");
    const podkarpackie = searchRes.results.find(u => u.level === 2);

    if (!podkarpackie) {
        console.error("Podkarpackie not found!");
        return;
    }
    console.log("Podkarpackie ID:", podkarpackie.id, "Level:", podkarpackie.level);

    // 2. Fetch Gminas directly (Level 5)
    console.log("\n2. Direct Fetch Level 5 for Podkarpackie...");
    const directRes = await client.getUnits(5, podkarpackie.id);
    console.log(`Direct Fetch Count: ${directRes.results ? directRes.results.length : 0}`);
    if (directRes.results && directRes.results.length > 0) {
        console.log("Sample Direct Item:", JSON.stringify(directRes.results[0], null, 2));
    }

    // 3. Fetch Powiats (Level 4)
    console.log("\n3. Fetch Level 4 (Powiats)...");
    const powiatRes = await client.getUnits(4, podkarpackie.id);
    console.log(`Powiat Count: ${powiatRes.results ? powiatRes.results.length : 0}`);

    if (powiatRes.results && powiatRes.results.length > 0) {
        const firstPowiat = powiatRes.results[0];
        console.log("Sample Powiat:", JSON.stringify(firstPowiat, null, 2));


        // 4. Drill down from first Powiat to Gminas (Level 6)
        console.log(`\n4. Driling from Level 5 ${firstPowiat.name} (${firstPowiat.id}) to Level 6...`);
        // Wait, 'firstPowiat' in output was Level 4. 
        // We want to drill from Level 5 item. 
        // In Step 4 of the script (line 58 orig), I was drilling from 'firstPowiat' which was Level 4.

        // Let's use the Direct Fetch Level 5 item (which is a Powiat) to drill to Level 6.
        if (directRes.results && directRes.results.length > 0) {
            const level5Unit = directRes.results[0];
            console.log(`\n4. Drilling from Level 5 Unit: ${level5Unit.name} (${level5Unit.id}) to Level 6...`);

            const level6Res = await client.getUnits(6, level5Unit.id);
            console.log(`Level 6 Count: ${level6Res.results ? level6Res.results.length : 0}`);
            if (level6Res.results && level6Res.results.length > 0) {
                console.log("Sample Level 6 Unit:", JSON.stringify(level6Res.results[0], null, 2));
            } else {
                console.log("No Level 6 units found for this Level 5 unit.");
            }
        }
    }
    console.log("--- DEBUG END ---");
}

debug();
