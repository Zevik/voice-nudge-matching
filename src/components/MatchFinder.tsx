
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { Mic, Video, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { useToast } from '@/hooks/use-toast';

const MatchFinder: React.FC = () => {
  const { state, startSearchingMatch, stopSearchingMatch, acceptMatch, rejectMatch } = useApp();
  const { currentUser, isSearchingMatch, currentMatch } = state;
  const { toast } = useToast();
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const [presenceChannel, setPresenceChannel] = useState<any>(null);

  // Function to set up real-time presence
  const setupPresence = () => {
    if (!currentUser) return null;
    
    // Create a unique channel for active users
    const channel = supabase.channel('active_users');

    // Set up presence tracking
    channel
      .on('presence', { event: 'sync' }, () => {
        // Get the current state of all users
        const state = channel.presenceState();
        
        // Convert presence state to array of users
        const users: User[] = [];
        Object.keys(state).forEach(key => {
          // Each key can have multiple presences (e.g., from different tabs)
          state[key].forEach((presence: any) => {
            if (presence.user && presence.user.id !== currentUser.id) {
              users.push(presence.user);
            }
          });
        });
        
        setActiveUsers(users);
        console.log("Active users updated:", users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || !currentUser) return;
        
        // Start tracking this user's presence
        await channel.track({
          user: currentUser,
          online_at: new Date().toISOString(),
          searching: isSearchingMatch
        });
        
        console.log("Channel subscribed, tracking user presence:", currentUser.id);
        setPresenceChannel(channel);
      });
      
    return channel;
  };

  // Set up or clean up presence tracking when searching status changes
  useEffect(() => {
    let channel: any = null;
    
    if (currentUser) {
      channel = setupPresence();
      console.log("Setting up presence channel", channel);
    }
    
    return () => {
      if (channel) {
        console.log("Removing presence channel");
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser?.id, isSearchingMatch]);

  // Function to fetch active users (as a fallback)
  const fetchActiveUsers = async () => {
    try {
      console.log("Fetching active users from database");
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', currentUser?.id || '')
        .limit(10);
      
      if (error) throw error;
      
      // Map the data to our User type
      const mappedUsers = data.map(profile => ({
        id: profile.id,
        name: profile.name || 'New User',
        age: profile.age || 25,
        gender: (profile.gender as 'male' | 'female' | 'other') || 'other',
        preferredGender: (profile.preferred_gender as 'male' | 'female' | 'both' | 'all') || 'all',
        location: profile.location || "Israel",
        relationshipGoal: (profile.relationship_goal as 'serious' | 'casual' | 'friendship') || 'casual',
        premium: profile.premium || false,
        profilePicture: profile.profile_picture || "/placeholder.svg",
        bio: profile.bio || undefined,
      }));
      
      console.log("Fetched users:", mappedUsers);
      setActiveUsers(mappedUsers);
    } catch (error) {
      console.error('Error fetching active users:', error);
      toast({
        title: "שגיאה בטעינת משתמשים",
        description: "לא ניתן לטעון משתמשים פעילים",
        variant: "destructive",
      });
    }
  };

  // If presence channel doesn't find users, fallback to fetchActiveUsers
  useEffect(() => {
    if (isSearchingMatch && activeUsers.length === 0) {
      fetchActiveUsers();
    }
  }, [isSearchingMatch]);

  // Update presence when searching status changes
  useEffect(() => {
    if (presenceChannel && currentUser) {
      presenceChannel.track({
        user: currentUser,
        online_at: new Date().toISOString(),
        searching: isSearchingMatch
      });
      console.log("Updated user presence - searching:", isSearchingMatch);
    }
  }, [isSearchingMatch]);

  // Stop tracking presence when component unmounts or user stops searching
  useEffect(() => {
    return () => {
      if (presenceChannel) {
        supabase.removeChannel(presenceChannel);
      }
    };
  }, []);

  // Function to initiate a match with another user
  const initiateMatch = (otherUser: User) => {
    if (!currentUser) return;
    
    console.log("Initiating match with user:", otherUser.id);
    
    // Create a match directly in the database
    supabase.from('matches').insert({
      user_id: currentUser.id,
      matched_user_id: otherUser.id,
      status: 'pending'
    }).then(({ error }) => {
      if (error) {
        console.error("Error creating match:", error);
        toast({
          title: "שגיאה ביצירת התאמה",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      // Set the match in app state
      acceptMatch(`${currentUser.id}-${otherUser.id}`);
    });
  };

  return (
    <div className="dating-card flex flex-col items-center gap-6 max-w-md w-full mx-auto">
      {!isSearchingMatch && !currentMatch && (
        <>
          <h2 className="text-2xl font-bold dating-gradient-text">Ready to Connect?</h2>
          <p className="text-center text-gray-600">
            Find someone available right now for a quick voice chat.
          </p>
          <div className="mt-4 w-full">
            <Button 
              onClick={startSearchingMatch} 
              className="w-full dating-button flex items-center justify-center gap-2"
            >
              <Search size={20} />
              Start Searching
            </Button>
          </div>
        </>
      )}

      {isSearchingMatch && !currentMatch && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="relative w-24 h-24 bg-dating-light rounded-full flex items-center justify-center">
            <div className="absolute w-full h-full rounded-full bg-dating-primary opacity-20 animate-pulse-slow"></div>
            <Search className="text-dating-primary" size={40} />
          </div>
          <h2 className="text-xl font-semibold">Searching for matches...</h2>
          
          {activeUsers.length > 0 ? (
            <div className="w-full mt-2 space-y-4">
              <p className="text-gray-600 text-center font-medium">משתמשים זמינים:</p>
              {activeUsers.map(user => (
                <div key={user.id} className="p-4 bg-white rounded-lg shadow flex items-center gap-4">
                  <div className="w-12 h-12 bg-dating-light rounded-full overflow-hidden flex-shrink-0">
                    <img 
                      src={user.profilePicture} 
                      alt={user.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-medium">{user.name}, {user.age}</h3>
                    <p className="text-sm text-gray-500">{user.location}</p>
                  </div>
                  <Button 
                    className="dating-button-sm"
                    onClick={() => initiateMatch(user)}
                  >
                    <Mic size={16} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center">
              אנחנו מחפשים מישהו זמין כרגע.
            </p>
          )}
          
          <Button 
            onClick={stopSearchingMatch} 
            variant="outline"
            className="mt-2"
          >
            בטל חיפוש
          </Button>
        </div>
      )}

      {currentMatch && currentMatch.status === 'pending' && (
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-24 h-24 bg-dating-light rounded-full flex items-center justify-center">
            <Mic className="text-dating-primary" size={40} />
          </div>
          <h2 className="text-xl font-semibold">Match Found!</h2>
          <p className="text-gray-600 text-center">
            Someone is available for a voice chat right now.
          </p>
          <div className="flex gap-4 mt-2">
            <Button
              onClick={() => rejectMatch(currentMatch.id)}
              variant="outline"
              className="border-dating-danger text-dating-danger hover:bg-dating-danger hover:text-white"
            >
              <X className="mr-2" size={16} />
              דחה
            </Button>
            <Button
              onClick={() => acceptMatch(currentMatch.id)}
              className="dating-button"
            >
              <Mic className="mr-2" size={16} />
              התחל שיחה קולית
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchFinder;
