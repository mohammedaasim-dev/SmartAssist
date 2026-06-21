/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
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

app.use(express.json());

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
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      // Lazy fallback support if Gemini API key is missing
      return res.json({
        response: `[DEVELOPMENT SANDBOX] This response is answered using our advanced local assistant because the GEMINI_API_KEY is not defined yet. 
        \n\nYour question was: "${trimmedMsg}". \n\nTo enable full real-time Gemini AI replies, make sure to add your API Key in the **Settings > Secrets** panel. We will match any of your added FAQs in the meantime!`,
        faqMatched: false,
        score: highestScore
      });
    }

    // Initialize Gemini SDK with custom user-agent header as required
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
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

    // Generate output with gemini-3.5-flash
    const chatResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
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
