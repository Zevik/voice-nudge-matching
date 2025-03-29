import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, User, Match, Call } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';

// Default state
const initialState: AppState = {
  currentUser: undefined,
  currentMatch: undefined,
  currentCall: undefined,
  isSearchingMatch: false,
  callTimeRemaining: 0,
  callStage: 'none',
};

interface AppContextType {
  state: AppState;
  setAuthUser: (supabaseUser: SupabaseUser, session: Session | null, profile?: any) => void;
  login: (user: User) => void;
  logout: () => void;
  startSearchingMatch: () => void;
  stopSearchingMatch: () => void;
  acceptMatch: (matchId: string) => void;
  rejectMatch: (matchId: string) => void;
  startCall: (matchId: string, type: 'voice' | 'video', duration: number) => void;
  endCall: () => void;
  makeDecision: (decision: 'continue' | 'end') => void;
  reportUser: (reportedUserId: string, reason: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  const { toast } = useToast();

  // Check for existing session on load
  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        setAuthUser(session.user, session, profileData);
      }
    };

    fetchSession();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setState(initialState);
        } else if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          // Fetch the user profile when auth state changes to signed in
          setTimeout(async () => {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            setAuthUser(session.user, session, profileData);
          }, 0);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Timer for calls
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (state.callTimeRemaining > 0 && (state.callStage === 'voice' || state.callStage === 'video')) {
      interval = setInterval(() => {
        setState(prev => {
          const newTimeRemaining = prev.callTimeRemaining - 1;
          
          // If time has run out, move to decision stage
          if (newTimeRemaining <= 0) {
            clearInterval(interval);
            return {
              ...prev,
              callTimeRemaining: 0,
              callStage: 'decision',
            };
          }
          
          return {
            ...prev,
            callTimeRemaining: newTimeRemaining,
          };
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.callTimeRemaining, state.callStage]);

  // Mock function to simulate finding a match
  useEffect(() => {
    if (state.isSearchingMatch && !state.currentMatch) {
      const findMatchTimeout = setTimeout(() => {
        const mockMatch: Match = {
          id: Math.random().toString(36).substring(7),
          userId: state.currentUser?.id || "",
          matchedUserId: "2", // mock ID for the matched user
          status: 'pending',
          createdAt: new Date(),
        };
        
        setState(prev => ({
          ...prev,
          currentMatch: mockMatch,
          isSearchingMatch: false,
        }));
        
        toast({
          title: "Match Found!",
          description: "Someone is available to chat. Get ready!",
        });
      }, 3000); // Simulate a 3 second search

      return () => clearTimeout(findMatchTimeout);
    }
  }, [state.isSearchingMatch, state.currentMatch, state.currentUser?.id, toast]);

  const setAuthUser = (supabaseUser: SupabaseUser, session: Session | null, profile?: any) => {
    const userProfile: User = {
      id: supabaseUser.id,
      name: profile?.name || supabaseUser.user_metadata?.name || "משתמש חדש",
      age: profile?.age || supabaseUser.user_metadata?.age || 25,
      gender: profile?.gender || supabaseUser.user_metadata?.gender || 'other',
      preferredGender: profile?.preferred_gender || 'all',
      location: profile?.location || "ישראל",
      relationshipGoal: profile?.relationship_goal || 'casual',
      premium: profile?.premium || false,
      profilePicture: profile?.profile_picture || "/placeholder.svg",
      bio: profile?.bio,
    };

    setState(prev => ({ ...prev, currentUser: userProfile }));
  };

  const login = (user: User) => {
    setState(prev => ({ ...prev, currentUser: user }));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setState(initialState);
    toast({
      title: "התנתקת בהצלחה",
      description: "להתראות!",
    });
  };

  const startSearchingMatch = () => {
    setState(prev => ({ ...prev, isSearchingMatch: true }));
    toast({
      title: "מחפש התאמות...",
      description: "נודיע לך כשנמצא מישהו זמין.",
    });
  };

  const stopSearchingMatch = () => {
    setState(prev => ({ ...prev, isSearchingMatch: false }));
    toast({
      title: "החיפוש הופסק",
      description: "הפסקת לחפש התאמות.",
    });
  };

  const acceptMatch = (matchId: string) => {
    if (state.currentMatch?.id === matchId) {
      setState(prev => ({
        ...prev,
        currentMatch: { ...prev.currentMatch!, status: 'accepted' },
      }));
      
      // Auto-start voice call after accepting match
      startCall(matchId, 'voice', 3 * 60); // 3 minutes for voice call
    }
  };

  const rejectMatch = (matchId: string) => {
    if (state.currentMatch?.id === matchId) {
      setState(prev => ({
        ...prev,
        currentMatch: undefined,
      }));
      toast({
        title: "התאמה נדחתה",
        description: "דחית את ההתאמה הזו. מחפש חדשה...",
      });
      // Auto-start searching for a new match
      startSearchingMatch();
    }
  };

  const startCall = (matchId: string, type: 'voice' | 'video', duration: number) => {
    const call: Call = {
      id: Math.random().toString(36).substring(7),
      matchId,
      type,
      status: 'active',
      startTime: new Date(),
      duration: duration,
    };
    
    setState(prev => ({
      ...prev,
      currentCall: call,
      callTimeRemaining: duration,
      callStage: type === 'voice' ? 'voice' : 'video',
    }));
    
    // Show a quick preparation screen before starting the call
    setTimeout(() => {
      toast({
        title: `${type === 'voice' ? 'שיחה קולית' : 'שיחת וידאו'} התחילה`,
        description: `יש לך ${Math.floor(duration / 60)} דקות לשוחח.`,
      });
    }, 2000);
  };

  const endCall = () => {
    setState(prev => ({
      ...prev,
      currentCall: prev.currentCall ? { ...prev.currentCall, status: 'completed', endTime: new Date() } : undefined,
      callStage: 'none',
      callTimeRemaining: 0,
    }));
    
    toast({
      title: "השיחה הסתיימה",
      description: "השיחה הסתיימה.",
    });
  };

  const makeDecision = (decision: 'continue' | 'end') => {
    if (decision === 'continue') {
      if (state.callStage === 'decision' && state.currentCall?.type === 'voice') {
        // If we were in a voice call, offer a video call next
        startCall(state.currentMatch?.id || "", 'video', 5 * 60); // 5 minutes for video call
        toast({
          title: "מעולה!",
          description: "עוברים לשיחת וידאו.",
        });
      } else {
        // Otherwise, just end the current session with a positive outcome
        toast({
          title: "התאמה מוצלחת!",
          description: "שניכם רוצים להמשיך! באפליקציה אמיתית, הייתם מחליפים פרטי קשר כעת.",
        });
        setState(prev => ({
          ...prev,
          currentCall: undefined,
          currentMatch: undefined,
          callStage: 'none',
        }));
      }
    } else {
      // End the match
      toast({
        title: "התאמה הסתיימה",
        description: "החלטת לסיים את ההתאמה הזו.",
      });
      setState(prev => ({
        ...prev,
        currentCall: undefined,
        currentMatch: undefined,
        callStage: 'none',
      }));
      
      // Auto-start searching for a new match
      startSearchingMatch();
    }
  };

  const reportUser = (reportedUserId: string, reason: string) => {
    toast({
      title: "דיווח על משתמש",
      description: "תודה על הדיווח. נבדוק את זה ונפעל בהתאם.",
      variant: "destructive",
    });
    
    // In a real app, we would make an API call to report the user
    // For now, just end the current match and call
    setState(prev => ({
      ...prev,
      currentCall: undefined,
      currentMatch: undefined,
      callStage: 'none',
    }));
  };

  const contextValue: AppContextType = {
    state,
    setAuthUser,
    login,
    logout,
    startSearchingMatch,
    stopSearchingMatch,
    acceptMatch,
    rejectMatch,
    startCall,
    endCall,
    makeDecision,
    reportUser,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
