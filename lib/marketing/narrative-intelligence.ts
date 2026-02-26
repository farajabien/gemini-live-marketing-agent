import { generateText } from "@/lib/ai/gemini-client";

// === Types ===

export interface NarrativeInput {
  audience: string;
  currentState: string;
  problem: string;
  costOfInaction: string;
  solution: string;
  afterState: string;
  identityShift: string;
  voice: string;
}

export interface SeriesNarrativeInput {
  genre: string;
  worldSetting: string;
  conflictType: string;
  protagonistArchetype: string;
  centralTheme: string;
  narrativeTone: string;
  visualStyle: string;
  episodeHooks: string;
}


export interface ExtractedPositioning {
  villain: string; // The real enemy (not a person, but a force/state)
  hero: string; // Who the customer becomes
  stakes: string; // What happens if they don't change
  promise: string; // The transformation you enable
  mechanism: string; // Your unique approach
  contrast: {
    before: string; // Current painful state
    after: string; // Desired transformed state
  };
  title: string; // A concise, punchy title for this strategy
  cost: number;
}


export interface ContentAngles {
  painAngles: string[]; // Ways to frame the problem
  costAngles: string[]; // Ways to frame the cost of inaction
  mechanismAngles: string[]; // Ways to frame your solution
  identityAngles: string[]; // Ways to frame the identity shift
  outcomeAngles: string[]; // Ways to frame the after-state
  cost: number;
}


export interface NarrativeStrength {
  specificityScore: number; // 0-100: How specific is the audience/problem?
  emotionalClarity: number; // 0-100: How clear is the emotional pain/relief?
  tensionStrength: number; // 0-100: How strong is the before/after contrast?
  contrastScore: number; // 0-100: How vivid is the transformation?
  overallScore: number; // 0-100: Weighted average
  cost: number;
}


// === AI Extraction Functions ===

export async function extractPositioning(input: NarrativeInput): Promise<ExtractedPositioning> {
  const prompt = `
You are a strategic narrative analyst. Extract the core positioning elements from this narrative.

INPUTS:
- Audience: ${input.audience}
- Current State: ${input.currentState}
- Problem: ${input.problem}
- Cost of Inaction: ${input.costOfInaction}
- Solution: ${input.solution}
- After State: ${input.afterState}
- Identity Shift: ${input.identityShift}
- Voice: ${input.voice}

OUTPUT JSON ONLY:
{
  "villain": "The real enemy (systemic force, not a person). Example: 'Manual chaos' not 'bad software'",
  "hero": "Who they become after transformation. Example: 'Confident operator with full visibility'",
  "stakes": "Concrete consequences if nothing changes. Example: 'Lost revenue, staff burnout, inability to scale'",
  "promise": "The core transformation in one sentence. Example: 'From reactive shop owner to confident business operator'",
  "mechanism": "Your unique approach (not feature list). Example: 'Centralized real-time order tracking system'",
  "contrast": {
    "before": "Vivid description of current painful state",
    "after": "Vivid description of transformed state"
  },
  "title": "A punchy 3-5 word title for this strategy (e.g. 'The Solopreneur's Marketing Edge')"
}

Be specific. Be concrete. Extract from the inputs provided. Ensure all fields are populated with specific strategic insights based on the brand's unique approach and audience.
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a narrative strategist. Output JSON only.",
    "gpt-4o",
    0.6
  );

  return { ...parsePositioning(response), cost };
}


function parsePositioning(response: string): ExtractedPositioning {


  console.log("[Narrative Intelligence] Raw positioning response:", response);

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);
    console.log("[Narrative Intelligence] Parsed positioning:", JSON.stringify(result, null, 2));
    return result;
  } catch (e) {
    console.error("Failed to parse positioning. Raw response:", response);
    console.error("Error details:", e);
    throw new Error("Failed to extract positioning from narrative");
  }
}

export async function extractContentAngles(input: NarrativeInput): Promise<ContentAngles & { cost: number }> {

  const prompt = `
You are a content strategist. Generate specific content angles from this narrative.

INPUTS:
- Audience: ${input.audience}
- Current State: ${input.currentState}
- Problem: ${input.problem}
- Cost of Inaction: ${input.costOfInaction}
- Solution: ${input.solution}
- After State: ${input.afterState}
- Identity Shift: ${input.identityShift}

For each category, generate 5 specific content angles/hooks that could become posts.

OUTPUT JSON ONLY:
{
  "painAngles": [
    "Specific way to talk about the problem",
    "Another angle on the pain",
    "etc..."
  ],
  "costAngles": [
    "Specific consequence to highlight",
    "Another cost angle",
    "etc..."
  ],
  "mechanismAngles": [
    "Way to explain your unique approach",
    "Another mechanism angle",
    "etc..."
  ],
  "identityAngles": [
    "Way to frame who they become",
    "Another identity shift angle",
    "etc..."
  ],
  "outcomeAngles": [
    "Specific outcome to highlight",
    "Another result angle",
    "etc..."
  ]
}

Make each angle concrete and specific to THIS audience and problem.
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a content strategist. Output JSON only.",
    "gpt-4o",
    0.7
  );



  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to parse angles. Raw response:", response);
    console.error("Error details:", e);
    throw new Error("Failed to extract content angles");
  }
}

