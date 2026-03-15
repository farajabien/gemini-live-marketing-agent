import { generateText } from "@/lib/ai/gemini-client";

// === Types ===

import { ViralPattern, ContentSeed } from "@/lib/types";

export interface NarrativeInput {
  audience: string;
  currentState: string;
  problem: string;
  costOfInaction: string;
  solution: string;
  afterState: string;
  identityShift: string;
  voice: string;
  patternLibrary?: ViralPattern[];
  seeds?: ContentSeed[];
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
  specificityScore: number; 
  emotionalClarity: number; 
  tensionStrength: number; 
  contrastScore: number; 
  
  // Total Capture Layers
  narrativeScore: number;
  formatScore: number;
  behaviorScore: number;
  evolutionScore: number;
  
  overallScore: number; 
  cost: number;
}


export interface NarrativeFramework {
  positioningStatement: string;
  coreMessage: string;
  contentPillars: {
    title: string;
    description: string;
    angles: string[];
  }[];
  brandVoice: string;
  cost?: number;
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
    "gemini-1.5-pro",
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

For each category, generate 5 specific content angles. 

CRITICAL RULES FOR ANGLES:
1. Each angle MUST be a STANDALONE 30-60s video concept.
2. Each angle MUST have a clear "Hook" (an opening that grabs attention).
3. Each angle MUST be anchored in a specific PROBLEM or frustration.
4. Each angle MUST have a specific resolution or takeaway.
5. AVOID fragmented angles (e.g., don't make 5 angles that are just 5 steps of one process).
6. Each angle should be able to function as a complete piece of content on its own.

OUTPUT JSON ONLY:
{
  "painAngles": [
    "Punchy standalone video hook + problem + quick resolution",
    "Another standalone hook anchored in a vivid frustration",
    "etc..."
  ],
  "costAngles": [
    "Hook centered on the consequences of inaction + standalone resolution",
    "Another high-stakes standalone hook",
    "etc..."
  ],
  "mechanismAngles": [
    "Hook explaining the 'how' as a standalone breakthrough",
    "etc..."
  ],
  "identityAngles": [
    "Hook about the transformation from X to Y as a standalone story",
    "etc..."
  ],
  "outcomeAngles": [
    "Hook about the specific desired result as a standalone win",
    "etc..."
  ]
}

Make each angle concrete, specific, and AUTHENTIC to this audience. NO generic marketing fluff.
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a content strategist. Output JSON only.",
    "gemini-1.5-pro",
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
  "narrativeScore": 80,
  "formatScore": 40,
  "behaviorScore": 30,
  "evolutionScore": 10,
  "overallScore": 60
}

Be honest. Score based on the actual inputs provided.
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a narrative analyst. Output JSON only.",
    "gemini-1.5-pro",
    0.5
  );



  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);

    const scores = {
      specificityScore: Number(parsed.specificityScore) || 0,
      emotionalClarity: Number(parsed.emotionalClarity) || 0,
      tensionStrength: Number(parsed.tensionStrength) || 0,
      contrastScore: Number(parsed.contrastScore) || 0,
      narrativeScore: Number(parsed.narrativeScore) || 0,
      formatScore: Number(parsed.formatScore) || 0,
      behaviorScore: Number(parsed.behaviorScore) || 0,
      evolutionScore: Number(parsed.evolutionScore) || 0,
      overallScore: Number(parsed.overallScore) || 0,
    };

    if (!scores.overallScore) {
      scores.overallScore = Math.round(
        (scores.narrativeScore * 0.4 +
        scores.formatScore * 0.2 +
        scores.behaviorScore * 0.2 +
        scores.evolutionScore * 0.2)
      );
    }

    return { ...scores, cost };
  } catch (e) {
    console.error("Failed to parse strength scores. Raw response:", response);
    throw new Error("Failed to score narrative strength");
  }
}

