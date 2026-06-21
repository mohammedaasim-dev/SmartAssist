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

app.post("/api/chat", async (req, res) => {
  try {
    const { message, mode, history } = req.body;
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
        return res.json({
          response: bestFaq.answer,
          faqMatched: true,
          matchedFaqQuestion: bestFaq.question,
          score: highestScore
        });
      } else if (mode === "FAQ") {
        // Strict FAQ lookup with no confident match
        return res.json({
          response: "I couldn't find an exact match in our FAQ knowledge base for that question. Please try phrasing it differently or switch to 'AI Responses' or 'Customer Support Assistant' for smart Gemini logic!",
          faqMatched: false,
          score: highestScore
        });
      }
    }

    // 2. Fall back to Gemini 3.5 Flash server-side logic
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("API Key Found:", !!apiKey);
    console.log("API Prefix:", apiKey?.substring(0, 10)); 
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      // Lazy fallback support if Gemini API key is missing
      return res.json({
        response: `[DEVELOPMENT SANDBOX] This response is answered using our advanced local assistant because the GEMINI_API_KEY is not defined yet. 
        \n\nYour question was: "${trimmedMsg}". \n\nTo enable full real-time Gemini AI replies, make sure to add your API Key in the **Settings > Secrets** panel. We will match any of your added FAQs in the meantime!`,
        faqMatched: false,
        score: highestScore
      });
    }

    // Initialize Gemini SDK safely
    const ai = new GoogleGenAI({
      apiKey: apiKey,
    });

    // We build systemic and contextual history instructions
    const systemInstruction = `You are "SmartAssist AI", an incredibly friendly, clear, and professional customer support chatbot.
You are developed for "Shaik Mohammed Aasim | B.Tech CSE AI&ML". Feel proud of Shaik's work in creating you!
Your job is to answer user queries with direct, clear solutions.
Here is the company rules and official FAQ knowledge base context to align with:
${JSON.stringify(dynamicFaqs, null, 2)}

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

    // Generate output with gemini-2.5-flash
    const chatResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        ...formattedHistory,
        { role: "user", parts: [{ text: trimmedMsg }] }
      ],
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    const aiText = chatResponse.text || "I'm sorry, I encountered a brief hiccup while processing your intelligence stream. Please try again.";

    return res.json({
      response: aiText,
      faqMatched: false,
      score: highestScore
    });

  } catch (error: any) {
    console.error("Gemini Assistant route error:", error);
    res.status(500).json({ 
      error: "An internal support server error occurred.", 
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

// Centered formatter to catch and translate Gemini rate/quota exhaustion errors
function formatGeminiError(error: any, modelName?: string): { error: string; code: number; isQuotaExceeded: boolean } {
  const errMsg = error && error.message ? String(error.message) : String(error);
  const status = error && error.status ? String(error.status) : "";
  const code = error && (error.code || error.status_code) ? Number(error.code || error.status_code) : 500;
  
  const isQuota = errMsg.includes("Quota exceeded") || 
                  errMsg.includes("quota") || 
                  errMsg.includes("RESOURCE_EXHAUSTED") || 
                  errMsg.toLowerCase().includes("rate limit") ||
                  status === "RESOURCE_EXHAUSTED" || 
                  code === 429;
                  
  if (isQuota) {
    return {
      error: `Gemini API Free Tier Limit exceeded for ${modelName || "model"}. Google Free Tier allows limited requests/min. Please wait a short moment and retry, or configure active Billing. For limits: https://ai.google.dev/gemini-api/docs/rate-limits`,
      code: 429,
      isQuotaExceeded: true
    };
  }
  
  return {
    error: errMsg || "Failed to process AI query.",
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
    console.error("Image edit/create error:", error);
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
    console.error("High-quality image error:", error);
    const errInfo = formatGeminiError(error, "gemini-3-pro-image-preview");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 3. SEARCH GROUNDING ENDPOINT using gemini-2.5-flash
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
      model: "gemini-2.5-flash",
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
    console.error("Search Grounding error:", error);
    const errInfo = formatGeminiError(error, "gemini-2.5-flash [Google Search Live]");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 4. MAPS GROUNDING ENDPOINT using gemini-2.5-flash
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
      model: "gemini-2.5-flash",
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
    console.error("Maps Grounding error:", error);
    const errInfo = formatGeminiError(error, "gemini-2.5-flash [Google Maps Live]");
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
      modelName = "gemini-2.5-flash";
    }

    if (isMock) {
      return res.json({
        success: true,
        isMock: true,
        modelUsed: modelName,
        response: `[DEVELOPMENT SANDBOX MODE - Model: ${modelName}]\n\nYou requested speed/complexity setting "${speed}". Here is the answer:\n\n"You are inquiring about: ${prompt}."\n\nPlease add a valid backend API Key to utilize live intelligence switching.`
      });
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });

    return res.json({
      success: true,
      modelUsed: modelName,
      response: response.text || "No intelligence textual parts returned."
    });

  } catch (error: any) {
    console.error("Intelligence route error:", error);
    const reqSpeed = req.body?.speed;
    const finalModel = (typeof reqSpeed === "string" && reqSpeed === "fast") 
      ? "gemini-3.1-flash-lite" 
      : (typeof reqSpeed === "string" && reqSpeed === "complex") 
        ? "gemini-2.5-flash" 
        : "gemini-3.5-flash";
    const errInfo = formatGeminiError(error, finalModel);
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 6. ANALYZE IMAGES ENDPOINT using gemini-2.5-flash
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
        response: `[DEVELOPMENT SANDBOX - Image Understanding]\n\nSuccessfully parsed image block (${mimeType}, size: ${Math.round(imageB64.length / 1.3)} bytes).\n\nUser Question: "${prompt || 'Describe this image'}"\n\nTo use full multimodal understanding via the advanced gemini-2.5-flash model, please add your live API Key to Secrets!`
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
      model: "gemini-2.5-flash",
      contents: { parts: [imagePart, textPart] }
    });

    return res.json({
      success: true,
      response: response.text || "Multimodal processor delivered empty text response."
    });

  } catch (error: any) {
    console.error("Analyze image error:", error);
    const errInfo = formatGeminiError(error, "gemini-2.5-flash [Image Analyzer]");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 7. ANALYZE VIDEO CONTENT ENDPOINT using gemini-2.5-flash
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
        response: `[DEVELOPMENT SANDBOX - Video Understanding]\n\nReceived video file (MIME: ${mimeType}, base64 length: ${videoB64.length} characters).\n\nPrompt: "${prompt || 'Summarize the events in this video.'}"\n\nTo analyze video content frames securely with the live Gemini Pro 2.5 engine, please connect a paid API key.`
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
      model: "gemini-2.5-flash",
      contents: { parts: [videoPart, textPart] }
    });

    return res.json({
      success: true,
      response: response.text || "Video analysis finished with no text output."
    });

  } catch (error: any) {
    console.error("Analyze video error:", error);
    const errInfo = formatGeminiError(error, "gemini-2.5-flash [Video Analyzer]");
    res.status(errInfo.code).json({ error: errInfo.error, isQuotaExceeded: errInfo.isQuotaExceeded });
  }
});

// 8. ENABLE HIGH THINKING ENDPOINT using gemini-2.5-flash
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
        response: `[DEVELOPMENT SANDBOX - Thinking Mode (gemini-2.5-flash)]\n\nQuery: "${prompt}"\n\nYour query has triggered the high-thinking reasoning engine. In production, this utilizes custom multi-layered inference with deep logical planning steps, allowing a highly complete solutions breakdown. Insert your actual Gemini API Key to enable.`
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    return res.json({
      success: true,
      response: response.text || "Reasoning engine answered empty response."
    });

  } catch (error: any) {
    console.error("High Thinking API error:", error);
    const errInfo = formatGeminiError(error, "gemini-2.5-flash [High Thinking Mode]");
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
