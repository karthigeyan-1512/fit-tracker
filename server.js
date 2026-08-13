const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Add Groq SDK for enhanced AI
const { Groq } = require('groq-sdk');

const app = express();

// Initialize Groq client (only if API key exists)
let groq = null;
if (process.env.GROQ_API_KEY) {
  try {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    console.log('🚀 Groq AI initialized successfully!');
  } catch (error) {
    console.log('⚠️ Groq initialization failed, will use fallback');
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// In-memory storage for demo (replace with database later)
let workouts = [];
let nutritionPlans = [];

// ENHANCED AI Chatbot endpoint with GROQ + existing functionality
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, user, chatHistory } = req.body;
    
    console.log(`🤖 Enhanced AI Chat request from ${user.name}: "${message}"`);
    
    let aiResponse = "";
    
    // TRY GROQ FIRST (Lightning Fast!)
    if (groq) {
      try {
        console.log('⚡ Using Groq for super-fast response...');
        
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `You are FitAI Pro, an expert AI fitness coach integrated into FitTracker AI app.

USER PROFILE:
- Name: ${user.name || 'User'}
- Fitness Level: ${user.fitnessLevel || 'beginner'}
- Goals: ${user.goals?.join(', ') || 'general fitness'}

YOUR EXPERTISE:
- Personal Training & Exercise Science
- Nutrition & Meal Planning  
- Workout Programming
- Injury Prevention & Form Correction
- Motivation & Mental Health
- Sports Performance

RESPONSE STYLE:
- Be encouraging and motivational 💪
- Give specific, actionable advice
- Use the user's name when appropriate
- Keep responses concise but comprehensive (max 200 words)
- Include relevant emojis for engagement
- Always prioritize safety

SPECIAL CAPABILITIES:
- When users ask for workouts, suggest they can be added to their workout plan
- When users ask for nutrition advice, mention meal planning features
- Reference their fitness level and goals in advice
- Provide progressive recommendations

Remember: You're their personal AI trainer integrated into their fitness app!`
            },
            {
              role: "user",
              content: message
            }
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 300,
          top_p: 1,
          stream: false
        });

        aiResponse = chatCompletion.choices[0]?.message?.content || "";
        
        if (aiResponse && aiResponse.length > 20) {
          console.log('✅ Groq responded successfully!');
          
          // Check for workout generation requests
          const lowerMessage = message.toLowerCase();
          if ((lowerMessage.includes('workout') || lowerMessage.includes('exercise')) && 
              (lowerMessage.includes('create') || lowerMessage.includes('generate') || 
               lowerMessage.includes('plan') || lowerMessage.includes('add'))) {
            
            const generatedWorkouts = generatePersonalizedWorkouts(user);
            workouts.unshift(...generatedWorkouts);
            
            return res.json({
              response: aiResponse + "\n\n💪 **Bonus:** I've added some personalized workouts to your workout plan! Check the Workouts tab to see them.",
              workouts: generatedWorkouts,
              timestamp: new Date().toISOString()
            });
          }
          
          // Check for nutrition plan requests
          if ((lowerMessage.includes('nutrition') || lowerMessage.includes('meal') || lowerMessage.includes('diet')) && 
              (lowerMessage.includes('plan') || lowerMessage.includes('create') || lowerMessage.includes('generate'))) {
            
            const nutritionPlan = generateEnhancedNutritionPlan(user);
            nutritionPlans = nutritionPlan;
            
            return res.json({
              response: aiResponse + "\n\n🍎 **Bonus:** I've created a personalized nutrition plan for you! Check the Nutrition tab to view it.",
              nutritionPlan: nutritionPlan,
              timestamp: new Date().toISOString()
            });
          }
          
          // Regular response
          return res.json({
            response: aiResponse,
            timestamp: new Date().toISOString()
          });
        }
      } catch (groqError) {
        console.log('⚠️ Groq API temporarily unavailable, using fallback:', groqError.message);
      }
    }
    
    // FALLBACK 1: Try Hugging Face (Your existing API)
    if (!aiResponse || aiResponse.length < 20) {
      try {
        console.log('🔄 Trying Hugging Face API...');
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: `You are FitAI Pro, an expert fitness coach. User: ${user.name} (${user.fitnessLevel || 'beginner'} level, goals: ${user.goals?.join(', ') || 'fitness'}). Question: "${message}". Give specific, actionable fitness advice with emojis:`,
            parameters: { max_length: 200, temperature: 0.7, do_sample: true }
          })
        });

        const data = await response.json();
        aiResponse = data[0]?.generated_text?.trim() || "";
        
        // Clean up response
        if (aiResponse.includes('You are FitAI')) {
          aiResponse = aiResponse.split('.').slice(1).join('.').trim();
        }
        if (aiResponse.length > 250) aiResponse = aiResponse.substring(0, 250) + "...";
        
        if (aiResponse && aiResponse.length > 20) {
          console.log('✅ Hugging Face responded successfully!');
        }
        
      } catch (hfError) {
        console.log("⚠️ Hugging Face API failed, using enhanced fallback");
      }
    }

    // FALLBACK 2: Enhanced local responses (Your existing system, improved)
    if (!aiResponse || aiResponse.length < 20) {
      console.log('🧠 Using enhanced local AI responses...');
      const response = generateEnhancedAIChatResponse(message.toLowerCase(), user, chatHistory);
      aiResponse = response.message;
      
      // Handle tasks generation
      if (response.tasks) {
        return res.json({
          response: aiResponse,
          tasks: response.tasks,
          timestamp: new Date().toISOString()
        });
      }

      // Handle workout generation and auto-add to workouts
      if (response.workouts) {
        response.workouts.forEach(workout => {
          workouts.unshift(workout);
        });

        return res.json({
          response: aiResponse,
          workouts: response.workouts,
          message: "I've added these workouts to your workout plan!",
          timestamp: new Date().toISOString()
        });
      }
    }
    
    res.json({
      response: aiResponse || "I'm having trouble connecting right now, but I'm here to help with your fitness journey! 💪 Please try again.",
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ AI Chat error:', error);
    res.status(500).json({ 
      message: 'Sorry, I\'m having trouble right now. Please try again! 🤖' 
    });
  }
});

