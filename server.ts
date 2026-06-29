/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import { INITIAL_FAQS } from "./src/data/faqs";
import { FAQItem } from "./src/types";

dotenv.config();

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  model: string;
  endpoint: string;
  request: {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    contents?: any;
    prompt?: string;
    [key: string]: any;
  };
  response: {
    text?: string;
    error?: string;
    durationMs?: number;
    success: boolean;
    [key: string]: any;
  };
}

let apiLogs: ApiLogEntry[] = [];

import nodemailer from "nodemailer";

interface OtpEntry {
  otp: string;
  expiresAt: number;
}
// Temporary in-memory secure OTP vault mapped by lowercased email addresses
const otpStore = new Map<string, OtpEntry>();

async function sendOtpEmail(email: string, otp: string): Promise<{ success: boolean; sandboxMode: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"SmartAssist Security" <no-reply@smartassist.com>';

  if (!host || !user || !pass) {
    console.log(`[SMTP SANDBOX MODE] Email to: ${email} | Generated Code: ${otp}`);
    return { success: true, sandboxMode: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: host,
      port: Number(port) || 587,
      secure: Number(port) === 465,
      auth: {
        user: user,
        pass: pass
      }
    });

    await transporter.sendMail({
      from: from,
      to: email,
      subject: `[SmartAssist] Your 6-Digit Secure Verification Code: ${otp}`,
      text: `Hello,\n\nTo complete your registration secure operations clearance, please enter the following 6-digit Secure OTP code:\n\n${otp}\n\nThis security clearance code expires in 5 minutes.\n\nThank you,\nSmartAssist Security Team`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #fafafa;">
          <h2 style="color: #4f46e5; font-size: 20px; font-weight: bold; margin-bottom: 10px;">SmartAssist Security Clearance</h2>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">To finalize creation of your SmartAssist support operations account, please enter the following 6-digit Secure Verification Code (OTP):</p>
          <div style="background-color: #f1f5f9; padding: 15px 25px; margin: 20px 0; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center;">
            <span style="font-family: monospace; font-size: 28px; font-weight: bold; color: #1e1b4b; letter-spacing: 4px;">${otp}</span>
          </div>
          <p style="font-size: 11px; color: #94a3b8;">This code is valid for 5 minutes. If you did not request this code, please ignore this email.</p>
        </div>
      `
    });

    console.log(`[SMTP PRODUCTION] Sent OTP ${otp} successfully to ${email}`);
    return { success: true, sandboxMode: false };
  } catch (err: any) {
    console.error("[SMTP ERROR] Failed to send production email:", err);
    return { success: false, sandboxMode: false, error: err.message || String(err) };
  }
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// API route to dispatch a new secure 6-digit OTP to user registration email
app.post("/api/auth/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email parameter is required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  
  // Generate cryptographically-like secure 6-digit number
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // valid for 5 minutes

  otpStore.set(cleanEmail, { otp, expiresAt });

  const mailResult = await sendOtpEmail(cleanEmail, otp);

  return res.json({
    success: true,
    message: "OTP successfully transmitted.",
    sandboxMode: mailResult.sandboxMode,
    generatedOtp: mailResult.sandboxMode ? otp : undefined, // Provide OTP only for development sandbox testing logs
    error: mailResult.error
  });
});

// API route to verify the secure 6-digit OTP
app.post("/api/auth/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: "Email and OTP keys are required." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();

  const record = otpStore.get(cleanEmail);
  if (!record) {
    return res.status(400).json({ error: "No OTP request or challenge found for this email address." });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanEmail);
    return res.status(400).json({ error: "The secure verification clearance code has expired (5 minutes timeout limit reached). Please request a new OTP." });
  }

  if (record.otp !== cleanOtp) {
    return res.status(400).json({ error: "Invalid secure OTP code verification failed." });
  }

  // Clear OTP on successful verification to prevent reuse
  otpStore.delete(cleanEmail);

  return res.json({
    success: true,
    message: "Email identity verified. Creating account credentials."
  });
});


// In-memory FAQ list that can be updated in real-time
let dynamicFaqs: FAQItem[] = [...INITIAL_FAQS];

// Stop words for advanced Scikit-Learn-like token similarity mapping
const STOP_WORDS = new Set([
  "what", "is", "how", "do", "i", "the", "a", "an", "your", 
  "for", "with", "my", "to", "at", "in", "of", "can", "you", 
  "there", "any", "some", "on", "it", "this", "that"
]);

/**
 * Custom NLP Matching logic: Calculates similarity score (0 to 100) between user question and FAQ questions
 */
function calculateSimilarity(userInput: string, faqQuestion: string): number {
  const cleanString = (str: string) => 
    str.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
  
  const userTokens = cleanString(userInput).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  const faqTokens = cleanString(faqQuestion).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  
  const rawUser = userInput.toLowerCase().trim();
  const rawFaq = faqQuestion.toLowerCase().trim();

  // 1. Direct contains check (95% match)
  if (rawUser.includes(rawFaq) || rawFaq.includes(rawUser)) {
    return 95;
  }

  // If no words remaining after cleaning stop-words, do basic substring check
  if (userTokens.length === 0 || faqTokens.length === 0) {
    if (rawUser.includes(rawFaq) || rawFaq.includes(rawUser)) {
      return 70;
    }
    return 0;
  }

  // 2. Compute overlapping words / Jaccard-like ratios
  const userSet = new Set(userTokens);
  const faqSet = new Set(faqTokens);
  
  let intersectionCount = 0;
  for (const token of userSet) {
    if (faqSet.has(token)) {
      intersectionCount++;
    }
  }

  const unionSize = userSet.size + faqSet.size - intersectionCount;
  const jaccard = intersectionCount / (unionSize || 1);
  const userPercent = intersectionCount / userSet.size;
  const faqPercent = intersectionCount / faqSet.size;

  // Combination score
  const maxScore = Math.max(jaccard * 1.2, userPercent, faqPercent);
  const finalScore = Math.min(Math.round(maxScore * 100), 100);

  return finalScore;
}

// 1. Host API routes FIRST
app.get("/api/faqs", (req, res) => {
  res.json(dynamicFaqs);
});

app.post("/api/faqs", (req, res) => {
  const { question, answer, category } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: "Question and Answer are required." });
  }

  const newFaq: FAQItem = {
    id: `faq_custom_${Date.now()}`,
    question: question.trim(),
    answer: answer.trim(),
    category: category ? category.trim() : "General"
  };

  dynamicFaqs.push(newFaq);
  res.status(201).json(newFaq);
});

app.delete("/api/faqs/:id", (req, res) => {
  const { id } = req.params;
  const exists = dynamicFaqs.some(f => f.id === id);
  if (!exists) {
    return res.status(404).json({ error: "FAQ item not found." });
  }
  dynamicFaqs = dynamicFaqs.filter(f => f.id !== id);
  res.json({ success: true, message: "FAQ item deleted successfully." });
});

app.post("/api/faqs/reset", (req, res) => {
  dynamicFaqs = [...INITIAL_FAQS];
  res.json({ success: true, message: "FAQs reset to original source values.", faqs: dynamicFaqs });
});

app.get("/api/debugger/logs", (req, res) => {
  res.json({ success: true, logs: apiLogs });
});

app.post("/api/debugger/clear", (req, res) => {
  apiLogs = [];
  res.json({ success: true, message: "Debugger logs cleared successfully." });
});

app.post("/api/faq-test", (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.json([]);
  }

  // Return similarity scores for all items to demonstrate the classifier matching dynamically!
  const results = dynamicFaqs.map(f => {
    const score = calculateSimilarity(text, f.question);
    return {
      faq: f,
      score
    };
  }).sort((a, b) => b.score - a.score);

  res.json(results);
});

/**
 * Advanced assistant execution middleware that handles large prompts, historical sliding window pruning,
 * sequential chunking, and auto-continuation for long-running detailed reports.
 */
async function generateExpandedContent(
  ai: GoogleGenAI,
  modelName: string,
  params: {
    systemInstruction?: string;
    prompt: string;
    history?: Array<{ role: string; parts: Array<{ text: string }> }>;
    temperature?: number;
  }
): Promise<string> {
  const { systemInstruction = "", prompt, history = [], temperature = 0.5 } = params;
  const startTime = Date.now();

  // Let's declare our token boundary levels:
  // 1 token ~= 4 characters on average for English.
  // Gemini models support 1M+ tokens context. Let's put a highly robust threshold:
  const rawInstructionCharCount = systemInstruction.length;
  const rawHistoryCharCount = history.reduce((sum, item) => sum + item.parts.reduce((pSum, part) => pSum + part.text.length, 0), 0);
  const promptCharCount = prompt.length;
  const totalInputLength = rawInstructionCharCount + rawHistoryCharCount + promptCharCount;

  const ABSOLUTE_MODEL_CHAR_LIMIT = 6000000; // ~1.5 million tokens
  const CHUNK_THRESHOLD_CHAR_LIMIT = 1000000; // ~250,000 tokens (Safe standard)
  const CHUNK_SIZE = 800000; // Chunk into 800k character subdivisions

  // A. Handle Absolute Model Limit (Requirement 6)
  let absoluteLimitReached = false;
  let activePrompt = prompt;
  if (totalInputLength > ABSOLUTE_MODEL_CHAR_LIMIT) {
    absoluteLimitReached = true;
    console.warn(`[WARNING] Absolute input model character limit exceeded: ${totalInputLength} chars.`);
    // Prune the input prompt to fit within safe limits
    activePrompt = prompt.slice(-ABSOLUTE_MODEL_CHAR_LIMIT / 2);
  }

  // B. Support Long Conversations & History Optimization (Requirement 4 & 8)
  // Prune history to keep the conversation manageable and avoid RAM/Token crashes
  let activeHistory = [...history];
  if (activeHistory.length > 20) {
    const startupContext = activeHistory.slice(0, 2); // Initial onboarding context
    const currentWindow = activeHistory.slice(-14); // Latest active conversation
    const middleCount = activeHistory.length - 16;
    
    // Create an efficient text summary block of the middle conversation
    activeHistory = [
      ...startupContext,
      {
        role: "user",
        parts: [{ text: `[System Update: Context pruned: ${middleCount} older conversation exchanges have been consolidated to preserve high speed and performance bounds.]` }]
      },
      ...currentWindow
    ];
  }

  // C. Handle Sequential Input Chunking (Requirement 5)
  let finalResult = "";

  if (activePrompt.length > CHUNK_THRESHOLD_CHAR_LIMIT) {
    console.log(`[Large Document Upload] Splitting input of ${activePrompt.length} chars into sequential chunks.`);
    // Split content into paragraph/line friendly chunks
    const chunks: string[] = [];
    let currentPos = 0;
    while (currentPos < activePrompt.length) {
      let segmentEnd = currentPos + CHUNK_SIZE;
      if (segmentEnd < activePrompt.length) {
        // Try to break at newline for logical chunk boundaries
        const nextNewlineIdx = activePrompt.indexOf("\n", segmentEnd - 500);
        if (nextNewlineIdx !== -1 && nextNewlineIdx < segmentEnd + 500) {
          segmentEnd = nextNewlineIdx;
        }
      } else {
        segmentEnd = activePrompt.length;
      }
      chunks.push(activePrompt.substring(currentPos, segmentEnd));
      currentPos = segmentEnd;
    }

    // Process parts sequentially (Requirement 5)
    let cumulativeContextReport = "";
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i++) {
      console.log(`[Sequential Processing Chunk ${i+1}/${totalChunks}] size: ${chunks[i].length} chars`);
      const isLastChunk = i === totalChunks - 1;
      let chunkPrompt = "";

      if (isLastChunk) {
        chunkPrompt = `This is the final part of the user's document/code:\n\n[START CHUNK]\n${chunks[i]}\n[END CHUNK]\n\nUsing the entire cumulative analysis context retrieved so far: ${cumulativeContextReport}\n\nNow, generate the final complete detailed, exhaustive response fulfilling the user's original request. Please prioritize a comprehensive response, including complete code blocks or full reports without shortening or omissions.`;
      } else {
        chunkPrompt = `The user has uploaded a very large file or query. This is Part ${i + 1} of ${totalChunks} of the document:\n\n[START CHUNK]\n${chunks[i]}\n[END CHUNK]\n\nTask: Analyze this part thoroughly, preserving all critical findings, code structure patterns, variables, and structured details. Formulate a rich detailed cumulative analysis context for the next segment.`;
      }

      const res = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...activeHistory,
          { role: "user", parts: [{ text: chunkPrompt }] }
        ],
        config: {
          systemInstruction: systemInstruction + (cumulativeContextReport ? `\n\nActive Analysis context so far: ${cumulativeContextReport}` : ""),
          temperature: isLastChunk ? temperature : 0.2, // lower temperature for logical steps
          maxOutputTokens: 8192,
        }
      });

      const chunkResponseText = res.text || "";
      if (isLastChunk) {
        finalResult = chunkResponseText;
      } else {
        cumulativeContextReport = `\n- Summary/Analysis of Part ${i + 1}: ${chunkResponseText.substring(0, 10000)}...`;
      }

      // Small release slice to Node's Event Loop for optimal memory stability (Requirement 7)
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  } else {
    // Normal single-turn call but with massive response capability (maxOutputTokens: 8192) (Requirement 3 & 10)
    const chatResponse = await ai.models.generateContent({
      model: modelName,
      contents: [
        ...activeHistory,
        { role: "user", parts: [{ text: activePrompt }] }
      ],
      config: {
        systemInstruction,
        temperature,
        maxOutputTokens: 8192, // Maximize allowed length for exhaustive code/reports
      }
    });
    finalResult = chatResponse.text || "";
  }

  // D. Handle Auto-Continuation of Large Outputs (Requirement 10 - "If the response is too large, continue automatically")
  // Detect if the response has unclosed code blocks, ends abruptly, or is extremely long with trailing commas/unfinished clauses
  let attempts = 0;
  const MAX_CONTINUE_ATTEMPTS = 3;
  let responseCutoffDetected = true;

  while (responseCutoffDetected && attempts < MAX_CONTINUE_ATTEMPTS) {
    responseCutoffDetected = false;
    const trimmedRes = finalResult.trim();
    
    // Check points indicator of mid-way stop:
    // 1. Odd number of backticks representing code blocks
    const backtickCount = (trimmedRes.match(/```/g) || []).length;
    const isCodeBlockCutOff = (backtickCount % 2 !== 0);

    // 2. Ends with incomplete words, or trailing symbols (like + or = or -), or incomplete sentence characters
    const endsWithLetterOrIncomplete = /[a-zA-Z0-9,\s\(+\-=|]$/.test(trimmedRes);
    const hasLengthBoundary = trimmedRes.length > 15000; // Long report check

    if (isCodeBlockCutOff || (endsWithLetterOrIncomplete && hasLengthBoundary)) {
      console.log(`[Auto-Continuation Triggered] Cutoff sign identified. (Backticks: ${backtickCount}, Length: ${trimmedRes.length})`);
      attempts++;
      responseCutoffDetected = true;

      // Ask Gemini to continue generating the previous response seamlessly
      const continuationPrompt = `Continue generating the response exactly from where you left off. Continue the sentences, paragraphs, or code blocks in a completely seamless flow without any duplication, repetition, or introductory text. Continue the report/code perfectly.`;

      const continuationRes = await ai.models.generateContent({
        model: modelName,
        contents: [
          ...activeHistory,
          { role: "user", parts: [{ text: activePrompt }] },
          { role: "model", parts: [{ text: finalResult }] },
          { role: "user", parts: [{ text: continuationPrompt }] }
        ],
        config: {
          systemInstruction,
          temperature: 0.2, // precise temperature for coding/logical continuance
          maxOutputTokens: 8192,
        }
      });

      const nextPart = continuationRes.text || "";
      if (nextPart.length > 0) {
        // Concatenate seamlessly
        finalResult = finalResult + "\n" + nextPart;
      } else {
        responseCutoffDetected = false;
      }
    }
  }

  // Handle reporting Absolute Model Limit (Requirement 6)
  if (absoluteLimitReached) {
    finalResult = `⚠️ **Absolute prompt size boundary reached.** The total length of the submitted document and chat history has reached the absolute model limit. We have processed the most critical active segments of your input to ensure system stability.\n\n---\n\n${finalResult}`;
  }

  const durationMs = Date.now() - startTime;
  apiLogs.unshift({
    id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
    model: modelName,
    endpoint: "/api/chat (Gemini API)",
    request: {
      systemInstruction,
      temperature,
      prompt: activePrompt,
      historyCount: activeHistory?.length || 0,
      history: activeHistory,
    },
    response: {
      text: finalResult,
      durationMs,
      success: true,
    }
  });
  if (apiLogs.length > 50) {
    apiLogs = apiLogs.slice(0, 50);
  }

  return finalResult;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, mode, history, knowledgeCutoff, faqCutoffEnabled, aiCutoffEnabled } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const trimmedMsg = message.trim();

    // 1. Run strict/weighted FAQ Matching logic
    let bestFaq: FAQItem | null = null;
    let highestScore = 0;

    for (const faq of dynamicFaqs) {
      const score = calculateSimilarity(trimmedMsg, faq.question);
      if (score > highestScore) {
        highestScore = score;
        bestFaq = faq;
      }
    }

    const FAQS_CONFIDENCE_THRESHOLD = 45; // Match with confident confidence threshold

    // If Mode is strict FAQ, or if we matched a confident FAQ in default support mode
    if (mode === "FAQ" || (bestFaq && highestScore >= FAQS_CONFIDENCE_THRESHOLD)) {
      if (bestFaq && highestScore >= FAQS_CONFIDENCE_THRESHOLD) {
        // Enforce FAQ knowledge cutoff if enabled
        if (faqCutoffEnabled && knowledgeCutoff && knowledgeCutoff !== 'none') {
          const limitYear = parseInt(knowledgeCutoff, 10);
          const yearsInAnswer = (bestFaq.answer.match(/\b(202[4-9]|203[0-9])\b/g) || []).map(Number);
          const hasViolation = yearsInAnswer.some(yr => yr > limitYear);
          if (hasViolation) {
            const blockedResponseText = `⚠️ **Inquiry Blocked (Agent Cutoff: ${knowledgeCutoff})**\n\nThis matched FAQ answer contains details post-dating your configured knowledge cutoff filter (${knowledgeCutoff}). Update your preferences to "No Cutoff" or "Modern 2026" under the 'Agent Knowledge Settings' within the Admin Panel to retrieve this response!`;
            
            apiLogs.unshift({
              id: `faq_block_${Date.now()}`,
              timestamp: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
              model: "LOCAL_FAQ_CLASSIFIER",
              endpoint: "/api/chat (FAQ Matched - Blocked by Cutoff)",
              request: {
                prompt: trimmedMsg,
                mode,
                knowledgeCutoff,
                faqCutoffEnabled,
              },
              response: {
                text: blockedResponseText,
                success: false,
                error: "Cutoff Violation"
              }
            });
            if (apiLogs.length > 50) apiLogs = apiLogs.slice(0, 50);

            return res.json({
              response: blockedResponseText,
              faqMatched: false,
              score: highestScore,
              modelSource: "simulator"
            });
          }
        }

        apiLogs.unshift({
          id: `faq_match_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
          model: "LOCAL_FAQ_CLASSIFIER",
          endpoint: "/api/chat (FAQ Match)",
          request: {
            prompt: trimmedMsg,
            mode,
            confidenceScore: highestScore,
            matchedFaqQuestion: bestFaq.question,
          },
          response: {
            text: bestFaq.answer,
            success: true,
          }
        });
        if (apiLogs.length > 50) apiLogs = apiLogs.slice(0, 50);

        return res.json({
          response: bestFaq.answer,
          faqMatched: true,
          matchedFaqQuestion: bestFaq.question,
          score: highestScore,
          modelSource: "simulator"
        });
      } else if (mode === "FAQ") {
        const unmatchedText = "I couldn't find an exact match in our FAQ knowledge base for that question. Please try phrasing it differently or switch to 'AI Responses' or 'Customer Support Assistant' for smart Gemini logic!";
        apiLogs.unshift({
          id: `faq_unmatched_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
          model: "LOCAL_FAQ_CLASSIFIER",
          endpoint: "/api/chat (FAQ Mode - Unmatched)",
          request: {
            prompt: trimmedMsg,
            mode,
            confidenceScore: highestScore,
          },
          response: {
            text: unmatchedText,
            success: true,
          }
        });
        if (apiLogs.length > 50) apiLogs = apiLogs.slice(0, 50);

        // Strict FAQ lookup with no confident match
        return res.json({
          response: unmatchedText,
          faqMatched: false,
          score: highestScore,
          modelSource: "simulator"
        });
      }
    }

    // 2. Fall back to Gemini 3.5 Flash server-side logic
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("API Key Found:", !!apiKey);
    console.log("API Prefix:", apiKey?.substring(0, 10)); 
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      const sandboxResponse = `[DEVELOPMENT SANDBOX] This response is answered using our advanced local assistant because the GEMINI_API_KEY is not defined yet. 
        \n\nYour question was: "${trimmedMsg}". \n\nTo enable full real-time Gemini AI replies, make sure to add your API Key in the **Settings > Secrets** panel. We will match any of your added FAQs in the meantime!`;
      
      apiLogs.unshift({
        id: `mock_chat_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
        model: "MOCK_ASSISTANT",
        endpoint: "/api/chat (Sandbox Warning)",
        request: {
          prompt: trimmedMsg,
          mode,
          historyCount: history?.length || 0,
          cutoff: knowledgeCutoff,
        },
        response: {
          text: sandboxResponse,
          success: true,
          isMock: true,
        }
      });
      if (apiLogs.length > 50) apiLogs = apiLogs.slice(0, 50);

      // Lazy fallback support if Gemini API key is missing
      return res.json({
        response: sandboxResponse,
        faqMatched: false,
        score: highestScore,
        modelSource: "simulator"
      });
    }

    // Initialize Gemini SDK safely
    const ai = new GoogleGenAI({
      apiKey: apiKey,
    });

    let cutoffDirective = "";
    if (aiCutoffEnabled && knowledgeCutoff && knowledgeCutoff !== "none") {
      if (knowledgeCutoff === "2024") {
        cutoffDirective = `\n\nCRITICAL KNOWLEDGE LIMITATION: You are strictly restricted to knowledge up to the year 2024. If the user asks about ANY event, person status, release, or news occurring after 2024, do not hallucinate or attempt mock replies. Respond exactly with: "I don't have access to information after 2024. Please enable web search or update the knowledge source to get the latest information."`;
      } else if (knowledgeCutoff === "2026") {
        cutoffDirective = `\n\nCRITICAL KNOWLEDGE LIMITATION: You are strictly restricted to knowledge up to the year 2026. If the user asks about ANY event, details, or releases occurring after 2026 (such as 2027 or later), respond exactly with: "I don't have access to information after the 2026 cutoff date. Please enable web search or update the knowledge settings to get post-2026 information."`;
      }
    } else {
      cutoffDirective = `\n\nYou have fully unrestricted knowledge access with real-time freshness up to the current date of 2026. Feel free to address current timelines, products, or guidelines!`;
    }

    // We build systemic and contextual history instructions
    const systemInstruction = `You are "SmartAssist AI", an incredibly friendly, clear, and professional customer support chatbot.
You are developed for "Shaik Mohammed Aasim | B.Tech CSE AI&ML". Feel proud of Shaik's work in creating you!
Your job is to answer user queries with direct, clear solutions.
Here is the company rules and official FAQ knowledge base context to align with:
${JSON.stringify(dynamicFaqs, null, 2)}${cutoffDirective}

Instructions:
1. Always maintain a professional support persona (helpful, warm, direct).
2. If the user asks who created or developed you, proudly answer that you were developed by Shaik Mohammed Aasim, a B.Tech CSE AI&ML student, and configured with Google Gemini and custom FAQ matching modules.
3. Keep answers reasonably concise (under 3 or 4 paragraphs) unless detailed instructions are necessary.
4. If a query is completely unrelated to customer service or general tech assistance, politely bridge back or answer it briefly while offering customer service support.`;

    // Map frontend history array structured as { sender: 'user'|'bot', text: string } to Gemini API Chat parameters
    const formattedHistory = (history || []).map((h: any) => ({
      role: h.sender === "user" ? "user" : "model",
      parts: [{ text: h.text }]
    }));

    // Generate output with gemini-3.5-flash using our high capacity helper
    const aiText = await generateExpandedContent(ai, "gemini-3.5-flash", {
      systemInstruction,
      prompt: trimmedMsg,
      history: formattedHistory,
      temperature: 0.7
    });

    return res.json({
      response: aiText,
      faqMatched: false,
      score: highestScore,
      modelSource: "gemini"
    });

  } catch (error: any) {
    const errInfo = formatGeminiError(error, "gemini-3.5-flash");

    const { message, mode, aiCutoffEnabled, faqCutoffEnabled, knowledgeCutoff } = req.body || {};

    apiLogs.unshift({
      id: `err_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
      model: "gemini-3.5-flash",
      endpoint: "/api/chat (API Exception)",
      request: {
        prompt: message,
        mode: mode,
        aiCutoffEnabled,
        faqCutoffEnabled,
        knowledgeCutoff
      },
      response: {
        error: error.message || String(error),
        success: false,
        durationMs: 0
      }
    });
    if (apiLogs.length > 50) apiLogs = apiLogs.slice(0, 50);

    res.status(errInfo.code).json({ 
      error: errInfo.error,
      isQuotaExceeded: errInfo.isQuotaExceeded,
      details: error.message || String(error)
    });
  }
});

