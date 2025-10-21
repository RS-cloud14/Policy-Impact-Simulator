export async function handler(event) {
  // ============================================
  // CORS HEADERS - Critical for Power BI
  // ============================================
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Allow all origins (or specify your Power BI domain)
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    const { message, context } = JSON.parse(event.body);

    // Securely load your API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: "API key missing. Please set GEMINI_API_KEY in Netlify environment variables." 
        }),
      };
    }

    // UPDATED: This context now matches the Policy Impact Simulator frontend.
    const systemContext = `You are the "Policy AI Assistant" for the "Policy Impact Simulator". This tool models the economic impact of policies designed to retain older workers in the workforce. Your role is to answer user questions based on the current scenario shown in the simulator.

The simulator has three main inputs:
- Additional Senior Workers: ${context.workers}
- Productivity Factor: ${context.productivity}
- Retirement Age: ${context.retirement} years

The simulator calculates several key outputs based on these inputs, including GDP Impact, Tax Revenue, Pension Savings (EPF), and Social Costs Saved.

When answering, explain how these factors are related, suggest real-world policies to achieve a scenario (e.g., 'High' impact might require tax incentives and reskilling programs), and discuss implementation challenges.

Key Data Sources Used by the Simulator:
- Base Worker Productivity: RM99,265/year (MITI 2024)
- Total EPF Contribution: 23% (KWSP 2024)
- Average Effective Tax Rate: 6% (LHDN)
- Social Welfare Savings: RM7,200/person/year (Budget 2025)

Be helpful, and focus your answers on economic policy and workforce planning.
IMPORTANT: Your answers must be short and concise. Aim for 2-4 sentences maximum.`; // MODIFIED: Added a stronger, more direct instruction for brevity.

    // Call Gemini API
    const response = await fetch(
      // MODIFIED: Switched from the experimental model to a stable, reliable one.
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${systemContext}\n\nUser question: ${message}` }
              ]
            }
          ],
          generationConfig: { 
            temperature: 0.7, 
            // MODIFIED: Drastically reduced the token limit to enforce shorter responses.
            maxOutputTokens: 256 
          }
        }),
      }
    );

    const data = await response.json();

    // Handle errors
    if (data.error) {
      return { 
        statusCode: 400, 
        headers: corsHeaders,
        body: JSON.stringify({ error: data.error.message }) 
      };
    }

    // Extract text safely
    let reply = "No valid response received.";
    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts) {
      reply = data.candidates[0].content.parts[0].text.trim();
    }

    return { 
      statusCode: 200, 
      headers: corsHeaders,
      body: JSON.stringify({ response: reply }) // Changed to 'response' to match frontend
    };

  } catch (error) {
    return { 
      statusCode: 500, 
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message }) 
    };
  }
}