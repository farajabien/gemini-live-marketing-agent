
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  console.log('Using API Key (last 4):', apiKey?.slice(-4));

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log('Available Models:');
    if (data.models) {
      data.models.forEach((m: any) => console.log(` - ${m.name} (supports: ${m.supportedGenerationMethods})`));
    } else {
      console.log('No models returned:', data);
    }
  } catch (err) {
    console.error('Error listing models:', err);
  }
}

listModels();
