
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { Mic, Video, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { User, DbMatch } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

const MatchFinder: React.FC = () => {
  const { state, startSearchingMatch, stopSearchingMatch, acceptMatch, rejectMatch } = useApp();
  const { currentUser, isSearchingMatch, currentMatch } = state;
  const { toast } = useToast();
  const [matches, setMatches] = useState<{match: DbMatch, user: User}[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch matches
  useEffect(() => {
    if (!currentUser) return;

    const fetchMatches = async () => {
      try {
        setLoading(true);
        console.log('Fetching matches for user:', currentUser.id);
        
        // Fetch matches where current user is either user_id or matched_user_id
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .or(`user_id.eq.${currentUser.id},matched_user_id.eq.${currentUser.id}`)
          .eq('status', 'pending');
        
        if (error) {
          console.error('Error fetching matches:', error);
          throw error;
        }
        
        console.log('Matches found:', data);
        
        if (!data || data.length === 0) {
          setMatches([]);
          setLoading(false);
          return;
        }
        
        // For each match, get the other user's profile
        const matchesWithProfiles = await Promise.all(data.map(async (match: DbMatch) => {
          // Determine which ID is the other user
          const otherUserId = match.user_id === currentUser.id 
            ? match.matched_user_id 
            : match.user_id;
          
          console.log('Getting profile for other user:', otherUserId);
          
          // Get the other user's profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', otherUserId)
            .single();
          
          if (profileError) {
            console.error('Error fetching profile:', profileError);
            throw profileError;
          }
          
          // Convert to our User type
          const user: User = {
            id: profileData.id,
            name: profileData.name || 'User',
            age: profileData.age || 25,
            gender: (profileData.gender as 'male' | 'female' | 'other') || 'other',
            preferredGender: (profileData.preferred_gender as 'male' | 'female' | 'both' | 'all') || 'all',
            location: profileData.location || 'Israel',
            bio: profileData.bio || undefined,
            profilePicture: profileData.profile_picture || '/placeholder.svg',
            relationshipGoal: (profileData.relationship_goal as 'serious' | 'casual' | 'friendship') || 'casual',
            premium: profileData.premium || false,
          };
          
          return { match, user };
        }));
        
        console.log('Matches with profiles:', matchesWithProfiles);
        setMatches(matchesWithProfiles);
      } catch (error) {
        console.error('Error fetching matches:', error);
        toast({
          title: "שגיאה בטעינת התאמות",
          description: "אירעה שגיאה בטעינת ההתאמות",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();

    // Set up real-time subscription for matches
    const matchesChannel = supabase
      .channel('matches-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `or(user_id.eq.${currentUser.id},matched_user_id.eq.${currentUser.id})`,
      }, (payload) => {
        console.log('Match change received:', payload);
        // Refresh matches
        fetchMatches();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
    };
  }, [currentUser, toast]);

  // Handle accepting a match
  const handleAcceptMatch = (matchId: string) => {
    acceptMatch(matchId);
  };

  // Handle rejecting a match
  const handleRejectMatch = (matchId: string) => {
    rejectMatch(matchId);
  };

  if (loading) {
    return <p className="text-center py-8">טוען התאמות...</p>;
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 max-w-md w-full mx-auto py-8">
        <h2 className="text-2xl font-bold dating-gradient-text">אין לך התאמות כרגע</h2>
        <p className="text-center text-gray-600">
          כאשר מישהו שסימנת לו לייק יסמן לך בחזרה, תוכלו להתחיל לשוחח.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <h2 className="text-2xl font-bold dating-gradient-text text-center">התאמות שלך</h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {matches.map(({ match, user }) => (
          <Card key={match.id} className="overflow-hidden">
            <div className="aspect-[3/4] w-full overflow-hidden">
              <img 
                src={user.profilePicture || "/placeholder.svg"} 
                alt={user.name} 
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = "/placeholder.svg";
                }}
              />
            </div>
            <CardContent className="p-4">
              <div>
                <h3 className="text-lg font-medium">{user.name}, {user.age}</h3>
                <p className="text-sm text-gray-500">{user.location}</p>
              </div>
              {user.bio && (
                <p className="mt-2 text-sm text-gray-700">{user.bio}</p>
              )}
            </CardContent>
            <CardFooter className="p-4 pt-0 flex justify-between">
              <Button
                onClick={() => handleRejectMatch(match.id)}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-50"
              >
                <X size={18} className="mr-1" />
                דחה
              </Button>
              <Button
                onClick={() => handleAcceptMatch(match.id)}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <Mic size={18} className="mr-1" />
                התחל שיחה
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MatchFinder;
