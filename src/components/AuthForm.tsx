
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useApp } from '@/context/AppContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart } from 'lucide-react';

const AuthForm: React.FC = () => {
  const { login } = useApp();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('other');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, we would make an API call to authenticate
    login({
      id: "1",
      name: name || "Guest User",
      age: parseInt(age) || 28,
      gender,
      preferredGender: 'all',
      location: "Tel Aviv",
      relationshipGoal: 'casual',
      premium: false,
    });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, we would make an API call to register
    login({
      id: "1",
      name,
      age: parseInt(age),
      gender,
      preferredGender: 'all',
      location: "Tel Aviv",
      relationshipGoal: 'casual',
      premium: false,
    });
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 dating-card">
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 bg-gradient-dating rounded-full flex items-center justify-center mb-4">
          <Heart className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-bold dating-gradient-text">VoiceMatch</h1>
        <p className="text-gray-600 mt-2">Connect through conversations</p>
      </div>

      <Tabs defaultValue="login">
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full dating-button">
              Login
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-name">Name</Label>
              <Input
                id="register-name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-age">Age</Label>
              <Input
                id="register-age"
                type="number"
                min="18"
                max="120"
                placeholder="Your age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-gender">Gender</Label>
              <select
                id="register-gender"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other')}
                required
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Password</Label>
              <Input
                id="register-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full dating-button">
              Register
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AuthForm;
