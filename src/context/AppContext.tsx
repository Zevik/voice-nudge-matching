import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, User, Match, Call } from '@/types';
import { useToast } from "@/components/ui/use-toast";

// Default user for testing
const defaultUser: User = {
  id: "1",
  name: "Guest User",
  age: 28,
  gender: "other",
  preferredGender: "all",
  location: "Tel Aviv",
  relationshipGoal: "casual",
  premium: false,
  profilePicture: "/placeholder.svg"
};

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

  // For demo purposes, auto-login the user
  useEffect(() => {
    // In a real app, we would check local storage or cookies for a stored session
    // For now, we'll just auto-login with the default user after a short delay
    const timer = setTimeout(() => {
      if (!state.currentUser) {
        setState(prev => ({ ...prev, currentUser: defaultUser }));
      }
    }, 1000);

    return () => clearTimeout(timer);
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

  const login = (user: User) => {
    setState(prev => ({ ...prev, currentUser: user }));
  };

  const logout = () => {
    setState(initialState);
  };

  const startSearchingMatch = () => {
    setState(prev => ({ ...prev, isSearchingMatch: true }));
    toast({
      title: "Searching for matches...",
      description: "We'll notify you when we find someone available.",
    });
  };

  const stopSearchingMatch = () => {
    setState(prev => ({ ...prev, isSearchingMatch: false }));
    toast({
      title: "Search stopped",
      description: "You've stopped looking for matches.",
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
        title: "Match declined",
        description: "You've declined this match. Looking for a new one...",
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
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} call started`,
        description: `You have ${Math.floor(duration / 60)} minutes to chat.`,
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
      title: "Call ended",
      description: "The call has ended.",
    });
  };

  const makeDecision = (decision: 'continue' | 'end') => {
    if (decision === 'continue') {
      if (state.callStage === 'decision' && state.currentCall?.type === 'voice') {
        // If we were in a voice call, offer a video call next
        startCall(state.currentMatch?.id || "", 'video', 5 * 60); // 5 minutes for video call
        toast({
          title: "Great!",
          description: "Moving to video call now.",
        });
      } else {
        // Otherwise, just end the current session with a positive outcome
        toast({
          title: "Match successful!",
          description: "You both want to continue! In a real app, you would exchange contact info now.",
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
        title: "Match ended",
        description: "You've decided to end this match.",
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
      title: "User reported",
      description: "Thank you for your report. We'll review it and take action.",
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
