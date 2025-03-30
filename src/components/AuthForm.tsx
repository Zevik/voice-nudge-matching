
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/context/AppContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

const AuthForm: React.FC = () => {
  const { setAuthUser } = useApp();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailVerificationRequired, setEmailVerificationRequired] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEmailVerificationRequired(false);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Check specifically for email verification error
        if (error.message.includes('Email not confirmed')) {
          setEmailVerificationRequired(true);
          throw new Error('אימייל לא מאומת. אנא בדוק את תיבת הדואר שלך לקבלת הוראות אימות, או לחץ על כפתור שליחת מייל אימות מחדש.');
        }
        throw error;
      }

      if (data.user) {
        // Fetch user profile from profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        // Set the user in the application context
        setAuthUser(data.user, data.session, profileData);
        
        toast({
          title: "התחברת בהצלחה",
          description: "ברוך הבא לVoiceMatch!",
        });
      }
    } catch (error: any) {
      toast({
        title: "התחברות נכשלה",
        description: error.message || "אירעה שגיאה בהתחברות, נסה שנית",
        variant: "destructive",
      });
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setEmailVerificationRequired(false);

    if (!name || !age || !email || !password) {
      toast({
        title: "שדות חסרים",
        description: "אנא מלא את כל השדות הנדרשים",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            age: parseInt(age),
            gender: gender,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        if (data.user.identities && data.user.identities.length === 0) {
          toast({
            title: "משתמש קיים",
            description: "כתובת האימייל כבר רשומה במערכת. נסה להתחבר או לאפס סיסמה.",
            variant: "destructive",
          });
        } else if (!data.session) {
          setEmailVerificationRequired(true);
          toast({
            title: "הרשמה בוצעה בהצלחה",
            description: "אנא אמת את כתובת האימייל שלך כדי להתחבר. בדוק את תיבת הדואר הנכנס שלך.",
          });
        } else {
          // Set the user in the application context
          setAuthUser(data.user, data.session);
          
          toast({
            title: "נרשמת בהצלחה",
            description: "ברוך הבא לVoiceMatch!",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "הרשמה נכשלה",
        description: error.message || "אירעה שגיאה בהרשמה, נסה שנית",
        variant: "destructive",
      });
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "מייל אימות נשלח",
        description: "בדוק את תיבת הדואר הנכנס שלך לקבלת הוראות אימות",
      });
    } catch (error: any) {
      toast({
        title: "שליחת מייל נכשלה",
        description: error.message || "אירעה שגיאה בשליחת מייל אימות, נסה שנית",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 dating-card">
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 bg-gradient-dating rounded-full flex items-center justify-center mb-4">
          <Heart className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-bold dating-gradient-text">VoiceMatch</h1>
        <p className="text-gray-600 mt-2">התחבר דרך שיחות</p>
      </div>

      {emailVerificationRequired && (
        <Alert className="mb-6 bg-amber-50 border-amber-200">
          <InfoIcon className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-700">דרוש אימות אימייל</AlertTitle>
          <AlertDescription className="text-amber-700">
            נשלח אליך מייל אימות. אנא בדוק את תיבת הדואר הנכנס שלך ולחץ על הקישור המצורף.
            <Button 
              variant="link" 
              className="p-0 h-auto text-amber-800 underline"
              onClick={resendVerificationEmail}
            >
              לחץ כאן לשליחת מייל אימות חדש
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="login">
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="login">התחברות</TabsTrigger>
          <TabsTrigger value="register">הרשמה</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
              disabled={loading}
            >
              {loading ? 'מתחבר...' : 'התחבר'}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-name">שם</Label>
              <Input
                id="register-name"
                placeholder="השם שלך"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-age">גיל</Label>
              <Input
                id="register-age"
                type="number"
                min="18"
                max="120"
                placeholder="הגיל שלך"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-gender">מגדר</Label>
              <select
                id="register-gender"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
                required
              >
                <option value="male">גבר</option>
                <option value="female">אישה</option>
                <option value="other">אחר</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email">אימייל</Label>
              <Input
                id="register-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">סיסמה</Label>
              <Input
                id="register-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
              disabled={loading}
            >
              {loading ? 'נרשם...' : 'הרשם'}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AuthForm;