// Enhanced nutrition plan generator (NEW FEATURE)
function generateEnhancedNutritionPlan(user) {
  const level = user.fitnessLevel || 'beginner';
  const goals = user.goals || [];
  
  let nutritionPlan = [];
  
  if (goals.includes('weight_loss')) {
    nutritionPlan = [
      {
        id: 1,
        meal: 'Breakfast',
        food: 'Greek yogurt parfait with berries and almonds',
        calories: 280,
        protein: 20,
        carbs: 25,
        fat: 12,
        time: '7:30 AM',
        reason: '🔥 High protein breakfast kickstarts metabolism',
        tips: '• Add cinnamon for blood sugar control\n• Use plain Greek yogurt'
      },
      {
        id: 2,
        meal: 'Lunch',
        food: 'Grilled chicken Caesar salad (light dressing)',
        calories: 320,
        protein: 35,
        carbs: 12,
        fat: 15,
        time: '12:30 PM',
        reason: '🥗 Lean protein + fiber keeps you satisfied',
        tips: '• Ask for dressing on side\n• Add extra vegetables'
      },
      {
        id: 3,
        meal: 'Snack',
        food: 'Apple slices with almond butter',
        calories: 190,
        protein: 4,
        carbs: 20,
        fat: 8,
        time: '4:00 PM',
        reason: '🍎 Natural sugars + healthy fats prevent crashes',
        tips: '• Measure almond butter portions\n• Choose organic when possible'
      },
      {
        id: 4,
        meal: 'Dinner',
        food: 'Baked salmon with roasted vegetables',
        calories: 350,
        protein: 32,
        carbs: 15,
        fat: 18,
        time: '7:30 PM',
        reason: '🐟 Omega-3s support recovery and heart health',
        tips: '• Season with herbs\n• Include colorful vegetables'
      }
    ];
  } else if (goals.includes('weight_gain') || goals.includes('muscle_gain')) {
    nutritionPlan = [
      {
        id: 1,
        meal: 'Breakfast',
        food: 'Oatmeal with banana, peanut butter, and protein powder',
        calories: 520,
        protein: 25,
        carbs: 65,
        fat: 18,
        time: '7:30 AM',
        reason: '💪 High-calorie start for muscle building',
        tips: '• Use overnight oats\n• Add extra nuts for calories'
      },
      {
        id: 2,
        meal: 'Lunch',
        food: 'Chicken and quinoa power bowl with avocado',
        calories: 650,
        protein: 45,
        carbs: 55,
        fat: 25,
        time: '1:00 PM',
        reason: '🍚 Complete proteins + complex carbs',
        tips: '• Prep quinoa in batches\n• Add olive oil for calories'
      },
      {
        id: 3,
        meal: 'Snack',
        food: 'Greek yogurt with granola and honey',
        calories: 320,
        protein: 18,
        carbs: 40,
        fat: 12,
        time: '4:00 PM',
        reason: '🥛 Protein-rich for muscle recovery',
        tips: '• Choose low-sugar granola\n• Add nuts for protein'
      },
      {
        id: 4,
        meal: 'Dinner',
        food: 'Salmon with quinoa and vegetables',
        calories: 550,
        protein: 40,
        carbs: 45,
        fat: 22,
        time: '7:00 PM',
        reason: '🐟 Complete meal with omega-3 fatty acids',
        tips: '• Include variety of vegetables\n• Cook with healthy oils'
      }
    ];
  } else {
    // General fitness nutrition (your existing logic)
    nutritionPlan = [
      {
        id: 1,
        meal: 'Breakfast',
        food: 'Greek yogurt with berries and nuts',
        calories: 350,
        protein: 20,
        carbs: 30,
        fat: 15,
        time: '8:00 AM',
        reason: 'Balanced macros for sustained energy'
      },
      {
        id: 2,
        meal: 'Lunch',
        food: 'Turkey and hummus wrap',
        calories: 400,
        protein: 25,
        carbs: 35,
        fat: 18,
        time: '1:00 PM',
        reason: 'Balanced meal with lean protein'
      },
      {
        id: 3,
        meal: 'Snack',
        food: 'Mixed nuts and dried fruit',
        calories: 200,
        protein: 8,
        carbs: 20,
        fat: 12,
        time: '4:00 PM',
        reason: 'Healthy fats and natural sugars'
      },
      {
        id: 4,
        meal: 'Dinner',
        food: 'Lean beef with sweet potato',
        calories: 450,
        protein: 30,
        carbs: 35,
        fat: 15,
        time: '7:00 PM',
        reason: 'Complete amino acids with complex carbs'
      }
    ];
  }
  
  return nutritionPlan;
}

