
import React from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Settings, LogOut } from 'lucide-react';

const ProfileSection: React.FC = () => {
  const { state, logout } = useApp();
  const { currentUser } = state;

  if (!currentUser) {
    return null;
  }

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
          <Badge className="absolute -bottom-1 right-0 bg-gradient-dating">Premium</Badge>
        )}
      </div>
      
      <h2 className="text-xl font-bold">{currentUser.name}, {currentUser.age}</h2>
      <p className="text-gray-600 mb-4">{currentUser.location}</p>
      
      <div className="grid grid-cols-2 gap-4 w-full">
        <Button variant="outline" className="flex items-center gap-2">
          <Settings size={16} />
          Settings
        </Button>
        <Button variant="outline" className="flex items-center gap-2" onClick={logout}>
          <LogOut size={16} />
          Logout
        </Button>
      </div>
      
      {!currentUser.premium && (
        <div className="mt-6 w-full p-4 bg-dating-light rounded-lg">
          <h3 className="font-medium text-center mb-2">Upgrade to Premium</h3>
          <p className="text-sm text-gray-600 text-center mb-3">
            Get unlimited calls, longer video chats, and priority matching
          </p>
          <Button className="w-full dating-button">
            Upgrade Now
          </Button>
        </div>
      )}
    </div>
  );
};

export default ProfileSection;
