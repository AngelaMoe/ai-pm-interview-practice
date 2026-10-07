// server.js
// Backend API server for AI PM Interview App

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import AIInterviewer from './ai-interviewer.js';
import { getClientIp } from './lib/rate-limit.js';
import learnRouter from './learn/routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env'), override: true });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Learn mode routes parse their own JSON with a smaller body limit, so they're mounted first
app.use('/api/learn', learnRouter);
app.use(express.json());

// Serve only the frontend page — never the whole project folder, which holds
// env files, server code and lesson content
app.get('/voice-interface.html', (req, res) => {
  res.sendFile(join(__dirname, 'voice-interface.html'));
});

// ===== DEMO MODE =====
// When no API key is set, allow 2 free tries per IP using the built-in key,
// then return a 402 with instructions to get their own key.
const DEMO_LIMIT = 2;
const demoUsage = new Map(); // ip -> count

function checkDemoLimit(req, res) {
  // If the app has its own API key configured, no demo gate needed
  if (process.env.ANTHROPIC_API_KEY) return true;

  const ip = getClientIp(req);
  const used = demoUsage.get(ip) || 0;

  if (used >= DEMO_LIMIT) {
    res.status(402).json({
      error: 'demo_limit_reached',
      message: `You've used both free demo interviews. To keep practicing, add your own free API key.`,
      cta: 'Get your free API key at https://console.anthropic.com/',
      used,
      limit: DEMO_LIMIT
    });
    return false;
  }

  demoUsage.set(ip, used + 1);
  return true;
}

// Store active interview sessions (in production, use Redis or database)
const activeSessions = new Map();
const VALID_MODES = ['guided', 'mock'];

// Generate unique session ID
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ===== API ENDPOINTS =====

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/voice-interface.html');
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AI PM Interview API is running' });
});

// Start a new interview session
app.post('/api/interview/start', async (req, res) => {
  try {
    const { interviewType, candidateName, mode } = req.body;

    if (!interviewType) {
      return res.status(400).json({ error: 'Interview type is required' });
    }

    const interviewMode = mode ?? 'mock';
    if (!VALID_MODES.includes(interviewMode)) {
      return res.status(400).json({ error: "Mode must be 'guided' or 'mock'" });
    }

    if (!checkDemoLimit(req, res)) return;

    // Create new interviewer instance
    const interviewer = new AIInterviewer();
    const sessionId = generateSessionId();

    // Start the interview
    const response = await interviewer.startInterview(
      interviewType,
      candidateName || 'the candidate',
      interviewMode
    );

    // Store session
    activeSessions.set(sessionId, {
      interviewer,
      interviewType,
      candidateName,
      startTime: new Date(),
      messageCount: 1
    });

    res.json({
      sessionId,
      interviewType,
      mode: interviewMode,
      guidedFramework: interviewer.guidedFramework || null,
      message: response.message,
      questionNumber: response.questionNumber,
      currentQuestionId: response.currentQuestionId || null
    });

  } catch (error) {
    console.error('Error starting interview:', error);
    res.status(500).json({ error: 'Failed to start interview' });
  }
});

// Submit candidate response and get next question/follow-up
app.post('/api/interview/respond', async (req, res) => {
  try {
    const { sessionId, response: candidateResponse } = req.body;

    if (!sessionId || !candidateResponse) {
      return res.status(400).json({ error: 'Session ID and response are required' });
    }

    // Get session
    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get AI response
    const aiResponse = await session.interviewer.respondToCandidate(candidateResponse);
    
    // Update session
    session.messageCount++;

    res.json({
      message: aiResponse.message,
      questionNumber: aiResponse.questionNumber,
      messageCount: session.messageCount,
      currentQuestionId: aiResponse.currentQuestionId || null
    });

  } catch (error) {
    console.error('Error processing response:', error);
    res.status(500).json({ error: 'Failed to process response' });
  }
});