// Your existing functions (preserved exactly)
function generateEnhancedAIChatResponse(message, user, chatHistory) {
  const userName = user.name || 'there';
  const fitnessLevel = user.fitnessLevel || 'beginner';
  const goals = user.goals || [];
  
  // Enhanced pattern matching for better responses
  const responses = {
    // Daily tasks and planning
    tasks: {
      keywords: ['task', 'plan', 'daily', 'routine', 'schedule', 'create'],
      response: `Perfect, ${userName}! 📋 I've created a personalized daily plan based on your ${fitnessLevel} level and ${goals.join(', ')} goals. These tasks will help you stay on track with your fitness journey! 💪`,
      generateTasks: true
    },
    
    // Workout suggestions with auto-add to workouts
    workout: {
      keywords: ['workout', 'exercise', 'training', 'gym', 'lift', 'suggestions', 'add this in my workouts', 'add to workouts'],
      response: fitnessLevel === 'beginner' 
        ? `Great question, ${userName}! 🌟 I've created beginner-friendly workouts and added them to your workout plan. These focus on building a solid foundation with proper form.`
        : fitnessLevel === 'intermediate'
        ? `Excellent, ${userName}! 💪 I've added intermediate-level workouts to your plan. These combine compound movements with progressive overload.`
        : `Perfect, ${userName}! 🔥 I've added advanced workouts to your plan with varied training techniques and periodization.`,
      generateWorkouts: true
    },
    
    // Nutrition with goal-specific advice (enhanced with emojis)
    nutrition: {
      keywords: ['nutrition', 'diet', 'food', 'eat', 'meal', 'hungry', 'advice'],
      response: goals.includes('weight_loss')
        ? `Great nutrition question, ${userName}! 🥗 For weight loss:
💡 Create a moderate 300-500 calorie deficit daily
🍗 Eat lean proteins: chicken, fish, tofu, eggs
🥬 Include fiber-rich vegetables with every meal
💧 Drink water before meals to feel fuller
🚫 Avoid liquid calories and processed foods`
        : goals.includes('weight_gain') || goals.includes('muscle_gain')
        ? `Excellent question, ${userName}! 💪 For gaining weight/muscle:
📈 Eat in a 300-500 calorie surplus daily
🥩 Consume 0.8-1g protein per pound bodyweight
🍠 Include healthy carbs: oats, quinoa, sweet potatoes
⏰ Eat every 3-4 hours, don't skip meals
🥑 Add healthy fats: nuts, avocado, olive oil`
        : `Smart nutrition question, ${userName}! 🌟 For general health:
⚖️ Balance each meal with protein, carbs, and healthy fats
🍎 Eat 5-6 servings of fruits and vegetables daily
💧 Stay hydrated with 8+ glasses of water
🌾 Choose whole foods over processed options
🍽️ Practice portion control and mindful eating`
    },
    
    // Motivation and mental support (enhanced)
    motivation: {
      keywords: ['motivate', 'motivation', 'encourage', 'help', 'support', 'hard', 'difficult'],
      response: `${userName}, I believe in you! 💪✨ Remember:
🎯 Every workout counts, no matter how small
📈 Progress isn't always linear - trust the process
🔄 Consistency beats perfection every time
🏗️ You're building habits that will last a lifetime
🎉 Celebrate small wins along the way!

You've already taken the hardest step by starting. Keep going! 🚀`
    },
    
    // Weight management specific (enhanced)
    weight: {
      keywords: ['weight', 'lose', 'gain', 'fat', 'pounds', 'kg'],
      response: goals.includes('weight_loss')
        ? `For sustainable weight loss, ${userName}! 🎯
📊 Aim for 1-2 pounds per week maximum
🏃‍♀️ Combine cardio (150+ min/week) with strength training
📝 Track your food intake honestly
⚖️ Weigh yourself weekly at the same time
❤️ Focus on how you feel, not just the scale number`
        : goals.includes('weight_gain')
        ? `For healthy weight gain, ${userName}! 💪
📈 Aim for 0.5-1 pound per week
🏋️‍♀️ Focus on building muscle, not just adding fat
🍎 Eat nutrient-dense, calorie-rich foods
💪 Strength train 3-4x per week consistently
⏰ Be patient - quality gains take time`
        : `For weight management, ${userName}! ⚖️
🎯 Focus on body composition over just weight
💪 Build lean muscle through resistance training
🔄 Maintain through balanced nutrition and activity
💡 Remember: muscle weighs more than fat
📸 Track progress through photos and measurements too`
    },
    
    // Muscle building (enhanced)
    muscle: {
      keywords: ['muscle', 'build', 'gain', 'strength', 'bulk', 'mass'],
      response: `For muscle building, ${userName}! 💪
📈 Progressive overload is key - gradually increase weight/reps
🏋️‍♀️ Focus on compound exercises: squats, deadlifts, bench press, rows
🥩 Eat 0.8-1g protein per pound of bodyweight daily
😴 Get 7-9 hours of quality sleep for recovery
🔄 Train each muscle group 2-3x per week
⏰ Be patient - visible muscle growth takes 8-12 weeks`
    },
    
    // Cardio specific (enhanced)
    cardio: {
      keywords: ['cardio', 'running', 'cycling', 'swimming', 'hiit', 'endurance'],
      response: fitnessLevel === 'beginner'
        ? `Great cardio question, ${userName}! 🏃‍♀️ For beginners:
🚶‍♀️ Start with 20-30 minutes of brisk walking
🏃‍♀️ Gradually increase to light jogging
🚴‍♀️ Try low-impact options: cycling, swimming, elliptical
📅 Aim for 3-4 sessions per week
👂 Listen to your body and build slowly`
        : `Excellent, ${userName}! 🔥 For your level:
⚡ Mix steady-state cardio (30-45 min) with HIIT (15-20 min)
⏱️ Try interval training: 30 sec work, 30 sec rest
🏃‍♀️ Include various activities: running, cycling, rowing
🎯 Aim for 150+ minutes moderate cardio per week
❤️ Track your heart rate zones for optimal training`
    }
  };

  // Find the best matching response (your existing logic)
  let bestMatch = null;
  let maxMatches = 0;

  for (const [category, data] of Object.entries(responses)) {
    const matches = data.keywords.filter(keyword => message.includes(keyword)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = data;
    }
  }

  if (bestMatch) {
    if (bestMatch.generateTasks) {
      const tasks = generateEnhancedDailyTasks(user);
      return {
        message: bestMatch.response,
        tasks: tasks
      };
    }

    if (bestMatch.generateWorkouts) {
      const generatedWorkouts = generatePersonalizedWorkouts(user);
      return {
        message: bestMatch.response,
        workouts: generatedWorkouts
      };
    }

    return { message: bestMatch.response };
  }

  // Default helpful response (enhanced)
  return { 
    message: `Hi ${userName}! 👋 As your AI fitness coach, I'm here to provide personalized advice for your ${fitnessLevel} level and ${goals.join(', ')} goals. 

🎯 I can help with:
💪 Custom workout plans (I can add them directly to your workouts!)
🥗 Nutrition guidance and meal planning
📋 Daily task planning
🔥 Motivation and support

What specific fitness topic would you like to work on today? 🚀` 
  };
}