function parseAngles(response: string, cost: number): ContentAngles & { cost: number } {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return { ...JSON.parse(jsonMatch[0]), cost };
  } catch (e) {
    console.error("Failed to parse angles. Raw response:", response);
    throw new Error("Failed to extract content angles");
  }
}

export async function scoreNarrativeStrength(input: NarrativeInput): Promise<NarrativeStrength & { cost: number }> {

  const prompt = `
You are a narrative quality analyst. Score the clarity and strength of this narrative.

INPUTS:
- Audience: ${input.audience}
- Current State: ${input.currentState}
- Problem: ${input.problem}
- Cost of Inaction: ${input.costOfInaction}
- Solution: ${input.solution}
- After State: ${input.afterState}
- Identity Shift: ${input.identityShift}

SCORING CRITERIA (0-100 for each):

1. specificityScore: How specific is the audience and problem?
   - 90-100: Extremely specific (e.g., "Laundry shop owners with 1-3 locations...")
   - 70-89: Fairly specific but could be sharper
   - 50-69: Somewhat vague (e.g., "small business owners")
   - 0-49: Too generic (e.g., "everyone")

2. emotionalClarity: How clear is the emotional pain and relief?
   - 90-100: Visceral, you can FEEL the frustration and relief
   - 70-89: Clear emotional stakes
   - 50-69: Somewhat emotional but abstract
   - 0-49: Purely functional, no emotion

3. tensionStrength: How strong is the current pain/urgency?
   - 90-100: Expensive, urgent, unbearable
   - 70-89: Clear problem but not desperate
   - 50-69: Mild inconvenience
   - 0-49: No real tension

4. contrastScore: How vivid is the before/after transformation?
   - 90-100: Night and day difference, crystal clear
   - 70-89: Clear improvement
   - 50-69: Incremental change
   - 0-49: Barely different

5. overallScore: Weighted average (specificity 30%, emotional 25%, tension 25%, contrast 20%)

OUTPUT JSON ONLY:
{
  "specificityScore": 85,
  "emotionalClarity": 78,
  "tensionStrength": 82,
  "contrastScore": 90,
  "overallScore": 83
}

Be honest. Score based on the actual inputs provided.
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a narrative analyst. Output JSON only.",
    "gpt-4o",
    0.5
  );



  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const scores = JSON.parse(jsonMatch[0]);

    // Calculate overall score if not provided
    if (!scores.overallScore) {
      scores.overallScore = Math.round(
        scores.specificityScore * 0.3 +
        scores.emotionalClarity * 0.25 +
        scores.tensionStrength * 0.25 +
        scores.contrastScore * 0.2
      );
    }

    return { ...scores, cost };
  } catch (e) {

    console.error("Failed to parse strength scores. Raw response:", response);
    console.error("Error details:", e);
    throw new Error("Failed to score narrative strength");
  }
}

// === Helper: Full Narrative Analysis ===

export async function analyzeNarrative(input: NarrativeInput) {
  try {
    // Run analyses sequentially to avoid rate limits and for clearer logging
    console.log("[Narrative Intelligence] Starting analysis...");
    
    console.log("[Narrative Intelligence] Extracting positioning...");
    const positioning = await extractPositioning(input);
    
    console.log("[Narrative Intelligence] Extracting content angles...");
    const angles = await extractContentAngles(input);
    
    console.log("[Narrative Intelligence] Scoring narrative strength...");
    const strength = await scoreNarrativeStrength(input);

    console.log("[Narrative Intelligence] Analysis complete.", {
      hasPositioning: !!positioning,
      hasAngles: !!angles,
      hasStrength: !!strength
    });
    const result = {
      positioning,
      angles,
      narrativeStrength: strength,
      totalCost: positioning.cost + angles.cost + strength.cost
    };
    return result;
  } catch (error: any) {

    console.error("Failed to analyze narrative:", error);
    // Re-throw with original message to preserve context
    throw new Error(error.message || "Failed to complete narrative analysis");
  }
}

export async function generateSmartTitle(input: NarrativeInput): Promise<{ title: string; oneLiner: string }> {
  const prompt = `
You are a high-end brand strategist. Generate a punchy, world-class title and a strategic one-liner for this brand narrative.

INPUTS:
- Audience: ${input.audience}
- Problem: ${input.problem}
- Solution: ${input.solution}
- Identity Shift: ${input.identityShift}

RULES:
1. Title: 3-5 words. Sharp, evocative, and benefit-driven. Avoid generic "Marketing for..." formats (e.g., "The Growth Catalyst").
2. One-Liner: A single sentence that explains the core transformation. 

OUTPUT JSON ONLY:
{
  "title": "evocative title",
  "oneLiner": "The strategic transformation sentence."
}
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a brand strategist. Output JSON only.",
    "gpt-4o",
    0.7
  );



  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return { ...JSON.parse(jsonMatch[0]), cost };
  } catch (e) {

    console.error("Failed to generate smart title. Raw response:", response);
    throw new Error("Failed to generate smart title");
  }
}

