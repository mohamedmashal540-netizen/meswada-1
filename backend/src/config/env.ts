import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  // Supports a comma-separated list, e.g. "https://app.com,https://staging.app.com"
  frontendOrigins: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  clerk: {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
    secretKey: process.env.CLERK_SECRET_KEY || '',
  },
  sqlitePath: process.env.SQLITE_PATH || path.join(__dirname, '../../data/maswada.db'),
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    organization: process.env.OPENAI_ORGANIZATION_ID || '',
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
  },
  // Secondary, OpenAI-compatible AI provider used when the primary
  // (OpenAI) fails or is out of quota. Groq/OpenRouter/Cerebras all
  // expose an OpenAI-compatible /chat/completions endpoint, so this
  // is just a different apiKey + baseURL + model — no SDK change.
  aiFallback: {
    apiKey: process.env.AI_FALLBACK_API_KEY || '',
    baseURL: process.env.AI_FALLBACK_BASE_URL || 'https://api.groq.com/openai/v1',
    model: process.env.AI_FALLBACK_MODEL || 'llama-3.3-70b-versatile',
  },
};

// Validate required config
if (!config.clerk.secretKey && config.nodeEnv !== 'test') {
  console.warn('⚠️  CLERK_SECRET_KEY is not set. Authentication will fail.');
}
if (!config.clerk.publishableKey && config.nodeEnv !== 'test') {
  console.warn('⚠️  CLERK_PUBLISHABLE_KEY is not set.');
}
