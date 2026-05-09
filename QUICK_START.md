# Quick Start - 5 Minutes to First Interview

## Step 1: Get API Key (2 min)

1. Go to https://console.anthropic.com/
2. Sign up or log in
3. Click "API Keys"
4. Click "Create Key"
5. Copy your key (starts with `sk-ant-...`)

## Step 2: Setup (2 min)

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and paste your API key
# ANTHROPIC_API_KEY=sk-ant-your-key-here
```

## Step 3: Run (1 min)

**Terminal** - Start backend:
```bash
npm start
```

You should see:
```
✅ AI PM Interview API running on port 3000
```

**Browser** - Open `voice-interface.html` in Chrome

## Step 4: Practice!

1. Allow microphone access
2. Select "Product Design"
3. Click "Start Interview"
4. Listen to AI question
5. Click "Speak" button
6. Answer the question
7. Click "Stop" when done
8. Get instant feedback!

## Example Interview

**AI**: "Design a fitness app for busy professionals."

**You**: "Let me use the CIRCLES framework. First, I want to clarify the situation. Are we targeting people who work 9-5 office jobs..."

**AI**: "Good start! Can you tell me more about what specific pain points these professionals face with existing fitness apps?"

**You**: "The main issue is time. They might only have 15-20 minutes..."

## Tips

✅ Use frameworks (CIRCLES, STAR)  
✅ Think out loud  
✅ Be specific with examples  
✅ Consider tradeoffs  

## Common Issues

**No microphone?**
- Check browser permissions
- Use Chrome or Edge

**API error?**
- Verify API key in `.env`
- Check backend is running

**No voice response?**
- Wait a few seconds (Claude is thinking!)
- Check browser console for errors

Ready? Start your first interview! 🚀
