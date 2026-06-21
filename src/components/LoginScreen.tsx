import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, googleProvider, microsoftProvider } from "../firebase";
import { motion, AnimatePresence } from "motion/react";
import { Bot, Mail, Lock, User, AlertCircle, ArrowRight, Check, X, ShieldCheck, Key, RefreshCw, ArrowLeft, Send, HelpCircle } from "lucide-react";

interface LoginScreenProps {
  onSuccess?: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // States to support Forgot Password and OTP validation requests
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [showOtpHint, setShowOtpHint] = useState(true);
  const [showSsoHelp, setShowSsoHelp] = useState(false);

  // Validation functions
  const validatePassword = (pass: string) => {
    return {
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      alphanumeric: /[a-zA-Z]/.test(pass) && /[0-9]/.test(pass),
      symbol: /[^A-Za-z0-9]/.test(pass)
    };
  };

  const validateUsername = (username: string) => {
    return {
      length: username.length >= 8,
      uppercase: /[A-Z]/.test(username),
      lowercase: /[a-z]/.test(username),
      alphanumeric: /[a-zA-Z]/.test(username) && /[0-9]/.test(username),
      underscore: /_/.test(username),
      noOtherSymbols: !/[^A-Za-z0-9_]/.test(username) && username.length > 0
    };
  };

  const passStatus = validatePassword(password);
  const nameStatus = validateUsername(name);

  const isPasswordValid = Object.values(passStatus).every(Boolean);
  const isUsernameValid = Object.values(nameStatus).every(Boolean);

  const formatAuthError = (errCode: string) => {
    switch (errCode) {
      case "auth/invalid-email":
        return "Invalid email address format.";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/user-not-found":
        return "No account exists with this email address.";
      case "auth/wrong-password":
        return "Incorrect password. Please try again.";
      case "auth/email-already-in-use":
        return "An account with this email address already exists.";
      case "auth/weak-password":
        return "Password should be at least 6 characters long.";
      case "auth/popup-closed-by-user":
        return "SSO sign-in popup was closed before completion.";
      case "auth/operation-not-allowed":
        return "Email/Password sign-in is currently disabled in your Firebase Settings. To use credentials: 1) Go to your Firebase Console -> Authentication -> Sign-in method. 2) Enable the 'Email/Password' provider. Alternatively, please use 'Sign in with Google' which is supported by default.";
      case "auth/unauthorized-domain":
        return `Firebase: Unauthorized Domain. The current address "${window.location.hostname}" is not listed in your Firebase project. Please navigate to Firebase Console -> Authentication -> Settings -> Authorized domains, and whitelist this address to enable SSO logins!`;
      case "auth/network-request-failed":
        return "Network reference lost. Please check your internet connection.";
      default:
        return "An authentication issue occurred. Please check your credentials.";
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!name.trim()) {
      setError("Display Name (Username) is required for creating an account.");
      return;
    }
    
    // Enforce validations robustly on submit
    if (!isUsernameValid) {
      setError("User Name does not meet the secure operations clearance constraints.");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet the specified security strength constraints.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed secure OTP transmission.");
      }

      if (data.sandboxMode) {
        setGeneratedOtp(data.generatedOtp || "");
        setShowOtpHint(true);
      } else {
        setGeneratedOtp("");
        setShowOtpHint(false);
      }
      setOtpInput("");
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to trigger security code dispatch.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    setLoading(true);
    try {
      // 1. Verify OTP with our secondary cloud/API service
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otpInput.trim() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "OTP Security verification failed.");
      }

