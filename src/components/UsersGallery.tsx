
import React, { useEffect, useState } from 'react';
import { User, DbLike } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import UserCard from '@/components/UserCard';
import { useToast } from '@/hooks/use-toast';

const UsersGallery: React.FC = () => {
  const { state } = useApp();
  const { currentUser } = state;
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [likedUsers, setLikedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all users
  useEffect(() => {
    if (!currentUser) return;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        
        // Fetch all users except current user, without gender filtering
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', currentUser.id);
        
        if (error) throw error;
        
        console.log('Fetched users:', data);
        
        if (!data || data.length === 0) {
          console.log('No users found or empty data array');
          setUsers([]);
          setLoading(false);
          return;
        }
        
        // Convert DB format to our User type
        const mappedUsers = data.map(profile => ({
          id: profile.id,
          name: profile.name || 'User',
          age: profile.age || 25,
          gender: (profile.gender as 'male' | 'female' | 'other') || 'other',
          preferredGender: (profile.preferred_gender as 'male' | 'female' | 'both' | 'all') || 'all',
          location: profile.location || 'Israel',
          bio: profile.bio || undefined,
          profilePicture: profile.profile_picture || '/placeholder.svg',
          relationshipGoal: (profile.relationship_goal as 'serious' | 'casual' | 'friendship') || 'casual',
          premium: profile.premium || false,
        }));
        
        console.log('Mapped users:', mappedUsers);
        setUsers(mappedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: "שגיאה בטעינת משתמשים",
          description: "אירעה שגיאה בטעינת המשתמשים",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUser, toast]);

  // Fetch likes given by the current user
  useEffect(() => {
    if (!currentUser) return;

    const fetchLikes = async () => {
      try {
        const { data, error } = await supabase
          .from('likes')
          .select('*')
          .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        // Extract liked user IDs
        const likedUserIds = data.map((like) => like.liked_user_id);
        setLikedUsers(likedUserIds);
      } catch (error) {
        console.error('Error fetching likes:', error);
      }
    };

    fetchLikes();

    // Set up real-time subscription for likes
    const likesChannel = supabase
      .channel('public:likes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'likes',
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        console.log('Likes change:', payload);
        // Refresh likes when there's a change
        fetchLikes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
    };
  }, [currentUser]);

  // Handle liking a user
  const handleLike = async (userId: string) => {
    if (!currentUser) return;
    
    try {
      // Check if already liked
      if (likedUsers.includes(userId)) {
        // Unlike by removing from database
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('liked_user_id', userId);
        
        if (error) throw error;
        
        // Update local state
        setLikedUsers(prev => prev.filter(id => id !== userId));
        
        toast({
          title: "ביטלת את הלייק",
          description: "ביטלת בהצלחה את הלייק",
        });
      } else {
        // Check if other user already liked current user (mutual like)
        const { data: mutualLike, error: mutualError } = await supabase
          .from('likes')
          .select('*')
          .eq('user_id', userId)
          .eq('liked_user_id', currentUser.id)
          .single();
        
        if (mutualError && mutualError.code !== 'PGRST116') throw mutualError;
        
        // Add like to database
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: currentUser.id,
            liked_user_id: userId,
          });
        
        if (error) throw error;
        
        // Update local state
        setLikedUsers(prev => [...prev, userId]);
        
        // If mutual like, create a match and notify
        if (mutualLike) {
          // Create a match in the database
          const { error: matchError } = await supabase
            .from('matches')
            .insert({
              user_id: currentUser.id,
              matched_user_id: userId,
              status: 'pending',
            });
          
          if (matchError) throw matchError;
          
          // Notify user about the match
          toast({
            title: "התאמה הדדית!",
            description: "מצאתם התאמה הדדית! אתם יכולים להתחיל שיחה",
            variant: "default",
          });
        } else {
          toast({
            title: "הוספת לייק",
            description: "הוספת לייק בהצלחה",
          });
        }
      }
    } catch (error) {
      console.error('Error handling like:', error);
      toast({
        title: "שגיאה בהוספת לייק",
        description: "אירעה שגיאה בעת הוספת לייק",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <p className="text-center py-8">טוען משתמשים...</p>;
  }

  if (users.length === 0) {
    return <p className="text-center py-8">לא נמצאו משתמשים</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 py-6">
      {users.map(user => (
        <UserCard 
          key={user.id} 
          user={user} 
          onLike={handleLike} 
          isLiked={likedUsers.includes(user.id)}
        />
      ))}
    </div>
  );
};

export default UsersGallery;
