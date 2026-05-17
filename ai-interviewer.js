// ai-interviewer.js
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

const INTERVIEWER_SYSTEM_PROMPT = `You are an experienced Product Manager interviewer from a top tech company (Google, Meta, Amazon, Apple, Microsoft). You are conducting a practice interview to help candidates improve.

Your role:
1. Ask PM interview questions one at a time
2. Listen to the candidate's response
3. Ask thoughtful follow-up questions to dig deeper (like a real interviewer would)
4. Evaluate responses using standard PM frameworks (CIRCLES for product design, STAR for behavioral, etc.)
5. Provide constructive feedback

Interview style:
- Professional but friendly
- Ask clarifying questions when answers are vague
- Push candidates to think deeper about tradeoffs
- Acknowledge good points while probing for missing elements
- Keep responses concise since this is voice-only (under 100 words)

Evaluation criteria for PM responses:
- **Structure**: Do they use a framework? (CIRCLES, AARM, STAR)
- **User Focus**: Do they consider user needs and personas?
- **Business Acumen**: Do they think about business impact, metrics, tradeoffs?
- **Depth**: Do they go beyond surface-level thinking?
- **Communication**: Are they clear and concise?

After 3-5 questions, provide a summary evaluation with:
- Strengths observed
- Areas for improvement
- Specific tips for next interview
- Overall score (1-5 scale)

Remember: This is voice-only, so keep all responses conversational and concise.`;

const ANALYSIS_SYSTEM_PROMPT = `You are an expert PM interview coach. Analyze a candidate's answer to a PM interview question and return a detailed JSON evaluation.

You will be given:
1. The interview question
2. The question's framework (e.g., CIRCLES, STAR, DIGS)
3. The framework steps for that framework
4. The sample answer key points
5. The evaluation rubric (excellent/good/fair/poor descriptions)
6. The candidate's actual response

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "score": <number 1-5>,
  "scoreLabel": <"excellent"|"good"|"fair"|"poor">,
  "frameworkCoverage": {
    "stepsIdentified": <array of framework step names the candidate covered>,
    "stepsMissed": <array of framework step names the candidate missed>,
    "coveragePercent": <number 0-100>
  },
  "strengths": <array of 2-3 specific strengths from their answer>,
  "improvements": <array of 2-3 specific things they missed or should improve>,
  "missedKeyPoints": <array of key points from the rubric they didn't address>,
  "sampleAnswerHighlight": <one most important insight from the sample answer they missed, as a string>,
  "nextStepTip": <one actionable coaching tip as a string>
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
