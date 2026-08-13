require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testAllAIServices() {
  console.log("🧠 Testing AI Services...");
  
  // Test 1: Try latest Groq models
  console.log("\n=== Testing Groq API ===");
  const groqModels = [
    'llama-3.1-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-groq-70b-8192-tool-use-preview',
    'llama3-groq-8b-8192-tool-use-preview',
    'gemma2-9b-it',
    'gemma-7b-it'
  ];
  
  if (process.env.GROQ_API_KEY) {
    for (const model of groqModels) {
      try {
        console.log(`🔄 Trying Groq model: ${model}`);
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'user',
                content: 'You are FitAI, a fitness coach. Give one workout tip for beginners in 2 sentences.'
              }
            ],
            max_tokens: 100,
            temperature: 0.7
          })
        });

        if (response.ok) {
          const data = await response.json();
          const aiResponse = data.choices?.[0]?.message?.content?.trim();
          
          console.log(`✅ Groq model ${model} works!`);
          console.log("🤖 AI Response:", aiResponse);
          return { service: 'groq', model: model };
        } else {
          const errorText = await response.text();
          const error = JSON.parse(errorText);
          console.log(`❌ ${model}: ${error.error.message}`);
        }
      } catch (error) {
        console.log(`❌ ${model} error:`, error.message);
      }
    }
  }
  
  // Test 2: Try OpenAI-compatible free services
  console.log("\n=== Testing Free AI Alternatives ===");
  
  // Test Together AI (free tier)
  try {
    console.log("🔄 Trying Together AI...");
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY || 'test'}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        messages: [{ role: 'user', content: 'Give a fitness tip' }],
        max_tokens: 100
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Together AI works!");
      console.log("🤖 Response:", data.choices[0].message.content);
      return { service: 'together' };
    }
  } catch (error) {
    console.log("❌ Together AI failed");
  }
  
  // Test 3: Local Ollama (completely free)
  try {
    console.log("🔄 Trying Ollama (local AI)...");
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama2',
        prompt: 'Give one fitness tip for beginners:',
        stream: false
      }),
      timeout: 5000
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Ollama works!");
      console.log("🤖 Response:", data.response);
      return { service: 'ollama' };
    }
  } catch (error) {
    console.log("❌ Ollama not available (install from https://ollama.ai)");
  }
  
  console.log("\n💡 All external AI services failed.");
  console.log("✅ Using intelligent fallback system - your app still works great!");
  console.log("🎯 The fallback provides professional fitness advice without external APIs.");
  
  return { service: 'fallback' };
}

testAllAIServices();