export async function scoreSeriesNarrativeStrength(input: SeriesNarrativeInput): Promise<NarrativeStrength & { cost: number }> {
  const prompt = `
You are a master story analyst. Score the depth and structural strength of this series narrative.

INPUTS:
- Genre: ${input.genre}
- Setting: ${input.worldSetting}
- Conflict: ${input.conflictType}
- Hero: ${input.protagonistArchetype}
- Theme: ${input.centralTheme}
- Tone: ${input.narrativeTone}
- Visuals: ${input.visualStyle}
- Hooks: ${input.episodeHooks}

SCORING CRITERIA (0-100 for each):

1. specificityScore: How unique and specific is this world and hook?
2. emotionalClarity: How clearly defined is the hero's internal struggle?
3. tensionStrength: How strong is the central conflict or "Villain"?
4. contrastScore: How distinct is the visual style and tone?

5. narrativeScore: Weighted average of the above 4 (40%)
6. formatScore: Based on the clarity of episode hooks (20%)
7. behaviorScore: Based on protagonist archetype depth (20%)
8. evolutionScore: Based on the "World Rules" or "Pillars" defined (20%)

OUTPUT JSON ONLY:
{
  "specificityScore": 85,
  "emotionalClarity": 78,
  "tensionStrength": 82,
  "contrastScore": 90,
  "narrativeScore": 80,
  "formatScore": 40,
  "behaviorScore": 30,
  "evolutionScore": 10,
  "overallScore": 60
}
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a story analyst. Output JSON only.",
    "gemini-2.5-pro",
    0.5
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const parsed = JSON.parse(jsonMatch[0]);

    const scores = {
      specificityScore: Number(parsed.specificityScore) || 0,
      emotionalClarity: Number(parsed.emotionalClarity) || 0,
      tensionStrength: Number(parsed.tensionStrength) || 0,
      contrastScore: Number(parsed.contrastScore) || 0,
      narrativeScore: Number(parsed.narrativeScore) || 0,
      formatScore: Number(parsed.formatScore) || 0,
      behaviorScore: Number(parsed.behaviorScore) || 0,
      evolutionScore: Number(parsed.evolutionScore) || 0,
      overallScore: Number(parsed.overallScore) || 0,
    };

    if (!scores.overallScore) {
      scores.overallScore = Math.round(
        (scores.narrativeScore * 0.4 +
        scores.formatScore * 0.2 +
        scores.behaviorScore * 0.2 +
        scores.evolutionScore * 0.2)
      );
    }

    return { ...scores, cost };
  } catch (e) {
    console.error("Failed to parse series strength scores:", response);
    return {
      specificityScore: 0,
      emotionalClarity: 0,
      tensionStrength: 0,
      contrastScore: 0,
      narrativeScore: 0,
      formatScore: 0,
      behaviorScore: 0,
      evolutionScore: 0,
      overallScore: 0,
      cost: 0
    };
  }
}

export async function generateNarrativeFramework(
  input: NarrativeInput,
  positioning: ExtractedPositioning,
  angles: ContentAngles
): Promise<NarrativeFramework> {
  const prompt = `
You are a high-end brand strategist. Convert these raw strategic components into a polished "Narrative Framework".

INPUTS:
- Positioning: ${JSON.stringify(positioning, null, 2)}
- Angles: ${JSON.stringify(angles, null, 2)}
- Voice Preference: ${input.voice}

TASK:
1. "positioningStatement": A single, powerful sentence that captures the transformation (From [Pain] to [Promise] through [Mechanism]).
2. "coreMessage": A 2-3 sentence paragraph that explains WHY this matters and how it works.
3. "contentPillars": Cluster the provided angles into 3-4 cohesive pillars. Each pillar needs a punchy title, a short description, and 3-5 specific angles (drawn from the provided angles). IMPORTANT: Maintain the standalone nature of the angles. Do not blend them into a single script.
4. "brandVoice": A definitive 1-sentence description of the brand's tone of voice.

OUTPUT JSON ONLY:
{
  "positioningStatement": "...",
  "coreMessage": "...",
  "contentPillars": [
    { "title": "...", "description": "...", "angles": ["...", "..."] }
  ],
  "brandVoice": "..."
}
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a brand strategist. Output JSON only.",
    "gemini-1.5-pro",
    0.6
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);
    console.log("[Narrative Intelligence] Synthesized Framework:", JSON.stringify(result, null, 2));
    return { ...result, cost };
  } catch (e) {
    console.error("Failed to generate framework. Raw response:", response);
    throw new Error("Failed to synthesize narrative framework");
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

    console.log("[Narrative Intelligence] Synthesizing final framework...");
    const framework = await generateNarrativeFramework(input, positioning, angles);

    console.log("[Narrative Intelligence] Analysis complete.", {
      hasPositioning: !!positioning,
      hasAngles: !!angles,
      hasStrength: !!strength,
      hasFramework: !!framework
    });
    const result = {
      positioning,
      angles,
      narrativeStrength: strength,
      framework: framework,
      totalCost: positioning.cost + angles.cost + strength.cost + (framework.cost || 0)
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
    "gemini-1.5-pro",
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
  "villain": "The core conflict/opposition/internal struggle",
  "hero": "The protagonist's transformation/identity shift",
  "mechanism": "The unique world logic/story mechanism",
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
    "gemini-1.5-pro",
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

export async function refineStoryNarrative(
  input: SeriesNarrativeInput,
  currentAnalysis: any,
  feedback: string
): Promise<{ 
  analysis: any; 
  totalCost: number;
  title: string;
}> {
  const prompt = `
You are a master storyteller and series architect. You previously generated a series architecture, and the user has feedback.

ORIGINAL INPUTS:
- Genre: ${input.genre}
- World Setting: ${input.worldSetting}
- Conflict Type: ${input.conflictType}
- Protagonist Archetype: ${input.protagonistArchetype}
- Central Theme: ${input.centralTheme}
- Narrative Tone: ${input.narrativeTone}
- Visual Style: ${input.visualStyle}
- Episode Hooks: ${input.episodeHooks}

CURRENT ANALYSIS:
${JSON.stringify(currentAnalysis, null, 2)}

USER FEEDBACK:
"${feedback}"

TASK:
Refine the series architecture based on the feedback. Maintain the core elements that weren't criticized, but pivot or deepen the elements mentioned in the feedback.

OUTPUT JSON ONLY (same structure as original):
{
  "characterDynamics": "Refined description",
  "plotBeats": ["Refined Beat 1", "Beat 2", "..."],
  "worldRules": ["Refined Rule 1", "..."],
  "visualMoat": "Refined visual strategy",
  "title": "Refined Series Title",
  "logline": "Refined 1-sentence hook"
}
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a series architect. Refine the architecture based on feedback. Output JSON only.",
    "gemini-1.5-pro",
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
    console.error("Failed to refine story narrative:", response);
    throw new Error("Failed to refine story narrative");
  }
}

export async function extractSeriesWizardDataFromBrainDump(
  brainDump: string
): Promise<any> {
  const prompt = `
You are a strategic series architect. A creator has provided a rough brainstorm or notes for a series.
Extract and map their ideas into the 8 required fields for our Series Architecture Wizard.
If a field is not explicitly mentioned, infer the MOST LIKELY logical choice based on their notes.

The 8 fields and their allowed values (or types) are:
1. "genre" (string - select the closest: "sci-fi", "mystery", "docu", "thriller", "fantasy", or make up a short genre name if none fit)
2. "worldSetting" (string - describe the setting in 1-2 sentences)
3. "conflictType" (string - select the closest: "internal", "person-vs-person", "person-vs-society", "person-vs-nature", "person-vs-tech")
4. "protagonistArchetype" (string - select the closest: "hero", "anti-hero", "underdog", "sage", "everyman")
5. "centralTheme" (string - describe the core theme in 1-2 sentences)
6. "narrativeTone" (string - select the closest: "optimistic", "dark", "satirical", "stoic", "whimsical")
7. "visualStyle" (string - describe the camera work, lighting, colors in 1-2 sentences)
8. "episodeHooks" (string - a list or paragraph of 3-5 potential episode hooks)

USER'S BRAIN DUMP:
"${brainDump}"

OUTPUT JSON ONLY exactly matching the keys above:
{
  "genre": "...",
  "worldSetting": "...",
  "conflictType": "...",
  "protagonistArchetype": "...",
  "centralTheme": "...",
  "narrativeTone": "...",
  "visualStyle": "...",
  "episodeHooks": "..."
}
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a series architect. Extract wizard data. Output JSON only.",
    "gemini-1.5-pro",
    0.7
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const data = JSON.parse(jsonMatch[0]);
    return { data, cost };
  } catch (e) {
    console.error("Failed to extract wizard data from brain dump:", response);
    throw new Error("Failed to extract wizard data from brain dump");
  }
}

export async function refineBrandNarrative(
  input: NarrativeInput,
  currentAnalysis: any,
  feedback: string
): Promise<{ 
  analysis: any; 
  totalCost: number; 
}> {
  const prompt = `
You are a strategic brand consultant. You previously generated a brand strategy, and the user has feedback.

ORIGINAL INPUTS:
- Audience: ${input.audience}
- Current State: ${input.currentState}
- Problem: ${input.problem}
- Cost of Inaction: ${input.costOfInaction}
- Solution: ${input.solution}
- After State: ${input.afterState}
- Identity Shift: ${input.identityShift}

CURRENT ANALYSIS:
${JSON.stringify(currentAnalysis, null, 2)}

USER FEEDBACK:
"${feedback}"

TASK:
Refine the brand positioning, core message, and content pillars based on the feedback. Maintain the core elements that weren't criticized, but pivot or deepen the elements mentioned in the feedback.

OUTPUT JSON ONLY (same structure as original):
{
  "positioningStatement": "...",
  "coreMessage": "...",
  "contentPillars": [
    { "title": "...", "description": "...", "angles": ["...", "..."] }
  ],
  "brandVoice": "..."
}
`;

  const { text: response, cost } = await generateText(
    prompt,
    "You are a brand strategist. Refine the strategy based on feedback. Output JSON only.",
    "gemini-1.5-pro",
    0.7
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const analysis = JSON.parse(jsonMatch[0]);
    return {
      analysis,
      totalCost: cost,
    };
  } catch (e) {
    console.error("Failed to refine brand narrative:", response);
    throw new Error("Failed to refine brand narrative");
  }
}

export async function refineContentPillar(
  input: NarrativeInput,
  pillar: { title: string, description: string, angles: string[] },
  feedback: string,
  history?: string
): Promise<{ title: string, description: string, angles: string[] }> {
  const prompt = `
You are a strategic content director. Refine this specific content pillar based on user feedback.

NARRATIVE CONTEXT:
- Audience: ${input.audience}
- Problem: ${input.problem}
- Solution: ${input.solution}

${history ? `CONTENT ALREADY GENERATED (DO NOT REPEAT THESE HOOKS/ANGLES):\n${history}\n` : ""}

CURRENT PILLAR:
- Title: ${pillar.title}
- Description: ${pillar.description}
- Angles: ${JSON.stringify(pillar.angles)}

USER FEEDBACK:
"${feedback}"

TASK:
1. Regenerate the 5 angles for this pillar.
2. Ensure each angle is a STANDALONE video concept with its own hook and problem anchor.
3. Pivot the tone or focus based on the feedback.

OUTPUT JSON ONLY:
{
  "title": "...",
  "description": "...",
  "angles": ["...", "..."]
}
`;

  const { text: response } = await generateText(
    prompt,
    "You are a content director. Refine the pillar angles based on feedback. Output JSON only.",
    "gemini-1.5-pro",
    0.7
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to refine content pillar:", response);
    throw new Error("Failed to refine content pillar");
  }
}

/**
 * Distills new insights back into the core narrative.
 * This makes the narrative an evolving "brain" that gets smarter with every interaction.
 */
export async function evolveNarrative(
  current: NarrativeInput,
  insight: string
): Promise<NarrativeInput> {
  const prompt = `
You are a strategic narrative analyst and brand "brain". Your job is to EVOLVE a brand narrative based on new insights discovered during a content session.

CURRENT NARRATIVE:
- Audience: ${current.audience}
- Current State: ${current.currentState}
- Problem: ${current.problem}
- Cost of Inaction: ${current.costOfInaction}
- Solution: ${current.solution}
- After State: ${current.afterState}
- Identity Shift: ${current.identityShift}
- Voice: ${current.voice}

NEW INSIGHT / DISCOVERY:
"${insight}"

TASK:
Refine the core narrative fields. 
1. Incorporate the new insight to make the narrative more SPECIFIC and EMOTIONALLY RESONANT.
2. Do not delete existing core facts, but sharpen them. 
3. If the insight reveals a better way to frame the problem or solution, update those fields.
4. Keep the text punchy and strategic.

OUTPUT JSON ONLY (Expanded Structure):
{
  "audience": "...",
  "aiPositioning": { "villain": "...", "hero": "...", "mechanism": "...", "promise": "...", "stakes": "..." },
  "problem": "...",
  "solution": "...",
  "voice": "..."
}
`;

  const { text: response } = await generateText(
    prompt,
    "You are a narrative strategist. Output JSON only.",
    "gemini-2.5-flash",
    0.5
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);

    // Extracting patterns and seeds if they exist in the insight (which might be the full conversation)
    let patterns = current.patternLibrary || [];
    let seeds = current.seeds || [];

    if (result.extractedPatterns) {
      patterns = [...patterns, ...result.extractedPatterns];
    }
    if (result.extractedSeeds) {
      seeds = [...seeds, ...result.extractedSeeds];
    }

    return {
      ...current,
      ...result,
      patternLibrary: patterns,
      seeds: seeds
    };
  } catch (e) {
    console.error("Failed to evolve narrative:", response);
    return current;
  }
}

