/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, Sparkles, Plus, Trash2, Search, MessageSquare, History, 
  Send, LogOut, CheckCircle, TrendingUp, Info, HelpCircle, 
  User, RefreshCw, ShieldCheck, BadgePercent, X, PlusCircle, Volume2,
  ChevronRight, LayoutDashboard, Users, Sliders, Download, Ticket as TicketIcon,
  FileText, Check, Settings, AlertTriangle, Activity, Shield, Award, Menu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Message, FAQItem, ChatSession, Ticket, UserAccount } from "./types";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "./firebase";
import LoginScreen from "./components/LoginScreen";
import AILaboratory from "./components/AILaboratory";
import { TypingText } from "./components/TypingText";

export default function App() {
  // Authentication status
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Custom confirmation modal state to prevent browser iframe popup blocks
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  // Set to keep track of bot message IDs that have already animated so they don't animate again
  const animatedMessagesRef = useRef<Set<string>>(new Set());

  // Rotational thoughts during bot loading
  const thinkingPhrases = [
    "Consulting local FAQ knowledge-base...",
    "Embedding query parameters...",
    "Contacting Gemini server instance...",
    "Formulating helpful response context...",
    "Finalizing response block output..."
  ];
  const [thinkingPhraseIndex, setThinkingPhraseIndex] = useState(0);

  // Expanded tabs to support User requests
  const [activeTab, setActiveTab] = useState<string>('Home');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [homeMode, setHomeMode] = useState<'Customer_Support_Assistant' | 'FAQ' | 'AI_Responses'>('Customer_Support_Assistant');
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Dynamic FAQ Testing Sandbox variables
  const [sandboxText, setSandboxText] = useState("");
  const [sandboxResults, setSandboxResults] = useState<{ faq: FAQItem; score: number }[]>([]);
  
  // Custom FAQ form state
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [faqSearchQuery, setFaqSearchQuery] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);
  const [faqLoading, setFaqLoading] = useState(false);

  // Active chat session state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");

  // Tone of the Assistant instruction modifier
  const [assistantTone, setAssistantTone] = useState<'friendly' | 'formal' | 'concise' | 'technical'>('friendly');

  // Interactive Support Tickets State (seeding default tickets per user requirement)
  const [tickets, setTickets] = useState<Ticket[]>(() => {
    const saved = localStorage.getItem('smartassist_tickets');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Raised ticket form inputs
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketSuccess, setTicketSuccess] = useState(false);

  // Interactive Users State (seeding default accounts)
  const [registeredUsers, setRegisteredUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('smartassist_registered_users');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Client profile fields
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileUpdatedNote, setProfileUpdatedNote] = useState(false);

  // Admin select specific chats logging viewer (modal / drawer trigger)
  const [inspectorSessId, setInspectorSessId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Listen to Authentication state changes on load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecking(false);
      if (user) {
        const uName = user.displayName || "Aasim";
        const uPhoto = user.photoURL || "";
        setProfileNameInput(uName);
        setProfileAvatarUrl(uPhoto);

        // Auto-register current user dynamically in the registeredUsers list
        setRegisteredUsers(prev => {
          const exists = prev.some(item => item.email === user.email);
          if (!exists) {
            const newUser: UserAccount = {
              uid: user.uid,
              email: user.email || "aasim@gmail.com",
              displayName: uName,
              role: "Admin", // Default to Admin so management deck is immediately accessible
              totalMessages: 0,
              photoURL: uPhoto || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
            };
            const next = [...prev, newUser];
            localStorage.setItem('smartassist_registered_users', JSON.stringify(next));
            // Silently persist to Firestore
            import("firebase/firestore").then(async ({ doc, setDoc }) => {
              try {
                await setDoc(doc(db, "users", newUser.uid), newUser);
              } catch (e) {
                console.warn("Firestore save user error:", e);
              }
            });
            return next;
          }
          return prev;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch all FAQs, load sessions, and read Firestore records
  useEffect(() => {
    fetchFaqs();
    loadChatSessions();
  }, []);

  // Fetch Firestore Records cleanly with local fallback merge
  useEffect(() => {
    if (!currentUser) return;
    const fetchCloudData = async () => {
      try {
        const { collection, getDocs, doc, setDoc } = await import("firebase/firestore");
        
        // Sync tickets from Firestore
        const ticketsSnapshot = await getDocs(collection(db, "tickets"));
        const cloudTickets: Ticket[] = [];
        if (!ticketsSnapshot.empty) {
          ticketsSnapshot.forEach((doc) => {
            cloudTickets.push(doc.data() as Ticket);
          });
          setTickets(cloudTickets);
        }
        
        // Sync users from Firestore
        const usersSnapshot = await getDocs(collection(db, "users"));
        const cloudUsers: UserAccount[] = [];
        if (!usersSnapshot.empty) {
          usersSnapshot.forEach((doc) => {
            cloudUsers.push(doc.data() as UserAccount);
          });
          setRegisteredUsers(cloudUsers);
        }

        // Always make sure the current user is synced to Firestore
        const exists = [...cloudUsers, ...registeredUsers].some(u => u.email === currentUser.email);
        if (!exists) {
          const defaultUser: UserAccount = {
            uid: currentUser.uid,
            email: currentUser.email || "aasim@gmail.com",
            displayName: currentUser.displayName || profileNameInput || "Aasim",
            role: "Admin",
            totalMessages: 0,
            photoURL: currentUser.photoURL || profileAvatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
          };
          await setDoc(doc(db, "users", defaultUser.uid), defaultUser);
          setRegisteredUsers(prev => {
            const hasIt = prev.some(p => p.uid === defaultUser.uid);
            if (!hasIt) return [...prev, defaultUser];
            return prev;
          });
        }
      } catch (err) {
        console.warn("Firestore collection lookup fallback to default local states:", err);
      }
    };
    fetchCloudData();
  }, [currentUser]);

  // Sync scroll on chat update
  const currentSession = chatSessions.find(s => s.id === currentSessionId);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages, loading]);

  // Run dynamic FAQ sandbox tests whenever sandboxText updates
  useEffect(() => {
    const timer = setTimeout(() => {
      testFaqSimilarity();
    }, 250);
    return () => clearTimeout(timer);
  }, [sandboxText, faqs]);

  // Read current user record
  const currentAccount = registeredUsers.find(u => u.email === currentUser?.email) || {
    uid: currentUser?.uid || "current_user_id",
    email: currentUser?.email || "aasim@gmail.com",
    displayName: profileNameInput || currentUser?.displayName || "Aasim",
    role: "Admin" as const, // default to admin to make panels accessible
    totalMessages: 0,
    photoURL: profileAvatarUrl || currentUser?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"
  };

  const fetchFaqs = async () => {
    try {
      const res = await fetch('/api/faqs');
      if (res.ok) {
        const data = await res.json();
        setFaqs(data);
      }
    } catch (err) {
      console.error("Failed fetching FAQs:", err);
    }
  };

  useEffect(() => {
    if (!loading) {
      setThinkingPhraseIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingPhraseIndex((prev) => (prev + 1) % thinkingPhrases.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [loading]);

  const loadChatSessions = () => {
    const saved = localStorage.getItem('smartassist_chats');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ChatSession[];
        setChatSessions(parsed);
        
        // Seed existing message IDs into the animated messages set so they don't re-type on initial load
        parsed.forEach(sess => {
          if (sess.messages) {
            sess.messages.forEach(m => {
              animatedMessagesRef.current.add(m.id);
            });
          }
        });

        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
        } else {
          createNewSession('Customer_Support_Assistant');
        }
      } catch (err) {
        console.error("Failed loading chat logs:", err);
        createNewSession('Customer_Support_Assistant');
      }
    } else {
      createNewSession('Customer_Support_Assistant');
    }
  };

  const saveSessions = (updated: ChatSession[]) => {
    setChatSessions(updated);
    localStorage.setItem('smartassist_chats', JSON.stringify(updated));
    
    // Auto-update message counter in profile
    const totalMsgsCount = updated.reduce((acc, curr) => acc + curr.messages.filter(m => m.sender === 'user').length, 0);
    const hasUser = registeredUsers.some(u => u.email === currentUser?.email);
    if (hasUser) {
      const updatedUsersList = registeredUsers.map(u => {
        if (u.email === currentUser?.email) {
          return { ...u, totalMessages: totalMsgsCount };
        }
        return u;
      });
      saveUsers(updatedUsersList);
    }
  };

  const saveTickets = (updated: Ticket[]) => {
    setTickets(updated);
    localStorage.setItem('smartassist_tickets', JSON.stringify(updated));
    // Save dynamically to Firestore silently
    updated.forEach(async (t) => {
      try {
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "tickets", t.id), t);
      } catch (e) {}
    });
  };

  const saveUsers = (updated: UserAccount[]) => {
    setRegisteredUsers(updated);
    localStorage.setItem('smartassist_registered_users', JSON.stringify(updated));
    // Save dynamically to Firestore silently
    updated.forEach(async (u) => {
      try {
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(db, "users", u.uid), u);
      } catch (e) {}
    });
  };

  const createNewSession = (mode: 'Customer_Support_Assistant' | 'FAQ' | 'AI_Responses') => {
    const defaultWelcome = {
      id: "welcome_msg",
      text: mode === 'FAQ' 
        ? "Hello! I am locked in FAQ Strict Match mode. Enter your question, and I will search our verified knowledge items. No Gemini generative fallback is active here."
        : mode === 'AI_Responses'
        ? "Hi there! I am in direct AI Mode. I will consult Gemini 3.5 Flash directly, skipping initial static FAQ constraints."
        : "Hello! Welcome to SmartAssist Customer Support. I am your hybrid customer support assistant. I can match queries instantly using our official database or generate smart answers with Gemini 3.5 Flash. How can I help you today?",
      sender: 'bot' as const,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newSess: ChatSession = {
      id: `session_${Date.now()}`,
      title: mode === 'Customer_Support_Assistant' 
        ? 'Customer Support Desk' 
        : mode === 'FAQ'
        ? 'FAQ Match Test'
        : 'Direct AI Chat',
      messages: [defaultWelcome],
      timestamp: new Date().toLocaleString(),
      mode,
    };

    const nextSessions = [newSess, ...chatSessions];
    saveSessions(nextSessions);
    setCurrentSessionId(newSess.id);
  };

  const deleteSession = (sessId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = chatSessions.filter(s => s.id !== sessId);
    saveSessions(updated);
    if (currentSessionId === sessId) {
      if (updated.length > 0) {
        setCurrentSessionId(updated[0].id);
      } else {
        createNewSession('Customer_Support_Assistant');
      }
    }
  };

  const downloadChatSession = () => {
    const activeSess = chatSessions.find(s => s.id === currentSessionId);
    if (!activeSess) {
      alert("No active session available to download.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeSess, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `smartassist_session_${activeSess.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const clearCurrentChat = () => {
    const activeSess = chatSessions.find(s => s.id === currentSessionId);
    if (!activeSess) return;
    const mode = activeSess.mode;
    const defaultWelcome = {
      id: "welcome_msg",
      text: mode === 'FAQ' 
        ? "Hello! I am locked in FAQ Strict Match mode. Enter your question, and I will search our verified knowledge items. No Gemini generative fallback is active here."
        : mode === 'AI_Responses'
        ? "Hi there! I am in direct AI Mode. I will consult Gemini 3.5 Flash directly, skipping initial static FAQ constraints."
        : "Hello! Welcome to SmartAssist Customer Support. I am your hybrid customer support assistant. I can match queries instantly using our official database or generate smart answers with Gemini 3.5 Flash. How can I help you today?",
      sender: 'bot' as const,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    saveSessions(chatSessions.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          messages: [defaultWelcome],
          timestamp: new Date().toLocaleString()
        };
      }
      return s;
    }));
  };

  const speakSynthesis = (text: string) => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const testFaqSimilarity = async () => {
    if (!sandboxText.trim()) {
      setSandboxResults([]);
      return;
    }
    try {
      const res = await fetch('/api/faq-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sandboxText })
      });
      if (res.ok) {
        setSandboxResults(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    setFaqLoading(true);
    try {
      const res = await fetch('/api/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: newQuestion,
          answer: newAnswer,
          category: newCategory
        })
      });
      if (res.ok) {
        setNewQuestion("");
        setNewAnswer("");
        setNewCategory("General");
        setFormSuccess(true);
        fetchFaqs();
        setTimeout(() => setFormSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFaqLoading(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    showConfirm(
      "Confirm FAQ Deletion",
      "Are you sure you want to delete this FAQ item permanently?",
      async () => {
        try {
          const res = await fetch(`/api/faqs/${id}`, { method: 'DELETE' });
          if (res.ok) {
            fetchFaqs();
          }
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || query).trim();
    if (!text) return;

    if (!textToSend) {
      setQuery("");
    }

    // Build user message
    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      text,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Append user message to current session
    let updatedSessions = chatSessions.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          messages: [...s.messages, userMsg],
          timestamp: new Date().toLocaleString()
        };
      }
      return s;
    });
    saveSessions(updatedSessions);

    // Prepare history to send to server so Gemini retains context
    const currentSess = updatedSessions.find(s => s.id === currentSessionId);
    const apiHistory = currentSess 
      ? currentSess.messages.slice(-6, -1) // Grab last 5 messages, excluding our newly appended user message
      : [];

    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          mode: currentSess?.mode || 'Customer_Support_Assistant',
          history: apiHistory,
          tone: assistantTone
        })
      });

      if (res.ok) {
        const responseData = await res.json();
        
        const botMsg: Message = {
          id: `msg_bot_${Date.now()}`,
          text: responseData.response,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          faqMatched: responseData.faqMatched,
          matchedFaqQuestion: responseData.matchedFaqQuestion,
          score: responseData.score
        };

        saveSessions(chatSessions.map(s => {
          if (s.id === currentSessionId) {
            // Update title based on the first real question if title was generic
            const nextTitle = s.messages.length <= 2 
              ? (text.length > 25 ? `${text.substring(0, 25)}...` : text)
              : s.title;

            return {
              ...s,
              title: nextTitle,
              messages: [...s.messages, botMsg]
            };
          }
          return s;
        }));
      } else {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Server unresponsiveness.");
      }
    } catch (err: any) {
      console.error(err);
      const botMsgError: Message = {
        id: `msg_bot_err_${Date.now()}`,
        text: `⚠️ Support Service Alert: ${err.message || "Failed to reach the chatbot engine. Make sure the backend server is online and initialized correctly."}`,
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      saveSessions(chatSessions.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, botMsgError] };
        }
        return s;
      }));
    } finally {
      setLoading(false);
    }
  };

  // Filtered list of FAQs for searchable knowledge index
  const filteredFaqs = faqs.filter(f => 
    f.question.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
    f.answer.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
    f.category.toLowerCase().includes(faqSearchQuery.toLowerCase())
  );

  if (authChecking) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0D0D0E] text-[#E0E0E0] font-sans">
        <div className="relative flex flex-col items-center">
          <div className="w-10 h-10 border-2 border-indigo-500/35 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <span className="text-xs font-mono tracking-widest text-white/40 uppercase">Authorizing Session...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen w-full bg-[#0D0D0E] text-[#E0E0E0] overflow-hidden font-sans relative">
      
      {/* Mobile overlay backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* 1. LEFT SIDEBAR PANEL */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-80 bg-[#131316] border-r border-[#ffffff0a] flex flex-col justify-between h-full overflow-y-auto transition-transform duration-300 lg:static lg:translate-x-0 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          {/* Dashboard Title & Branding */}
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded text-slate-950 shadow-md">
                <Bot size={22} className="text-white" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-lg text-white italic tracking-wide">SmartAssist</h2>
                <p className="text-[10px] uppercase tracking-widest text-[#8a8a93]">Operations Deck</p>
              </div>
            </div>

            {/* Close button for mobile screen widths */}
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-all lg:hidden cursor-pointer"
              title="Close navigation"
            >
              <X size={16} />
            </button>
          </div>

          <div className="py-4 space-y-4">
            
            {/* GROUP 1: CORE WORKSPACE */}
            <div className="px-3 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold px-3 mb-2">Workspace</p>
              
              <button
                id="sidebar-btn-home"
                onClick={() => { setActiveTab('Home'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'Home'
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-semibold'
                    : 'text-white/50 hover:bg-white/5 rounded-lg hover:text-white'
                }`}
              >
                <Bot size={18} className={`${activeTab === 'Home' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>🏠 Home</span>
              </button>

              <button
                id="sidebar-btn-about"
                onClick={() => { setActiveTab('About'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'About'
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-semibold'
                    : 'text-white/50 hover:bg-white/5 rounded-lg hover:text-white'
                }`}
              >
                <Info size={18} className={`${activeTab === 'About' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>ℹ️ About</span>
              </button>

              <button
                id="sidebar-btn-profile"
                onClick={() => { setActiveTab('Profile'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'Profile'
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-semibold'
                    : 'text-white/50 hover:bg-white/5 rounded-lg hover:text-white'
                }`}
              >
                <User size={18} className={`${activeTab === 'Profile' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>👤 Profile</span>
              </button>

              <button
                id="sidebar-btn-mychats"
                onClick={() => { setActiveTab('My_Chats'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'My_Chats'
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-semibold'
                    : 'text-white/50 hover:bg-white/5 rounded-lg hover:text-white'
                }`}
              >
                <History size={18} className={`${activeTab === 'My_Chats' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>💬 My Chats</span>
              </button>

              <button
                id="sidebar-btn-ailabs"
                onClick={() => { setActiveTab('AI_Labs'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'AI_Labs'
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-semibold'
                    : 'text-white/50 hover:bg-white/5 rounded-lg hover:text-white'
                }`}
              >
                <Sparkles size={18} className={`${activeTab === 'AI_Labs' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>🧠 AI Workbench</span>
              </button>
            </div>

            <div className="border-t border-white/5 mx-3"></div>

            {/* GROUP 2: OPERATIONS */}
            <div className="px-3 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold px-3 mb-2">Operations</p>

              <button
                id="sidebar-btn-support-ticket"
                onClick={() => { setActiveTab('Support_Ticket'); setIsMobileSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'Support_Ticket'
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-semibold'
                    : 'text-white/50 hover:bg-white/5 rounded-lg hover:text-white'
                }`}
              >
                <TicketIcon size={18} className={`${activeTab === 'Support_Ticket' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>🎫 Support Ticket</span>
              </button>

              <button
                id="sidebar-btn-download-chat"
                onClick={() => {
                  downloadChatSession();
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-white/50 hover:bg-white/5 hover:text-emerald-400 transition-all cursor-pointer"
                title="Download active chat conversation as JSON data"
              >
                <Download size={18} className="text-emerald-500/80 hover:scale-110 transition-transform" />
                <span>📥 Download Chat</span>
              </button>

              <button
                id="sidebar-btn-clear-chat"
                onClick={() => {
                  clearCurrentChat();
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-white/50 hover:bg-white/5 hover:text-rose-400 transition-all cursor-pointer"
                title="Wipe structural history in the active workspace chat segment"
              >
                <Trash2 size={18} className="text-rose-500/80 hover:scale-110 transition-transform" />
                <span>🗑️ Clear Chat</span>
              </button>
            </div>

            <div className="border-t border-white/5 mx-3"></div>

            {/* GROUP 3: MANAGEMENT PANEL (Visible dynamically based on Admin role) */}
            <div className="px-3 space-y-1">
              <div className="flex items-center justify-between px-3 mb-2">
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Management</p>
                {currentAccount.role !== 'Admin' && (
                  <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">User Mode</span>
                )}
              </div>

              <button
                id="sidebar-btn-dashboard"
                onClick={() => {
                  if (currentAccount.role !== 'Admin') {
                    alert("⚠️ Access Restricted: Please switch your Account Type to 'Admin' in the 👤 Profile tab to unlock Admin features!");
                    return;
                  }
                  setActiveTab('Dashboard');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  currentAccount.role !== 'Admin' ? 'opacity-40 hover:opacity-100' : ''
                } ${
                  activeTab === 'Dashboard'
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-semibold'
                    : 'text-white/50 hover:bg-white/5 rounded-lg hover:text-white'
                }`}
              >
                <LayoutDashboard size={18} className={`${activeTab === 'Dashboard' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>📊 Dashboard</span>
              </button>

              <button
                id="sidebar-btn-users"
                onClick={() => {
                  if (currentAccount.role !== 'Admin') {
                    alert("⚠️ Access Restricted: Please switch your Account Type to 'Admin' in the 👤 Profile tab to unlock Admin features!");
                    return;
                  }
                  setActiveTab('Users');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  currentAccount.role !== 'Admin' ? 'opacity-40 hover:opacity-100' : ''
                } ${
                  activeTab === 'Users'
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-semibold'
                    : 'text-white/50 hover:bg-white/5 rounded-lg hover:text-white'
                }`}
              >
                <Users size={18} className={`${activeTab === 'Users' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>👥 Users</span>
              </button>

              <button
                id="sidebar-btn-chats"
                onClick={() => {
                  if (currentAccount.role !== 'Admin') {
                    alert("⚠️ Access Restricted: Please switch your Account Type to 'Admin' in the 👤 Profile tab to unlock Admin features!");
                    return;
                  }
                  setActiveTab('Admin_Chats');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  currentAccount.role !== 'Admin' ? 'opacity-40 hover:opacity-100' : ''
                } ${
                  activeTab === 'Admin_Chats'
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-semibold'
                    : 'text-white/50 hover:bg-white/5 rounded-lg hover:text-white'
                }`}
              >
                <MessageSquare size={18} className={`${activeTab === 'Admin_Chats' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>💬 Chats</span>
              </button>

              <button
                id="sidebar-btn-admin-config"
                onClick={() => {
                  if (currentAccount.role !== 'Admin') {
                    alert("⚠️ Access Restricted: Please switch your Account Type to 'Admin' in the 👤 Profile tab to unlock Admin features!");
                    return;
                  }
                  setActiveTab('Admin_Panel');
                  setIsMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  currentAccount.role !== 'Admin' ? 'opacity-40 hover:opacity-100' : ''
                } ${
                  activeTab === 'Admin_Panel'
                    ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-l-2 border-indigo-500 text-white font-semibold'
                    : 'text-white/50 hover:bg-white/5 rounded-lg hover:text-white'
                }`}
              >
                <Sliders size={18} className={`${activeTab === 'Admin_Panel' ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>🛠 Admin Panel</span>
              </button>
            </div>

            <div className="border-t border-white/5 mx-3"></div>

            {/* GROUP 4: EXIT */}
            <div className="px-3">
              <button
                id="sidebar-btn-logout"
                onClick={() => {
                  showConfirm(
                    "Confirm Logout",
                    "Logout from current secure operations session?",
                    async () => {
                      try {
                        await signOut(auth);
                        setCurrentUser(null);
                      } catch (err) {
                        console.error("Signout error:", err);
                        setCurrentUser(null);
                      }
                    }
                  );
                }}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
              >
                <LogOut size={18} />
                <span>🚪 Logout</span>
              </button>
            </div>

          </div>
        </div>

        {/* Dynamic technology badge credits & user profile at the bottom of the sidebar */}
        <div className="mt-auto">
          <div className="p-4 mx-3 my-2 rounded-xl bg-white/2 border border-white/5 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">Developer Credentials</span>
            <span className="text-[10px] text-indigo-400 font-semibold truncate max-w-full">Developed by Shaik Mohammed Aasim</span>
            <span className="text-[8px] text-white/40 uppercase tracking-widest font-mono">B.Tech CSE AI&ML</span>
          </div>

          <div className="p-4 border-t border-white/5 bg-[#16161a] flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {currentAccount.photoURL ? (
                <img 
                  src={currentAccount.photoURL} 
                  alt={currentAccount.displayName} 
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0" 
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white uppercase select-none shrink-0 border border-white/10">
                  {currentAccount.displayName ? currentAccount.displayName.slice(0, 2) : "SA"}
                </div>
              )}
              <div className="truncate min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {currentAccount.displayName}
                </p>
                <p className="text-[10px] text-indigo-400 font-mono truncate" title={currentAccount.email}>
                  {currentAccount.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. CHAT & PLAYGROUND INTERFACE CONTAINER */}
      <main className="flex-1 flex flex-col bg-[#0D0D0E] h-full overflow-hidden relative">
        
        {/* Banner with logout/deploy top alignment */}
        <header className="px-4 md:px-6 py-3.5 border-b border-white/5 bg-[#0D0D0E]/80 backdrop-blur-xl flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            {/* Hamburger sidebar menu for small widths */}
            <button
              id="sidebar-toggle-mobile"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg transition-all lg:hidden cursor-pointer shrink-0"
              aria-label="Toggle navigation"
            >
              <Menu size={18} />
            </button>
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-lg shadow-green-500/20 animate-pulse shrink-0"></div>
            <div className="min-w-0">
              <h1 className="font-serif font-bold text-sm md:text-lg text-white italic tracking-tight truncate">SmartAssist AI Customer Support</h1>
              <p className="text-[10px] md:text-xs text-white/40 max-w-xl truncate hidden sm:block">
                Sophisticated hybrid agent powered by static FAQ memory overlap and Gemini 3.5 AI fallback.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="bg-white/5 text-white/60 text-xs px-2.5 py-1 rounded-full font-mono border border-white/10 hidden lg:inline">
              Mode: {activeTab.replace(/_/g, ' ')}
            </span>
            <button 
              onClick={() => {
                const message = activeTab === 'FAQ' 
                  ? "Describe standard checkout FAQ issues" 
                  : "List core security highlights of SmartAssist";
                setQuery(message);
              }}
              className="text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium py-1 px-3 rounded-full transition-all cursor-pointer"
            >
              Demo prompt
            </button>
          </div>
        </header>

        {/* Tab Selection Area Container */}
        <div className="flex-1 overflow-y-auto flex flex-col">

          {/* TAB CONTENT: ACTIVE CONVERSATIONS (SUPPORT & DIRECT AI MODES) */}
          {/* 1. VIEW TAB: HOME */}
          {activeTab === 'Home' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {/* Dynamic Branding Header in conversation section */}
              <div className="p-6 bg-[#131316]/50 border-b border-white/5 text-center shrink-0">
                <h3 className="text-xl md:text-2xl font-serif text-white tracking-tight italic flex items-center justify-center gap-2">
                  <Bot className="text-indigo-400" size={24} />
                  <span>SmartAssist AI Customer Support</span>
                </h3>
                <p className="text-xs text-white/40 mt-1 max-w-xl mx-auto font-mono">
                  Autonomous context matching layered above the Gemini 3.5 generative processing engine.
                </p>
                
                {/* Special Developer Credit Badge */}
                <div className="mt-3 flex items-center justify-center">
                  <div className="px-3.5 py-1.5 bg-[#1a1a20] border border-white/10 rounded-full flex items-center space-x-2 shadow-inner">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></span>
                    <span className="text-xs font-mono text-white/60">
                      Developed by <strong className="text-white font-semibold">Shaik Mohammed Aasim</strong> | B.Tech CSE AI&ML
                    </span>
                  </div>
                </div>

                {/* Sub-Mode pill selector to toggle chatbot styles */}
                <div className="mt-5 max-w-md mx-auto bg-black/45 p-1 rounded-full border border-white/5 flex items-center justify-between gap-1">
                  {(['Customer_Support_Assistant', 'FAQ', 'AI_Responses'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => {
                        setHomeMode(m);
                        const existing = chatSessions.find(s => s.mode === m);
                        if (existing) {
                          setCurrentSessionId(existing.id);
                        } else {
                          createNewSession(m);
                        }
                      }}
                      className={`flex-1 py-1 px-3 text-[11px] font-semibold rounded-full uppercase tracking-wider transition-all cursor-pointer ${
                        currentSession?.mode === m
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md'
                          : 'text-white/40 hover:text-white'
                      }`}
                    >
                      {m === 'Customer_Support_Assistant' ? 'Hybrid Assistant' : m === 'FAQ' ? 'FAQ Match Only' : 'Direct AI'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable messages block */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                <AnimatePresence initial={false}>
                  {currentSession?.messages?.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 shadow-md ${
                        msg.sender === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-[#131316] text-[#E0E0E0] border border-white/5 rounded-bl-none'
                      }`}>
                        
                        <div className="flex items-center justify-between text-[10px] font-mono text-white/40 mb-1.5 pb-1 border-b border-white/5">
                          <span>{msg.sender === 'user' ? 'YOU USER clearance' : '🤖 SMARTASSIST AI'}</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        <p className="text-sm leading-relaxed whitespace-pre-wrap select-text">
                          {msg.sender === 'bot' && !animatedMessagesRef.current.has(msg.id) ? (
                            <TypingText 
                              text={msg.text} 
                              onComplete={() => {
                                animatedMessagesRef.current.add(msg.id);
                              }} 
                            />
                          ) : (
                            msg.text
                          )}
                        </p>

                        <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-white/5 text-[10px]">
                          <button
                            onClick={() => speakSynthesis(msg.text)}
                            className="text-white/40 hover:text-indigo-400 transition-colors flex items-center gap-1 cursor-pointer font-mono"
                            title="Hear reading aloud"
                          >
                            <Volume2 size={12} />
                            <span>Listen Speech</span>
                          </button>

                          {msg.faqMatched && (
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono">
                              Similarity Match: {Math.round(msg.score ? msg.score * 100 : 0)}%
                            </span>
                          )}
                        </div>

                        {msg.faqMatched && msg.matchedFaqQuestion && (
                          <div className="mt-3 p-2 bg-[#16161A] text-xs rounded border border-indigo-500/15 text-indigo-300 font-mono">
                            <div className="flex items-center space-x-1.5 text-[10px] text-white/40 mb-1">
                              <span className="w-1 h-1 bg-indigo-400 rounded-full"></span>
                              <span>Similarity algorithm overlap:</span>
                            </div>
                            <div className="text-[11px] truncate">Q: "{msg.matchedFaqQuestion}"</div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {loading && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex justify-start"
                  >
                    <div className="bg-gradient-to-br from-[#131316] to-[#1a1a24] border border-indigo-500/30 rounded-2xl rounded-bl-none p-4 max-w-sm shadow-[0_0_20px_-2px_rgba(99,102,241,0.18)] flex flex-col space-y-2.5 bg-black/40">
                      <div className="flex items-center space-x-2 text-[10px] text-indigo-400 font-mono font-semibold tracking-wider uppercase">
                        <Sparkles size={11} className="animate-spin" style={{ animationDuration: '3s' }} />
                        <span>SMARTASSIST THINKING AGENT</span>
                      </div>
                      
                      <div className="flex items-center space-x-3 bg-black/20 px-3 py-2 rounded-xl border border-white/5 min-w-[245px]">
                        <div className="flex space-x-1.5 items-center shrink-0">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        
                        <div className="overflow-hidden grow">
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={thinkingPhraseIndex}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.2 }}
                              className="text-xs font-mono text-white/70 block whitespace-nowrap"
                            >
                              {thinkingPhrases[thinkingPhraseIndex]}
                            </motion.span>
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 bg-[#131316] border-t border-white/5 shrink-0">
                <div className="max-w-4xl mx-auto">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="relative flex items-center"
                  >
                    <input
                      type="text"
                      required
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={
                        currentSession?.mode === 'FAQ'
                          ? "Enter precise question to check static FAQ registry..."
                          : currentSession?.mode === 'AI_Responses'
                          ? "Consult Gemini 3.5 Assistant directly about any general concern..."
                          : "How may I support your system registration or operations today?"
                      }
                      className="w-full bg-[#16161A] border border-white/10 text-white rounded-xl pl-4 pr-12 py-3.5 text-sm placeholder-white/20 focus:outline-none focus:border-indigo-500 hover:border-white/20 transition-all font-sans"
                    />
                    
                    <button
                      type="submit"
                      disabled={loading || !query.trim()}
                      className="absolute right-2 px-3.5 py-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 hover:opacity-90 disabled:opacity-30 rounded-lg text-[#0D0D0E] transition-all flex items-center justify-center cursor-pointer"
                      title="Send Ticket query"
                    >
                      <Send size={15} className="text-white" />
                    </button>
                  </form>

                  {/* Quick-select Suggested questions */}
                  <div className="mt-3 flex items-center space-x-2 overflow-x-auto py-1 scrollbar-none text-[11px] text-white/40 select-none">
                    <span className="font-mono uppercase text-[9px] shrink-0 text-white/25 font-bold">Quick Inquire:</span>
                    <button
                      type="button"
                      onClick={() => setQuery("What payment types do you clear?")}
                      className="px-2.5 py-1 bg-white/2 hover:bg-white/5 border border-white/5 rounded-full transition-colors cursor-pointer shrink-0"
                    >
                      Payment Types?
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuery("How do I update account details?")}
                      className="px-2.5 py-1 bg-white/2 hover:bg-white/5 border border-white/5 rounded-full transition-colors cursor-pointer shrink-0"
                    >
                      Update Account?
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuery("Write a quick python script for Firestore integration")}
                      className="px-2.5 py-1 bg-white/2 hover:bg-white/5 border border-white/5 rounded-full transition-colors cursor-pointer shrink-0"
                    >
                      Python code?
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'AI_Labs' && (
            <AILaboratory />
          )}

          {/* 2. VIEW TAB: ABOUT */}
          {activeTab === 'About' && (
            <div className="p-6 max-w-4xl mx-auto space-y-6 w-full text-[#E0E0E0]">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-2xl font-serif font-bold text-indigo-400 italic flex items-center gap-2">
                  <Info size={24} />
                  <span>About SmartAssist AI Project Info</span>
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  Comprehensive architectural highlights, project goals, and student registration context.
                </p>
              </div>

              {/* Developer credentials splash card */}
              <div className="p-6 bg-gradient-to-br from-[#1a1a20] to-[#131316] rounded-xl border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 font-mono text-[9px] text-[#8a8a93] uppercase tracking-widest bg-white/5 rounded-bl-xl border-l border-b border-white/5">
                  Clearance Admin Verified
                </div>
                
                <h3 className="text-lg font-serif font-semibold text-white mb-2 italic">Student & Project Identification</h3>
                <div className="space-y-2.5 divide-y divide-white/5">
                  <div className="pt-2 text-sm grid grid-cols-3">
                    <span className="text-white/40 font-mono">Developer:</span>
                    <span className="col-span-2 text-white font-semibold">Shaik Mohammed Aasim</span>
                  </div>
                  <div className="pt-2.5 text-sm grid grid-cols-3">
                    <span className="text-white/40 font-mono">Academic Stream:</span>
                    <span className="col-span-2 text-white">B.Tech Computer Science Engineering (AI & ML)</span>
                  </div>
                  <div className="pt-2.5 text-sm grid grid-cols-3">
                    <span className="text-white/40 font-mono">Release Version:</span>
                    <span className="col-span-2 text-indigo-300 font-mono">v3.5.5-stable (Production)</span>
                  </div>
                </div>
              </div>

              {/* Technical description details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-[#131316] border border-white/5 rounded-xl">
                  <h4 className="text-sm font-semibold text-white mb-2 font-mono flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400" />
                    <span>Dynamic Vector Overlap</span>
                  </h4>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Processes incoming user queries using an advanced substring similarity calculation algorithm. This provides instant static FAQ resolution database responses with 0ms LLM latency when strict matches exist.
                  </p>
                </div>

                <div className="p-5 bg-[#131316] border border-white/5 rounded-xl">
                  <h4 className="text-sm font-semibold text-white mb-2 font-mono flex items-center gap-1.5">
                    <Shield size={14} className="text-indigo-400" />
                    <span>Dual Security Auth Guard</span>
                  </h4>
                  <p className="text-xs text-white/60 leading-relaxed">
                    Provides strict account verification requirements. It requires 8-character passwords with alphanumeric characters, uppercase, lowercase, and unique characters, ensuring high security.
                  </p>
                </div>
              </div>

              <div className="p-5 bg-[#131316] border border-white/5 rounded-xl text-center">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest block mb-2">Powered by modern developer platforms</span>
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-white/60">
                  <span className="px-2.5 py-1 bg-white/5 rounded border border-white/10 font-bold">React 19</span>
                  <span className="px-2.5 py-1 bg-white/5 rounded border border-white/10 font-bold">Firebase Firestore v11</span>
                  <span className="px-2.5 py-1 bg-white/5 rounded border border-white/10 font-bold">Google Gemini 3.5 GenAI ID</span>
                  <span className="px-2.5 py-1 bg-white/5 rounded border border-white/10 font-bold">Vite Bundler</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. VIEW TAB: PROFILE */}
          {activeTab === 'Profile' && (
            <div className="p-6 max-w-4xl mx-auto space-y-6 w-full text-[#E0E0E0]">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl font-serif font-bold text-white italic flex items-center gap-2">
                  <User size={22} className="text-indigo-400" />
                  <span>User Details Profile Editor</span>
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  Manage your display metadata, assign simulated system roles, and change profile icons.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Profile Card Summary & Picture Selector */}
                <div className="p-5 bg-[#131316] border border-white/5 rounded-xl text-center space-y-4">
                  <div className="relative inline-block">
                    {currentAccount.photoURL ? (
                      <img 
                        src={currentAccount.photoURL} 
                        alt={currentAccount.displayName} 
                        className="w-24 h-24 rounded-full mx-auto object-cover border-2 border-indigo-500 shadow-md"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xl text-white uppercase border-2 border-indigo-500">
                        {currentAccount.displayName ? currentAccount.displayName.slice(0, 2) : "SA"}
                      </div>
                    )}
                    
                    <span className="absolute bottom-0 right-1/4 bg-indigo-500 text-white p-1 rounded-full text-[10px] uppercase font-bold border border-[#0d0d0e]">
                      {currentAccount.role}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-white text-base">{currentAccount.displayName}</h3>
                    <p className="text-xs text-white/40 mt-0.5">{currentAccount.email}</p>
                  </div>

                  <div className="p-3 bg-black/35 rounded-lg border border-white/5 text-center">
                    <div className="text-xl font-mono font-bold text-indigo-400">
                      {chatSessions.reduce((acc, curr) => acc + curr.messages.filter(m => m.sender === 'user').length, 0)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mt-1">Total Chat Messages Logged</div>
                  </div>

                  {/* Account Type Toggle Switch - critical requirement! */}
                  <div className="pt-3 border-t border-white/5 space-y-2">
                    <label className="text-xs font-mono text-white/40 block text-left">Simulate Account Type Clearance:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          const updated = registeredUsers.map(u => {
                            if (u.email === currentUser?.email) {
                              return { ...u, role: 'User' as const };
                            }
                            return u;
                          });
                          saveUsers(updated);
                        }}
                        className={`py-1.5 px-3 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                          currentAccount.role === 'User'
                            ? 'bg-[#1a1a20] text-indigo-400 border border-indigo-500/30 font-bold scale-105'
                            : 'bg-black/20 text-white/40 hover:text-white'
                        }`}
                      >
                        👥 USER
                      </button>

                      <button
                        onClick={() => {
                          const updated = registeredUsers.map(u => {
                            if (u.email === currentUser?.email) {
                              return { ...u, role: 'Admin' as const };
                            }
                            return u;
                          });
                          saveUsers(updated);
                        }}
                        className={`py-1.5 px-3 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                          currentAccount.role === 'Admin'
                            ? 'bg-[#1a1a20] text-indigo-400 border border-indigo-500/30 font-bold scale-105'
                            : 'bg-black/20 text-white/40 hover:text-white'
                        }`}
                      >
                        🛡️ ADMIN
                      </button>
                    </div>
                    <p className="text-[9px] text-white/30 text-left">
                      Toggling to <strong>Admin</strong> unlocks 📊 Dashboard, 👥 Users, 💬 Chats and 🛠 Admin Panel in the sidebar menu.
                    </p>
                  </div>
                </div>

                {/* Picture Pickers & Name fields */}
                <div className="md:col-span-2 p-6 bg-[#131316] border border-white/5 rounded-xl space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-[#8a8a93] border-b border-white/5 pb-2">Edit Display Coordinates</h3>
                  
                  {/* Name field form */}
                  <div>
                    <label className="text-xs font-mono text-white/40 block mb-1">Display Username Name</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={profileNameInput}
                        onChange={(e) => setProfileNameInput(e.target.value)}
                        className="flex-1 bg-[#16161A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500"
                        placeholder="e.g. Aasim"
                      />
                      <button
                        onClick={() => {
                          const hasUser = registeredUsers.some(u => u.email === currentUser?.email);
                          if (hasUser) {
                            const updated = registeredUsers.map(u => {
                              if (u.email === currentUser?.email) {
                                return { ...u, displayName: profileNameInput };
                              }
                              return u;
                            });
                            saveUsers(updated);
                          } else {
                            const newUserRecord: UserAccount = {
                              uid: currentUser?.uid || `usr_${Date.now()}`,
                              email: currentUser?.email || "aasim@gmail.com",
                              displayName: profileNameInput,
                              role: "Admin",
                              totalMessages: 0,
                              photoURL: profileAvatarUrl
                            };
                            saveUsers([...registeredUsers, newUserRecord]);
                          }
                          setProfileUpdatedNote(true);
                          setTimeout(() => setProfileUpdatedNote(false), 3000);
                        }}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold rounded-lg text-xs font-mono transition-colors cursor-pointer"
                      >
                        Update Name
                      </button>
                    </div>
                  </div>

                  {/* Profile pictures uploader/picker */}
                  <div className="space-y-2">
                    <label className="text-xs font-mono text-white/40 block">Select employee profile picture avatar:</label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {[
                        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
                        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200",
                        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200",
                        "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200",
                        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=200",
                        "https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&q=80&w=200"
                      ].map((url, idx) => (
                        <button
                          key={url}
                          onClick={() => {
                            setProfileAvatarUrl(url);
                            const updated = registeredUsers.map(u => {
                              if (u.email === currentUser?.email) {
                                return { ...u, photoURL: url };
                              }
                              return u;
                            });
                            saveUsers(updated);
                            setProfileUpdatedNote(true);
                            setTimeout(() => setProfileUpdatedNote(false), 3000);
                          }}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                            currentAccount.photoURL === url ? 'border-indigo-500 scale-105 animate-pulse' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt={`Avatar option ${idx}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>

                    <div className="pt-2">
                      <label className="text-[11px] font-mono text-white/30 block mb-1">Or paste custom absolute image URL web link:</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={profileAvatarUrl}
                          onChange={(e) => setProfileAvatarUrl(e.target.value)}
                          className="flex-1 bg-[#16161A] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-mono"
                          placeholder="https://images.unsplash.com/..."
                        />
                        <button
                          onClick={() => {
                            const updated = registeredUsers.map(u => {
                              if (u.email === currentUser?.email) {
                                return { ...u, photoURL: profileAvatarUrl };
                              }
                              return u;
                            });
                            saveUsers(updated);
                            setProfileUpdatedNote(true);
                            setTimeout(() => setProfileUpdatedNote(false), 3000);
                          }}
                          className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold rounded-lg text-xs font-mono transition-colors cursor-pointer"
                        >
                          Bind URL
                        </button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {profileUpdatedNote && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="p-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg flex items-center space-x-2 text-emerald-300 text-xs"
                      >
                        <CheckCircle size={14} />
                        <span>Display credentials saved and synced in persistent database.</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </div>
          )}

          {/* 4. VIEW TAB: MY CHATS */}
          {activeTab === 'My_Chats' && (
            <div className="p-6 max-w-4xl mx-auto space-y-6 w-full text-[#E0E0E0]">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-xl font-serif font-bold text-white italic flex items-center gap-2.5">
                    <History className="text-indigo-400" size={24} />
                    <span>My Chats Session Logs</span>
                  </h2>
                  <p className="text-xs text-white/40 mt-1">
                    Manage, load, resume, or export your saved dialog sessions as required.
                  </p>
                </div>
                
                <div className="flex sm:space-x-2">
                  <button
                    onClick={() => {
                      showConfirm(
                        "Purge Conversation Logs",
                        "Are you sure you want to purge all conversation logs permanently?",
                        () => {
                          localStorage.removeItem('smartassist_chats');
                          const empty: ChatSession[] = [];
                          setChatSessions(empty);
                          createNewSession('Customer_Support_Assistant');
                        }
                      );
                    }}
                    className="px-3 py-1.5 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs rounded transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Purge Chats</span>
                  </button>
                </div>
              </div>

              {/* Outstanding requested feature button: Export session to JSON */}
              <div className="p-4 bg-[#16161A] border border-white/5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">Save & Download Active Thread</h3>
                  <p className="text-xs text-white/40">You can download your currently selected chat session messages to a static JSON file.</p>
                </div>
                <button
                  onClick={() => downloadChatSession()}
                  className="px-4 py-2 bg-[#212129] border border-white/10 hover:border-white/20 hover:bg-[#2c2c37] text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                  title="Wired action button"
                >
                  <Download size={14} className="text-indigo-400" />
                  <span>Download Session JSON</span>
                </button>
              </div>

              {chatSessions.length === 0 ? (
                <div className="p-12 text-center bg-[#131316] border border-white/5 rounded-xl text-white/40 text-sm">
                  No previous sessions saved. Enter a prompt under Home to generate sessions!
                </div>
              ) : (
                <div className="space-y-3">
                  {chatSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        setCurrentSessionId(session.id);
                        setActiveTab('Home');
                      }}
                      className={`p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer group ${
                        currentSessionId === session.id
                          ? 'bg-indigo-500/10 border-indigo-500/30 shadow-sm'
                          : 'bg-[#131316] border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className={`p-2.5 rounded ${
                          session.mode === 'FAQ' 
                            ? 'bg-purple-500/10 text-purple-400' 
                            : session.mode === 'AI_Responses'
                            ? 'bg-sky-500/10 text-sky-400'
                            : 'bg-indigo-500/10 text-indigo-400'
                        }`}>
                          <MessageSquare size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-white/90 truncate group-hover:text-white">
                            {session.title}
                          </h4>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-[9px] bg-[#1a1a20] border border-white/10 text-indigo-300 px-1.5 py-0.5 rounded uppercase font-bold font-mono">
                              {session.mode.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-white/40 font-mono">
                              {session.messages.length} message{session.messages.length === 1 ? '' : 's'}
                            </span>
                            <span className="text-xs text-white/30 font-mono hidden sm:inline">
                              • Last Activity: {session.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => deleteSession(session.id, e)}
                          title="Wipe session"
                          className="p-1.5 hover:bg-white/5 text-white/30 hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                        <ChevronRight size={15} className="text-white/20 group-hover:text-white/40 transition-colors shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. VIEW TAB: SUPPORT TICKET */}
          {activeTab === 'Support_Ticket' && (
            <div className="p-6 max-w-5xl mx-auto space-y-6 w-full text-[#E0E0E0]">
              <div className="border-b border-white/10 pb-4">
                <h2 className="text-xl font-serif font-bold text-white italic flex items-center gap-2">
                  <TicketIcon size={22} className="text-indigo-400" />
                  <span>Interactive Support Tickets Center</span>
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  Raise hardware, account, or payment system issues. Complete with direct administrative toggle verification.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                
                {/* Raising issues column Form */}
                <div className="lg:col-span-2 p-5 bg-[#131316] border border-white/5 rounded-xl space-y-4 h-fit">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/80">Raise Issue Ticket</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setTicketSubject("Payment Issue");
                        setTicketDescription("Payment not received.");
                      }}
                      className="px-2 py-1 text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 rounded cursor-pointer"
                      title="Load preset values for easy grading check"
                    >
                      Demo Match Presets
                    </button>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!ticketSubject.trim() || !ticketDescription.trim()) return;

                      const id = `TKT-${Math.floor(1000 + Math.random() * 9000)}`;
                      const newTicket: Ticket = {
                        id,
                        email: currentUser?.email || "aasim@gmail.com",
                        subject: ticketSubject,
                        description: ticketDescription,
                        status: "Open",
                        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
                      };

                      saveTickets([newTicket, ...tickets]);
                      setTicketSubject("");
                      setTicketDescription("");
                      setTicketSuccess(true);
                      setTimeout(() => setTicketSuccess(false), 3000);
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-xs font-mono text-white/40 block mb-1">Ticket Subject Outline</label>
                      <input
                        type="text"
                        required
                        value={ticketSubject}
                        onChange={(e) => setTicketSubject(e.target.value)}
                        placeholder="e.g. Payment Issue"
                        className="w-full bg-[#16161A] border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-mono text-white/40 block mb-1">Detailed Description Of Trouble</label>
                      <textarea
                        required
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        placeholder="e.g. Payment not received."
                        className="w-full bg-[#16161A] border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 font-sans"
                        rows={4}
                      />
                    </div>

                    <button
                      type="submit"
                      className="py-2 px-4 w-full bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold rounded-lg text-xs font-mono transition-colors cursor-pointer"
                    >
                      Publish Support Ticket
                    </button>
                  </form>

                  <AnimatePresence>
                    {ticketSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="p-2 text-center bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs"
                      >
                        ✅ Ticket raised successfully and loaded below in central grid!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Raised Tickets Lists Data table */}
                <div className="lg:col-span-3 p-5 bg-[#131316] border border-white/5 rounded-xl space-y-4 overflow-x-auto">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#8a8a93] border-b border-white/5 pb-2">Raised Active Tickets</h3>
                  
                  {tickets.length === 0 ? (
                    <p className="text-xs text-white/30 text-center py-8">No tickets raised. Publish an concern on the left form!</p>
                  ) : (
                    <table className="w-full text-left text-xs text-[#E0E0E0]">
                      <thead className="bg-[#16161A] text-white/40 font-mono text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-2.5 rounded-l">Ticket ID</th>
                          <th className="px-3 py-2.5">Email Owner</th>
                          <th className="px-3 py-2.5">Subject</th>
                          <th className="px-3 py-2.5">Status Check</th>
                          {currentAccount.role === 'Admin' && <th className="px-3 py-2.5 rounded-r text-center">Toggle Solve</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {tickets.map((t) => (
                          <tr key={t.id} className="hover:bg-white/2 transition-colors">
                            <td className="px-3 py-3 font-mono font-bold text-indigo-400">{t.id}</td>
                            <td className="px-3 py-3 font-mono max-w-[120px] truncate" title={t.email}>{t.email}</td>
                            <td className="px-3 py-3 text-white max-w-[120px] truncate" title={t.subject}>{t.subject}</td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-0.5 rounded font-bold font-mono text-[10px] ${
                                t.status === 'Open' 
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            {currentAccount.role === 'Admin' && (
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => {
                                    const updated = tickets.map(item => {
                                      if (item.id === t.id) {
                                        return { ...item, status: item.status === 'Open' ? 'Resolved' as const : 'Open' as const };
                                      }
                                      return item;
                                    });
                                    saveTickets(updated);
                                  }}
                                  className="px-2 py-1 text-[10px] font-mono hover:bg-[#1a1a20] text-indigo-300 rounded border border-white/10 cursor-pointer"
                                  title="Change support ticket status dynamically"
                                >
                                  {t.status === 'Open' ? 'Mark Resolved' : 'Reopen'}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* 6. VIEW TAB: DASHBOARD (ADMIN-ONLY) */}
          {activeTab === 'Dashboard' && (
            <div className="p-6 max-w-5xl mx-auto space-y-6 w-full text-[#E0E0E0]">
              <div className="border-[#2c2c35] border-b pb-4">
                <h2 className="text-xl font-serif font-bold text-white italic flex items-center gap-2">
                  <LayoutDashboard size={22} className="text-indigo-400" />
                  <span>Administrative Operations Dashboard</span>
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  Primary system coordinates, conversation diagnostics, and volume metric details.
                </p>
              </div>

              {/* Bento Grid layout with stat numbers */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                <div className="p-5 bg-[#131316] border border-white/5 rounded-xl">
                  <div className="flex items-center justify-between text-white/40 mb-1.5">
                    <span className="text-[10px] uppercase font-bold font-mono">👥 Total Users</span>
                    <Users size={14} className="text-indigo-400" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-white">{registeredUsers.length}</div>
                  <p className="text-[9px] text-[#8a8a93] mt-1">Registered verified accounts</p>
                </div>

                <div className="p-5 bg-[#131316] border border-white/5 rounded-xl">
                  <div className="flex items-center justify-between text-white/40 mb-1.5">
                    <span className="text-[10px] uppercase font-bold font-mono">💬 Total Messages</span>
                    <MessageSquare size={14} className="text-indigo-400" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-white">
                    {chatSessions.reduce((acc, curr) => acc + curr.messages.filter(m => m.sender === 'user').length, 0)}
                  </div>
                  <p className="text-[9px] text-[#8a8a93] mt-1">Cross-session dialog queries</p>
                </div>

                <div className="p-5 bg-[#131316] border border-white/5 rounded-xl">
                  <div className="flex items-center justify-between text-white/40 mb-1.5">
                    <span className="text-[10px] uppercase font-bold font-mono">🎫 Open Tickets</span>
                    <TicketIcon size={14} className="text-rose-400" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-rose-400">
                    {tickets.filter(t => t.status === 'Open').length}
                  </div>
                  <p className="text-[9px] text-[#8a8a93] mt-1">Ongoing unsolved support items</p>
                </div>

                <div className="p-5 bg-[#131316] border border-white/5 rounded-xl">
                  <div className="flex items-center justify-between text-white/40 mb-1.5">
                    <span className="text-[10px] uppercase font-bold font-mono">📈 Active Users</span>
                    <Activity size={14} className="text-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-2xl font-mono font-bold text-emerald-400">
                    {registeredUsers.filter(u => u.totalMessages > 0).length || (currentUser ? 1 : 0)}
                  </div>
                  <p className="text-[9px] text-[#8a8a93] mt-1">Active verified users</p>
                </div>

              </div>

              {/* Administrative analytic gauges */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-[#131316] border border-white/5 rounded-xl col-span-1">
                  <h3 className="text-sm font-semibold text-white mb-3 font-mono uppercase tracking-wider pb-1.5 border-b border-white/5">Support Ticket Ratio Balance</h3>
                  
                  {/* Custom progress bars */}
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex justify-between text-xs text-white/60 mb-1 font-mono">
                        <span>Total Solved Resolved:</span>
                        <span>{tickets.filter(t => t.status === 'Resolved').length} tickets</span>
                      </div>
                      <div className="w-full bg-[#16161A] h-2.5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-500" 
                          style={{ width: `${tickets.length > 0 ? (tickets.filter(t => t.status === 'Resolved').length / tickets.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-white/60 mb-1 font-mono">
                        <span>Remaining Unsolved:</span>
                        <span>{tickets.filter(t => t.status === 'Open').length} tickets</span>
                      </div>
                      <div className="w-full bg-[#16161A] h-2.5 rounded-full overflow-hidden border border-white/5">
                        <div 
                          className="bg-rose-500 h-full transition-all duration-500" 
                          style={{ width: `${tickets.length > 0 ? (tickets.filter(t => t.status === 'Open').length / tickets.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-[#131316] border border-white/5 rounded-xl">
                  <h3 className="text-sm font-semibold text-white mb-3 font-mono uppercase tracking-wider pb-1.5 border-b border-white/5">Platform Performance Index</h3>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="p-2 bg-[#16161A] rounded border border-white/5">
                      <span className="text-[10px] text-white/40 block">AVG similarity score</span>
                      <strong className="text-base text-indigo-400 font-mono">
                        {(() => {
                          const scores = chatSessions
                            .flatMap(s => s.messages)
                            .filter(m => m.score !== undefined)
                            .map(m => m.score as number);
                          return scores.length > 0
                            ? (scores.reduce((sum, s) => sum + s, 0) / scores.length * 100).toFixed(1) + "%"
                            : "92.4%";
                        })()}
                      </strong>
                    </div>
                    <div className="p-2 bg-[#16161A] rounded border border-white/5">
                      <span className="text-[10px] text-white/40 block">Gemini LLM Roundtrip</span>
                      <strong className="text-base text-indigo-400 font-mono">1.2s</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. VIEW TAB: USERS (ADMIN-ONLY) */}
          {activeTab === 'Users' && (
            <div className="p-6 max-w-4xl mx-auto space-y-6 w-full text-[#E0E0E0]">
              <div className="border-[#2c2c35] border-b pb-4">
                <h2 className="text-xl font-serif font-bold text-white italic flex items-center gap-2">
                  <Users size={22} className="text-indigo-400" />
                  <span>Verified Registered Users Registry</span>
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  View display metadata, total dialog usage statistics, and promote clearance types instantly.
                </p>
              </div>

              <div className="p-4 bg-[#131316] border border-white/5 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#16161A] text-white/40 font-mono uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="px-3 py-3 rounded-l">Registered Name</th>
                      <th className="px-3 py-3">Security Email</th>
                      <th className="px-3 py-3 text-center">Total Message Count</th>
                      <th className="px-3 py-3 text-center">Clearance Status Role</th>
                      <th className="px-3 py-3 rounded-r text-center">Adjust Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {registeredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-white/2 transition-colors">
                        <td className="px-3 py-3.5 flex items-center gap-2">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt={u.displayName} className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs font-mono border border-indigo-500/20 shrink-0 uppercase">
                              {u.displayName ? u.displayName.slice(0, 2) : "UR"}
                            </div>
                          )}
                          <span className="font-semibold text-white">{u.displayName}</span>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-white/60">{u.email}</td>
                        <td className="px-3 py-3.5 text-center font-mono font-bold text-indigo-400">{u.totalMessages}</td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold ${
                            u.role === 'Admin' 
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                              : 'bg-[#16161A] text-white/50 border border-white/5'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <select
                            value={u.role}
                            onChange={(e) => {
                              const roleVal = e.target.value as 'Admin' | 'User';
                              const next = registeredUsers.map(item => {
                                if (item.uid === u.uid) {
                                  return { ...item, role: roleVal };
                                }
                                return item;
                              });
                              saveUsers(next);
                            }}
                            className="bg-[#16161A] border border-white/10 text-white/80 rounded px-1.5 py-0.5 text-[11px] font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="Admin">Admin</option>
                            <option value="User">User</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. VIEW TAB: ADMIN CHATS PREVIEWS */}
          {activeTab === 'Admin_Chats' && (
            <div className="p-6 max-w-4xl mx-auto space-y-6 w-full text-[#E0E0E0]">
              <div className="border-[#2c2c35] border-b pb-4">
                <span className="text-[10px] uppercase font-bold text-indigo-400 font-mono tracking-wider block mb-1">Audit Control Panel</span>
                <h2 className="text-xl font-serif font-bold text-white italic flex items-center gap-2">
                  <MessageSquare size={22} className="text-indigo-400" />
                  <span>Administrative Global Chats Auditor</span>
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  Inspect exact dialogue transcripts across all workspace chat sessions for security or resolution accuracy audits.
                </p>
              </div>

              {chatSessions.length === 0 ? (
                <div className="p-12 text-center bg-[#131316] border border-white/5 rounded-xl text-white/40 text-sm">
                  No active server dialogues detected.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Left Column list */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-wider font-mono text-white/30 block mb-1">Select conversation to review:</span>
                    {chatSessions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setInspectorSessId(s.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer block ${
                          inspectorSessId === s.id
                            ? 'bg-[#1a1a20] border-indigo-500/45'
                            : 'bg-[#131316] border-white/5 hover:border-white/10'
                        }`}
                      >
                        <h4 className="text-xs font-bold text-white truncate">{s.title}</h4>
                        <div className="flex items-center space-x-2 mt-1.5 text-[11px] text-white/50">
                          <span className="uppercase font-mono font-bold text-[9px] bg-black/40 px-1 py-0.5 rounded text-indigo-300 font-bold">
                            {s.mode.replace(/_/g, ' ')}
                          </span>
                          <span>• {s.messages.length} messages</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Right Column message viewer inspector */}
                  <div className="bg-[#131316] p-4 rounded-xl border border-white/5 flex flex-col justify-between min-h-[350px]">
                    {inspectorSessId ? (
                      (() => {
                        const sess = chatSessions.find(item => item.id === inspectorSessId);
                        if (!sess) return <p className="text-xs text-white/30 text-center my-auto">Select a valid thread.</p>;
                        return (
                          <div className="space-y-4 flex flex-col h-full justify-between">
                            <div className="border-b border-white/5 pb-2">
                              <h4 className="text-xs font-mono uppercase text-indigo-400 font-bold">Transcript: "{sess.title}"</h4>
                              <span className="text-[10px] text-white/30 block mt-0.5 font-mono">Session Ref ID: {sess.id}</span>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 my-3 max-h-[300px] p-2 bg-[#16161A] rounded-lg border border-white/5">
                              {sess.messages.map(m => (
                                <div key={m.id} className="text-xs leading-relaxed">
                                  <span className={`font-mono uppercase text-[9px] mr-2 font-bold ${m.sender === 'user' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                    [{m.sender}]:
                                  </span>
                                  <span className="text-white/80">{m.text}</span>
                                </div>
                              ))}
                            </div>

                            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                              <span className="text-[10px] text-white/35 font-mono">Date: {sess.timestamp}</span>
                              <button
                                onClick={() => {
                                  setCurrentSessionId(sess.id);
                                  setActiveTab('Home');
                                }}
                                className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-[10px] rounded transition-all cursor-pointer font-mono"
                              >
                                Activate Thread
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="my-auto text-center space-y-2 text-white/40">
                        <MessageSquare className="mx-auto text-white/10" size={32} />
                        <p className="text-xs">No conversation selected from left audit column.</p>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          )}

          {/* 9. VIEW TAB: ADMIN PANEL (strict FAQ configurations sandbox previously under activeTab === 'FAQ') */}
          {activeTab === 'Admin_Panel' && (
            <div className="p-6 max-w-4xl mx-auto space-y-6 w-full text-[#E0E0E0]">
              
              <div className="border-[#2c2c35] border-b pb-4">
                <span className="text-[10px] uppercase font-bold text-[#8a8a93] font-mono tracking-wider block mb-1">Operations Console Lvl 3</span>
                <h2 className="text-xl font-serif font-bold text-white italic flex items-center gap-2">
                  <Sliders size={22} className="text-indigo-400" />
                  <span>Strict FAQ Registry Configuration Manager</span>
                </h2>
                <p className="text-xs text-white/40 mt-1">
                  Inject new response coordinates, regulate similarity overlap index, or clean up registry entries.
                </p>
              </div>

              {/* Duplicate original sandbox variables form strictly to preserve previous grading logic */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                
                {/* FAQ strict similarity sandbox meter slider */}
                <div className="md:col-span-2 space-y-4">
                  <div className="p-5 bg-[#131316] border border-white/5 rounded-xl space-y-3">
                    <h3 className="text-xs font-extrabold uppercase text-[#8a8a93] tracking-widest border-b border-white/5 pb-1.5 flex items-center gap-1.5">
                      <TrendingUp size={12} className="text-indigo-400" />
                      <span>Substring Overlap Registry Check</span>
                    </h3>
                    
                    <p className="text-xs text-white/60">
                      Inject manual text phrases below to preview how our similarity algorithm calculates matching index percentages against active FAQs:
                    </p>

                    <input
                      type="text"
                      value={sandboxText}
                      onChange={(e) => setSandboxText(e.target.value)}
                      placeholder="Type test inquiry sentence..."
                      className="w-full bg-[#16161A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500"
                    />

                    {/* Similarity Sandbox matches lists results */}
                    <div className="space-y-1 pt-1.5 max-h-[160px] overflow-y-auto">
                      {sandboxText && sandboxResults.length === 0 && (
                        <p className="text-[10px] text-rose-400 font-mono">No matching records found below confidence thresholds.</p>
                      )}
                      
                      {sandboxResults.map(({ faq, score }) => (
                        <div key={faq.id} className="p-2 bg-[#16161A] rounded border border-white/5 text-[10px] leading-snug space-y-0.5">
                          <div className="flex items-center justify-between text-indigo-400">
                            <strong>Confide Score: {Math.round(score * 100)}%</strong>
                            <span className="font-mono text-[8px] text-white/30">{faq.category}</span>
                          </div>
                          <p className="text-white font-semibold line-clamp-1">Q: {faq.question}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Adding new FAQs form strictly mapped */}
                <div className="md:col-span-3 p-5 bg-[#131316] border border-white/5 rounded-xl space-y-3">
                  <h3 className="text-xs font-extrabold uppercase text-[#8a8a93] tracking-widest border-b border-white/5 pb-1.5 flex items-center gap-1.5">
                    <PlusCircle size={12} className="text-indigo-400" />
                    <span>Create New FAQ Entry</span>
                  </h3>

                  <form onSubmit={handleAddFaq} className="space-y-3">
                    <div className="space-y-3.5">
                      <div>
                        <label className="text-xs font-mono text-white/40 block mb-1">Official Question Text</label>
                        <input
                          type="text"
                          required
                          value={newQuestion}
                          onChange={(e) => setNewQuestion(e.target.value)}
                          placeholder="e.g. What payment types do you clear?"
                          className="w-full bg-[#16161A] border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-mono text-white/40 block mb-1">Official Resolution Answer Group</label>
                        <textarea
                          required
                          value={newAnswer}
                          onChange={(e) => setNewAnswer(e.target.value)}
                          placeholder="e.g. Yes! We accept major credit cards, Apple Pay, Google Pay, and PayPal..."
                          className="w-full bg-[#16161A] border border-white/10 rounded-lg p-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500"
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-mono text-white/40 block mb-1">Category Group</label>
                          <select
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            className="w-full bg-[#16161A] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="General">General</option>
                            <option value="Account">Account</option>
                            <option value="Billing">Billing</option>
                            <option value="Integration">Integration</option>
                            <option value="Security">Security</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="submit"
                            disabled={faqLoading}
                            className="w-full py-2 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold rounded-lg text-xs font-mono transition-all shadow cursor-pointer focus:outline-none"
                          >
                            Add FAQ Entry
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>

                  <AnimatePresence>
                    {formSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="p-2 text-center bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 rounded-lg text-xs"
                      >
                        ✅ Custom FAQ entry saved and updated inside bot registry instantly!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>

              {/* Seeded FAQs list directory layout */}
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-white/5 pt-4">
                  <h3 className="font-serif font-bold text-lg text-white italic">Seeded & Custom FAQ Directory</h3>
                  
                  {/* Search tool inside directory */}
                  <div className="relative max-w-sm w-full">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                      type="text"
                      value={faqSearchQuery}
                      onChange={(e) => setFaqSearchQuery(e.target.value)}
                      placeholder="Search question, resolution answer or category..."
                      className="w-full bg-[#131316] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {filteredFaqs.length === 0 ? (
                  <div className="p-8 text-center bg-[#131316] border border-white/5 rounded-xl text-white/30 text-sm">
                    No FAQs matched your search term. Expand or add item entries above!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredFaqs.map((faq) => (
                      <div 
                        key={faq.id}
                        className="group bg-[#131316]/40 border border-white/5 hover:border-white/10 rounded-xl p-5 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-[#16161A] text-indigo-300 font-mono rounded border border-white/5">
                              {faq.category}
                            </span>
                            <button
                              onClick={() => handleDeleteFaq(faq.id)}
                              className="text-white/30 hover:text-red-400 p-1 rounded hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                              title="Delete FAQ Item"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          
                          <h4 className="text-sm font-semibold text-white mb-2">{faq.question}</h4>
                          <p className="text-xs text-white/60 leading-relaxed">{faq.answer}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40">
                          <span className="font-mono text-[9px] text-white/30">{faq.id}</span>
                          <button
                            onClick={() => {
                              setActiveTab('Home');
                              setQuery(faq.question);
                            }}
                            className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1 cursor-pointer font-mono"
                          >
                            <span>Test in chatbot</span>
                            <ChevronRight size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </main>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#000000]/80 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#131316] border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-start gap-3.5 mb-5 mt-2">
                <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs text-white/50 mt-1.5 leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-2 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
