// ai-interviewer.js
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WIKI_FRAMEWORKS_BLOCK } from './wiki-knowledge.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Lazy client so dotenv has time to load before we read process.env
let _anthropic = null;
function getClient() {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// Load questions database
let questionsDb = null;
function getQuestionsDb() {
  if (!questionsDb) {
    const dbPath = join(__dirname, 'pm-questions-comprehensive.json');
    questionsDb = JSON.parse(readFileSync(dbPath, 'utf8'));
  }
  return questionsDb;
}

const FRAMEWORK_STEPS_MAP = {
  'Metrics & Analytics': {
    name: 'TROPIC',
    steps: [['T','Time'],['R','Region'],['O','Other launches'],['P','Platform'],['I','Industry'],['C','Cannibalization']]
  },
  'Behavioral': {
    name: 'STAR+M',
    steps: [['S','Situation'],['T','Task'],['A','Action'],['R','Result'],['+M','Meta-reflection']]
  },
  'Product Design': {
    name: '10-Step Design',
    steps: [['1','Clarify'],['2-3','Mission + users'],['4-5','Journey + pain points'],['6-7','Solutions + prioritize'],['8','AI layer'],['9-10','Metrics + tradeoffs']]
  },
  'Product Strategy': {
    name: 'SIGNAL',
    steps: [['S','Strengths'],['I','Industry trends'],['G','Goals'],['N','Needs'],['A','Actions'],['L','Land on recommendation']]
  },
  'Product Execution': {
    name: 'TROPIC',
    steps: [['T','Timeframe'],['R','Root cause'],['O','Options'],['P','Prioritize'],['I','Implement'],['C','Close the loop']]
  },
  'Technical PM': {
    name: 'System Design',
    steps: [['1','Clarify scale'],['2','Define components'],['3','Data model'],['4','Bottlenecks'],['5','Tradeoffs']]
  },
  'Product Sense': {
    name: 'AI-CUPS-PDM',
    steps: [['C','Context — what problem does this AI solve?'],['U','Users — who benefits and who is at risk?'],['P','Product critique — what works and what doesn\'t?'],['S','Signals — what metrics prove it\'s working?'],['P','Priority — what\'s the highest-leverage improvement?'],['D','Differentiation — why is the AI layer essential here?'],['M','Measure — how do you know the improvement worked?']]
  },
  'AI Safety': {
    name: 'AI-CUPS-PDM',
    steps: [['C','Context — what harm scenarios exist?'],['U','Users at risk — who is most vulnerable?'],['P','Prevention — model-level vs product-level controls'],['S','Signals — metrics that detect harm early'],['P','Policy — override and escalation path'],['D','Disclosure — what must users know?'],['M','Metrics — safety vs utility tradeoff']]
  },
};

function getGuidedSystemPrompt(interviewType) {
  const fw = FRAMEWORK_STEPS_MAP[interviewType] || FRAMEWORK_STEPS_MAP['Metrics & Analytics'];
  const stepsText = fw.steps.map(([l, d]) => `  ${l}: ${d}`).join('\n');
  return `You are an AI PM interview coach running a guided practice session. Your role is to coach the candidate step by step through the ${fw.name} framework.

Active framework: ${fw.name}
Steps:
${stepsText}

Rules:
- Ask one real interview question to start, then coach step by step
- After each candidate response: (1) briefly acknowledge what they covered (2) prompt the next uncovered step by its exact letter
- If they cover a step unprompted, acknowledge it: "You already covered [letter], good. Now [next step]."
- If they jump to solutions before diagnosing, redirect: "Hold on — we haven't covered [missing step] yet."
- Keep every response under 80 words — this is voice
- ALWAYS start your response with [STEP:X] where X is the current step letter (e.g. [STEP:T] or [STEP:done]) — the UI parses this
- Be encouraging but direct. Name the framework step explicitly.`;
}

const INTERVIEWER_SYSTEM_PROMPT = `You are an experienced AI Product Manager interviewer from a top tech company (Google, Meta, Amazon, Anthropic, OpenAI). You are conducting a practice interview to help candidates prepare for AI PM roles.

Your role:
1. Ask PM interview questions one at a time
2. Listen to the candidate's response
3. Ask 1-2 follow-up questions that dig deeper — exactly as a real interviewer would
4. Give concise, specific feedback that names the framework they used or should have used
5. Call out AI-specific gaps explicitly (missing failure modes, skipped safety considerations, no AI layer in metric diagnosis)

Interview style:
- Professional but direct
- When an answer is vague, probe with: "Can you be more specific about who the user is?" or "What metric would you actually track for that?"
- Acknowledge strong points briefly, then push on what's missing
- Keep ALL responses under 100 words — this is voice-only

When giving feedback, name the framework explicitly. Examples:
- "Good use of TROPIC, but you didn't add the AI layer — did the model update?"
- "Your answer needs the M from STAR+M — what number proves that worked?"
- "You skipped the AI failure path — that's step 8 of the 10-step design framework."
- "C-NABGT: you covered C, N, and A, but you skipped the T (tracking plan)."

After 3-5 exchanges, provide a summary evaluation:
- Frameworks used correctly (name them)
- Frameworks missed or used incorrectly (name them)
- One most important thing to fix before their next interview
- Overall score (1-5 scale)

${WIKI_FRAMEWORKS_BLOCK}`;

const ANALYSIS_SYSTEM_PROMPT = `You are an expert AI PM interview coach. Analyze a candidate's answer against the question's rubric and the wiki framework standards below.

${WIKI_FRAMEWORKS_BLOCK}

You will be given:
1. The interview question
2. The question's framework (e.g., STAR+M, TROPIC, C-NABGT, 10-Step-Design, UPS-PPPB, GAME, SIGNAL)
3. The framework steps
4. The sample answer key points
5. The evaluation rubric (excellent/good/fair/poor)
6. The candidate's actual response

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "score": <number 1-5>,
  "scoreLabel": <"excellent"|"good"|"fair"|"poor">,
  "frameworkUsed": <name of the framework the candidate applied, or "none">,
  "frameworkCoverage": {
    "stepsIdentified": <array of framework step names the candidate covered>,
    "stepsMissed": <array of framework step names the candidate missed>,
    "coveragePercent": <number 0-100>
  },
  "aiDepth": {
    "mentionedFailureModes": <boolean>,
    "mentionedSafety": <boolean>,
    "addedAILayerToTROPIC": <boolean — only relevant for metric drop questions>,
    "includedMetricInSTAR": <boolean — only relevant for behavioral questions>
  },
  "strengths": <array of 2-3 specific strengths, each referencing the framework or wiki standard>,
  "improvements": <array of 2-3 specific improvements, each naming the framework step or wiki standard missed>,
  "missedKeyPoints": <array of key points from the rubric they didn't address>,
  "sampleAnswerHighlight": <the single most important insight from the sample answer they missed>,
  "nextStepTip": <one actionable coaching tip that names the specific framework or step to practice>
}`;

class AIInterviewer {
  constructor() {
    this.conversationHistory = [];
    this.currentQuestionIndex = 0;
    this.interviewType = null;
    this.questionsAsked = [];
    this.currentQuestion = null;
  }

  // Get questions filtered by category
  getQuestionsForType(interviewType) {
    const db = getQuestionsDb();
    // Map interview type IDs to category names in the database
    const categoryMap = {
      'product-design': 'product-design',
      'Product Design': 'product-design',
      'metrics': 'metrics',
      'Metrics & Analytics': 'metrics',
      'behavioral': 'behavioral',
      'Behavioral': 'behavioral',
      'product-strategy': 'strategy',
      'Product Strategy': 'strategy',
      'execution': 'execution',
      'Product Execution': 'execution',
      'technical': 'technical',
      'Technical PM': 'technical',
      'estimation': 'estimation',
      'Product Sense': 'ai-product-sense',
      'AI Safety': 'ai-safety',
      'ai-product-sense': 'ai-product-sense',
      'ai-safety': 'ai-safety',
      'ai-metrics': 'ai-metrics'
    };
    const category = categoryMap[interviewType] || interviewType;
    return db.questions.filter(q => q.category === category);
  }

  // Pick a random question for the interview type
  pickQuestion(interviewType, exclude = []) {
    const questions = this.getQuestionsForType(interviewType);
    const available = questions.filter(q => !exclude.includes(q.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }

  // Get framework info from the database
  getFrameworkInfo(frameworkName) {
    const db = getQuestionsDb();
    return db.frameworks[frameworkName] || null;
  }

  async startInterview(interviewType, candidateName = 'the candidate', mode = 'mock') {
    this.interviewType = interviewType;
    this.mode = mode;
    this.activeSystemPrompt = mode === 'guided' ? getGuidedSystemPrompt(interviewType) : INTERVIEWER_SYSTEM_PROMPT;
    this.guidedFramework = mode === 'guided' ? (FRAMEWORK_STEPS_MAP[interviewType] || FRAMEWORK_STEPS_MAP['Metrics & Analytics']) : null;
    this.conversationHistory = [];
    this.currentQuestionIndex = 0;
    this.questionsAsked = [];

    // Pick first question from database
    const question = this.pickQuestion(interviewType);
    if (question) {
      this.currentQuestion = question;
      this.questionsAsked.push(question.id);
    }

    const initialPrompt = `Start a ${interviewType} interview with ${candidateName}. Introduce yourself briefly (15-20 words max since this is voice), then ask this specific question: "${question ? question.question : `a ${interviewType} question`}". Be conversational since this is voice-only.`;

    const result = await this.sendMessage(initialPrompt);
    this.currentQuestionIndex++;
    return result;
  }

  async sendMessage(userMessage) {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    try {
      const response = await getClient().messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: [{ type: 'text', text: this.activeSystemPrompt || INTERVIEWER_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: this.conversationHistory
      });

      const block = response.content[0];
      if (block.type !== 'text') throw new Error(`Unexpected content type: ${block.type}`);
      const assistantMessage = block.text;

      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage
      });

      return {
        message: assistantMessage,
        questionNumber: this.currentQuestionIndex,
        conversationLength: this.conversationHistory.length,
        currentQuestionId: this.currentQuestion?.id || null
      };
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw new Error('Failed to get response from AI interviewer', { cause: error });
    }
  }

  async respondToCandidate(candidateResponse) {
    return await this.sendMessage(candidateResponse);
  }

  async getFinalEvaluation() {
    const evaluationPrompt = `We've completed the interview questions. Please provide a final evaluation with:
1. Overall performance summary (2-3 sentences)
2. Key strengths (2-3 points)
3. Areas for improvement (2-3 points)
4. Specific actionable tips for their next interview
5. Overall score out of 5

Keep it conversational and encouraging since this is voice feedback.`;

    return await this.sendMessage(evaluationPrompt);
  }

  // Analyze a specific candidate answer against the question's rubric
  async analyzeAnswer(questionId, userResponse) {
    const db = getQuestionsDb();
    const question = db.questions.find(q => q.id === questionId);

    if (!question) {
      throw new Error(`Question ${questionId} not found in database`);
    }

    const framework = this.getFrameworkInfo(question.framework);
    const frameworkSteps = framework?.steps || [];

    const analysisPrompt = `Question: "${question.question}"

Framework: ${question.framework}
Framework steps: ${JSON.stringify(frameworkSteps)}

Sample answer key points: ${JSON.stringify(question.keyPoints)}

Evaluation rubric:
- Excellent (5): ${question.evaluationRubric.excellent}
- Good (4): ${question.evaluationRubric.good}
- Fair (3): ${question.evaluationRubric.fair}
- Poor (1-2): ${question.evaluationRubric.poor}

Sample answer overview: ${question.sampleAnswer.overview}
Sample answer steps: ${JSON.stringify(question.sampleAnswer.steps)}

Candidate's response: "${userResponse}"

Analyze the candidate's response against the rubric and return JSON as specified.`;

    try {
      const response = await getClient().messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: [{ type: 'text', text: ANALYSIS_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: analysisPrompt }]
      });

      const block = response.content[0];
      if (block.type !== 'text') throw new Error(`Unexpected content type: ${block.type}`);
      const rawText = block.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const analysis = JSON.parse(rawText);

      return {
        questionId,
        question: question.question,
        framework: question.framework,
        category: question.category,
        source: question.source,
        company: question.company,
        analysis,
        sampleAnswer: question.sampleAnswer,
        keyPoints: question.keyPoints,
        evaluationRubric: question.evaluationRubric
      };
    } catch (error) {
      console.error('Error analyzing answer:', error);
      throw new Error('Failed to analyze answer', { cause: error });
    }
  }

  // Get all available questions (for frontend display)
  getAllQuestions() {
    return getQuestionsDb().questions.map(q => ({
      id: q.id,
      category: q.category,
      difficulty: q.difficulty,
      framework: q.framework,
      source: q.source,
      company: q.company,
      question: q.question
    }));
  }

  // Get question by ID (without full sample answer — for during interview)
  getQuestionById(id) {
    const db = getQuestionsDb();
    return db.questions.find(q => q.id === id) || null;
  }

  getConversationHistory() {
    return this.conversationHistory;
  }

  reset() {
    this.conversationHistory = [];
    this.currentQuestionIndex = 0;
    this.questionsAsked = [];
    this.interviewType = null;
    this.currentQuestion = null;
  }
}

export default AIInterviewer;
