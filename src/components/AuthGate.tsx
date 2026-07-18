import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { getFormulaSettings, subscribeSuppliers } from "../db/supabase";
import { Supplier } from "../types";
import { Flame, Mail, Lock, LogIn, AlertCircle, KeyRound, Weight, User as UserIcon, CheckCircle } from "lucide-react";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  isSupplier: boolean;
  isOwner: boolean;
  supplierId: string | null;
  isDbLive: boolean;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  enterAsGuest: () => void;
  enterAsSupplier: (id?: string) => void;
  enterAsOwner: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [isSupplier, setIsSupplier] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setIsGuest(false);
        setIsSupplier(false);
        setIsOwner(false);
      } else {
        const savedGuest = localStorage.getItem("tikka_auth_guest") === "true";
        const savedSupplier = localStorage.getItem("tikka_auth_supplier") === "true";
        const savedOwner = localStorage.getItem("tikka_auth_owner") === "true";
        const savedSupplierId = localStorage.getItem("tikka_auth_supplier_id");
        if (savedOwner) {
          setIsOwner(true);
          setIsGuest(false);
          setIsSupplier(false);
        } else if (savedGuest) {
          setIsGuest(true);
          setIsSupplier(false);
          setIsOwner(false);
        } else if (savedSupplier) {
          setIsSupplier(true);
          setIsGuest(false);
          setIsOwner(false);
          if (savedSupplierId) setSupplierId(savedSupplierId);
        }
      }
      setLoading(false);
    }).catch((err) => {
      console.warn("Auth session check failed (Supabase may not be configured):", err);
      const savedGuest = localStorage.getItem("tikka_auth_guest") === "true";
      const savedOwner = localStorage.getItem("tikka_auth_owner") === "true";
      if (savedOwner) {
        setIsOwner(true);
      } else if (savedGuest) {
        setIsGuest(true);
      }
      setLoading(false);
    });

    let subscription: any = { unsubscribe: () => {} };
    try {
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setUser(session.user);
          setIsGuest(false);
          setIsSupplier(false);
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      if (sub) subscription = sub;
    } catch (err) {
      console.warn("Auth state listener failed:", err);
    }

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
  };

  const registerWithEmail = async (name: string, email: string, pass: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: {
          full_name: name,
        }
      }
    });
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const logout = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      setIsGuest(false);
      setIsSupplier(false);
      setIsOwner(false);
      setSupplierId(null);
      setUser(null);
      
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout Process Interrupted:", err);
    } finally {
      window.location.href = "/?logout=" + Date.now();
    }
  };

  const enterAsGuest = () => {
    setIsGuest(true);
    setIsOwner(false);
    setIsSupplier(false);
    localStorage.setItem("tikka_auth_guest", "true");
    setUser(null);
  };

  const enterAsOwner = () => {
    setIsOwner(true);
    setIsGuest(false);
    setIsSupplier(false);
    localStorage.setItem("tikka_auth_owner", "true");
    setUser(null);
  };

  const enterAsSupplier = (id?: string) => {
    setIsSupplier(true);
    setIsGuest(false);
    setIsOwner(false);
    localStorage.setItem("tikka_auth_supplier", "true");
    if (id) {
      setSupplierId(id);
      localStorage.setItem("tikka_auth_supplier_id", id);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isGuest,
      isSupplier,
      isOwner,
      supplierId,
      isDbLive: !!supabase,
      signInWithGoogle,
      loginWithEmail,
      registerWithEmail,
      resetPassword,
      logout,
      enterAsGuest,
      enterAsSupplier,
      enterAsOwner
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, isGuest, isSupplier, isOwner, loginWithEmail, registerWithEmail, resetPassword, enterAsSupplier, enterAsOwner } = useAuth();
  
  const [tab, setTab] = useState<"login" | "signup" | "forgot" | "supplier">(() => {
    return (localStorage.getItem("tikka_auth_pref_tab") as any) || "login";
  });

  useEffect(() => {
    if (tab === "login" || tab === "supplier") {
      localStorage.setItem("tikka_auth_pref_tab", tab);
    }
  }, [tab]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [supplierPin, setSupplierPin] = useState("");
  const [supplierUsernameInput, setSupplierUsernameInput] = useState("");
  const [supplierPasswordInput, setSupplierPasswordInput] = useState("");
  const [dbSettings, setDbSettings] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    getFormulaSettings().then((res) => {
      setDbSettings(res);
    }).catch((err) => {
      console.warn("Could not load formula settings in AuthGate", err);
    });

    const unsubscribe = subscribeSuppliers((data) => {
      setSuppliers(data);
    });
    return () => unsubscribe();
  }, [user, isGuest, isSupplier]);
  
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-ink font-sans">
        <div className="flex flex-col items-center gap-6">
          <div className="p-4 bg-accent/5 text-accent rounded border border-accent/20 animate-pulse">
            <Flame className="w-8 h-8 fill-accent/10" />
          </div>
          <div className="space-y-2 text-center">
            <h2 className="font-display text-xl uppercase tracking-widest text-ink/40">
              Akbar Tikka
            </h2>
            <div className="flex items-center justify-center gap-2">
              <span className="w-1 h-1 rounded-full bg-accent animate-ping" />
              <span className="font-mono text-[10px] text-ink/20 font-bold uppercase tracking-widest">Initializing...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If user is authenticated or logged in as guest or supplier, let them access the app
  if (user || isGuest || isSupplier || isOwner) {
    return <>{children}</>;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please enter email and password.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");

    // Owner bypass
    const OWNER_EMAIL = "k.m.d.unreal@gmail.com";
    const OWNER_PASSWORD = "111222";
    if (email.trim().toLowerCase() === OWNER_EMAIL && password === OWNER_PASSWORD) {
      setSuccessMsg("Owner access granted. Loading Dashboard...");
      setTimeout(() => { enterAsOwner(); }, 800);
      setSubmitting(false);
      return;
    }

    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setErrorMsg("Invalid Email or Password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
        setErrorMsg("The email address is not valid.");
      } else {
        setErrorMsg(err.message || "Login failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setErrorMsg("Please fill out all fields.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password kam se kam 6 characters ka hona chahiye.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      await registerWithEmail(name, email, password);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setErrorMsg("This email is already registered.");
      } else {
        setErrorMsg(err.message || "Registration failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter your email.");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await resetPassword(email);
      setSuccessMsg("Password reset link has been sent! Check your inbox. ✨");
      setTimeout(() => setTab("login"), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while sending the reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 font-sans text-ink relative overflow-hidden">
      
      {/* Background Decorative glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -ml-64 -mb-64 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-surface border border-ink-faint rounded shadow-2xl p-8 relative z-10 space-y-8">
        
        {/* Brand Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex p-4 bg-accent/5 text-accent rounded border border-accent/20">
            <Flame className="w-10 h-10 fill-accent/10" />
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-3xl uppercase tracking-tighter text-ink flex items-center justify-center gap-2">
              Akbar Tikka
            </h1>
            <p className="font-mono text-[10px] opacity-30 uppercase tracking-[0.2em]">Management System Portal</p>
          </div>
        </div>

        {/* Success/Error Alerts */}
        {errorMsg && (
          <div className="bg-accent/5 border border-accent/30 text-accent p-4 rounded text-xs flex items-start gap-3 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-mono font-bold uppercase tracking-wider">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-custom/5 border border-emerald-custom/30 text-emerald-custom p-4 rounded text-xs flex items-start gap-3">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-mono font-bold uppercase tracking-wider">{successMsg}</p>
          </div>
        )}

        {/* Tab Buttons (Hide on forgot or supplier mode) */}
        {tab !== "forgot" && tab !== "supplier" && (
          <div className="grid grid-cols-2 p-1 bg-bg border border-ink-faint rounded">
            <button
              type="button"
              onClick={() => { setTab("login"); setErrorMsg(""); }}
              className={`py-2 px-3 rounded font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${
                tab === "login"
                  ? "bg-accent text-bg"
                  : "opacity-30 hover:opacity-60"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab("signup"); setErrorMsg(""); }}
              className={`py-2 px-3 rounded font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${
                tab === "signup"
                  ? "bg-accent text-bg"
                  : "opacity-30 hover:opacity-60"
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Forms Container */}
        {tab === "login" && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg border border-ink-faint focus:border-accent rounded pl-10 pr-3 py-3 font-mono text-xs outline-none transition-colors"
                    placeholder="ENTER_EMAIL"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setTab("forgot"); setErrorMsg(""); }}
                    className="font-mono text-[9px] font-bold text-accent hover:underline uppercase tracking-widest"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-bg border border-ink-faint focus:border-accent rounded pl-10 pr-3 py-3 font-mono text-xs outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-accent text-bg py-4 rounded font-mono font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? "Processing..." : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In to Dashboard
                </>
              )}
            </button>
          </form>
        )}

        {tab === "signup" && (
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">
                  Full Name / Shop Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-bg border border-ink-faint focus:border-accent rounded pl-10 pr-3 py-3 font-mono text-xs outline-none transition-colors"
                    placeholder="ENTER_NAME"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg border border-ink-faint focus:border-accent rounded pl-10 pr-3 py-3 font-mono text-xs outline-none transition-colors"
                    placeholder="ENTER_EMAIL"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">
                  Create Password (Min 6 chars)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-bg border border-ink-faint focus:border-accent rounded pl-10 pr-3 py-3 font-mono text-xs outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-accent text-bg py-4 rounded font-mono font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? "Processing..." : (
                <>
                  <KeyRound className="w-4 h-4" />
                  Create Free Account
                </>
              )}
            </button>
          </form>
        )}

        {tab === "forgot" && (
          <form onSubmit={handleForgot} className="space-y-6">
            <div className="space-y-2 text-center">
              <h3 className="font-display text-lg uppercase tracking-widest">Recovery</h3>
              <p className="font-mono text-[10px] opacity-30 uppercase tracking-widest">Request a reset link to your registered email address.</p>
            </div>
            <div className="space-y-2">
              <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-bg border border-ink-faint focus:border-accent rounded pl-10 pr-3 py-3 font-mono text-xs outline-none transition-colors"
                  placeholder="ENTER_EMAIL"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => { setTab("login"); setErrorMsg(""); setSuccessMsg(""); }}
                className="flex-1 border border-ink-faint text-ink/40 py-3 rounded font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-bg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-accent text-bg py-3 rounded font-mono font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-colors"
              >
                Send Link
              </button>
            </div>
          </form>
        )}

        {/* Supplier Passcode PIN Form */}
        {tab === "supplier" && (
          <form onSubmit={(e) => {
            e.preventDefault();
            const isEnabled = dbSettings?.supplierAccessEnabled !== false;
            if (!isEnabled) {
              setErrorMsg("Supplier portal access has been disabled.");
              return;
            }

            const expectedUsername = (dbSettings?.supplierUsername || "zeeshan").trim().toLowerCase();
            const expectedPassword = (dbSettings?.supplierPassword || "786").trim();
            
            const enteredUsername = supplierUsernameInput.trim().toLowerCase();
            const enteredPassword = supplierPasswordInput.trim();

            const matchedSupplier = suppliers.find(
              s => s.username?.toLowerCase() === enteredUsername && s.password === enteredPassword
            );

            if (matchedSupplier) {
              setSuccessMsg("Success! Access approved. Loading Portal...");
              setErrorMsg("");
              setTimeout(() => {
                enterAsSupplier(matchedSupplier.id);
              }, 1000);
            } else if (enteredUsername === expectedUsername && enteredPassword === expectedPassword) {
              setSuccessMsg("Success! Access approved. Loading Portal...");
              setErrorMsg("");
              setTimeout(() => {
                enterAsSupplier();
              }, 1000);
            } else {
              setErrorMsg("Invalid ID or Password entered.");
            }
          }} className="space-y-6">
            <div className="space-y-2 text-center">
              <h3 className="font-display text-lg text-accent uppercase tracking-widest flex items-center justify-center gap-2">
                <Weight className="w-5 h-5 text-accent animate-pulse" />
                Supplier Access
              </h3>
              <p className="font-mono text-[10px] opacity-30 uppercase tracking-widest">Enter credentials to proceed</p>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">
                  Supplier ID / Username
                </label>
                <input
                  type="text"
                  required
                  value={supplierUsernameInput}
                  onChange={(e) => setSupplierUsernameInput(e.target.value)}
                  className="w-full bg-bg border border-ink-faint focus:border-accent rounded px-4 py-3 font-mono text-xs outline-none transition-colors"
                  placeholder="ENTER_ID"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-mono text-[8px] font-bold opacity-30 uppercase tracking-widest">
                  Access Password
                </label>
                <input
                  type="password"
                  required
                  value={supplierPasswordInput}
                  onChange={(e) => setSupplierPasswordInput(e.target.value)}
                  className="w-full bg-bg border border-ink-faint focus:border-accent rounded px-4 py-3 font-mono text-xs outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>

              <div className="font-mono text-[8px] text-center opacity-20 uppercase tracking-widest leading-relaxed">
                Tip: Default login is Username: zeeshan / Pass: 786. This can be changed in the Settings tab.
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => { setTab("login"); setErrorMsg(""); setSuccessMsg(""); setSupplierUsernameInput(""); setSupplierPasswordInput(""); }}
                className="flex-1 border border-ink-faint text-ink/40 py-3 rounded font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-bg transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 bg-accent text-bg py-3 rounded font-mono font-bold text-[10px] uppercase tracking-widest hover:brightness-110 transition-colors"
              >
                Enter Portal
              </button>
            </div>
          </form>
        )}

        {/* Supplier Portal Access */}
        {tab !== "supplier" && tab !== "forgot" && (
          <div className="space-y-4 pt-4 border-t border-ink-faint text-center">
            <div className="bg-bg/50 p-4 rounded border border-ink-faint">
              <span className="font-mono text-[8px] opacity-30 block mb-3 font-bold uppercase tracking-widest">
                Are you a supplier?
              </span>
              <button
                type="button"
                onClick={() => { setTab("supplier"); setErrorMsg(""); setSuccessMsg(""); setSupplierUsernameInput(""); setSupplierPasswordInput(""); }}
                className="w-full bg-accent/5 text-accent border border-accent/20 py-3 rounded font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-accent/10 transition-all flex items-center justify-center gap-2"
              >
                <Weight className="w-3.5 h-3.5" />
                Supplier Portal Access
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
