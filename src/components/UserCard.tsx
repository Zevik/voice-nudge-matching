
import React from 'react';
import { User } from '@/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';

interface UserCardProps {
  user: User;
  onLike: (userId: string) => void;
  isLiked?: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ user, onLike, isLiked = false }) => {
  return (
    <Card className="w-full max-w-sm overflow-hidden transition-all hover:shadow-md">
      <div className="aspect-[3/4] w-full overflow-hidden">
        <img 
          src={user.profilePicture || "/placeholder.svg"} 
          alt={user.name} 
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.svg";
          }}
        />
      </div>
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">{user.name}, {user.age}</h3>
            <p className="text-sm text-gray-500">{user.location}</p>
          </div>
        </div>
        {user.bio && (
          <p className="mt-2 text-sm text-gray-700 line-clamp-2">{user.bio}</p>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-end">
        <Button 
          onClick={() => onLike(user.id)}
          variant={isLiked ? "default" : "outline"}
          size="sm"
          className={isLiked ? "bg-red-500 hover:bg-red-600" : "hover:bg-red-100"}
        >
          <Heart className={isLiked ? "text-white" : "text-red-500"} size={18} />
          {isLiked ? "לייק!" : "לייק"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default UserCard;