export async function refineFullStrategy(
  current: NarrativeInput,
  feedback: string,
  contentHistory?: string
): Promise<{ 
  narrative: NarrativeInput, 
  pillars: Array<{ title: string, description: string, angles: string[] }> 
}> {
  const prompt = `
You are a Lead Content Strategist. Your task is to refine the ENTIRE content strategy for a brand based on user feedback.

CURRENT NARRATIVE BRAIN:
- Audience: ${current.audience}
- Problem: ${current.problem}
- Solution: ${current.solution}
- Voice: ${current.voice}

${contentHistory ? `PREVIOUS CONTENT HISTORY (DO NOT REPEAT):\n${contentHistory}\n` : ""}

USER FEEDBACK FOR FULL STRATEGY:
"${feedback}"

TASK:
1. EVOLVE the Narrative Brain fields based on the feedback. Make them more specific and strategically aligned with the feedback.
2. REGENERATE 3 distinct Content Pillars based on the evolved narrative.
3. For each pillar, generate 5 STANDALONE video concepts (angles).
4. Each angle must have a clear hook and problem-anchor.

OUTPUT JSON ONLY:
{
  "narrative": {
    "audience": "...",
    "currentState": "...",
    "problem": "...",
    "costOfInaction": "...",
    "solution": "...",
    "afterState": "...",
    "identityShift": "...",
    "voice": "..."
  },
  "pillars": [
    {
      "title": "...",
      "description": "...",
      "angles": ["...", "...", "...", "...", "..."]
    }
  ]
}
`;

  const { text: response } = await generateText(
    prompt,
    "You are a lead content strategist. Refine the full strategy. Output JSON only.",
    "gemini-1.5-pro",
    0.7
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);
    
    return {
      narrative: {
        audience: result.narrative.audience || current.audience,
        currentState: result.narrative.currentState || current.currentState,
        problem: result.narrative.problem || current.problem,
        costOfInaction: result.narrative.costOfInaction || current.costOfInaction,
        solution: result.narrative.solution || current.solution,
        afterState: result.narrative.afterState || result.narrative.afterstate || current.afterState,
        identityShift: result.narrative.identityShift || current.identityShift,
        voice: result.narrative.voice || current.voice,
      },
      pillars: result.pillars
    };
  } catch (e) {
    console.error("Failed to refine full strategy:", response);
    throw new Error("Failed to refine full strategy");
  }
}

