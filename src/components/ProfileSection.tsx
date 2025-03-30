
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Settings, LogOut, Edit, Save, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ProfileSection: React.FC = () => {
  const { state, logout, setAuthUser } = useApp();
  const { currentUser } = state;
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [age, setAge] = useState(currentUser?.age?.toString() || '');
  const [location, setLocation] = useState(currentUser?.location || '');
  const [gender, setGender] = useState(currentUser?.gender || '');
  const [preferredGender, setPreferredGender] = useState(currentUser?.preferredGender || '');
  const [relationshipGoal, setRelationshipGoal] = useState(currentUser?.relationshipGoal || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [profileImage, setProfileImage] = useState(currentUser?.profilePicture || '/placeholder.svg');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!currentUser) {
    return null;
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    if (!currentUser) return;
    
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const filePath = `${currentUser.id}.${fileExt}`;
    
    setImageUploading(true);
    
    try {
      // Check if a storage bucket exists, if not upload will fail
      const { data: bucketData, error: bucketError } = await supabase
        .storage
        .listBuckets();
      
      console.log('Available buckets:', bucketData);
      
      // If no avatar bucket exists, we'll default to the public folder
      const bucketName = 'avatars';
      
      const { data, error } = await supabase
        .storage
        .from(bucketName)
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type
        });
        
      if (error) {
        throw error;
      }
      
      // Get the public URL for the uploaded image
      const { data: urlData } = supabase
        .storage
        .from(bucketName)
        .getPublicUrl(filePath);
        
      const imageUrl = urlData.publicUrl;
      
      // Update profile in database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          profile_picture: imageUrl
        })
        .eq('id', currentUser.id);
        
      if (updateError) {
        throw updateError;
      }
      
      // Update local state
      setProfileImage(imageUrl);
      
      // Update user context
      if (currentUser) {
        const updatedUser = {
          ...currentUser,
          profilePicture: imageUrl
        };
        
        // Get the current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setAuthUser(session.user, session, updatedUser);
        }
      }
      
      toast({
        title: "התמונה הועלתה בהצלחה",
        description: "תמונת הפרופיל שלך עודכנה",
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "שגיאה בהעלאת התמונה",
        description: error.message || "לא ניתן להעלות את התמונה",
        variant: "destructive",
      });
    } finally {
      setImageUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          name,
          age: parseInt(age),
          location,
          gender,
          preferred_gender: preferredGender,
          relationship_goal: relationshipGoal,
          bio
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
    <div className="dating-card flex flex-col items-center text-right" dir="rtl">
      <div className="relative w-24 h-24 mb-4">
        <Avatar className="w-24 h-24 border-4 border-white shadow-lg cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <AvatarImage src={profileImage} alt={currentUser.name} />
          <AvatarFallback className="bg-dating-primary text-white text-xl">
            {currentUser.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {currentUser.premium && (
          <Badge className="absolute -bottom-1 right-0 bg-gradient-dating">פרימיום</Badge>
        )}
        
        <Button 
          variant="outline" 
          size="icon" 
          className="absolute -bottom-2 -left-2 rounded-full bg-white shadow-md hover:bg-gray-100"
          onClick={() => fileInputRef.current?.click()}
          disabled={imageUploading}
        >
          <Upload size={16} />
          <span className="sr-only">העלה תמונה</span>
        </Button>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleImageUpload}
          disabled={imageUploading}
        />
      </div>
      
      {isEditing ? (
        <div className="w-full space-y-4 mb-4 text-right" dir="rtl">
          <div>
            <Label htmlFor="name">שם</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="text-right"
              dir="rtl"
            />
          </div>
          <div>
            <Label htmlFor="age">גיל</Label>
            <Input 
              id="age" 
              type="number" 
              value={age} 
              onChange={(e) => setAge(e.target.value)} 
              className="text-right"
              dir="rtl"
            />
          </div>
          <div>
            <Label htmlFor="location">מיקום</Label>
            <Input 
              id="location" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
              className="text-right"
              dir="rtl"
            />
          </div>
          <div>
            <Label htmlFor="gender">מגדר</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id="gender" className="text-right" dir="rtl">
                <SelectValue placeholder="בחר/י מגדר" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="male">גבר</SelectItem>
                <SelectItem value="female">אישה</SelectItem>
                <SelectItem value="other">אחר</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="preferredGender">מגדר מועדף</Label>
            <Select value={preferredGender} onValueChange={setPreferredGender}>
              <SelectTrigger id="preferredGender" className="text-right" dir="rtl">
                <SelectValue placeholder="בחר/י מגדר מועדף" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="male">גברים</SelectItem>
                <SelectItem value="female">נשים</SelectItem>
                <SelectItem value="both">גברים ונשים</SelectItem>
                <SelectItem value="all">הכל</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="relationshipGoal">מטרת הקשר</Label>
            <Select value={relationshipGoal} onValueChange={setRelationshipGoal}>
              <SelectTrigger id="relationshipGoal" className="text-right" dir="rtl">
                <SelectValue placeholder="בחר/י מטרת קשר" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="serious">קשר רציני</SelectItem>
                <SelectItem value="casual">קשר קליל</SelectItem>
                <SelectItem value="friendship">חברות</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bio">קצת עליי</Label>
            <Textarea 
              id="bio" 
              value={bio || ''} 
              onChange={(e) => setBio(e.target.value)}
              placeholder="ספר/י קצת על עצמך"
              className="resize-none text-right"
              rows={3}
              dir="rtl"
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
          <h2 className="text-xl font-bold text-right">{currentUser.name}, {currentUser.age}</h2>
          <p className="text-gray-600 mb-1 text-right">{currentUser.location}</p>
          
          <div className="flex flex-wrap gap-2 mb-4 justify-center">
            {currentUser.gender && (
              <Badge variant="outline">
                {currentUser.gender === 'male' ? 'גבר' : 
                 currentUser.gender === 'female' ? 'אישה' : 'אחר'}
              </Badge>
            )}
            
            {currentUser.preferredGender && (
              <Badge variant="outline">
                מחפש/ת: {
                  currentUser.preferredGender === 'male' ? 'גברים' : 
                  currentUser.preferredGender === 'female' ? 'נשים' : 
                  currentUser.preferredGender === 'both' ? 'גברים ונשים' : 'הכל'
                }
              </Badge>
            )}
            
            {currentUser.relationshipGoal && (
              <Badge variant="outline">
                {currentUser.relationshipGoal === 'serious' ? 'קשר רציני' : 
                 currentUser.relationshipGoal === 'casual' ? 'קשר קליל' : 'חברות'}
              </Badge>
            )}
          </div>
          
          {currentUser.bio && (
            <p className="text-sm text-gray-700 mb-4 text-right">{currentUser.bio}</p>
          )}
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
        <div className="mt-6 w-full p-4 bg-dating-light rounded-lg text-right">
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
