import React, { useState, useRef } from "react";
import { 
  Sparkles, Brain, Search, MapPin, Image as ImageIcon, Video, 
  MessageSquare, Upload, Trash2, Send, Cpu, Eye, Zap, 
  ChevronRight, RefreshCw, Layers, ShieldCheck, Check, Sliders
} from "lucide-react";

interface AILaboratoryProps {
  onSuccess?: () => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
  modelName: string;
}

export default function AILaboratory({ onSuccess }: AILaboratoryProps) {
  // Tabs for the AI Laboratory Workspace
  const [activeSubTab, setActiveSubTab] = useState<
    "chatbot" | "thinking" | "multimodal" | "grounding" | "imagery"
  >("chatbot");

  const [loading, setLoading] = useState(false);
  const [errorString, setErrorString] = useState<string | null>(null);

  // Smart Simulator Fallback States
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);

  // 1. Chatbot Tab states
  const [chatModel, setChatModel] = useState<"fast" | "general" | "complex">("general");
  const [systemInstruction, setSystemInstruction] = useState(
    "You are an Elite AI Operations specialist representing SmartAssist. Be clear, analytical, and highly helpful."
  );
  const [chatQuery, setChatQuery] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: "init",
      sender: "bot",
      text: "Greetings! I'm your multi-turn Gemini agent. You can custom-configure my system role or trigger faster models on the operations control deck.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelName: "gemini-3.5-flash"
    }
  ]);

  // 2. Thinking Tab states
  const [thinkingPrompt, setThinkingPrompt] = useState("");
  const [thinkingOutput, setThinkingOutput] = useState("");

  // 3. Multimodal Tab states
  const [multimodalType, setMultimodalType] = useState<"image" | "video">("image");
  const [multimodalPrompt, setMultimodalPrompt] = useState("");
  const [multimodalOutput, setMultimodalOutput] = useState("");
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const [uploadedMime, setUploadedMime] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 4. Grounding Tab states
  const [groundingMode, setGroundingMode] = useState<"search" | "maps">("search");
  const [groundingQuery, setGroundingQuery] = useState("");
  const [groundingOutput, setGroundingOutput] = useState("");

  // 5. Imagery Workspace states
  const [imageryMode, setImageryMode] = useState<"imagen" | "edit">("imagen");
  const [imageryPrompt, setImageryPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("1:1");
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  const [imageryOutputUrl, setImageryOutputUrl] = useState<string | null>(null);
  
  // Custom presets for System Roles
  const systemPresets = [
    {
      name: "Standard Specialist",
      instr: "You are an Elite AI Operations specialist representing SmartAssist. Be clear, analytical, and highly helpful."
    },
    {
      name: "Cyber Security Auditor",
      instr: "You are a senior cybersecurity researcher. Analyze queries focusing on infrastructure defense, authorization levels, and vulnerability hardening. Speak with technical weight."
    },
    {
      name: "Support Copywriter",
      instr: "You are a creative copywriting expert specialized in customer success. Tone down technical jargon and write highly empathetic, cheerful, and persuasive instructions."
    }
  ];

  // Client-side File to Base64 utility
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setUploadedMime(file.type);

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 1. Submit Multi-turn Chat
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim() || loading) return;

    setErrorString(null);
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: chatQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelName: "user"
    };

    setChatHistory((prev) => [...prev, userMsg]);
    const currentQuery = chatQuery;
    setChatQuery("");
    setLoading(true);

    if (isSimulationMode) {
      setTimeout(() => {
        let simulatedText = "";
        const roleLower = systemInstruction.toLowerCase();
        if (roleLower.includes("cyber security")) {
          simulatedText = `[SECURE COGNITION TERMINAL - SIMULATED AUDIT]\n\nAUDIT LOG:\n- Query: "${currentQuery}"\n- Status: SAFE / RECONSTRUCTED INTERFACE ACTIVE\n- Analysis: Under offline simulation protocol, we have verified that this route behaves correctly. Sanitizing memory buffers and authorizing local key variables. Ensure no secret API credentials are run in browser client spaces. Security bounds verified successfully with zero packet loss.`;
        } else if (roleLower.includes("copywriter") || roleLower.includes("empathetic")) {
          simulatedText = `Hey there! 🌟 I've analyzed your question "${currentQuery}" and built this cute reply! Everything is working beautifully and we are absolutely thrilled to guide you through the AI Laboratory workbench! Let's build something awesome together! ❤️`;
        } else {
          simulatedText = `[SIMULATION WORKSPACE ACTIVE]\n\nUnder active Standard Specialist settings, we successfully processed your query: "${currentQuery}".\n\nThe intelligence sandbox model is fully operational. When live API quotas are available, this route automatically proxies through high-efficiency Gemini server models. Ready for your next command!`;
        }

        const botMsg: ChatMessage = {
          id: `bot_${Date.now()}`,
          sender: "bot",
          text: simulatedText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelName: "gemini-3.5-flash [Simulated]"
        };
        setChatHistory((prev) => [...prev, botMsg]);
        setLoading(false);
      }, 700);
      return;
    }

    try {
      // Package query with system instructions + formatted history
      const promptCombined = `[System instructions for this chat session: "${systemInstruction}"]\n\nUser query: ${userMsg.text}`;
      
      const response = await fetch("/api/ai/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptCombined,
          speed: chatModel
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Server returned a non-JSON response: ${text.slice(0, 140)}... Confirm API Key credentials support this model.`);
      }

      const data = await response.json();
      if (!response.ok || data.error) {
        if (response.status === 429 || data.isQuotaExceeded) {
          setShowQuotaWarning(true);
        }
        throw new Error(data.error || "Failed to communicate with chat engine.");
      }

      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        sender: "bot",
        text: data.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelName: data.modelUsed
      };
      setChatHistory((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      setErrorString(err.message || String(err));
      if (err.message?.includes("Limit exceeded") || err.message?.includes("Quota")) {
        setShowQuotaWarning(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit Reasoning (Thinking) Query
  const handleSendThinking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thinkingPrompt.trim() || loading) return;

    setErrorString(null);
    setLoading(true);
    setThinkingOutput("");

    if (isSimulationMode) {
      setTimeout(() => {
        setThinkingOutput(`[COGNITIVE REASONING MATRIX SECURE NODE - SIMULATED RESOLUTION]
Executing Depth Sequence Level: HIGH
Core Model targeted: gemini-2.5-flash

STEP 1: OBJECTIVE DECONSTRUCTION
Analyzing parameters of requested query:
"${thinkingPrompt}"

EVALUATING LOGICAL BOUNDS:
- Checked overlapping variables and edge conditions.
- Validated rate-limits and runtime complexity vectors.

STEP 2: ALTERNATIVE MODEL PATHS
1. Pathway Alpha (High Memory, Low Cache misses):
   Utilize pre-allocated chunks and parallel async workers to process state vectors instantly without locking critical processes.
2. Pathway Beta (Recursive, Lazy Initializer):
   Bypass heavy upfront compilation costs by initializing modules solely on first request context. Prevents cold startups.

STEP 3: INTEGRATION PARADIGM
We design a highly optimal system map. For operations like this, the following architecture is recommended:

\`\`\`typescript
// High Thinking Optimized Sequence Engine
export class SequenceResolver<T> {
  private registries = new Map<string, T>();

  public solve(key: string, calculation: () => T): T {
    if (this.registries.has(key)) {
      return this.registries.get(key)!;
    }
    const evaluated = calculation();
    this.registries.set(key, evaluated);
    return evaluated;
  }
}
\`\`\`

STEP 4: ROBUSTNESS & SECURITY COMPLIANCE
- Input Validation: Sanitized.
- Memory leak analysis: Zero overhead, fully cleaned up on component unmount.
- Thread-locks check: Confirmed non-blocking with standard event loop.

[CONCLUSION]: Model reasoning completed successfully with state preservation.`);
        setLoading(false);
      }, 950);
      return;
    }

    try {
      const response = await fetch("/api/ai/thinking-high", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: thinkingPrompt })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Server returned a non-JSON response: ${text.slice(0, 140)}... Confirm API Key credentials support high thinking level capabilities.`);
      }

      const data = await response.json();
      if (!response.ok || data.error) {
        if (response.status === 429 || data.isQuotaExceeded) {
          setShowQuotaWarning(true);
        }
        throw new Error(data.error || "Reasoning engine failed.");
      }
      setThinkingOutput(data.response);
    } catch (err: any) {
      console.error(err);
      setErrorString(err.message || String(err));
      if (err.message?.includes("Limit exceeded") || err.message?.includes("Quota")) {
        setShowQuotaWarning(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // 3. Submit Multimodal (Image/Video) Analysis
  const handleSendMultimodal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedBase64 || loading) {
      setErrorString("Please upload a media file (JPEG/PNG/MP4) first.");
      return;
    }

    setErrorString(null);
    setLoading(true);
    setMultimodalOutput("");

    const isVideo = uploadedMime.includes("video") || multimodalType === "video";
    const endpoint = isVideo ? "/api/ai/analyze-video" : "/api/ai/analyze-image";

    if (isSimulationMode) {
      setTimeout(() => {
        setMultimodalOutput(`[MULTIMODAL INTELLIGENCE RADAR - SIMULATED RESULTS]
