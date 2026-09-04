/**
 * Complete Backend Server for GoRouter Claude API Integration
 * Use this as your Express.js backend for Kenya Hockey Union Live & Off-Pitch Africa
 * 
 * Installation:
 * npm install express cors dotenv
 * 
 * Setup:
 * 1. Create .env file with GOROUTER_API_KEY=your-key
 * 2. npm start
 * 3. Backend runs on http://localhost:5000
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY = process.env.GOROUTER_API_KEY;
const BASE_URL = "https://gorouter.app/v1";
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const PORT = process.env.PORT || 5000;

// Validate configuration
if (!API_KEY) {
  console.error('❌ ERROR: GOROUTER_API_KEY environment variable is not set!');
  console.error('Set it in .env file: GOROUTER_API_KEY=your-key-here');
  process.exit(1);
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

// CORS - Allow requests from frontend
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// SYSTEM PROMPTS - Customized for each context
// ============================================================================

const SYSTEM_PROMPTS = {
  hockey: `You are an expert hockey analyst specializing in Kenyan hockey. You have deep knowledge of:
- Kenya Hockey Union teams and players
- International hockey strategies and tactics
- Player performance analysis
- Match predictions and game flow
- Hockey rules and regulations

Provide concise, insightful analysis. When analyzing matches or players, be specific and data-driven.
If you don't have specific data, acknowledge it and provide general hockey insights instead.`,

  sports: `You are a comprehensive sports expert specializing in African and international sports. Your expertise includes:
- Player performance analysis
- Team dynamics and strategy
- Sports commentary and storytelling
- Social media engagement and trends
- Performance predictions and analytics

Provide engaging, entertaining, and informative sports content. Make your responses suitable for:
- Social media posts
- Sports commentary
- Fan engagement
- Athlete interviews and quotes

Keep responses engaging and conversational.`,

  general: `You are a helpful sports assistant. Answer questions about sports, athletes, teams, and related topics.
Be friendly, informative, and engaging. If unsure about specific facts, acknowledge limitations and provide general knowledge instead.`
};

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Health Check Endpoint
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    apiConnected: !!API_KEY
  });
});

/**
 * Main Claude API Endpoint
 * POST /api/claude
 * 
 * Body:
 * {
 *   "message": "Your question here",
 *   "context": "hockey" | "sports" | "general",  // optional, default: "general"
 *   "maxTokens": 1024  // optional, default: 1024
 * }
 */
