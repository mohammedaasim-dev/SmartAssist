/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
  faqMatched?: boolean;
  matchedFaqQuestion?: string;
  score?: number;
  modelSource?: 'gemini' | 'simulator';
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: string;
  mode: 'FAQ' | 'AI_Responses' | 'Customer_Support_Assistant';
}

export interface Ticket {
  id: string;
  email: string;
  subject: string;
  description: string;
  status: 'Open' | 'Resolved';
  createdAt: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: 'User' | 'Admin';
  totalMessages: number;
  photoURL?: string;
}