// All your existing functions (preserved exactly as they are)
function generatePersonalizedWorkouts(user) {
  const level = user.fitnessLevel || 'beginner';
  const goals = user.goals || [];
  const userName = user.name || 'User';
  
  let workouts = [];

  if (level === 'beginner') {
    workouts = [
      {
        id: Date.now(),
        type: 'Bodyweight Training',
        duration: 20,
        calories: 150,
        date: new Date(),
        notes: 'AI Generated: Focus on proper form. 3 sets of push-ups (5-10 reps), squats (10-15 reps), planks (30-60 sec)'
      },
      {
        id: Date.now() + 1,
        type: 'Walking',
        duration: 30,
        calories: 120,
        date: new Date(),
        notes: 'AI Generated: Brisk 30-minute walk. Maintain steady pace, focus on breathing'
      },
      {
        id: Date.now() + 2,
        type: 'Flexibility & Stretching',
        duration: 15,
        calories: 50,
        date: new Date(),
        notes: 'AI Generated: Full body stretching routine. Hold each stretch for 20-30 seconds'
      }
    ];
  } else if (level === 'intermediate') {
    workouts = [
      {
        id: Date.now(),
        type: 'Compound Strength Training',
        duration: 45,
        calories: 300,
        date: new Date(),
        notes: 'AI Generated: Squats, deadlifts, bench press. 3-4 sets of 8-12 reps with progressive overload'
      },
      {
        id: Date.now() + 1,
        type: 'HIIT Cardio',
        duration: 25,
        calories: 250,
        date: new Date(),
        notes: 'AI Generated: 30 sec work, 30 sec rest intervals. Include burpees, mountain climbers, jump squats'
      },
      {
        id: Date.now() + 2,
        type: 'Core & Conditioning',
        duration: 20,
        calories: 120,
        date: new Date(),
        notes: 'AI Generated: Planks, Russian twists, leg raises. Focus on controlled movements'
      }
    ];
  } else {
    workouts = [
      {
        id: Date.now(),
        type: 'Advanced Strength Circuit',
        duration: 60,
        calories: 400,
        date: new Date(),
        notes: 'AI Generated: Complex movements with supersets. Vary rep ranges: 3-5 strength, 8-12 hypertrophy'
      },
      {
        id: Date.now() + 1,
        type: 'High-Intensity Intervals',
        duration: 30,
        calories: 350,
        date: new Date(),
        notes: 'AI Generated: Advanced HIIT with plyometrics. Focus on explosive movements and recovery'
      },
      {
        id: Date.now() + 2,
        type: 'Functional Movement',
        duration: 40,
        calories: 280,
        date: new Date(),
        notes: 'AI Generated: Multi-plane movements, unilateral exercises, core stability integration'
      }
    ];
  }

  // Adjust based on goals
  if (goals.includes('weight_loss')) {
    workouts.forEach(workout => {
      if (workout.type.includes('Cardio') || workout.type.includes('HIIT')) {
        workout.calories = Math.round(workout.calories * 1.2); // Boost cardio calories
        workout.notes += ' - Optimized for weight loss';
      }
    });
  } else if (goals.includes('muscle_gain')) {
    workouts.forEach(workout => {
      if (workout.type.includes('Strength') || workout.type.includes('Training')) {
        workout.duration = Math.round(workout.duration * 1.1); // Longer strength sessions
        workout.notes += ' - Optimized for muscle building';
      }
    });
  }

  return workouts;
}

