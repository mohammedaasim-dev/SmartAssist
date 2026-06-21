/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FAQItem } from '../types';

export const INITIAL_FAQS: FAQItem[] = [
  {
    id: "faq_1",
    question: "What is SmartAssist AI?",
    answer: "SmartAssist AI is an advanced, high-performance customer support automation platform. It combines static FAQ-matching algorithms with the power of Gemini 3.5 Flash AI to deliver instant, hyper-accurate responses to support queries.",
    category: "General"
  },
  {
    id: "faq_2",
    question: "How do I sign up for SmartAssist?",
    answer: "You can sign up on our website by clicking the 'Get Started' button. Enter your email, set a secure password, and select either our Starter, Professional, or Enterprise tiers. We offer a 14-day free trial on all plans.",
    category: "Account"
  },
  {
    id: "faq_3",
    question: "What is your refund policy?",
    answer: "We offer a 30-day risk-free money-back guarantee for all subscription plans. If you find that SmartAssist is not a perfect fit for your workflow, contact billing@smartassist.ai within the first 30 days to claim a hassle-free, full refund.",
    category: "Billing"
  },
  {
    id: "faq_4",
    question: "How do I integrate the chatbot with my website?",
    answer: "Integrating SmartAssist is fast and easy. Go to your Dashboard, navigate to 'Widget Settings', and copy the generated JavaScript snippet. Paste this code snippet into the <head> tags of your HTML, and the chat widget is ready to go!",
    category: "Integration"
  },
  {
    id: "faq_5",
    question: "Is my customer data secure?",
    answer: "Absolutely. SmartAssist implements enterprise-grade security. All client-server transmissions are encrypted via TLS 1.3, and database records are encrypted at rest with AES-256. We comply with GDPR, HIPAA, and SOC2 regulations.",
    category: "Security"
  },
  {
    id: "faq_6",
    question: "Do you offer pricing discounts?",
    answer: "Yes! We run several programs supporting the community. Non-profit organizations, educational establishments, and startups under 1 year old are eligible for a 25% discount. Simply fill in a request form inside the platform under Subscriptions.",
    category: "Billing"
  },
  {
    id: "faq_7",
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel your subscription inside the SmartAssist dashboard at any time. Go to Settings -> Billing -> Cancel Subscription. You will not be charged again, and you will retain access to your premium capabilities until your current billing period ends.",
    category: "Billing"
  },
  {
    id: "faq_8",
    question: "What AI model is used for the responses?",
    answer: "The chatbot uses Gemini 3.5 Flash AI as its core LLM, supplemented by our lightweight Scikit-Learn based text preprocessors and token matching modules for initial FAQ queries. This hybrid system ensures lightning-fast speeds and high-fidelity help.",
    category: "General"
  }
];