// Request final evaluation
app.post('/api/interview/evaluate', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get final evaluation
    const evaluation = await session.interviewer.getFinalEvaluation();

    res.json({
      evaluation: evaluation.message,
      interviewType: session.interviewType,
      duration: Math.floor((new Date() - session.startTime) / 1000 / 60), // minutes
      messageCount: session.messageCount
    });

  } catch (error) {
    console.error('Error getting evaluation:', error);
    res.status(500).json({ error: 'Failed to get evaluation' });
  }
});

// Get interview history for a session
app.get('/api/interview/history/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      sessionId,
      interviewType: session.interviewType,
      candidateName: session.candidateName,
      startTime: session.startTime,
      history: session.interviewer.getConversationHistory()
    });

  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// End interview session
app.post('/api/interview/end', (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = activeSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get final conversation history before deleting
    const history = session.interviewer.getConversationHistory();
    
    // Clean up session
    activeSessions.delete(sessionId);

    res.json({
      message: 'Interview session ended',
      conversationHistory: history
    });

  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Analyze a candidate's answer against the question rubric
app.post('/api/interview/analyze-answer', async (req, res) => {
  try {
    const { sessionId, questionId, userResponse } = req.body;

    if (!questionId || !userResponse) {
      return res.status(400).json({ error: 'questionId and userResponse are required' });
    }

    // Use session's interviewer if available, otherwise create a temp one
    let interviewer;
    if (sessionId && activeSessions.has(sessionId)) {
      interviewer = activeSessions.get(sessionId).interviewer;
    } else {
      interviewer = new AIInterviewer();
    }

    const result = await interviewer.analyzeAnswer(questionId, userResponse);

    res.json(result);
  } catch (error) {
    console.error('Error analyzing answer:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to analyze answer' });
  }
});

// Get sample answer for a specific question (shown after candidate has responded)
app.get('/api/interview/question/:id/sample', (req, res) => {
  try {
    const interviewer = new AIInterviewer();
    const question = interviewer.getQuestionById(req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({
      questionId: question.id,
      question: question.question,
      keyPoints: question.keyPoints,
      sampleAnswer: question.sampleAnswer,
      evaluationRubric: question.evaluationRubric
    });
  } catch (error) {
    console.error('Error getting sample answer:', error);
    res.status(500).json({ error: 'Failed to get sample answer' });
  }
});

// Get all available questions (metadata only, no sample answers)
app.get('/api/interview/questions', (req, res) => {
  try {
    const interviewer = new AIInterviewer();
    const questions = interviewer.getAllQuestions();
    const { category, difficulty } = req.query;

    let filtered = questions;
    if (category) filtered = filtered.filter(q => q.category === category);
    if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);

    res.json({ questions: filtered, total: filtered.length });
  } catch (error) {
    console.error('Error getting questions:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
});

// Get available interview types
app.get('/api/interview/types', (req, res) => {
  res.json({
    types: [
      {
        id: 'product-design',
        name: 'Product Design',
        description: 'Design a product or feature (e.g., "Design a fitness app")',
        frameworks: ['CIRCLES', 'User Stories']
      },
      {
        id: 'product-strategy',
        name: 'Product Strategy',
        description: 'Strategic product decisions and prioritization',
        frameworks: ['AARM', 'SWOT']
      },
      {
        id: 'metrics',
        name: 'Metrics & Analytics',
        description: 'Define success metrics and analyze product performance',
        frameworks: ['Metric Framework', 'AARRR']
      },
      {
        id: 'behavioral',
        name: 'Behavioral',
        description: 'Past experiences and situations (e.g., "Tell me about a time...")',
        frameworks: ['STAR']
      },
      {
        id: 'execution',
        name: 'Product Execution',
        description: 'Roadmapping, prioritization, and delivery',
        frameworks: ['RICE', 'MoSCoW']
      },
      {
        id: 'technical',
        name: 'Technical PM',
        description: 'Technical concepts and system design for PMs',
        frameworks: ['Technical Depth']
      }
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ AI PM Interview API running on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🎯 Interview types: http://localhost:${PORT}/api/interview/types`);
});

// Cleanup old sessions every hour
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.startTime < oneHourAgo) {
      activeSessions.delete(sessionId);
      console.log(`🧹 Cleaned up inactive session: ${sessionId}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour

export default app;