function generateEnhancedDailyTasks(user) {
  const level = user.fitnessLevel || 'beginner';
  const goals = user.goals || [];
  
  const baseTasks = [
    {
      id: 1,
      title: "Morning Movement",
      description: level === 'beginner' ? "10-minute gentle stretching or light walk" : "15-minute dynamic warm-up routine",
      completed: false,
      priority: 'high',
      estimatedTime: level === 'beginner' ? '10 minutes' : '15 minutes',
      type: 'mobility'
    },
    {
      id: 2,
      title: goals.includes('weight_loss') ? "Cardio Session" : goals.includes('muscle_gain') ? "Strength Training" : "Workout Session",
      description: goals.includes('weight_loss') ? "30-minute moderate cardio workout" : goals.includes('muscle_gain') ? "45-minute strength training session" : "30-minute mixed workout",
      completed: false,
      priority: 'high',
      estimatedTime: goals.includes('muscle_gain') ? '45 minutes' : '30 minutes',
      type: 'exercise'
    },
    {
      id: 3,
      title: "Smart Nutrition",
      description: goals.includes('weight_loss') ? "Track meals and stay within calorie goals" : goals.includes('weight_gain') ? "Eat protein-rich meals every 3-4 hours" : "Eat balanced meals with protein, carbs, and healthy fats",
      completed: false,
      priority: 'high',
      estimatedTime: 'Throughout day',
      type: 'nutrition'
    },
    {
      id: 4,
      title: "Hydration Goal",
      description: "Drink at least 8 glasses of water throughout the day",
      completed: false,
      priority: 'medium',
      estimatedTime: 'All day',
      type: 'health'
    },
    {
      id: 5,
      title: "Recovery & Rest",
      description: level === 'beginner' ? "10-minute evening relaxation" : "15-minute post-workout stretching",
      completed: false,
      priority: 'medium',
      estimatedTime: level === 'beginner' ? '10 minutes' : '15 minutes',
      type: 'recovery'
    }
  ];

  return baseTasks;
}