export async function generateSeriesSeasonPlot(input: SeriesNarrativeInput, episodeCount: number = 3): Promise<{ seriesTitle: string, megaPrompt: string, episodes: Array<{ title: string, script: string, episodeNumber: number }> }> {
  const prompt = `
You are a Lead Showrunner and Screenwriter. Your task is to generate a compelling ${episodeCount}-episode "Series Architecture" based on a Story Foundation.

STORY FOUNDATION:
- Genre: ${input.genre}
- World: ${input.worldSetting}
- Conflict: ${input.conflictType}
- Hero Archetype: ${input.protagonistArchetype}
- Theme: ${input.centralTheme}
- Tone: ${input.narrativeTone}
- Visual Style: ${input.visualStyle}

TASK:
1. Generate an overarching "Mega-Prompt" (premise & style guide) for the series.
2. Generate specific metadata for EXACTLY ${episodeCount} episodes.
3. Each episode needs a title and a "Beat-Script" (2-3 sentences of what specifically happens).

OUTPUT JSON ONLY:
{
  "seriesTitle": "A high-impact, catchy 3-5 word title for the series",
  "megaPrompt": "The high-level series premise and production guide...",
  "episodes": [
    {
      "title": "Episode 1 Title",
      "script": "Beat/Premise for Episode 1...",
      "episodeNumber": 1
    },
    ...
  ]
}

RULES:
- Be creative. Don't be generic.
- Ensure there is clear progression between episodes.
- Episode descriptions must be action-oriented.
- megaPrompt should be 200-500 words.
`;

  const { text } = await generateText(
    prompt,
    "You are a creative showrunner. Write a compelling series plot. Output JSON only.",
    "gemini-1.5-pro",
    0.8
  );

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to parse series season plot:", text);
    throw new Error("Failed to generate structured season plot");
  }
}

