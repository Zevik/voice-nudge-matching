
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { Mic, Video, Heart, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { User, DbMatch } from '@/types';
import { useToast } from '@/hooks/use-toast';

const MatchFinder: React.FC = () => {
  const { state, acceptMatch, rejectMatch, likeUser, getLikedStatus } = useApp();
  const { currentUser, currentMatch } = state;
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedUsers, setLikedUsers] = useState<Record<string, boolean>>({});

  // Fetch all users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      if (!currentUser) return;
      
      try {
        setLoading(true);
        
        // Fetch all users except current user
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', currentUser.id);
          
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
        
        setUsers(mappedUsers);

        // Check which users are already liked
        const likeStatus: Record<string, boolean> = {};
        for (const user of mappedUsers) {
          likeStatus[user.id] = await getLikedStatus(user.id);
        }
        setLikedUsers(likeStatus);
        
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: "שגיאה בטעינת משתמשים",
          description: "לא ניתן לטעון את רשימת המשתמשים",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
    
    // Subscribe to match updates
    const matchesSubscription = supabase
      .channel('public:matches')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
      }, () => {
        // Refresh users when matches change
        fetchUsers();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(matchesSubscription);
    };
  }, [currentUser]);

  // Handle liking a user
  const handleLike = async (userId: string) => {
    await likeUser(userId);
    
    // Update the local liked state
    setLikedUsers(prev => ({
      ...prev,
      [userId]: true
    }));
  };

  return (
    <div className="dating-card flex flex-col items-center gap-6 max-w-md w-full mx-auto">
      {!currentMatch && (
        <>
          <h2 className="text-2xl font-bold dating-gradient-text">חיפוש התאמות</h2>
          
          {loading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="animate-spin text-dating-primary" size={40} />
            </div>
          ) : (
            <div className="w-full space-y-4">
              {users.length > 0 ? (
                users.map(user => (
                  <div key={user.id} className="p-4 bg-white rounded-lg shadow flex items-center gap-4">
                    <div className="w-16 h-16 bg-dating-light rounded-full overflow-hidden flex-shrink-0">
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
                      {user.bio && <p className="text-sm mt-1">{user.bio}</p>}
                    </div>
                    <Button 
                      className={`rounded-full p-2 ${likedUsers[user.id] ? 'bg-pink-100' : 'dating-button-sm'}`}
                      onClick={() => handleLike(user.id)}
                      disabled={likedUsers[user.id]}
                    >
                      <Heart 
                        size={24} 
                        className={likedUsers[user.id] ? 'text-pink-500 fill-pink-500' : ''}
                      />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-gray-600 text-center">
                  אין משתמשים זמינים כרגע
                </p>
              )}
            </div>
          )}
        </>
      )}

      {currentMatch && currentMatch.status === 'pending' && (
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-24 h-24 bg-dating-light rounded-full flex items-center justify-center">
            <Mic className="text-dating-primary" size={40} />
          </div>
          <h2 className="text-xl font-semibold">התאמה הדדית!</h2>
          <p className="text-gray-600 text-center">
            יש לכם התאמה הדדית! האם תרצו להתחיל שיחה קולית?
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