app.post('/api/claude', async (req, res) => {
  try {
    const { message, context = 'general', maxTokens = 1024 } = req.body;

    // ===== INPUT VALIDATION =====
    if (!message) {
      return res.status(400).json({
        error: 'Message is required',
        success: false
      });
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return res.status(400).json({
        error: 'Message cannot be empty',
        success: false
      });
    }

    if (trimmedMessage.length > 10000) {
      return res.status(400).json({
        error: 'Message too long (max 10000 characters)',
        success: false
      });
    }

    if (maxTokens < 10 || maxTokens > 4096) {
      return res.status(400).json({
        error: 'maxTokens must be between 10 and 4096',
        success: false
      });
    }

    // ===== PREPARE SYSTEM PROMPT =====
    const systemPrompt = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.general;

    console.log(`📤 Claude request: context=${context}, message_length=${trimmedMessage.length}`);

    // ===== CALL GOROUTER API =====
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-opus-5-thinking',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmedMessage }
        ],
        max_tokens: maxTokens,
        temperature: 1.0
      })
    });

    const data = await response.json();

    // ===== ERROR HANDLING =====
    if (!response.ok) {
      console.error('❌ GoRouter API error:', data);

      const errorMessage = data.error?.message || data.message || 'Unknown error';

      if (response.status === 401) {
        return res.status(401).json({
          error: 'Authentication failed - check API key',
          success: false
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          error: 'Rate limited - too many requests',
          success: false
        });
      }

      return res.status(response.status).json({
        error: errorMessage,
        success: false
      });
    }

    // ===== SUCCESS RESPONSE =====
    console.log(`✅ Claude response: ${data.usage.output_tokens} tokens`);

    res.json({
      success: true,
      message: data.content[0].text,
      model: data.model,
      usage: {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Server error:', error);

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return res.status(503).json({
        error: 'Cannot reach Claude API - connection error',
        success: false
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      success: false,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Batch Request Endpoint
 * POST /api/claude/batch
 * 
 * For processing multiple questions at once
 * 
 * Body:
 * {
 *   "requests": [
 *     { "message": "Question 1", "context": "hockey" },
 *     { "message": "Question 2", "context": "sports" }
 *   ]
 * }
 */
app.post('/api/claude/batch', async (req, res) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests)) {
      return res.status(400).json({
        error: 'requests must be an array',
        success: false
      });
    }

    if (requests.length === 0) {
      return res.status(400).json({
        error: 'requests array cannot be empty',
        success: false
      });
    }

    if (requests.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 requests per batch',
        success: false
      });
    }

    console.log(`📤 Batch request: ${requests.length} questions`);

    const results = [];

    for (let i = 0; i < requests.length; i++) {
      const { message, context = 'general' } = requests[i];

      try {
        const systemPrompt = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.general;

        const response = await fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-opus-5-thinking',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            max_tokens: 1024,
            temperature: 1.0
          })
        });

        const data = await response.json();

        if (response.ok) {
          results.push({
            success: true,
            message: data.content[0].text,
            usage: data.usage
          });
        } else {
          results.push({
            success: false,
            error: data.error?.message || 'API error'
          });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message
        });
      }

      // Small delay between requests to avoid rate limiting
      if (i < requests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Batch error:', error);
    res.status(500).json({
      error: 'Batch processing failed',
      success: false
    });
  }
});

/**
 * Stream Response Endpoint
 * POST /api/claude/stream
 * 
 * For real-time streaming responses (server-sent events)
 * Useful for UI that shows Claude "typing"
 */
app.post('/api/claude/stream', async (req, res) => {
  try {
    const { message, context = 'general' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const systemPrompt = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.general;

    console.log(`📤 Stream request: ${message.substring(0, 50)}...`);

    // Send initial event
    res.write('data: ' + JSON.stringify({ type: 'start', status: 'processing' }) + '\n\n');

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-opus-5-thinking',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1024,
        temperature: 1.0
      })
    });

    const data = await response.json();

    if (!response.ok) {
      res.write('data: ' + JSON.stringify({
        type: 'error',
        error: data.error?.message || 'API error'
      }) + '\n\n');
      res.end();
      return;
    }

    // Send response in chunks (simulating streaming)
    const fullResponse = data.content[0].text;
    const chunkSize = 20; // characters per chunk

    for (let i = 0; i < fullResponse.length; i += chunkSize) {
      const chunk = fullResponse.substring(i, i + chunkSize);
      res.write('data: ' + JSON.stringify({
        type: 'chunk',
        content: chunk
      }) + '\n\n');

      // Small delay between chunks for visual effect
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Send completion event
    res.write('data: ' + JSON.stringify({
      type: 'complete',
      usage: data.usage
    }) + '\n\n');

    res.end();

  } catch (error) {
    console.error('❌ Stream error:', error);
    res.write('data: ' + JSON.stringify({
      type: 'error',
      error: error.message
    }) + '\n\n');
    res.end();
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 GoRouter Claude API Backend Server');
  console.log('='.repeat(60));
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🌐 Frontend: ${FRONTEND_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 15)}...`);
  console.log(`📊 Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log('='.repeat(60));
  console.log('\n📝 Available endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/claude');
  console.log('  POST /api/claude/batch');
  console.log('  POST /api/claude/stream');
  console.log('\n✅ Ready to accept requests!\n');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📛 Server shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📛 Server interrupted...');
  process.exit(0);
});