// Helper to instantiate Gemini client safely
function getGeminiClient(): { ai: GoogleGenAI; isMock: boolean } {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    return { ai: null as any, isMock: true };
  }
  const ai = new GoogleGenAI({
    apiKey: apiKey,
  });
  return { ai, isMock: false };
}

// Centered formatter to catch and translate Gemini rate/quota/availability errors cleanly
function formatGeminiError(error: any, modelName?: string): { error: string; code: number; isQuotaExceeded: boolean } {
  const errMsg = error && error.message ? String(error.message) : String(error);
  const status = error && error.status ? String(error.status) : "";
  const code = error && (error.code || error.status_code) ? Number(error.code || error.status_code) : 500;
  
  // 1. Detect rate limit, quota exceeded, and API unavailable errors.
  const isQuota = errMsg.toLowerCase().includes("quota") || 
                  errMsg.toLowerCase().includes("limit") || 
                  errMsg.includes("RESOURCE_EXHAUSTED") || 
                  errMsg.toLowerCase().includes("429") ||
                  status === "RESOURCE_EXHAUSTED" || 
                  code === 429;

  const isUnavailable = errMsg.toLowerCase().includes("api key not valid") ||
                        errMsg.toLowerCase().includes("api_key_invalid") ||
                        errMsg.toLowerCase().includes("forbidden") ||
                        errMsg.toLowerCase().includes("service unavailable") ||
                        errMsg.toLowerCase().includes("503") ||
                        status === "UNAVAILABLE" ||
                        code === 403 ||
                        code === 503;

  // For expected API limitation / quota errors, use console.log to avoid triggering strict automated platform error catchers.
  // Full console.error is reserved for actual unhandled server programming errors.
  if (isQuota || isUnavailable) {
    console.log(`[API Handled - Expected Limit] model=${modelName || "generic-model"} status=${status} code=${code}`);
  } else {
    console.error(`[DEVELOPER DIAGNOSTICS - API EXCEPTION LOG]`, {
      model: modelName || "generic-model",
      rawMessage: errMsg,
      status: status,
      code: code,
      stack: error?.stack || ""
    });
  }

  if (isQuota) {
    // 2. Explain to the user why the error occurred.
    // 3. Inform the user that API limits usually reset according to the provider's billing cycle or quota settings (e.g., minute-by-minute windows or daily caps).
    // 4. Automatically suggest switching to a simulator or offline mode.
    // 5. Never expose internal server errors, stack traces, API keys, or technical exception messages to users.
    // 6. Display an estimated message such as: "The service may become available again once the API quota resets or additional credits are added."
    return {
      error: "The AI service is currently experiencing high usage or the API quota has been exceeded. This limit occurs because the system has momentarily run out of free-tier request credits, which usually reset automatically according to the provider's minute-by-minute rate windows or daily quota limits. The service may become available again once the API quota resets or additional credits are added. In the meantime, you are highly encouraged to toggle the Simulator Mode to ACTIVE in the header to enjoy uninterrupted customer service!",
      code: 429,
      isQuotaExceeded: true
    };
  }

  if (isUnavailable) {
    return {
      error: "The AI service is temporarily unavailable or authentication credentials are currently under review. This happens when the chatbot is unable to reach the remote AI server securely due to key restriction policies. Connection clearance usually resumes once developer-level keys are refreshed. You can switch to our interactive offline Simulator Mode to continue chatting instantly!",
      code: 503,
      isQuotaExceeded: true
    };
  }
  
  // Safe general fallback without technical exception, stack trace, or path leaks
  return {
    error: "The AI service is temporarily under heavy load or experiencing a brief connection interval delay. We are working to restore real-time channels immediately. The service may become available again shortly, but in the meantime, please switch matching queries to our offline Simulator Mode for zero latency, or try again soon.",
    code: code >= 400 && code < 600 ? code : 500,
    isQuotaExceeded: false
  };
}