// All your existing endpoints (preserved exactly)
app.post('/api/ai/recommendations', async (req, res) => {
  try {
    const user = req.body;
    const recommendations = [
      {
        type: 'workout',
        title: 'Start Your Fitness Journey!',
        description: 'Begin with 3 moderate workouts per week. Consistency is key to building healthy habits.',
        confidence: 0.95
      }
    ];
    res.json(recommendations);
  } catch (error) {
    console.error('AI Recommendations error:', error);
    res.status(500).json({ message: 'Error generating AI recommendations' });
  }
});

app.get('/api/workouts', (req, res) => {
  res.json(workouts);
});

app.post('/api/workouts', (req, res) => {
  const newWorkout = {
    id: Date.now(),
    ...req.body,
    date: new Date()
  };
  workouts.unshift(newWorkout);
  res.status(201).json(newWorkout);
});

app.get('/api/nutrition', (req, res) => {
  res.json(nutritionPlans);
});

app.post('/api/nutrition/generate-plan', (req, res) => {
  try {
    const { user } = req.body;
    const goals = user.goals || [];
    const fitnessLevel = user.fitnessLevel || 'beginner';
    
    let nutritionPlan = [];
    
    // Generate AI-based food suggestions based on user goals
    if (goals.includes('weight_gain') || goals.includes('muscle_gain')) {
      nutritionPlan = [
        {
          id: 1,
          meal: 'Breakfast',
          food: 'Oatmeal with banana and peanut butter',
          calories: 450,
          protein: 15,
          carbs: 65,
          fat: 18,
          time: '8:00 AM',
          reason: 'High in carbs and healthy fats for weight gain'
        },
        {
          id: 2,
          meal: 'Lunch',
          food: 'Chicken rice bowl with avocado',
          calories: 600,
          protein: 45,
          carbs: 50,
          fat: 25,
          time: '1:00 PM',
          reason: 'Protein and carbs for muscle building'
        },
        {
          id: 3,
          meal: 'Snack',
          food: 'Greek yogurt with granola',
          calories: 300,
          protein: 20,
          carbs: 35,
          fat: 8,
          time: '4:00 PM',
          reason: 'Protein-rich snack for muscle recovery'
        },
        {
          id: 4,
          meal: 'Dinner',
          food: 'Salmon with quinoa and vegetables',
          calories: 550,
          protein: 40,
          carbs: 45,
          fat: 22,
          time: '7:00 PM',
          reason: 'Complete meal with omega-3 fatty acids'
        }
      ];
    } else if (goals.includes('weight_loss')) {
      nutritionPlan = [
        {
          id: 1,
          meal: 'Breakfast',
          food: 'Egg white omelet with vegetables',
          calories: 250,
          protein: 25,
          carbs: 8,
          fat: 5,
          time: '8:00 AM',
          reason: 'High protein, low calorie for weight loss'
        },
        {
          id: 2,
          meal: 'Lunch',
          food: 'Grilled chicken salad',
          calories: 350,
          protein: 35,
          carbs: 15,
          fat: 12,
          time: '1:00 PM',
          reason: 'Lean protein with fiber-rich vegetables'
        },
        {
          id: 3,
          meal: 'Snack',
          food: 'Apple with almond butter',
          calories: 200,
          protein: 6,
          carbs: 25,
          fat: 8,
          time: '4:00 PM',
          reason: 'Natural sugars with healthy fats'
        },
        {
          id: 4,
          meal: 'Dinner',
          food: 'Baked fish with steamed broccoli',
          calories: 300,
          protein: 35,
          carbs: 10,
          fat: 8,
          time: '7:00 PM',
          reason: 'Light, protein-rich evening meal'
        }
      ];
    } else {
      // General fitness nutrition
      nutritionPlan = [
        {
          id: 1,
          meal: 'Breakfast',
          food: 'Greek yogurt with berries and nuts',
          calories: 350,
          protein: 20,
          carbs: 30,
          fat: 15,
          time: '8:00 AM',
          reason: 'Balanced macros for sustained energy'
        },
        {
          id: 2,
          meal: 'Lunch',
          food: 'Turkey and hummus wrap',
          calories: 400,
          protein: 25,
          carbs: 35,
          fat: 18,
          time: '1:00 PM',
          reason: 'Balanced meal with lean protein'
        },
        {
          id: 3,
          meal: 'Snack',
          food: 'Mixed nuts and dried fruit',
          calories: 200,
          protein: 8,
          carbs: 20,
          fat: 12,
          time: '4:00 PM',
          reason: 'Healthy fats and natural sugars'
        },
        {
          id: 4,
          meal: 'Dinner',
          food: 'Lean beef with sweet potato',
          calories: 450,
          protein: 30,
          carbs: 35,
          fat: 15,
          time: '7:00 PM',
          reason: 'Complete amino acids with complex carbs'
        }
      ];
    }
    
    // Store the generated plan
    nutritionPlans = nutritionPlan;
    
    res.json({
      plan: nutritionPlan,
      totalCalories: nutritionPlan.reduce((sum, meal) => sum + meal.calories, 0),
      totalProtein: nutritionPlan.reduce((sum, meal) => sum + meal.protein, 0),
      message: `I've created a personalized nutrition plan based on your ${goals.join(', ')} goals!`
    });
  } catch (error) {
    console.error('Nutrition plan generation error:', error);
    res.status(500).json({ message: 'Error generating nutrition plan' });
  }
});

app.put('/api/nutrition/:id', (req, res) => {
  const { id } = req.params;
  const updatedMeal = req.body;
  
  const index = nutritionPlans.findIndex(meal => meal.id === parseInt(id));
  if (index !== -1) {
    nutritionPlans[index] = { ...nutritionPlans[index], ...updatedMeal };
    res.json(nutritionPlans[index]);
  } else {
    res.status(404).json({ message: 'Meal not found' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server running with GROQ AI + enhanced responses and workout generation',
    ai_status: groq ? 'Groq AI Active ⚡' : 'Fallback AI Active 🤖',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`🤖 Enhanced AI Chat ready with ${groq ? 'GROQ Lightning Speed ⚡' : 'Fallback AI 🤖'}!`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
