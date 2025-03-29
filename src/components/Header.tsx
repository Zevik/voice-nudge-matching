
import React from 'react';
import { useApp } from '@/context/AppContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart } from 'lucide-react';

const Header: React.FC = () => {
  const { state } = useApp();
  const { currentUser } = state;

  return (
    <div className="flex justify-between items-center p-4 mb-6">
      <div className="flex items-center gap-2">
        <Heart className="text-dating-primary" size={24} />
        <h1 className="text-2xl font-bold dating-gradient-text">VoiceMatch</h1>
      </div>
      
      {currentUser && (
        <Avatar className="w-10 h-10 border-2 border-white shadow">
          <AvatarImage src={currentUser.profilePicture} alt={currentUser.name} />
          <AvatarFallback className="bg-dating-primary text-white">
            {currentUser.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default Header;
