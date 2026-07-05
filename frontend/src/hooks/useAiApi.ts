import { useCallback } from "react";

// backend default port is 3001 (see backend/src/config/env.ts)
// override by creating frontend/.env with VITE_API_BASE_URL if needed
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export type RewriteMode = "comedy" | "formal" | "casual";

interface AiTextInput {
  // We always send the live editor text rather than noteId, so AI actions
  // reflect unsaved edits too (backend prioritizes noteId's saved content
  // over `text` when both are sent - see backend/src/services/ai.service.ts).
  text: string;
}

async function callAi(
  path: "summarize" | "rewrite" | "translate",
  body: Record<string, unknown>,
  token: string | null
): Promise<string | null> {
  if (!token) {
    console.error("No token found");
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      console.error(`AI ${path} error: ${response.status}`, errorBody);
      return null;
    }

    const data = await response.json();
    return typeof data?.result === "string" ? data.result : null;
  } catch (error) {
    console.error(`Network error calling AI ${path}:`, error);
    return null;
  }
}

function useAiApi() {
  const summarize = useCallback(async ({ text }: AiTextInput, token: string | null) => {
    return callAi("summarize", { text }, token);
  }, []);

  const rewrite = useCallback(
    async ({ text }: AiTextInput, mode: RewriteMode, token: string | null) => {
      return callAi("rewrite", { text, mode }, token);
    },
    []
  );

  const translate = useCallback(async ({ text }: AiTextInput, token: string | null) => {
    return callAi("translate", { text }, token);
  }, []);

  return { summarize, rewrite, translate };
}

export default useAiApi;
