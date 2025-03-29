import React, { createContext, useContext, useState, useReducer, useEffect } from 'react';
import { User, AppState, Match, Call, Report } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

// Create a context with an undefined initial value
interface AppContextType {
  state: AppState;
  setAuthUser: (user: any, session: any, profile?: any) => void;
  logout: () => void;
  startSearchingMatch: () => void;
  stopSearchingMatch: () => void;
  acceptMatch: (matchId: string) => void;
  rejectMatch: (matchId: string) => void;
  startCall: (type: 'voice' | 'video') => void;
  endCall: () => void;
  makeDecision: (decision: 'continue' | 'end') => void;
  reportUser: (reportedUserId: string, reason: string) => void;
}

// Initial state
const initialState: AppState = {
  currentUser: undefined,
  currentMatch: undefined,
  currentCall: undefined,
  isSearchingMatch: false,
  callTimeRemaining: 0,
  callStage: 'none',
};

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Custom hook to use the app context
export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

// Provider component
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Setup realtime subscription for matches and calls when user is logged in
  useEffect(() => {
    if (!state.currentUser) return;

    // Use supabase realtime features here for matches and calls
    const matchesChannel = supabase
      .channel('public:matches')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `user_id=eq.${state.currentUser.id}`,
      }, (payload) => {
        console.log('Match change received:', payload);
        // Handle match changes
        if (payload.eventType === 'INSERT') {
          // New match notification
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
    };
  }, [state.currentUser]);

  // Handle call timer
  useEffect(() => {
    if (state.callStage === 'voice' || state.callStage === 'video') {
      if (timerInterval) clearInterval(timerInterval);

      const interval = setInterval(() => {
        setState(prev => {
          const newTimeRemaining = prev.callTimeRemaining - 1;
          
          // If time is up, end the call
          if (newTimeRemaining <= 0) {
            clearInterval(interval);
            return {
              ...prev,
              callTimeRemaining: 0,
              callStage: 'decision'
            };
          }
          
          return {
            ...prev,
            callTimeRemaining: newTimeRemaining
          };
        });
      }, 1000);
      
      setTimerInterval(interval);
      
      return () => clearInterval(interval);
    } else if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  }, [state.callStage]);

  // Set auth user from Supabase
  const setAuthUser = async (user: any, session: any, profile?: any) => {
    let userProfile: User;

    if (!profile) {
      // If profile not provided, fetch it from database
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (error) throw error;
        profile = data;
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    }
    
    // Create a user object from auth and profile data
    userProfile = {
      id: user.id,
      name: profile?.name || user.user_metadata?.name || 'New User',
      age: profile?.age || 25,
      gender: (profile?.gender as 'male' | 'female' | 'other') || 'other',
      preferredGender: (profile?.preferred_gender as 'male' | 'female' | 'both' | 'all') || 'all',
      location: profile?.location || 'Israel',
      relationshipGoal: (profile?.relationship_goal as 'serious' | 'casual' | 'friendship') || 'casual',
      premium: profile?.premium || false,
      profilePicture: profile?.profile_picture || '/placeholder.svg',
      bio: profile?.bio || undefined,
    };
    
    setState({
      ...initialState,
      currentUser: userProfile
    });
  };

  // Logout user
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setState(initialState);
      
      toast({
        title: "התנתקת בהצלחה",
        description: "להתראות!",
      });
    } catch (error: any) {
      toast({
        title: "שגיאה בהתנתקות",
        description: error.message,
        variant: "destructive",
      });
      console.error('Logout error:', error);
    }
  };

  // Start searching for a match
  const startSearchingMatch = () => {
    setState(prev => ({
      ...prev,
      isSearchingMatch: true
    }));
    
    // In a real app, we would connect to a backend service to find matches
    // For demo purposes, simulate finding a match after a delay
    setTimeout(() => {
      if (state.isSearchingMatch) {
        const mockMatch = {
          id: Math.random().toString(36).substring(7),
          userId: state.currentUser?.id || "",
          matchedUserId: "random-user-id",
          status: "pending" as const, // Using 'as const' to satisfy TypeScript
          createdAt: new Date(),
        };
        
        setState(prev => ({
          ...prev,
          currentMatch: mockMatch
        }));
      }
    }, 10000); // 10 seconds
  };

  // Stop searching for a match
  const stopSearchingMatch = () => {
    setState(prev => ({
      ...prev,
      isSearchingMatch: false
    }));
  };

  // Accept a match
  const acceptMatch = (matchId: string) => {
    // In a real app, we would update the match status in the database
    
    setState(prev => {
      if (prev.currentMatch?.id === matchId) {
        return {
          ...prev,
          currentMatch: {
            ...prev.currentMatch,
            status: "accepted" as const
          },
          isSearchingMatch: false,
          callStage: 'preparing',
          callTimeRemaining: 5 // 5 seconds preparation time
        };
      }
      return prev;
    });
    
    // Start call after preparation time
    setTimeout(() => {
      startCall('voice');
    }, 5000);
  };

  // Reject a match
  const rejectMatch = (matchId: string) => {
    // In a real app, we would update the match status in the database
    
    setState(prev => {
      if (prev.currentMatch?.id === matchId) {
        return {
          ...prev,
          currentMatch: undefined,
          isSearchingMatch: false
        };
      }
      return prev;
    });
  };

  // Start a call
  const startCall = (type: 'voice' | 'video') => {
    const callDuration = type === 'voice' ? 60 : 120; // 1 min for voice, 2 min for video
    
    const newCall: Call = {
      id: Math.random().toString(36).substring(7),
      matchId: state.currentMatch?.id || '',
      type: type,
      status: 'active',
      startTime: new Date(),
      duration: callDuration,
    };
    
    setState(prev => ({
      ...prev,
      currentCall: newCall,
      callStage: type,
      callTimeRemaining: callDuration
    }));
    
    toast({
      title: `${type === 'voice' ? 'שיחה קולית' : 'שיחת וידאו'} התחילה`,
      description: `השיחה תסתיים אוטומטית בעוד ${callDuration} שניות`,
    });
  };

  // End a call
  const endCall = () => {
    setState(prev => ({
      ...prev,
      currentCall: {
        ...prev.currentCall!,
        status: 'completed',
        endTime: new Date()
      } as Call,
      callStage: 'decision'
    }));
    
    toast({
      title: "השיחה הסתיימה",
      description: "האם תרצה להמשיך את ההתאמה?",
    });
  };

  // Make a decision after a call
  const makeDecision = (decision: 'continue' | 'end') => {
    if (decision === 'continue') {
      // If it was a voice call, move to video
      if (state.currentCall?.type === 'voice') {
        startCall('video');
        
        toast({
          title: "החלטתם להמשיך!",
          description: "מעבר לשיחת וידאו...",
        });
      } 
      // If it was a video call, exchange contact info
      else {
        setState(prev => ({
          ...prev,
          currentCall: undefined,
          callStage: 'none',
          // Keep the match for future reference
        }));
        
        toast({
          title: "התאמה מוצלחת!",
          description: "עכשיו תוכל לשלוח הודעות לאדם זה",
        });
      }
    } else {
      // End the match
      setState(prev => ({
        ...prev,
        currentMatch: undefined,
        currentCall: undefined,
        callStage: 'none'
      }));
      
      toast({
        title: "התאמה הסתיימה",
        description: "אתה יכול להמשיך לחפש התאמות חדשות",
      });
    }
  };

  // Report a user
  const reportUser = (reportedUserId: string, reason: string) => {
    // In a real app, we would submit this report to the database
    
    const newReport: Report = {
      id: Math.random().toString(36).substring(7),
      reporterId: state.currentUser?.id || "",
      reportedUserId: reportedUserId,
      callId: state.currentCall?.id || "",
      reason: reason,
      status: 'pending',
      createdAt: new Date()
    };
    
    console.log('User reported:', newReport);
    
    toast({
      title: "דיווח נשלח",
      description: "תודה על הדיווח. צוות המנהלים שלנו יבדוק את הבעיה.",
    });
  };

  return (
    <AppContext.Provider
      value={{
        state,
        setAuthUser,
        logout,
        startSearchingMatch,
        stopSearchingMatch,
        acceptMatch,
        rejectMatch,
        startCall,
        endCall,
        makeDecision,
        reportUser
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