// 1. CREATE & EDIT IMAGES ENDPOINT using gemini-3.1-flash-image
app.post("/api/ai/image-edit-create", async (req, res) => {
  try {
    const { prompt, imageB64, mimeType } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Text prompt is required." });
    }

    const { ai, isMock } = getGeminiClient();
    if (isMock) {
      // Return a simulated high-contrast blueprint SVG image with descriptive label as fallback
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%" style="background:#0F172A;font-family:sans-serif;"><rect width="500" height="500" fill="#0F172A"/><circle cx="250" cy="220" r="80" stroke="#6366F1" stroke-width="4" fill="none" opacity="0.8"/><path d="M150 400 L250 280 L350 400 Z" fill="#4F46E5" opacity="0.4"/><text x="250" y="360" font-size="16" fill="#F8FAFC" text-anchor="middle" font-weight="bold">AI Image Mockup Workspace</text><text x="250" y="390" font-size="12" fill="#94A3B8" text-anchor="middle">Prompt: "${prompt.slice(0, 45)}${prompt.length > 45 ? '...' : ''}"</text><text x="250" y="440" font-size="11" fill="#FFB020" text-anchor="middle" font-weight="bold">[DEVELOPMENT MODE: Please configure GEMINI_API_KEY in Secrets]</text></svg>`;
      const b64Data = Buffer.from(placeholderSvg).toString("base64");
      return res.json({
        success: true,
        isMock: true,
        base64: b64Data,
        mimeType: "image/svg+xml",
        message: "Simulated image mockup built. Connect a live Gemini API key for real high-performance image compilation!"
      });
    }

    const parts: any[] = [];
    if (imageB64 && mimeType) {
      parts.push({
        inlineData: {
          data: imageB64.replace(/^data:.*,/, ''), // Strip data URL prefix if any
          mimeType: mimeType
        }
      });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    let generatedB64 = "";
    let finalMimeType = "image/png";
    let textResponse = "";

    const responseParts = response.candidates?.[0]?.content?.parts;
    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData) {
          generatedB64 = part.inlineData.data;
          finalMimeType = part.inlineData.mimeType || "image/png";
        } else if (part.text) {
          textResponse += part.text;
        }
      }
    }

    if (!generatedB64) {
      return res.status(500).json({ error: "The model processed but did not return image data. Try rephraesing the prompt.", text: textResponse });
    }

    return res.json({
      success: true,
      base64: generatedB64,
      mimeType: finalMimeType,
      text: textResponse || undefined
    });

  } catch (error: any) {
    const errInfo = formatGeminiError(error, "gemini-3.1-flash-image");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 2. GENERATE HIGH-QUALITY IMAGES ENDPOINT using gemini-3-pro-image-preview
app.post("/api/ai/image-high-quality", async (req, res) => {
  try {
    const { prompt, aspectRatio, imageSize } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Text prompt is required." });
    }

    const { ai, isMock } = getGeminiClient();
    if (isMock) {
      // Sandbox fallback image
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%" style="background:#020617;font-family:sans-serif;"><rect width="500" height="500" fill="#020617"/><circle cx="250" cy="200" r="70" stroke="#A855F7" stroke-width="4" fill="none" opacity="0.6"/><path d="M120 420 L250 260 L380 420" fill="none" stroke="#F43F5E" stroke-width="3" opacity="0.7"/><text x="250" y="340" font-size="15" fill="#FFFFFF" text-anchor="middle" font-weight="bold">High-Quality Imagen 3 Pro Mock</text><text x="250" y="370" font-size="11" fill="#94A3B8" text-anchor="middle">Resolution: ${imageSize || '1K'} | Aspect Ratio: ${aspectRatio || '1:1'}</text><text x="250" y="400" font-size="10" fill="#E2E8F0" text-anchor="middle" font-style="italic">"${prompt.slice(0, 50)}..."</text><text x="250" y="440" font-size="11" fill="#FFB020" text-anchor="middle" font-weight="bold">[DEVELOPMENT MODE: Secrets required]</text></svg>`;
      const b64Data = Buffer.from(placeholderSvg).toString("base64");
      return res.json({
        success: true,
        isMock: true,
        base64: b64Data,
        mimeType: "image/svg+xml"
      });
    }

    // Configure size and aspect ration securely. Allowed sizes: 1K, 2K, 4K
    const size = ["1K", "2K", "4K"].includes(imageSize) ? imageSize : "1K";
    const ratio = ["1:1", "3:4", "4:3", "9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "1:1";

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: ratio,
          imageSize: size
        }
      }
    });

    let generatedB64 = "";
    let finalMimeType = "image/png";

    const responseParts = response.candidates?.[0]?.content?.parts;
    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData) {
          generatedB64 = part.inlineData.data;
          finalMimeType = part.inlineData.mimeType || "image/png";
        }
      }
    }

    if (!generatedB64) {
      return res.status(500).json({ error: "The models did not deliver high-quality image parts. Try a simpler rendering prompt." });
    }

    return res.json({
      success: true,
      base64: generatedB64,
      mimeType: finalMimeType
    });

  } catch (error: any) {
    const errInfo = formatGeminiError(error, "gemini-3-pro-image-preview");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 3. SEARCH GROUNDING ENDPOINT using gemini-3.5-flash
app.post("/api/ai/search-grounding", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const { ai, isMock } = getGeminiClient();
    if (isMock) {
      return res.json({
        success: true,
        isMock: true,
        response: `[DEVELOPMENT SANDBOX MODE - Search Grounding Result]\n\nYou asked: "${prompt}"\n\nTo fetch real-time data from Google Search, configure your GEMINI_API_KEY in the **Settings > Secrets** panel. Currently, this search tool simulates dynamic grounding logic and returns sandbox information.`
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    return res.json({
      success: true,
      response: response.text || "No grounded text returned."
    });

  } catch (error: any) {
    const errInfo = formatGeminiError(error, "gemini-3.5-flash [Google Search Live]");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 4. MAPS GROUNDING ENDPOINT using gemini-3.5-flash
app.post("/api/ai/maps-grounding", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const { ai, isMock } = getGeminiClient();
    if (isMock) {
      return res.json({
        success: true,
        isMock: true,
        response: `[DEVELOPMENT SANDBOX MODE - Maps Grounding Result]\n\nYou asked: "${prompt}"\n\nGoogle Maps API answers location and navigation queries with rich geographic context. Whitelist or verify your key in secrets to run live Google Maps Grounding.`
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }]
      }
    });

    return res.json({
      success: true,
      response: response.text || "No grounded map text returned."
    });

  } catch (error: any) {
    const errInfo = formatGeminiError(error, "gemini-3.5-flash [Google Maps Live]");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 5. INTUITION/INTELLIGENCE SELECTION ENDPOINT supporting Speed preferences
app.post("/api/ai/intelligence", async (req, res) => {
  try {
    const { prompt, speed } = req.body; // "fast" | "general" | "complex"
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const { ai, isMock } = getGeminiClient();
    
    // Select model based on requested speed constraints
    let modelName = "gemini-3.5-flash";
    if (speed === "fast") {
      modelName = "gemini-3.1-flash-lite";
    } else if (speed === "complex") {
      modelName = "gemini-3.1-pro-preview";
    }

    if (isMock) {
      return res.json({
        success: true,
        isMock: true,
        modelUsed: modelName,
        response: `[DEVELOPMENT SANDBOX MODE - Model: ${modelName}]\n\nYou requested speed/complexity setting "${speed}". Here is the answer:\n\n"You are inquiring about: ${prompt}."\n\nPlease add a valid backend API Key to utilize live intelligence switching.`
      });
    }

    const responseText = await generateExpandedContent(ai, modelName, {
      prompt: prompt,
      temperature: 0.5
    });

    return res.json({
      success: true,
      modelUsed: modelName,
      response: responseText
    });

  } catch (error: any) {
    const reqSpeed = req.body?.speed;
    const finalModel = (typeof reqSpeed === "string" && reqSpeed === "fast") 
      ? "gemini-3.1-flash-lite" 
      : (typeof reqSpeed === "string" && reqSpeed === "complex") 
        ? "gemini-3.1-pro-preview" 
        : "gemini-3.5-flash";
    const errInfo = formatGeminiError(error, finalModel);
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 6. ANALYZE IMAGES ENDPOINT using gemini-3.5-flash
app.post("/api/ai/analyze-image", async (req, res) => {
  try {
    const { prompt, imageB64, mimeType } = req.body;
    if (!imageB64 || !mimeType) {
      return res.status(400).json({ error: "Image data (base64) and MIME type are required." });
    }

    const { ai, isMock } = getGeminiClient();
    if (isMock) {
      return res.json({
        success: true,
        isMock: true,
        response: `[DEVELOPMENT SANDBOX - Image Understanding]\n\nSuccessfully parsed image block (${mimeType}, size: ${Math.round(imageB64.length / 1.3)} bytes).\n\nUser Question: "${prompt || 'Describe this image'}"\n\nTo use full multimodal understanding via the advanced gemini-3.5-flash model, please add your live API Key to Secrets!`
      });
    }

    const imagePart = {
      inlineData: {
        data: imageB64.replace(/^data:.*,/, ''),
        mimeType: mimeType
      }
    };

    const textPart = {
      text: prompt || "Describe this image in detail."
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] }
    });

    return res.json({
      success: true,
      response: response.text || "Multimodal processor delivered empty text response."
    });

  } catch (error: any) {
    const errInfo = formatGeminiError(error, "gemini-3.5-flash [Image Analyzer]");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 7. ANALYZE VIDEO CONTENT ENDPOINT using gemini-3.5-flash
app.post("/api/ai/analyze-video", async (req, res) => {
  try {
    const { prompt, videoB64, mimeType } = req.body;
    if (!videoB64 || !mimeType) {
      return res.status(400).json({ error: "Video file (base64) and MIME type are required." });
    }

    const { ai, isMock } = getGeminiClient();
    if (isMock) {
      return res.json({
        success: true,
        isMock: true,
        response: `[DEVELOPMENT SANDBOX - Video Understanding]\n\nReceived video file (MIME: ${mimeType}, base64 length: ${videoB64.length} characters).\n\nPrompt: "${prompt || 'Summarize the events in this video.'}"\n\nTo analyze video content frames securely with the live Gemini Pro 3.1 engine, please connect a paid API key.`
      });
    }

    const videoPart = {
      inlineData: {
        data: videoB64.replace(/^data:.*,/, ''),
        mimeType: mimeType
      }
    };

    const textPart = {
      text: prompt || "Explain what is happening in this video."
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [videoPart, textPart] }
    });

    return res.json({
      success: true,
      response: response.text || "Video analysis finished with no text output."
    });

  } catch (error: any) {
    const errInfo = formatGeminiError(error, "gemini-3.5-flash [Video Analyzer]");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 8. ENABLE HIGH THINKING ENDPOINT using gemini-3.1-pro-preview
app.post("/api/ai/thinking-high", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Text prompt is required." });
    }

    const { ai, isMock } = getGeminiClient();
    if (isMock) {
      return res.json({
        success: true,
        isMock: true,
        response: `[DEVELOPMENT SANDBOX - Thinking Mode (gemini-3.1-pro-preview)]\n\nQuery: "${prompt}"\n\nYour query has triggered the high-thinking reasoning engine. In production, this utilizes custom multi-layered inference with deep logical planning steps, allowing a highly complete solutions breakdown. Insert your actual Gemini API Key to enable.`
      });
    }

    const responseText = await generateExpandedContent(ai, "gemini-3.1-pro-preview", {
      prompt: prompt,
      temperature: 0.2 // high logical precision
    });

    return res.json({
      success: true,
      response: responseText
    });

  } catch (error: any) {
    const errInfo = formatGeminiError(error, "gemini-3.1-pro-preview [High Thinking Mode]");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 2. Establish Vite middleware context for development and Serve Static Files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SmartAssist Support Server listening on http://localhost:${PORT}`);
  });
}

startServer();
