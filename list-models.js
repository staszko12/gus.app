const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// Read API key from .env.local
const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const apiKeyMatch = envContent.match(/NEXT_PUBLIC_GEMINI_API_KEY=(.+)/);
const API_KEY = apiKeyMatch ? apiKeyMatch[1].trim() : '';

const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
    try {
        const models = await genAI.listModels();

        console.log("\n=== Available Models ===\n");

        for await (const model of models) {
            console.log(`Model: ${model.name}`);
            console.log(`  Display Name: ${model.displayName}`);
            console.log(`  Description: ${model.description}`);
            console.log(`  Supported Methods: ${model.supportedGenerationMethods?.join(', ')}`);
            console.log('---');
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
