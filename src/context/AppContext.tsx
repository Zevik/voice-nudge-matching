import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AppState, Match, Call, Report, DbMatch, DbReport } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import webRTCService from '@/services/WebRTCService';

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
  likeUser: (userId: string) => Promise<void>;
  getLikedStatus: (userId: string) => Promise<boolean>;
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

  // Check for existing session on load
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setAuthUser(session.user, session, profile);
      }
    };
    
    checkSession();
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          setAuthUser(session.user, session, profile);
        } else if (event === 'SIGNED_OUT') {
          setState(initialState);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Setup realtime subscription for matches when user is logged in
  useEffect(() => {
    if (!state.currentUser) return;

    // Use supabase realtime features for matches
    const matchesChannel = supabase
      .channel('user-matches')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `user_id=eq.${state.currentUser.id}`,
      }, (payload) => {
        console.log('Match change received:', payload);
        
        // Handle new match
        if (payload.eventType === 'INSERT') {
          const matchData = payload.new as DbMatch;
          
          // Check if it's a mutual match (both users liked each other)
          if (matchData.status === 'mutual') {
            const newMatch: Match = {
              id: matchData.id,
              userId: matchData.user_id,
              matchedUserId: matchData.matched_user_id,
              status: 'pending',
              createdAt: new Date(matchData.created_at),
            };
            
            setState(prev => ({
              ...prev,
              currentMatch: newMatch,
              isSearchingMatch: false
            }));
            
            toast({
              title: "התאמה חדשה!",
              description: "מישהו סימן לך לייק בחזרה, מתאים לך להתחיל שיחה?",
            });
          }
        }
        
        // Handle match updates
        if (payload.eventType === 'UPDATE') {
          const matchData = payload.new as DbMatch;
          
          if (state.currentMatch && state.currentMatch.id === matchData.id) {
            setState(prev => ({
              ...prev,
              currentMatch: {
                ...prev.currentMatch!,
                status: matchData.status as 'pending' | 'accepted' | 'rejected' | 'completed'
              } as Match
            }));
            
            // If match was accepted, prepare for call
            if (matchData.status === 'accepted') {
              setState(prev => ({
                ...prev,
                callStage: 'preparing',
                callTimeRemaining: 5 // 5 seconds preparation time
              }));
              
              // Start call after preparation time
              setTimeout(() => {
                startCall('voice');
              }, 5000);
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
    };
  }, [state.currentUser]);

  // Setup realtime subscription for incoming matches
  useEffect(() => {
    if (!state.currentUser) return;

    // Subscribe to matches where this user is the matched_user_id
    const incomingMatchesChannel = supabase
      .channel('incoming-matches')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `matched_user_id=eq.${state.currentUser.id}`,
      }, (payload) => {
        console.log('Incoming match received:', payload);
        
        // Handle new incoming match - only mutual matches will show notification
        if (payload.eventType === 'INSERT') {
          const matchData = payload.new as DbMatch;
          
          if (matchData.status === 'mutual') {
            const newMatch: Match = {
              id: matchData.id,
              userId: matchData.user_id,
              matchedUserId: matchData.matched_user_id,
              status: 'pending',
              createdAt: new Date(matchData.created_at),
            };
            
            setState(prev => ({
              ...prev,
              currentMatch: newMatch,
              isSearchingMatch: false
            }));
            
            toast({
              title: "התאמה הדדית!",
              description: "מישהו סימן לך לייק והתאמתם. רוצה להתחיל שיחה?",
            });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(incomingMatchesChannel);
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
  };

  // Stop searching for a match
  const stopSearchingMatch = () => {
    setState(prev => ({
      ...prev,
      isSearchingMatch: false
    }));
  };

  // Accept a match
  const acceptMatch = async (matchId: string) => {
    if (!state.currentMatch && !matchId.includes('-')) {
      // If we have a database match ID
      try {
        const { error } = await supabase
          .from('matches')
          .update({ status: 'accepted' })
          .eq('id', matchId);
          
        if (error) throw error;
        
        // The state will be updated by the realtime subscription
      } catch (error) {
        console.error('Error accepting match:', error);
        toast({
          title: "שגיאה בקבלת התאמה",
          description: "נסה שוב מאוחר יותר",
          variant: "destructive",
        });
      }
    } else {
      // For now, handle the composite ID case (like user1-user2)
      setState(prev => {
        if (prev.currentMatch?.id === matchId || matchId.includes('-')) {
          return {
            ...prev,
            currentMatch: {
              ...prev.currentMatch!,
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
    }
  };

  // Reject a match
  const rejectMatch = async (matchId: string) => {
    if (state.currentMatch && !matchId.includes('-')) {
      // If we have a database match ID
      try {
        const { error } = await supabase
          .from('matches')
          .update({ status: 'rejected' })
          .eq('id', matchId);
          
        if (error) throw error;
      } catch (error) {
        console.error('Error rejecting match:', error);
      }
    }
    
    setState(prev => {
      if (prev.currentMatch?.id === matchId || matchId.includes('-')) {
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
    if (!state.currentMatch || !state.currentUser) return;
    
    const callDuration = type === 'voice' ? 60 : 120; // 1 min for voice, 2 min for video
    
    // Create a call ID
    const callId = `call-${state.currentUser.id}-${state.currentMatch.matchedUserId}-${Date.now()}`;
    
    const newCall: Call = {
      id: callId,
      matchId: state.currentMatch.id,
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
    
    // In a real implementation, we would initiate the WebRTC call here
    // using the WebRTCService to connect with the matched user
    
    toast({
      title: `${type === 'voice' ? 'שיחה קולית' : 'שיחת וידאו'} התחילה`,
      description: `השיחה תסתיים אוטומטית בעוד ${callDuration} שניות`,
    });
  };

  // End a call
  const endCall = () => {
    // In a real implementation, we would use WebRTCService to end the call
    
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
        // In a real implementation, we might update the match status in the database
        // to indicate that contact info can be exchanged
        
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
      if (state.currentMatch) {
        // Update match status in database
        supabase
          .from('matches')
          .update({ status: 'completed' })
          .eq('id', state.currentMatch.id)
          .then(({ error }) => {
            if (error) console.error('Error updating match status:', error);
          });
      }
      
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
  const reportUser = async (reportedUserId: string, reason: string) => {
    if (!state.currentUser) return;
    
    try {
      // Insert report into database
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: state.currentUser.id,
          reported_user_id: reportedUserId,
          call_id: state.currentCall?.id || null,
          reason: reason,
          status: 'pending'
        });
        
      if (error) throw error;
      
      toast({
        title: "דיווח נשלח",
        description: "תודה על הדיווח. צוות המנהלים שלנו יבדוק את הבעיה.",
      });
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: "שגיאה בשליחת דיווח",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  };

  // Like a user - new function
  const likeUser = async (likedUserId: string) => {
    if (!state.currentUser) return;
    
    try {
      // Check if there's already a match from the other user to this user
      const { data: existingMatches, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('user_id', likedUserId)
        .eq('matched_user_id', state.currentUser.id)
        .single();
      
      if (matchError && matchError.code !== 'PGRST116') {
        // Real error, not just "no rows returned"
        throw matchError;
      }
      
      // Check if we already liked this user
      const { data: alreadyLiked, error: likedError } = await supabase
        .from('matches')
        .select('*')
        .eq('user_id', state.currentUser.id)
        .eq('matched_user_id', likedUserId)
        .single();
        
      if (!likedError && alreadyLiked) {
        // We already liked this user, no need to create a new record
        toast({
          title: "כבר סימנת לייק",
          description: "כבר סימנת לייק למשתמש זה",
        });
        return;
      }
      
      let matchStatus = 'liked';
      
      // If the other user already liked us, this is a mutual match!
      if (existingMatches) {
        matchStatus = 'mutual';
        
        // Update the existing match to mutual
        await supabase
          .from('matches')
          .update({ status: 'mutual' })
          .eq('id', existingMatches.id);
      }
      
      // Create a new match record
      const { error } = await supabase
        .from('matches')
        .insert({
          user_id: state.currentUser.id,
          matched_user_id: likedUserId,
          status: matchStatus
        });
        
      if (error) throw error;
      
      if (matchStatus === 'mutual') {
        toast({
          title: "התאמה הדדית!",
          description: "גם הצד השני סימן לך לייק, תוכלו להתחיל שיחה!",
        });
      } else {
        toast({
          title: "סימנת לייק",
          description: "אם הצד השני יסמן לך גם לייק, תקבלו התראה להתחיל שיחה",
        });
      }
    } catch (error) {
      console.error('Error liking user:', error);
      toast({
        title: "שגיאה בסימון לייק",
        description: "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    }
  };
  
  // Check if user already liked another user
  const getLikedStatus = async (userId: string): Promise<boolean> => {
    if (!state.currentUser) return false;
    
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('user_id', state.currentUser.id)
        .eq('matched_user_id', userId);
        
      if (error) throw error;
      
      return data && data.length > 0;
    } catch (error) {
      console.error('Error checking like status:', error);
      return false;
    }
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
        reportUser,
        likeUser,
        getLikedStatus
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
