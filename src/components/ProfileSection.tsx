
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Settings, LogOut, Edit, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

const ProfileSection: React.FC = () => {
  const { state, logout, setAuthUser } = useApp();
  const { currentUser } = state;
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [age, setAge] = useState(currentUser?.age.toString() || '');
  const [location, setLocation] = useState(currentUser?.location || '');
  const [loading, setLoading] = useState(false);

  if (!currentUser) {
    return null;
  }

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          name,
          age: parseInt(age),
          location
        })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (data && session) {
        // Update the user in context
        setAuthUser(session.user, session, data);
        toast({
          title: "פרופיל עודכן",
          description: "הפרטים שלך עודכנו בהצלחה",
        });
        setIsEditing(false);
      }
    } catch (error: any) {
      toast({
        title: "שגיאה בעדכון הפרופיל",
        description: error.message || "לא ניתן לעדכן את הפרופיל",
        variant: "destructive",
      });
      console.error('Update profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dating-card flex flex-col items-center">
      <div className="relative w-24 h-24 mb-4">
        <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
          <AvatarImage src={currentUser.profilePicture} alt={currentUser.name} />
          <AvatarFallback className="bg-dating-primary text-white text-xl">
            {currentUser.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {currentUser.premium && (
          <Badge className="absolute -bottom-1 right-0 bg-gradient-dating">פרימיום</Badge>
        )}
      </div>
      
      {isEditing ? (
        <div className="w-full space-y-4 mb-4">
          <div>
            <Label htmlFor="name">שם</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />
          </div>
          <div>
            <Label htmlFor="age">גיל</Label>
            <Input 
              id="age" 
              type="number" 
              value={age} 
              onChange={(e) => setAge(e.target.value)} 
            />
          </div>
          <div>
            <Label htmlFor="location">מיקום</Label>
            <Input 
              id="location" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
            />
          </div>
          <Button 
            className="w-full dating-button" 
            onClick={handleSaveProfile}
            disabled={loading}
          >
            <Save size={16} className="mr-2" />
            {loading ? 'שומר...' : 'שמור שינויים'}
          </Button>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-bold">{currentUser.name}, {currentUser.age}</h2>
          <p className="text-gray-600 mb-4">{currentUser.location}</p>
        </>
      )}
      
      <div className="grid grid-cols-2 gap-4 w-full">
        <Button 
          variant="outline" 
          className="flex items-center gap-2"
          onClick={() => setIsEditing(!isEditing)}
        >
          <Edit size={16} />
          {isEditing ? 'בטל' : 'ערוך פרופיל'}
        </Button>
        <Button 
          variant="outline" 
          className="flex items-center gap-2" 
          onClick={logout}
        >
          <LogOut size={16} />
          התנתק
        </Button>
      </div>
      
      {!currentUser.premium && (
        <div className="mt-6 w-full p-4 bg-dating-light rounded-lg">
          <h3 className="font-medium text-center mb-2">שדרג לפרימיום</h3>
          <p className="text-sm text-gray-600 text-center mb-3">
            קבל שיחות ללא הגבלה, שיחות וידאו ארוכות יותר, ועדיפות בהתאמות
          </p>
          <Button className="w-full dating-button">
            שדרג עכשיו
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfileSection;
