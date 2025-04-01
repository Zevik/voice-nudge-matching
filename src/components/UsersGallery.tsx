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
        console.log(`==== MUTUAL LIKES CHECK START ====`);
        console.log(`Current user: ${currentUser.id}, My likes count: ${myLikes.length}`);
        console.log(`My liked users: ${JSON.stringify(myLikes)}`);
        
        // Find users who have liked the current user
        const { data: mutualLikes, error: likesError } = await supabase
          .from('likes')
          .select('*')
          .eq('liked_user_id', currentUser.id)
          .in('user_id', myLikes);
          
        if (likesError) {
          console.error(`Error checking mutual likes:`, likesError);
          return;
        }
        
        console.log(`Potential mutual likes found: ${mutualLikes?.length || 0}`, mutualLikes);
        
        if (!mutualLikes || mutualLikes.length === 0) {
          console.log(`No mutual likes found for user ${currentUser.id}`);
          console.log(`==== MUTUAL LIKES CHECK END - NO MUTUAL LIKES ====`);
          return;
        }
        
        console.log(`Processing ${mutualLikes.length} mutual likes for user ${currentUser.id}`);
        
        // For each mutual like, check if a match already exists
        for (const like of mutualLikes) {
          const otherUserId = like.user_id;
          
          console.log(`\n-- Processing mutual like between ${currentUser.id} and ${otherUserId} --`);
          console.log(`Checking if match exists between ${currentUser.id} and ${otherUserId}`);
          
          // Check if a match already exists between these users with a detailed OR condition
          const matchQuery = `and(user_id.eq.${currentUser.id},matched_user_id.eq.${otherUserId}),and(user_id.eq.${otherUserId},matched_user_id.eq.${currentUser.id})`;
          console.log(`Match query: OR(${matchQuery})`);
          
          const { data: existingMatch, error: checkMatchError } = await supabase
            .from('matches')
            .select('*')
            .or(matchQuery)
            .maybeSingle();
          
          console.log(`Existing match check results:`, { existingMatch, error: checkMatchError });
          
          if (checkMatchError) {
            if (checkMatchError.code === 'PGRST116') {
              console.log(`No existing match record found (expected PGRST116 error)`);
            } else {
              console.error(`Error checking existing match:`, checkMatchError);
              continue;
            }
          }
          
          // Only create a match if one doesn't already exist
          if (!existingMatch) {
            console.log(`No existing match found, CREATING NEW MATCH between ${currentUser.id} and ${otherUserId}`);
            
            try {
              // Create a match in the database
              const newMatch = {
                user_id: currentUser.id,
                matched_user_id: otherUserId,
                status: 'pending'
              };
              
              console.log(`Match creation payload:`, newMatch);
              
              const { data: insertResult, error: matchError } = await supabase
                .from('matches')
                .insert(newMatch)
                .select();
              
              console.log(`Match creation result:`, { insertResult, matchError });
              
              if (matchError) {
                console.error(`ERROR CREATING MATCH:`, matchError);
                console.error(`Error details:`, {
                  code: matchError.code,
                  message: matchError.message,
                  details: matchError.details,
                  hint: matchError.hint
                });
                
                // Check if it's an RLS policy violation
                if (matchError.code === 'PGRST301') {
                  console.error(`RLS POLICY ERROR detected - trying reverse match creation`);
                  
                  // Try creating match in reverse order as a workaround
                  const reverseMatch = {
                    user_id: otherUserId,
                    matched_user_id: currentUser.id,
                    status: 'pending'
                  };
                  
                  console.log(`Trying reverse match creation:`, reverseMatch);
                  
                  const { data: reverseResult, error: reverseError } = await supabase
                    .from('matches')
                    .insert(reverseMatch)
                    .select();
                    
                  console.log(`Reverse match creation result:`, { reverseResult, reverseError });
                  
                  if (reverseError) {
                    console.error(`Reverse match creation also failed:`, reverseError);
                  } else {
                    console.log(`SUCCESS! Reverse match created successfully:`, reverseResult);
                    
                    toast({
                      title: "התאמה הדדית!",
                      description: "מצאתם התאמה הדדית! אתם יכולים להתחיל שיחה",
                      variant: "default",
                    });
                  }
                } else {
                  console.error(`Non-RLS error creating match:`, matchError);
                }
                
                continue;
              }
              
              console.log(`SUCCESS! Match created successfully:`, insertResult);
              
              // Notify user about the match
              toast({
                title: "התאמה הדדית!",
                description: "מצאתם התאמה הדדית! אתם יכולים להתחיל שיחה",
                variant: "default",
              });
              
            } catch (insertError) {
              console.error(`EXCEPTION during match creation:`, insertError);
            }
          } else {
            console.log(`Match already exists between ${currentUser.id} and ${otherUserId}:`, existingMatch);
          }
        }
        
        console.log(`==== MUTUAL LIKES CHECK END ====`);
      } catch (error) {
        console.error(`ERROR in mutual likes processing:`, error);
        console.log(`==== MUTUAL LIKES CHECK FAILED ====`);
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
    if (!currentUser || processingLike) {
      console.log(`[LIKE] Cannot process - currentUser: ${!!currentUser}, processingLike: ${processingLike}`);
      return;
    }
    
    try {
      setProcessingLike(true);
      console.log(`[LIKE] -------- START LIKE PROCESS --------`);
      console.log(`[LIKE] Current user: ${currentUser.id}, Target user: ${userId}`);
      console.log(`[LIKE] Current liked users: ${JSON.stringify(likedUsers)}`);
      
      // Check if already liked
      if (likedUsers.includes(userId)) {
        console.log(`[UNLIKE] Starting unlike process...`);
        // Unlike by removing from database
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('liked_user_id', userId);
        
        if (error) {
          console.error(`[UNLIKE] Error:`, error);
          throw error;
        }
        
        console.log(`[UNLIKE] Successfully removed like`);
        // Update local state
        setLikedUsers(prev => prev.filter(id => id !== userId));
        
        toast({
          title: "ביטלת את הלייק",
          description: "ביטלת בהצלחה את הלייק",
        });
      } else {
        console.log(`[LIKE] Starting like process...`);
        // Add like to database
        const { error } = await supabase
          .from('likes')
          .insert({
            user_id: currentUser.id,
            liked_user_id: userId,
          });
        
        if (error) {
          console.error(`[LIKE] Insert error:`, error);
          throw error;
        }
        
        console.log(`[LIKE] Successfully added like`);
        // Update local state
        setLikedUsers(prev => [...prev, userId]);
        
        toast({
          title: "הוספת לייק",
          description: "הוספת לייק בהצלחה",
        });
        
        // Check if other user already liked current user (mutual like)
        console.log(`[MATCH] Checking for mutual like...`);
        console.log(`[MATCH] Query: user_id=${userId}, liked_user_id=${currentUser.id}`);
        
        const { data: mutualLike, error: mutualError } = await supabase
          .from('likes')
          .select('*')
          .eq('user_id', userId)
          .eq('liked_user_id', currentUser.id);
        
        console.log(`[MATCH] Mutual like check result:`, { mutualLike, mutualError });
        
        if (mutualError) {
          console.error(`[MATCH] Error checking mutual like:`, mutualError);
          return;
        }
        
        // Check if we have a mutual like
        const hasMutualLike = mutualLike && mutualLike.length > 0;
        console.log(`[MATCH] Has mutual like: ${hasMutualLike}`);
        
        if (hasMutualLike) {
          console.log(`[MATCH] MUTUAL LIKE DETECTED!`);
          
          // Check if a match already exists
          console.log(`[MATCH] Checking for existing match...`);
          const matchQuery = `and(user_id.eq.${currentUser.id},matched_user_id.eq.${userId}),and(user_id.eq.${userId},matched_user_id.eq.${currentUser.id})`;
          console.log(`[MATCH] Query: ${matchQuery}`);
          
          const { data: existingMatch, error: checkMatchError } = await supabase
            .from('matches')
            .select('*')
            .or(matchQuery)
            .maybeSingle();
          
          console.log(`[MATCH] Existing match check result:`, { existingMatch, checkMatchError });
          
          if (checkMatchError && checkMatchError.code !== 'PGRST116') {
            console.error(`[MATCH] Error checking existing match:`, checkMatchError);
            return;
          }
          
          if (!existingMatch) {
            console.log(`[MATCH] No existing match found - creating new match`);
            
            try {
              const newMatch = {
                user_id: currentUser.id,
                matched_user_id: userId,
                status: 'pending',
              };
              
              console.log(`[MATCH] Attempting to create match:`, newMatch);
              
              const { data: insertResult, error: matchError } = await supabase
                .from('matches')
                .insert(newMatch)
                .select();
              
              if (matchError) {
                console.error(`[MATCH] Error creating match:`, matchError);
                console.error(`[MATCH] Error details:`, {
                  code: matchError.code,
                  message: matchError.message,
                  details: matchError.details,
                  hint: matchError.hint
                });
                
                // Handle specific errors
                if (matchError.code === 'PGRST301') {
                  console.error(`[MATCH] RLS POLICY ERROR detected - trying reverse match creation`);
                  
                  // Try creating match in reverse order as a workaround
                  const reverseMatch = {
                    user_id: userId,
                    matched_user_id: currentUser.id,
                    status: 'pending',
                  };
                  
                  console.log(`[MATCH] Trying reverse match creation:`, reverseMatch);
                  
                  const { data: reverseResult, error: reverseError } = await supabase
                    .from('matches')
                    .insert(reverseMatch)
                    .select();
                    
                  console.log(`[MATCH] Reverse match creation result:`, { reverseResult, reverseError });
                  
                  if (reverseError) {
                    console.error(`[MATCH] Reverse match creation also failed:`, reverseError);
                    toast({
                      title: "שגיאה ביצירת התאמה",
                      description: "אירעה שגיאה ביצירת ההתאמה, נסה שוב מאוחר יותר",
                      variant: "destructive",
                    });
                  } else {
                    console.log(`[MATCH] SUCCESS - Reverse match created!`);
                    toast({
                      title: "התאמה הדדית!",
                      description: "מצאתם התאמה הדדית! אתם יכולים להתחיל שיחה",
                      variant: "default",
                    });
                  }
                } else {
                  toast({
                    title: "שגיאה ביצירת התאמה",
                    description: "אירעה שגיאה ביצירת ההתאמה, נסה שוב מאוחר יותר",
                    variant: "destructive",
                  });
                }
              } else {
                console.log(`[MATCH] SUCCESS - Match created!`);
                toast({
                  title: "התאמה הדדית!",
                  description: "מצאתם התאמה הדדית! אתם יכולים להתחיל שיחה",
                  variant: "default",
                });
              }
            } catch (error) {
              console.error(`[MATCH] Exception during match creation:`, error);
              toast({
                title: "שגיאה ביצירת התאמה",
                description: "אירעה שגיאה ביצירת ההתאמה, נסה שוב מאוחר יותר",
                variant: "destructive",
              });
            }
          } else {
            console.log(`[MATCH] Match already exists:`, existingMatch);
          }
        } else {
          console.log(`[MATCH] No mutual like found`);
        }
      }
    } catch (error: any) {
      console.error(`[ERROR] Error in handleLike:`, error);
      toast({
        title: "שגיאה בהוספת לייק",
        description: error.message || "אירעה שגיאה בעת הוספת לייק",
        variant: "destructive",
      });
    } finally {
      console.log(`[LIKE] -------- END LIKE PROCESS --------`);
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