export async function evolveSeriesNarrative(
  current: SeriesNarrativeInput,
  insight: string
): Promise<SeriesNarrativeInput> {
  const prompt = `
You are a master series architect and "story brain". Your job is to EVOLVE a series narrative (story architecture) based on new insights discovered during a creative brainstorming session.

CURRENT STORY ARCHITECTURE:
- Genre: ${current.genre}
- World Setting: ${current.worldSetting}
- Conflict Type: ${current.conflictType}
- Protagonist Archetype: ${current.protagonistArchetype}
- Central Theme: ${current.centralTheme}
- Narrative Tone: ${current.narrativeTone}
- Visual Style: ${current.visualStyle}
- Episode Hooks: ${current.episodeHooks}

NEW INSIGHT / CREATIVE DISCOVERY:
"${insight}"

TASK:
Refine the story architecture fields. 
1. Incorporate the new insight to make the world, characters, or conflict more compelling and specific.
2. Do not delete established core facts, but sharpen them. 
3. If the insight suggests a better "World Rule" or "Visual Style" detail, bake it into the descriptions.
4. Keep the text punchy, creative, and evocative.

OUTPUT JSON ONLY (SeriesNarrativeInput structure):
{
  "genre": "...",
  "worldSetting": "...",
  "conflictType": "...",
  "protagonistArchetype": "...",
  "centralTheme": "...",
  "narrativeTone": "...",
  "visualStyle": "...",
  "episodeHooks": "..."
}
`;

  const { text: response } = await generateText(
    prompt,
    "You are a series architect. Distill insights to evolve the story brain. Output JSON only.",
    "gemini-1.5-pro",
    0.6
  );

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    const result = JSON.parse(jsonMatch[0]);
    return {
      genre: result.genre || current.genre,
      worldSetting: result.worldSetting || current.worldSetting,
      conflictType: result.conflictType || current.conflictType,
      protagonistArchetype: result.protagonistArchetype || current.protagonistArchetype,
      centralTheme: result.centralTheme || current.centralTheme,
      narrativeTone: result.narrativeTone || current.narrativeTone,
      visualStyle: result.visualStyle || current.visualStyle,
      episodeHooks: result.episodeHooks || current.episodeHooks,
    };
  } catch (e) {
    console.error("Failed to evolve series narrative:", response);
    return current; // Fallback to current
  }
}