Analyzed File: ${uploadedFileName || (isVideo ? "operations_footage.mp4" : "mainframe.jpg")}
Asset Mime-Type: ${uploadedMime || (isVideo ? "video/mp4" : "image/jpeg")}
Sensing Protocol: OFFLINE DEMO SANDBOX

ANALYTICAL PROMPT DIRECTIVE:
"${multimodalPrompt || "Describe uploaded media asset layout."}"

VISUAL STAGE GRAPH ANALYSIS:
1. Canvas Boundaries: Measured at 1920x1080 resolution, satisfying aspect checks.
2. Grid Layout & Density: Elements display a high-contrast elegant structural flow with comfortable negative spacing. No visual overflows or overlapping elements observed.
3. Content Classification: Technical diagram/interface mockup detected with 96% structural clarity. Color values demonstrate excellent visual matching.

SUMMARY: The media file loads flawlessly within the viewer space, and the pipeline models correct parsing logic.`);
        setLoading(false);
      }, 850);
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: multimodalPrompt,
          imageB64: !isVideo ? uploadedBase64 : undefined,
          videoB64: isVideo ? uploadedBase64 : undefined,
          mimeType: uploadedMime || (isVideo ? "video/mp4" : "image/jpeg")
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Server returned a non-JSON response: ${text.slice(0, 140)}... Confim upload sizing fits within limits.`);
      }

      const data = await response.json();
      if (!response.ok || data.error) {
        if (response.status === 429 || data.isQuotaExceeded) {
          setShowQuotaWarning(true);
        }
        throw new Error(data.error || "Multimodal analyzer failed.");
      }
      setMultimodalOutput(data.response);
    } catch (err: any) {
      console.error(err);
      setErrorString(err.message || String(err));
      if (err.message?.includes("Limit exceeded") || err.message?.includes("Quota")) {
        setShowQuotaWarning(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // 4. Submit Grounding Lookup
  const handleSendGrounding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groundingQuery.trim() || loading) return;

    setErrorString(null);
    setLoading(true);
    setGroundingOutput("");

    const endpoint = groundingMode === "search" ? "/api/ai/search-grounding" : "/api/ai/maps-grounding";

    if (isSimulationMode) {
      setTimeout(() => {
        if (groundingMode === "search") {
          setGroundingOutput(`[GOOGLE LIVE SEARCH GROUNDING - SIMULATED RESPONSE]
Query parameter: "${groundingQuery}"
Index node checked: live_knowledge_graph_v2026

RETRIEVED DATA AND METADATA BULLETINS:
- Verified latest 2026 releases: Development frameworks show beautiful, robust updates regarding Vite, TypeScript Native type stripping, and high strength layouts.
- Quota Rate Shielding: Shared environments benefit from custom Client-Side Simulated switches that preserve operational continuity when Google Free tier counts exceed limits.

SUMMARY OF RETRIEVED SOURCES:
- Source 1: Official Developers Portal — "Harnessing Gemini 3.5 live search grounding with high fidelity callbacks."
- Source 2: Technical Specs Hub — "Custom body parser expansion up to 50MB matches base64 graphic pipelines perfectly."`);
        } else {
          setGroundingOutput(`[GOOGLE MAPS GEOGRAPHIC GROUNDING - SIMULATED NAVIGATION]
Query location: "${groundingQuery}"
Coordinate output: Lat 37.4275° N, Lon 122.1697° W (Palo Alto, California region)

OPTIMIZED ROUTING ANALYSIS:
- Traffic Status: Light density on native express links.
- Selected Optimal Route: Stanford Avenue and El Camino Real detour corridors.
- Estimated Trip duration: ~18 minutes with real-time transit updates active.

SIGHTS AND PLACES MATCHED:
- Destination: Code Artisan Workspace Café (Rated 4.9 🌟)
- Features: Ergonomic standing-desk structures, persistent fiber uplinks, cozy aesthetic ambient lamps, and premium filter drippers.`);
        }
        setLoading(false);
      }, 800);
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: groundingQuery })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Server returned a non-JSON response: ${text.slice(0, 140)}... Confirm API Key credentials support grounding tools.`);
      }

      const data = await response.json();
      if (!response.ok || data.error) {
        if (response.status === 429 || data.isQuotaExceeded) {
          setShowQuotaWarning(true);
        }
        throw new Error(data.error || "Grounding request encountered an error.");
      }
      setGroundingOutput(data.response);
    } catch (err: any) {
      console.error(err);
      setErrorString(err.message || String(err));
      if (err.message?.includes("Limit exceeded") || err.message?.includes("Quota")) {
        setShowQuotaWarning(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // 5. Submit Imagery (Generation/Editing) Request
  const handleSendImagery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageryPrompt.trim() || loading) return;

    setErrorString(null);
    setLoading(true);
    setImageryOutputUrl(null);

    const isEditMode = imageryMode === "edit";
    const endpoint = isEditMode ? "/api/ai/image-edit-create" : "/api/ai/image-high-quality";

    if (isSimulationMode) {
      setTimeout(() => {
        // CURATED ABSTRACT HIGH-FIDELITY DESIGN ASSETS FROM UNSPLASH
        const designUrls = [
          "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1614064641938-3bbee52942c7?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=800"
        ];
        // Select matching index based on prompt string length to provide deterministic change on prompt variations
        const idx = imageryPrompt.length % designUrls.length;
        setImageryOutputUrl(designUrls[idx]);
        setLoading(false);
      }, 1200);
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: imageryPrompt,
          aspectRatio,
          imageSize,
          imageB64: isEditMode ? uploadedBase64 : undefined,
          mimeType: isEditMode ? uploadedMime : undefined
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Server returned a non-JSON response: ${text.slice(0, 140)}... Confirm API Key credentials support image generation.`);
      }

      const data = await response.json();
      if (!response.ok || data.error) {
        if (response.status === 429 || data.isQuotaExceeded) {
          setShowQuotaWarning(true);
        }
        throw new Error(data.error || "Imagery compiler failed.");
      }
      
      const imageUrl = `data:${data.mimeType};base64,${data.base64}`;
      setImageryOutputUrl(imageUrl);
    } catch (err: any) {
      console.error(err);
      setErrorString(err.message || String(err));
      if (err.message?.includes("Limit exceeded") || err.message?.includes("Quota")) {
        setShowQuotaWarning(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0D0D0E]" id="ai-laboratory-root">
      
      {/* Sub-Header Tabs Row */}
      <div className="bg-[#121215]/80 backdrop-blur-md border-b border-white/5 py-2 px-4 flex items-center justify-between overflow-x-auto gap-2 shrink-0 select-none">
        <div className="flex items-center space-x-1.5 md:space-x-3">
          <button
            onClick={() => setActiveSubTab("chatbot")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer border ${
              activeSubTab === "chatbot"
                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                : "text-white/40 hover:text-white border-transparent"
            }`}
          >
            <MessageSquare size={13} />
            <span>Multi-Turn Bot</span>
          </button>

          <button
            onClick={() => setActiveSubTab("thinking")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer border ${
              activeSubTab === "thinking"
                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                : "text-white/40 hover:text-white border-transparent"
            }`}
          >
            <Brain size={13} />
            <span>High Thinking</span>
          </button>

          <button
            onClick={() => setActiveSubTab("multimodal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer border ${
              activeSubTab === "multimodal"
                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                : "text-white/40 hover:text-white border-transparent"
            }`}
          >
            <Layers size={13} />
            <span>Image/Video Scope</span>
          </button>

          <button
            onClick={() => setActiveSubTab("grounding")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer border ${
              activeSubTab === "grounding"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "text-white/40 hover:text-white border-transparent"
            }`}
          >
            <Search size={13} />
            <span>Search & Maps</span>
          </button>

          <button
            onClick={() => setActiveSubTab("imagery")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer border ${
              activeSubTab === "imagery"
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "text-white/40 hover:text-white border-transparent"
            }`}
          >
            <ImageIcon size={13} />
            <span>Image Studio</span>
          </button>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {/* Manual Simulation Toggle */}
          <button 
            type="button"
            onClick={() => {
              setIsSimulationMode(!isSimulationMode);
              setErrorString(null);
            }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all cursor-pointer ${
              isSimulationMode 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold" 
                : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isSimulationMode ? "bg-emerald-500 animate-pulse" : "bg-white/30"}`} />
            <span>Simulation Mode: {isSimulationMode ? "ON" : "OFF"}</span>
          </button>

          <div className="hidden md:flex items-center space-x-1.5 bg-[#1b1b22] px-2.5 py-1 rounded-full border border-white/5 font-mono text-[10px] text-white/50 shrink-0">
            <ShieldCheck size={11} className="text-emerald-500" />
            <span>Operational Labs clearance</span>
          </div>
        </div>
      </div>

      {/* Main Sandbox Frame view */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-7xl mx-auto w-full flex flex-col space-y-6">

        {/* Dynamic Simulation/Quota Notice banner with clear user actions */}
        {showQuotaWarning && (
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-xs flex flex-col space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-indigo-400 font-mono">
                <Sparkles size={13} className="text-indigo-400 animate-pulse" /> Gemini API Free Tier Quota Exhausted
              </span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-mono">CODE: 429</span>
            </div>
            <p className="opacity-90 leading-relaxed text-indigo-200">
              The shared Google Free Tier rate-limits have been temporarily exhausted for this session.
              You can instantly bypass this by activating <strong className="text-white">Smart Sandbox Simulation Mode</strong>. This runs high-fidelity, contextual outputs client-side so you can test all Multi-turn Bot, High Thinking, Video Scope, Grounding, and Image Studio workspaces uninterrupted!
            </p>
            <div className="flex items-center space-x-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsSimulationMode(true);
                  setShowQuotaWarning(false);
                  setErrorString(null);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-[11px] transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm"
              >
                <Check size={12} />
                <span>Activate Simulation Protocol</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQuotaWarning(false)}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-lg font-semibold text-[11px] transition-all cursor-pointer font-mono"
              >
                Dismiss Warning
              </button>
            </div>
          </div>
        )}

        {/* Regular system error logger */}
        {errorString && !showQuotaWarning && (
          <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl text-amber-400 text-xs flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wide flex items-center gap-1">
                <Sliders size={12} /> Live API Status Alert:
              </span>
              <button 
                type="button"
                onClick={() => {
                  setIsSimulationMode(true);
                  setErrorString(null);
                }}
                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono cursor-pointer"
              >
                Run in Simulator instead
              </button>
            </div>
            <p className="opacity-90">{errorString}</p>
            <p className="text-[10px] text-white/40 font-mono">
              Pro tip: Open the "SSO Login not working" diagnostics in the login portal or verify keys inside Settings.
            </p>
          </div>
        )}

        {/* SUB TAB PANEL: CHATBOT CONTAINER */}
        {activeSubTab === "chatbot" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start">
            
            {/* Control Sidebar */}
            <div className="space-y-4 bg-[#111114] border border-white/5 rounded-xl p-4 lg:col-span-1">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white/90 font-mono mb-2 flex items-center gap-1.5">
                <Sliders size={14} className="text-indigo-400" />
                <span>Persona Configuration</span>
              </h3>
              
              {/* Persona presets selection */}
              <div className="space-y-2">
                <label className="text-[11px] text-white/40 uppercase font-mono block">Preset System Instructions</label>
                <div className="space-y-1.5">
                  {systemPresets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setSystemInstruction(preset.instr)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                        systemInstruction === preset.instr
                          ? "bg-indigo-500/10 border-indigo-500/30 text-white"
                          : "bg-white/1 border-transparent text-white/60 hover:bg-white/2 hover:text-white"
                      }`}
                    >
                      <span className="font-semibold block mb-0.5">{preset.name}</span>
                      <span className="text-[10px] text-white/40 line-clamp-2 leading-relaxed">{preset.instr}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* System Instruction Custom Text area */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/40 uppercase font-mono block">Custom Role Prompts</label>
                <textarea
                  value={systemInstruction}
                  onChange={(e) => setSystemInstruction(e.target.value)}
                  className="w-full text-xs p-3 bg-[#161619] border border-white/5 rounded-lg text-white focus:outline-none focus:border-indigo-500 resize-none h-24"
                  placeholder="Tell the chatbot how to react to incoming questions..."
                />
              </div>

              {/* Speed Model parameter override */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <label className="text-[11px] text-white/40 uppercase font-mono block">Speed & Core Model Mapping</label>
                <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-1 rounded-full border border-white/5">
                  <button
                    onClick={() => setChatModel("fast")}
                    className={`py-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold rounded-full select-none transition-all cursor-pointer ${
                      chatModel === "fast"
                        ? "bg-indigo-500 text-white"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    Lite Speed
                  </button>
                  <button
                    onClick={() => setChatModel("general")}
                    className={`py-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold rounded-full select-none transition-all cursor-pointer ${
                      chatModel === "general"
                        ? "bg-indigo-500 text-white"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    Balanced
                  </button>
                  <button
                    onClick={() => setChatModel("complex")}
                    className={`py-1.5 px-2 text-[10px] uppercase tracking-wider font-semibold rounded-full select-none transition-all cursor-pointer ${
                      chatModel === "complex"
                        ? "bg-indigo-500 text-white"
                        : "text-white/40 hover:text-white"
                    }`}
                  >
                    Complex
                  </button>
                </div>
                <p className="text-[10px] text-white/30 italic">
                  {chatModel === "fast" && "👉 Executes 'gemini-3.1-flash-lite' for instant sub-second query loops."}
                  {chatModel === "general" && "👉 Executes 'gemini-3.5-flash' for balanced customer support responses."}
                  {chatModel === "complex" && "👉 Executes 'gemini-2.5-flash' for heavy coding & technical audits."}
                </p>
              </div>
            </div>

            {/* Chat Thread Panel */}
            <div className="lg:col-span-2 border border-white/5 rounded-xl bg-[#111114] flex flex-col h-[520px] overflow-hidden">
              <div className="p-3 border-b border-white/5 bg-[#141418] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles size={14} className="text-indigo-400" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">Active Operational Sandbox Chat</span>
                </div>
                <button
                  onClick={() => setChatHistory([{
                    id: "init",
                    sender: "bot",
                    text: "Conversation cleared. Ready for your configured system instructions!",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    modelName: "gemini-3.ec-flash"
                  }])}
                  className="p-1 px-2 border border-white/5 bg-white/1 text-white/50 hover:text-white rounded text-[10px] font-mono transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={10} />
                  <span>Clear Conversation</span>
                </button>
              </div>

              {/* Message scroll list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {chatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-xl p-3.5 ${
                      msg.sender === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-[#16161A] text-white/80 border border-white/5"
                    }`}>
                      <div className="flex items-center justify-between gap-4 text-[9px] font-mono opacity-40 mb-1">
                        <span>{msg.sender === "user" ? "YOU OPERATOR" : `🤖 Agent Profile (${msg.modelName})`}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Form bar */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-white/5 bg-[#141418] flex gap-2">
                <input
                  type="text"
                  required
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  placeholder="Enquire something and trigger custom persona override..."
                  className="flex-1 bg-[#18181D] border border-white/5 hover:border-white/10 text-xs px-3.5 py-3 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={loading || !chatQuery.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 rounded-lg px-4 flex items-center justify-center transition-colors text-white cursor-pointer"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SUB TAB PANEL: HIGH THINKING (REASONING ENGINE) */}
        {activeSubTab === "thinking" && (
          <div className="space-y-4">
            <div className="p-5 border border-purple-500/10 rounded-xl bg-[#111114] space-y-2">
              <h3 className="text-base font-serif italic font-bold text-white flex items-center gap-2">
                <Brain className="text-purple-400 animate-pulse" size={18} />
                <span>Deep Reasoner & High Thinking Space</span>
              </h3>
              <p className="text-xs text-white/40 leading-relaxed max-w-3xl">
                By setting the premium <strong>gemini-2.5-flash</strong> core, 
                the model is empowered to analyze coding paradigms, security gaps, and mathematical puzzles. Note: we explicitly omit any maxOutputTokens parameter to guarantee reasoning completion!
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Controls prompt */}
              <form onSubmit={handleSendThinking} className="bg-[#111114] border border-white/5 p-5 rounded-xl space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40 font-mono uppercase block">System Target Query</label>
                  <textarea
                    value={thinkingPrompt}
                    onChange={(e) => setThinkingPrompt(e.target.value)}
                    required
                    rows={4}
                    className="w-full text-xs p-3.5 bg-[#151518] border border-white/5 rounded-lg text-white focus:outline-none focus:border-purple-500 placeholder-white/10"
                    placeholder="Enter mathematical complex coding issues, heavy algorithm optimization, or cyber risk scenarios to map out reasoning steps..."
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-purple-400 font-mono bg-purple-500/5 px-2 py-0.5 rounded border border-purple-500/10">
                    Model: gemini-2.5-flash
                  </span>
                  <button
                    type="submit"
                    disabled={loading || !thinkingPrompt.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 border border-purple-500/30 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-30"
                  >
                    {loading ? <RefreshCw className="animate-spin text-white" size={12} /> : <Zap size={11} />}
                    <span>Compile Deep Reasoning</span>
                  </button>
                </div>

                {/* Preset helpers */}
                <div className="space-y-1.5 pt-3 border-t border-white/5">
                  <span className="text-[10px] text-white/30 uppercase font-mono block">Preset Reasoning Challenges</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Write a highly optimal O(N) lookup algorithm to map overlapping IP subnets in Node.js",
                      "Analyze potential session fixation risks if OAuth redirect flows omit cryptographic state validation",
                      "Solve: Given a matrix of dimension N, design a parallel worker map-reduce process that avoids race locks"
                    ].map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setThinkingPrompt(p)}
                        className="text-[10px] leading-snug bg-white/2 hover:bg-white/5 border border-white/5 font-mono text-left p-2 rounded text-white/70 max-w-full hover:text-white"
                      >
                        {p.slice(0, 75)}...
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              {/* Output result */}
              <div className="bg-[#111114] border border-white/5 rounded-xl flex flex-col h-[400px] lg:h-[450px]">
                <div className="p-3 border-b border-white/5 bg-[#151518] flex items-center justify-between text-xs font-mono">
                  <p className="text-white font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu size={14} className="text-purple-400" />
                    <span>Calculated Inference Chain Output</span>
                  </p>
                  {loading && <span className="text-[10px] text-purple-400 animate-pulse">Computing reasoning blocks...</span>}
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 font-mono text-xs text-white/80 bg-black/40 leading-relaxed whitespace-pre-wrap select-text">
                  {thinkingOutput ? (
                    thinkingOutput
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center h-full text-white/20 select-none space-y-2">
                      <Brain size={32} strokeWidth={1} />
                      <span>Deep Reasoning output will be plotted here. Click compile to trigger!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB PANEL: MULTIMODAL CAPABILITIES */}
        {activeSubTab === "multimodal" && (
          <div className="space-y-4">
            <div className="p-5 border border-cyan-500/10 rounded-xl bg-[#111114] space-y-1">
              <h3 className="text-base font-serif italic font-bold text-white flex items-center gap-2">
                <Layers className="text-cyan-400" size={18} />
                <span>Multimodal Image & Video Intel Analyzer</span>
              </h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Empower your Operations workspace with deep frame-by-frame analysis using the robust <strong>gemini-2.5-flash</strong> model. 
                Upload JPEG/PNG images or MP4 recordings to describe contents, extract text, or audit interface diagrams instantly.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Media submit controls */}
              <form onSubmit={handleSendMultimodal} className="bg-[#111114] border border-white/5 p-5 rounded-xl space-y-4">
                
                {/* Media Type Toggle */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40 font-mono uppercase block">Select Asset Category</label>
                  <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-lg border border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setMultimodalType("image");
                        setUploadedBase64(null);
                        setUploadedFileName("");
                      }}
                      className={`py-1.5 rounded text-xs select-none font-semibold transition-all cursor-pointer ${
                        multimodalType === "image" ? "bg-cyan-950 text-cyan-400 border border-cyan-500/20" : "text-white/40 hover:text-white"
                      }`}
                    >
                      Multimodal Image
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMultimodalType("video");
                        setUploadedBase64(null);
                        setUploadedFileName("");
                      }}
                      className={`py-1.5 rounded text-xs select-none font-semibold transition-all cursor-pointer ${
                        multimodalType === "video" ? "bg-cyan-950 text-cyan-400 border border-cyan-500/20" : "text-white/40 hover:text-white"
                      }`}
                    >
                      Multimodal Video File
                    </button>
                  </div>
                </div>

                {/* Upload panel */}
                <div className="space-y-2">
                  <label className="text-[11px] text-white/40 font-mono uppercase block">Upload Asset</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/5 hover:border-cyan-500/20 rounded-xl p-8 text-center cursor-pointer bg-white/1 transition-all space-y-1"
                  >
                    <Upload className="mx-auto text-white/30" size={24} />
                    <p className="text-xs text-white/50">
                      {uploadedFileName ? (
                        <span className="text-cyan-400 font-semibold">{uploadedFileName}</span>
                      ) : (
                        <span>Drag & drop or Click to choose your file</span>
                      )}
                    </p>
                    <p className="text-[10px] text-white/30 font-mono">
                      {multimodalType === "image" ? "Supports PNG, JPEG, WEBP max 8MB" : "Supports MP4, quick sample frames max 15MB"}
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={multimodalType === "image" ? "image/*" : "video/*"}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* Question Prompt */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40 font-mono uppercase block">Analytical directives</label>
                  <input
                    type="text"
                    required
                    value={multimodalPrompt}
                    onChange={(e) => setMultimodalPrompt(e.target.value)}
                    className="w-full text-xs p-3.5 bg-[#151518] border border-white/5 rounded-lg text-white placeholder-white/20 focus:outline-none focus:border-cyan-500"
                    placeholder={
                      multimodalType === "image"
                        ? "Describe layout anomalies, scan data tables, or troubleshoot screenshots..."
                        : "Describe the timeline sequence, extract highlighted alerts, or decode motion..."
                    }
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !uploadedBase64}
                  className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/30 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-30"
                >
                  {loading ? <RefreshCw className="animate-spin text-white" size={13} /> : <Eye size={13} />}
                  <span>Analyze Uploaded Multimodal Frame</span>
                </button>
              </form>

              {/* Multimodal Output pane */}
              <div className="bg-[#111114] border border-white/5 rounded-xl flex flex-col h-[400px] lg:h-[465px]">
                <div className="p-3 border-b border-white/5 bg-[#151518] flex items-center justify-between text-xs font-mono">
                  <p className="text-white font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu size={14} className="text-cyan-400" />
                    <span>Diagnostic Extraction Intelligence Output</span>
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 text-xs text-white/80 bg-black/40 leading-relaxed whitespace-pre-wrap select-text">
                  {multimodalOutput ? (
                    multimodalOutput
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center h-full text-white/20 select-none space-y-2">
                      <Layers size={32} strokeWidth={1} />
                      <span>Multimodal analyzer output will render here. Choose a file and direct the agent to compile!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB PANEL: SEARCH & MAPS GROUNDING */}
        {activeSubTab === "grounding" && (
          <div className="space-y-4">
            <div className="p-5 border border-amber-500/10 rounded-xl bg-[#111114] space-y-1">
              <h3 className="text-base font-serif italic font-bold text-white flex items-center gap-2">
                <Search className="text-amber-400" size={18} />
                <span>Google Search & Maps Grounding Hub</span>
              </h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Connect your Gemini requests directly with live, real-time index databases. Toggle between <strong>Google Search Grounding</strong> for immediate news and technical event validation, or <strong>Google Maps Grounding</strong> for rich geographic coordinates and business locator services. Both modes query via the core <strong>gemini-3.5-flash</strong> integration.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Grounding entry form */}
              <form onSubmit={handleSendGrounding} className="bg-[#111114] border border-white/5 p-5 rounded-xl space-y-4">
                
                {/* Method selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40 font-mono uppercase block">Active Grounding Service</label>
                  <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-lg border border-white/5">
                    <button
                      type="button"
                      onClick={() => setGroundingMode("search")}
                      className={`py-1.5 rounded text-xs select-none font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                        groundingMode === "search" ? "bg-amber-950 text-amber-400 border border-amber-500/20" : "text-white/40 hover:text-white"
                      }`}
                    >
                      <Search size={12} />
                      <span>Google Search (Live)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroundingMode("maps")}
                      className={`py-1.5 rounded text-xs select-none font-semibold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                        groundingMode === "maps" ? "bg-amber-950 text-amber-400 border border-amber-500/20" : "text-white/40 hover:text-white"
                      }`}
                    >
                      <MapPin size={12} />
                      <span>Google Maps Integration</span>
                    </button>
                  </div>
                </div>

                {/* Grounding input prompt */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40 font-mono uppercase block">Real-time index query</label>
                  <textarea
                    value={groundingQuery}
                    onChange={(e) => setGroundingQuery(e.target.value)}
                    required
                    rows={3}
                    className="w-full text-xs p-3.5 bg-[#151518] border border-white/5 rounded-lg text-white focus:outline-none focus:border-amber-500 placeholder-white/20"
                    placeholder={
                      groundingMode === "search"
                        ? "Verify what developer updates were merged for Tailwind CSS v4 in late 2025 or query recent Tech events..."
                        : "Describe operational route travel from San Francisco Downtown to Palo Alto Stanford campus, listing key intersections..."
                    }
                  />
                </div>

                {/* Grounding Submit */}
                <button
                  type="submit"
                  disabled={loading || !groundingQuery.trim()}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-500 border border-amber-500/30 text-[#0D0D0E] rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-30"
                >
                  {loading ? <RefreshCw className="animate-spin text-black" size={13} /> : <Search size={13} />}
                  <span>Ground and Execute Request</span>
                </button>

                {/* Suggestions */}
                <div className="space-y-1 pt-2 border-t border-white/5">
                  <span className="text-[9px] text-white/30 uppercase font-mono block">Recommended queries</span>
                  <div className="flex flex-col space-y-1">
                    {[
                      { text: "Latest tech releases regarding Gemini 3.5 capabilities in June 2026", target: "search" },
                      { text: "Find nearest top rated workspace cafes in Cupertino, California containing power outlets", target: "maps" }
                    ].map((rec, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setGroundingMode(rec.target as any);
                          setGroundingQuery(rec.text);
                        }}
                        className="text-[10px] text-white/50 text-left p-1.5 hover:bg-white/5 rounded hover:text-white flex items-center gap-1.5 font-mono"
                      >
                        <ChevronRight size={10} />
                        <span className="truncate">{rec.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>

              {/* Grounded Output Screen */}
              <div className="bg-[#111114] border border-white/5 rounded-xl flex flex-col h-[400px]">
                <div className="p-3 border-b border-white/5 bg-[#151518] flex items-center justify-between text-xs font-mono">
                  <p className="text-white font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu size={14} className="text-amber-400" />
                    <span>Validated Grounding Verification Results</span>
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 text-xs text-white/80 bg-black/40 leading-relaxed whitespace-pre-wrap select-text">
                  {groundingOutput ? (
                    groundingOutput
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center h-full text-white/20 select-none space-y-2">
                      <Search size={32} strokeWidth={1} />
                      <span>Validated lookup results will print here. Run grounding queries to trigger real-time index checks!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB PANEL: IMAGERY WORKSPACE (CREATE & EDIT IMAGES COMPLETE) */}
        {activeSubTab === "imagery" && (
          <div className="space-y-4">
            <div className="p-5 border border-rose-500/10 rounded-xl bg-[#111114] space-y-1">
              <h3 className="text-base font-serif italic font-bold text-white flex items-center gap-2">
                <ImageIcon className="text-rose-400" size={18} />
                <span>Generative Imagery & Spatial Canvas Studio</span>
              </h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Render and edit graphics in real-time. Use <strong>High-Quality Imagen 3 Pro</strong> (via <strong>gemini-3-pro-image-preview</strong>) to generate custom assets with configurable aspect ratio and size metrics (1K, 2K, 4K). Switch to <strong>Dynamic Imagery Canvas</strong> (using <strong>gemini-3.1-flash-image</strong>) to run text-guided adjustments on uploaded photos!
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* Creation Controllers */}
              <form onSubmit={handleSendImagery} className="bg-[#111114] border border-white/5 p-5 rounded-xl space-y-4">
                
                {/* Method selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40 font-mono uppercase block">Active Studio Process</label>
                  <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-lg border border-white/5">
                    <button
                      type="button"
                      onClick={() => setImageryMode("imagen")}
                      className={`py-1.5 rounded text-xs select-none font-semibold transition-all cursor-pointer ${
                        imageryMode === "imagen" ? "bg-rose-950 text-rose-400 border border-rose-500/20" : "text-white/40 hover:text-white"
                      }`}
                    >
                      High-Quality Imagen 3 Pro
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageryMode("edit")}
                      className={`py-1.5 rounded text-xs select-none font-semibold transition-all cursor-pointer ${
                        imageryMode === "edit" ? "bg-rose-950 text-rose-400 border border-rose-500/20" : "text-white/40 hover:text-white"
                      }`}
                    >
                      Image Creation & Smart Edit
                    </button>
                  </div>
                </div>

                {/* If Edit mode selected, show optional image upload */}
                {imageryMode === "edit" && (
                  <div className="space-y-2 border-l border-rose-500/20 pl-3">
                    <label className="text-[11px] text-white/40 font-mono uppercase block">Base Image for text-guided editing</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-white/5 hover:border-rose-500/20 rounded-xl p-4 text-center cursor-pointer bg-white/1 transition-all"
                    >
                      {uploadedFileName ? (
                        <span className="text-rose-400 text-xs font-semibold block truncate">{uploadedFileName}</span>
                      ) : (
                        <span className="text-white/40 text-xs">📸 Click custom photo to run guided replacements</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Imagen parameter controls */}
                {imageryMode === "imagen" && (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Aspect Ratio */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-white/40 font-mono uppercase block">Aspect Ratio</label>
                      <select
                        value={aspectRatio}
                        onChange={(e: any) => setAspectRatio(e.target.value)}
                        className="w-full text-xs p-2.5 bg-[#151518] border border-white/5 rounded-lg text-white font-mono focus:outline-none focus:border-rose-500"
                      >
                        <option value="1:1">Square (1:1)</option>
                        <option value="4:3">Standard Desktop (4:3)</option>
                        <option value="16:9">Widescreen (16:9)</option>
                        <option value="3:4">Vertical (3:4)</option>
                        <option value="9:16">Mobile Story (9:16)</option>
                      </select>
                    </div>

                    {/* Image Size Selection (1K, 2K, 4K) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-white/40 font-mono uppercase block">Resolution Dimension</label>
                      <select
                        value={imageSize}
                        onChange={(e: any) => setImageSize(e.target.value)}
                        className="w-full text-xs p-2.5 bg-[#151518] border border-white/5 rounded-lg text-white font-mono focus:outline-none focus:border-rose-500"
                      >
                        <option value="1K">Standard 1K (1024x1024)</option>
                        <option value="2K">Ultra 2K (2048x2048)</option>
                        <option value="4K">Extreme Cinematic 4K</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Prompt entry */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40 font-mono uppercase block">Visual compilation prompt</label>
                  <textarea
                    value={imageryPrompt}
                    onChange={(e) => setImageryPrompt(e.target.value)}
                    required
                    rows={3}
                    className="w-full text-xs p-3.5 bg-[#151518] border border-white/5 rounded-lg text-white focus:outline-none focus:border-rose-500"
                    placeholder={
                      imageryMode === "imagen"
                        ? "A photorealistic cyberpunk operations mainframe deck with floating glowing holographic terminal charts, volumetric lighting, unreal engine 5 render, cinematic..."
                        : "Modify the uploaded photo, replace background with a clean corporate minimal twilight studio workspace, volumetric details..."
                    }
                  />
                </div>

                {/* Generate Action Button */}
                <button
                  type="submit"
                  disabled={loading || !imageryPrompt.trim()}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 border border-rose-500/30 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-30"
                >
                  {loading ? <RefreshCw className="animate-spin text-white" size={13} /> : <Zap size={13} />}
                  <span>Compile and Render Graphics</span>
                </button>
              </form>

              {/* Render display pane */}
              <div className="bg-[#111114] border border-white/5 rounded-xl overflow-hidden flex flex-col h-[400px] lg:h-[465px]">
                <div className="p-3 border-b border-white/5 bg-[#151518] flex items-center justify-between text-xs font-mono">
                  <p className="text-white font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu size={14} className="text-rose-400" />
                    <span>Compiled Graphics View</span>
                  </p>
                </div>
                <div className="flex-1 bg-black/40 flex items-center justify-center p-4 relative">
                  {imageryOutputUrl ? (
                    <img 
                      src={imageryOutputUrl} 
                      alt="Generative Canvas output" 
                      className="max-h-full max-w-full object-contain rounded shadow-lg border border-white/5 transition-all duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center text-white/20 select-none space-y-2">
                      <ImageIcon size={36} strokeWidth={1} />
                      <span className="text-xs">No active rendering. Click render graphics to draw assets!</span>
                    </div>
                  )}

                  {loading && (
                    <div className="absolute inset-0 bg-[#0D0D0E]/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
                      <RefreshCw className="animate-spin text-rose-400" size={32} />
                      <p className="text-xs font-mono text-white/70">Rendering spatial canvas graphics...</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