export async function analyzeStoryNarrative(input: SeriesNarrativeInput): Promise<{ 
  analysis: any; 
  totalCost: number;
  title: string;
}> {
  const prompt = `
You are a master storyteller and series architect. Analyze these story elements and build a deep, cohesive narrative framework.

INPUTS:
- Genre: ${input.genre}
- World Setting: ${input.worldSetting}
- Conflict Type: ${input.conflictType}
- Protagonist Archetype: ${input.protagonistArchetype}
- Central Theme: ${input.centralTheme}
- Narrative Tone: ${input.narrativeTone}
- Visual Style: ${input.visualStyle}
- Episode Hooks: ${input.episodeHooks}

TASK:
1. Define the "Character Dynamics" (Internal vs External tension).
2. Outline 5 major "Plot Beats" or "Story Pillars" that define the series arc.
3. Establish 3 "World Rules" that govern the logic of this setting.
4. Synthesize a "Visual Moat" - how this series should look unique compared to anything else.
5. Generate a punchy Series Title and a 1-sentence Logline.

OUTPUT JSON ONLY:
{
  "characterDynamics": "Description of internal/external tension",
  "plotBeats": ["Beat 1", "Beat 2", "Beat 3", "Beat 4", "Beat 5"],
  "worldRules": ["Rule 1", "Rule 2", "Rule 3"],
  "visualMoat": "Specific visual strategy for consistency",
  "title": "Series Title",
  "logline": "1-sentence hook"
}
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a series architect. Output JSON only.",
    "gpt-4o",
    0.7
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const analysis = JSON.parse(jsonMatch[0]);
    return {
      analysis,
      totalCost: cost,
      title: analysis.title
    };
  } catch (e) {
    console.error("Failed to analyze story narrative:", response);
    throw new Error("Failed to analyze story narrative");
  }
}

