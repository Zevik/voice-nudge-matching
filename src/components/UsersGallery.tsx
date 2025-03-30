
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
  const [processingLike, setProcessingLike] = useState(false);

  // Fetch all users
  useEffect(() => {
    if (!currentUser) return;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        
        // Fetch all profiles, excluding the current user
        const { data: allProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .neq('id', currentUser.id);
        
        if (profilesError) {
          console.error('Error fetching users:', profilesError);
          throw profilesError;
        }
        
        // Convert DB format to our User type and provide default values for missing fields
        const mappedUsers = allProfiles.map(profile => ({
          id: profile.id,
          name: profile.name || 'משתמש',
          age: profile.age || 25,
          gender: (profile.gender as 'male' | 'female' | 'other') || 'other',
          preferredGender: (profile.preferred_gender as 'male' | 'female' | 'both' | 'all') || 'all',
          location: profile.location || 'ישראל',
          bio: profile.bio || undefined,
          profilePicture: profile.profile_picture || '/placeholder.svg',
          relationshipGoal: (profile.relationship_goal as 'serious' | 'casual' | 'friendship') || 'casual',
          premium: profile.premium || false,
        }));
        
        setUsers(mappedUsers);
      } catch (error) {
        console.error('Error in users fetch flow:', error);
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

  // Fetch likes given by the current user and check for mutual likes
  useEffect(() => {
    if (!currentUser) return;

    const fetchLikes = async () => {
      try {
        console.log('Fetching likes for user ID:', currentUser.id);
        
        const { data, error } = await supabase
          .from('likes')
          .select('*')
          .eq('user_id', currentUser.id);
        
        if (error) throw error;
        
        // Extract liked user IDs
        const likedUserIds = data.map((like) => like.liked_user_id);
        setLikedUsers(likedUserIds);
        
        console.log('Fetched likes for current user:', data);
        
        // Check for mutual likes and create matches if needed
        await checkForMutualLikes(likedUserIds);
      } catch (error) {
        console.error('Error fetching likes:', error);
      }
    };

    // Function to check for mutual likes and create matches
    const checkForMutualLikes = async (myLikes: string[]) => {
      if (!myLikes.length) return;
      
      try {
        console.log('Checking for mutual likes among:', myLikes);
        
        // Find users who have liked the current user
        const { data: mutualLikes, error: likesError } = await supabase
          .from('likes')
          .select('*')
          .eq('liked_user_id', currentUser.id)
          .in('user_id', myLikes);
          
        if (likesError) {
          console.error('Error checking mutual likes:', likesError);
          return;
        }
        
        console.log('Found potential mutual likes:', mutualLikes);
        
        if (!mutualLikes || mutualLikes.length === 0) return;
        
        // For each mutual like, check if a match already exists
        for (const like of mutualLikes) {
          const otherUserId = like.user_id;
          
          console.log('Checking if match exists between', currentUser.id, 'and', otherUserId);
          
          // Check if a match already exists between these users
          const { data: existingMatch, error: checkMatchError } = await supabase
            .from('matches')
            .select('*')
            .or(`and(user_id.eq.${currentUser.id},matched_user_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},matched_user_id.eq.${currentUser.id})`)
            .maybeSingle();
          
          if (checkMatchError && checkMatchError.code !== 'PGRST116') {
            console.error('Error checking existing match:', checkMatchError);
            continue;
          }
          
          // Only create a match if one doesn't already exist
          if (!existingMatch) {
            console.log('No existing match found, creating new match between', currentUser.id, 'and', otherUserId);
            
            try {
              // Create a match in the database
              const newMatch = {
                user_id: currentUser.id,
                matched_user_id: otherUserId,
                status: 'pending'
              };
              
              console.log('Attempting to create match with payload:', newMatch);
              
              const { data: insertResult, error: matchError } = await supabase
                .from('matches')
                .insert(newMatch)
                .select();
              
              if (matchError) {
                console.error('Error creating match:', matchError);
                console.error('Error details:', matchError.details, matchError.hint, matchError.message);
                
                // Check if it's an RLS policy violation
                if (matchError.code === 'PGRST301') {
                  console.error('This appears to be an RLS policy issue. The current user does not have permission to insert into the matches table.');
                }
                
                continue;
              }
              
              console.log('Match created successfully:', insertResult);
              
              // Notify user about the match
              toast({
                title: "התאמה הדדית!",
                description: "מצאתם התאמה הדדית! אתם יכולים להתחיל שיחה",
                variant: "default",
              });
              
            } catch (insertError) {
              console.error('Exception during match creation:', insertError);
            }
          } else {
            console.log('Match already exists:', existingMatch);
          }
        }
      } catch (error) {
        console.error('Error in mutual likes processing:', error);
      }
    };

    fetchLikes();

    // Set up real-time subscription for likes
    const likesChannel = supabase
      .channel('likes-changes-' + currentUser.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'likes',
        filter: `or(user_id.eq.${currentUser.id},liked_user_id.eq.${currentUser.id})`,
      }, (payload) => {
        console.log('Likes change received:', payload);
        // Refresh likes when there's a change
        fetchLikes();
      })
      .subscribe((status) => {
        console.log('Likes subscription status:', status);
      });

    return () => {
      supabase.removeChannel(likesChannel);
    };
  }, [currentUser, toast]);

  // Handle liking a user
  const handleLike = async (userId: string) => {
    if (!currentUser || processingLike) return;
    
    try {
      setProcessingLike(true);
      
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
        
        toast({
          title: "הוספת לייק",
          description: "הוספת לייק בהצלחה",
        });
        
        // Check if other user already liked current user (mutual like)
        console.log('Checking for mutual like between', currentUser.id, 'and', userId);
        
        const { data: mutualLike, error: mutualError } = await supabase
          .from('likes')
          .select('*')
          .eq('user_id', userId)
          .eq('liked_user_id', currentUser.id)
          .single();
        
        if (mutualError) {
          if (mutualError.code === 'PGRST116') { // Not found error is expected if no mutual like
            console.log('No mutual like found');
          } else {
            console.error('Error checking mutual like:', mutualError);
          }
          setProcessingLike(false);
          return; // Exit if no mutual like or error checking
        }
        
        // If we got here, a mutual like exists
        console.log('Mutual like detected!', mutualLike);
        
        // Check if a match already exists between these users
        const { data: existingMatch, error: checkMatchError } = await supabase
          .from('matches')
          .select('*')
          .or(`and(user_id.eq.${currentUser.id},matched_user_id.eq.${userId}),and(user_id.eq.${userId},matched_user_id.eq.${currentUser.id})`)
          .maybeSingle();
        
        if (checkMatchError) {
          console.error('Error checking existing match:', checkMatchError);
          setProcessingLike(false);
          return;
        }
        
        // Only create a match if one doesn't already exist
        if (!existingMatch) {
          console.log('No existing match found, creating new match...');
          
          try {
            // Create a match object
            const newMatch = {
              user_id: currentUser.id,
              matched_user_id: userId,
              status: 'pending',
            };
            
            console.log('Attempting to create match with payload:', newMatch);
            
            // Create a match in the database
            const { data: insertResult, error: matchError } = await supabase
              .from('matches')
              .insert(newMatch)
              .select();
            
            if (matchError) {
              console.error('Error creating match:', matchError);
              console.error('Error details:', matchError.details, matchError.hint, matchError.message);
              
              // Check if it's an RLS policy violation
              if (matchError.code === 'PGRST301') {
                console.error('This appears to be an RLS policy issue. The current user does not have permission to insert into the matches table.');
                
                // Attempt to create match with a direct SQL insert as a workaround if needed
                /* This is commented out as it's not recommended, but could be a last resort
                const { data: sqlInsertResult, error: sqlError } = await supabase.rpc('create_match', { 
                  user_id_param: currentUser.id, 
                  matched_user_id_param: userId 
                });
                
                if (sqlError) {
                  console.error('SQL insert attempt also failed:', sqlError);
                } else {
                  console.log('Match created via SQL function:', sqlInsertResult);
                }
                */
              }
              
              toast({
                title: "שגיאה ביצירת התאמה",
                description: "אירעה שגיאה ביצירת ההתאמה, נסה שוב מאוחר יותר",
                variant: "destructive",
              });
            } else {
              console.log('Match created successfully:', insertResult);
              
              // Notify user about the match
              toast({
                title: "התאמה הדדית!",
                description: "מצאתם התאמה הדדית! אתם יכולים להתחיל שיחה",
                variant: "default",
              });
            }
          } catch (insertError) {
            console.error('Exception during match creation:', insertError);
            toast({
              title: "שגיאה ביצירת התאמה",
              description: "אירעה שגיאה ביצירת ההתאמה, נסה שוב מאוחר יותר",
              variant: "destructive",
            });
          }
        } else {
          console.log('Match already exists:', existingMatch);
        }
      }
    } catch (error: any) {
      console.error('Error handling like:', error);
      toast({
        title: "שגיאה בהוספת לייק",
        description: error.message || "אירעה שגיאה בעת הוספת לייק",
        variant: "destructive",
      });
    } finally {
      setProcessingLike(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-lg font-medium" dir="rtl">טוען משתמשים...</div>;
  }

  if (!users || users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4" dir="rtl">
        <p className="text-lg text-gray-600 text-center">
          אין משתמשים זמינים כרגע
        </p>
        <p className="text-sm text-gray-500 text-center">
          נסה לחזור מאוחר יותר או פנה לתמיכה
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 py-6" dir="rtl">
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