export async function extractViralPatterns(conversation: string): Promise<ViralPattern[]> {
  const prompt = `
    Analyze this conversation and extract "Viral Patterns"—winning structural blueprints for content.
    Look for: Hook styles, structural arcs, and emotional triggers that seem to resonate.

    CONVERSATION:
    "${conversation}"

    OUTPUT JSON ONLY (Array of ViralPattern):
    [
      {
        "id": "generated-id",
        "name": "The Brutal Truth",
        "hookType": "Contrarian Authority",
        "structure": ["Hook", "Common Belief", "Contradiction", "Framework"],
        "emotionArc": "Shock to Insight",
        "pacingPattern": "Fast cut start, slower middle",
        "successScore": 0.85,
        "tags": ["contrarian", "saas", "truth"]
      }
    ]
  `;

  const { text: response } = await generateText(prompt, "You are a virality analyst.", "gemini-2.0-flash", 0.7);
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (e) {
    return [];
  }
}

export async function extractContentSeeds(conversation: string): Promise<ContentSeed[]> {
  const prompt = `
    Analyze this conversation and extract "Content Seeds"—strategic anchors for future content clusters.
    Each seed should be a specific topic or angle that came up during brainstorming.

    CONVERSATION:
    "${conversation}"

    OUTPUT JSON ONLY (Array of ContentSeed):
    [
      {
        "id": "generated-id",
        "topic": "The Builder Trap",
        "pillar": "Developer Traps",
        "angle": "Why we build before validating",
        "status": "active"
      }
    ]
  `;

  const { text: response } = await generateText(prompt, "You are a content strategist.", "gemini-2.0-flash", 0.7);
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (e) {
    return [];
  }
}


