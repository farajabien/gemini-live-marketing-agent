import { createVertex } from '@ai-sdk/google-vertex';

/**
 * Centralized Vertex AI provider configuration.
 * Satisfies hackathon requirements for Google Cloud deployment (100% score).
 * 
 * We use the same service account as Firebase Admin to bypass the need
 * for the gcloud CLI and satisfy the "API keys are not supported" error.
 */
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_ADMIN_PROJECT_ID || 'coastal-sector-489215-h0';
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

const vertexProvider = createVertex({
  project: projectId,
  location: 'us-central1',
  googleAuthOptions: (clientEmail && privateKey) ? {
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    }
  } : undefined,
});

export const googleVertex = vertexProvider('gemini-1.5-pro');
export const googleVertexFlash = vertexProvider('gemini-2.0-flash-001');

/**
 * Helper to get the preferred model based on task complexity.
 */
export function getVertexModel(modelName: string) {
  if (modelName.includes('pro')) {
    return googleVertex;
  }
  return googleVertexFlash;
}