      // 2. Finalize creation with Firebase Authentication
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, {
        displayName: name.trim()
      });
      onSuccess?.();
    } catch (err: any) {
      console.error("Auth error during credentials creation:", err);
      const errMsg = err.code ? formatAuthError(err.code) : err.message;
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setForgotPasswordSuccess(false);

    if (!email.trim()) {
      setError("Please provide a valid email address first.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setForgotPasswordSuccess(true);
    } catch (err: any) {
      console.error("Forgot password issue:", err);
      const errMsg = err.code ? formatAuthError(err.code) : err.message;
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    try {
      if (isSignUp) {
        // Enforce validations robustly
        if (!name.trim()) {
          throw new Error("Display Name (Username) is required.");
        }
        if (!isUsernameValid) {
          throw new Error("User Name does not meet secure operations clearance constraints.");
        }
        if (!isPasswordValid) {
          throw new Error("Password does not meet specified security strength constraints.");
        }
        
        setLoading(true);
        const response = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Failed secure OTP transmission.");
        }

        if (data.sandboxMode) {
          setGeneratedOtp(data.generatedOtp || "");
          setShowOtpHint(true);
        } else {
          setGeneratedOtp("");
          setShowOtpHint(false);
        }
        setOtpInput("");
        setOtpSent(true);
      } else {
        setLoading(true);
        await signInWithEmailAndPassword(auth, email, password);
        onSuccess?.();
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const errMsg = err.code ? formatAuthError(err.code) : err.message;
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess?.();
    } catch (err: any) {
      console.error("Google Auth error:", err);
      const errMsg = err.code ? formatAuthError(err.code) : err.message;
      setError(`Google SSO: ${errMsg}`);
      setShowSsoHelp(true);
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, microsoftProvider);
      onSuccess?.();
    } catch (err: any) {
      console.error("Microsoft Auth error:", err);
      const errMsg = err.code ? formatAuthError(err.code) : err.message;
      setError(`Microsoft SSO: ${errMsg}`);
      setShowSsoHelp(true);
    } finally {
      setLoading(false);
    }
  };

  if (otpSent) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0D0D0E] text-[#E0E0E0] select-none p-4 relative overflow-hidden font-sans">
        
        {/* Background graphic halo glows */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md bg-[#131316] border border-white/5 rounded-2xl p-8 shadow-2xl relative z-10"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/10 mb-4">
              <ShieldCheck size={26} className="text-white" />
            </div>
            <h1 className="text-2xl font-serif font-bold italic tracking-wide text-white">
              Security Verification
            </h1>
            <p className="text-xs text-white/40 mt-1.5 max-w-xs mx-auto">
              A 6-digit security OTP code was dispatched to <span className="text-indigo-400 font-semibold">{email}</span>.
            </p>
          </div>

          {/* Prompt/Banner for easy review debugging */}
          {showOtpHint && (
            <motion.div
              layout
              className="mb-5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3.5 relative overflow-hidden"
            >
              <button 
                type="button"
                onClick={() => setShowOtpHint(false)} 
                className="absolute top-2 right-2 text-white/30 hover:text-white transition-colors cursor-pointer"
                title="Hide instructions"
              >
                <X size={13} />
              </button>
              <div className="flex items-start space-x-2.5">
                <Key size={14} className="text-indigo-400 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 font-mono">Mail Server Sandbox Console</p>
                  <p className="text-xs text-white/70 leading-relaxed">
                    To make testing completely seamless and fully operational without configuring SMTP secrets:
                  </p>
                  <div className="bg-black/30 rounded px-2.5 py-1.5 border border-indigo-500/20 inline-block mt-1">
                    <span className="text-xs text-white/50">Your Security OTP:</span>{" "}
                    <span className="text-sm font-mono font-bold text-amber-300 tracking-wider select-all">{generatedOtp}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error notification banner */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start space-x-2 w-full text-xs text-red-400"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleVerifyOtpAndSignUp} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/30 font-bold mb-1.5 font-mono">
                Enter 6-Digit OTP Code
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="000 000"
                  className="w-full bg-[#16161A] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-lg font-mono text-center tracking-[0.5em] text-white placeholder-white/10 outline-none focus:border-indigo-500/80 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/40 text-white font-medium rounded-lg text-sm transition-all focus:outline-none flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-indigo-500/10"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>Verify Code & Create Account</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setError(null);
              }}
              className="text-white/40 hover:text-white transition-colors p-1 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back / Edit Info</span>
            </button>

            <button
              type="button"
              onClick={handleSendOtp}
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors p-1 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Resend OTP Code</span>
            </button>
          </div>

        </motion.div>
      </div>
    );
  }

  if (isForgotPassword) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0D0D0E] text-[#E0E0E0] select-none p-4 relative overflow-hidden font-sans">
        
        {/* Background graphic halo glows */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md bg-[#131316] border border-white/5 rounded-2xl p-8 shadow-2xl relative z-10"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#16161A] border border-white/5 shadow-md mb-4 text-indigo-400">
              <Key size={24} className="animate-pulse" />
            </div>
            <h1 className="text-2xl font-serif font-bold italic tracking-wide text-white">
              Recover Operations Password
            </h1>
            <p className="text-xs text-white/40 mt-1.5 max-w-xs mx-auto">
              Provide your authorized email below to reset your secure administrator login password.
            </p>
          </div>

          {/* Success Banner */}
          <AnimatePresence mode="wait">
            {forgotPasswordSuccess ? (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-400 space-y-1"
              >
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider font-mono text-[10px] text-emerald-300">
                  <Check size={14} />
                  <span>Success link dispatched</span>
                </div>
                <p className="text-white/70 leading-relaxed">
                  We have successfully transmitted a password recovery invitation link to <span className="text-white font-semibold">{email}</span>. Please check your email inbox to choose a secure new password.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Error notification banner */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start space-x-2 w-full text-xs text-red-400"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/30 font-bold mb-1 font-mono">
                Your Email Address
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full bg-[#16161A] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/80 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/40 text-white font-medium rounded-lg text-sm transition-all focus:outline-none flex items-center justify-center space-x-2 cursor-pointer shadow-md"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <span>Send Reset Request Link</span>
                  <Send size={13} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-xs">
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setForgotPasswordSuccess(false);
                setError(null);
              }}
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors focus:outline-none bg-transparent border-none p-0 cursor-pointer"
            >
              Return to Login Screen
            </button>
          </div>

        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0D0D0E] text-[#E0E0E0] select-none p-4 relative overflow-hidden font-sans">
      
      {/* Background graphic halo glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md bg-[#131316] border border-white/5 rounded-2xl p-8 shadow-2xl relative z-10"
      >
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/10 mb-4">
            <Bot size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-serif font-bold italic tracking-wide text-white">
            SmartAssist Portal
          </h1>
          <p className="text-xs text-white/40 mt-1 max-w-xs mx-auto">
            Access secure FAQ match directories and premium generative AI support modules
          </p>
        </div>

        {/* Error notification banner */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start space-x-2 w-full text-xs text-red-400 col-span-2"
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main login/signup form */}
        <form onSubmit={isSignUp ? handleSendOtp : handleSubmit} className="space-y-4">
          <AnimatePresence mode="popLayout">
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                key="name-field"
              >
                <label className="block text-[10px] uppercase tracking-wider text-white/30 font-bold mb-1 font-mono">
                  Display name (Username)
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    required={isSignUp}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g. Admin_User1"
                    className="w-full bg-[#16161A] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/80 transition-colors"
                  />
                </div>

                {/* Real-time Username Requirements list */}
                <div className="mt-2 bg-[#16161A]/50 border border-white/5 rounded-lg p-3 space-y-1.5">
                  <p className="text-[9px] uppercase font-bold text-white/30 tracking-wider font-mono">Username Requirements</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                    <div className="flex items-center space-x-1.5">
                      {nameStatus.length ? (
                        <Check size={10} className="text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                      )}
                      <span className={nameStatus.length ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>8+ Chars</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {nameStatus.uppercase ? (
                        <Check size={10} className="text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                      )}
                      <span className={nameStatus.uppercase ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>1+ Uppercase</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {nameStatus.lowercase ? (
                        <Check size={10} className="text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                      )}
                      <span className={nameStatus.lowercase ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>1+ Lowercase</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {nameStatus.alphanumeric ? (
                        <Check size={10} className="text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                      )}
                      <span className={nameStatus.alphanumeric ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>Alphanumeric</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {nameStatus.underscore ? (
                        <Check size={10} className="text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                      )}
                      <span className={nameStatus.underscore ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>1+ Underscore (_)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {nameStatus.noOtherSymbols ? (
                        <Check size={10} className="text-emerald-500 shrink-0" />
                      ) : (
                        <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                      )}
                      <span className={nameStatus.noOtherSymbols ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>No other symbols</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/30 font-bold mb-1 font-mono">
              Email Address
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full bg-[#16161A] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/80 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/30 font-bold mb-1 font-mono">
              Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#16161A] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/80 transition-colors"
              />
            </div>

            {/* Forgot password link for Sign In view */}
            {!isSignUp && (
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError(null);
                  }}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer outline-none font-medium bg-transparent border-none p-0"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Real-time Password Requirements list */}
            {isSignUp && (
              <div className="mt-2 bg-[#16161A]/50 border border-white/5 rounded-lg p-3 space-y-1.5">
                <p className="text-[9px] uppercase font-bold text-white/30 tracking-wider font-mono">Password Requirements</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <div className="flex items-center space-x-1.5">
                    {passStatus.length ? (
                      <Check size={10} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                    )}
                    <span className={passStatus.length ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>8+ Chars</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {passStatus.uppercase ? (
                      <Check size={10} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                    )}
                    <span className={passStatus.uppercase ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>1+ Uppercase</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {passStatus.lowercase ? (
                      <Check size={10} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                    )}
                    <span className={passStatus.lowercase ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>1+ Lowercase</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {passStatus.alphanumeric ? (
                      <Check size={10} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                    )}
                    <span className={passStatus.alphanumeric ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>Alphanumeric</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    {passStatus.symbol ? (
                      <Check size={10} className="text-emerald-500 shrink-0" />
                    ) : (
                      <div className="w-1 h-1 rounded-full bg-white/20 shrink-0" />
                    )}
                    <span className={passStatus.symbol ? "text-emerald-400/80 font-mono" : "text-white/40 font-mono"}>1+ Symbol</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-indigo-500 hover:bg-indigo-400 disabled:bg-indigo-500/40 text-white font-medium rounded-lg text-sm transition-all focus:outline-none flex items-center justify-center space-x-2 cursor-pointer shadow-md"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/25 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <span>{isSignUp ? "Verify Email with OTP" : "Enter Dashboard"}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Auth providers (SSO) */}
        <div className="mt-6">
          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute w-full border-t border-white/5"></div>
            <span className="relative bg-[#131316] px-3 text-[10px] uppercase tracking-wider text-white/30 font-mono">
              Or Authenticate with
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Google Signup Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-xs font-semibold text-white/80 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Google</span>
            </button>

            {/* Microsoft SSO Button */}
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-xs font-semibold text-white/80 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 23 23">
                <rect x="0" y="0" width="10.5" height="10.5" fill="#f25022" />
                <rect x="11.5" y="0" width="10.5" height="10.5" fill="#7fba00" />
                <rect x="0" y="11.5" width="10.5" height="10.5" fill="#00a4ef" />
                <rect x="11.5" y="11.5" width="10.5" height="10.5" fill="#ffb900" />
              </svg>
              <span>Microsoft</span>
            </button>
          </div>

          {/* Troubleshooter action button */}
          <div className="mt-3.5 text-center">
            <button
              type="button"
              onClick={() => setShowSsoHelp(!showSsoHelp)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold transition-colors bg-transparent border-none p-1 cursor-pointer inline-flex items-center gap-1"
            >
              <HelpCircle size={12} />
              <span>{showSsoHelp ? "Hide Auth Troubleshooter" : "SSO Login not working? Quick Fix"}</span>
            </button>
          </div>

          <AnimatePresence>
            {showSsoHelp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 overflow-hidden text-left"
              >
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 font-mono mb-2 flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-indigo-400" />
                  <span>Interactive SSO Diagnostics</span>
                </h4>
                
                <div className="space-y-3.5 text-xs text-white/70 leading-relaxed">
                  <div className="space-y-1">
                    <p className="font-semibold text-white">1. Iframe Sandbox Limitation (Most Common!)</p>
                    <p className="text-white/50 text-[11px]">
                      Chrome and Safari block third-party storage & cookies in sandboxed preview frames. 
                      <span className="text-indigo-300 font-medium block mt-1">
                        👉 Solved by clicking the "Open in new tab" icon at the top right of this preview panel to run the app directly!
                      </span>
                    </p>
                  </div>

                  <div className="space-y-1 border-t border-white/5 pt-2">
                    <p className="font-semibold text-white">2. Enable Providers in Firebase Console</p>
                    <p className="text-white/50 text-[11px]">
                      Ensure Google/Microsoft signing is officially set to <span className="text-emerald-400">Enabled</span> in your Firebase Dashboard.
                      <a 
                        href="https://console.firebase.google.com/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-indigo-400 font-medium ml-1 underline hover:text-indigo-300"
                      >
                        Open Firebase Console
                      </a>
                    </p>
                  </div>

                  <div className="space-y-1 border-t border-white/5 pt-2">
                    <p className="font-semibold text-white">3. Authorized Domain Whitelisting</p>
                    <p className="text-white/50 text-[11px]">
                      Your current URL hostname must be added under <strong>Authorized domains</strong> in Firebase Authentication settings:
                    </p>
                    <div className="bg-black/40 rounded p-2 font-mono text-[10px] text-amber-300 break-all select-all mt-1 border border-white/5 flex items-center justify-between gap-1">
                      <span className="select-all">{window.location.hostname}</span>
                      <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded shrink-0 uppercase tracking-wider">Copy Address</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Toggle link */}
        <div className="mt-8 text-center text-xs text-white/40">
          <span>{isSignUp ? "Already have operations clearance?" : "Need support clearance?"}</span>{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors focus:outline-none bg-transparent border-none p-0 cursor-pointer"
          >
            {isSignUp ? "Sign In instead" : "Create Account"}
          </button>
        </div>

      </motion.div>
    </div>
  );
}
