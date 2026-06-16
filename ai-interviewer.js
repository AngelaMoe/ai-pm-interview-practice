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
      'metrics': 'metrics',
      'behavioral': 'behavioral',
      'product-strategy': 'strategy',
      'execution': 'execution',
      'technical': 'technical',
      'estimation': 'estimation'
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

  async startInterview(interviewType, candidateName = 'the candidate') {
    this.interviewType = interviewType;
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
        system: [{ type: 'text', text: INTERVIEWER_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
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
