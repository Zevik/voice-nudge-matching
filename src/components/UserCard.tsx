
import React from 'react';
import { User } from '@/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserCardProps {
  user: User;
  onLike: (userId: string) => void;
  isLiked?: boolean;
}

const UserCard: React.FC<UserCardProps> = ({ user, onLike, isLiked = false }) => {
  return (
    <Card className="w-full max-w-sm overflow-hidden transition-all hover:shadow-md" dir="rtl">
      <div className="aspect-[3/4] w-full overflow-hidden relative">
        <img 
          src={user.profilePicture || "/placeholder.svg"} 
          alt={user.name} 
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.svg";
          }}
        />
        {user.premium && (
          <Badge className="absolute top-2 right-2 bg-yellow-400 text-black">
            פרימיום
          </Badge>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium">{user.name}, {user.age}</h3>
            <p className="text-sm text-gray-500">{user.location}</p>
          </div>
          <div className="flex flex-col items-end">
            <Badge variant="outline" className="mb-1">
              {user.gender === 'male' ? 'גבר' : user.gender === 'female' ? 'אישה' : 'אחר'}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {user.relationshipGoal === 'serious' ? 'רציני' : 
               user.relationshipGoal === 'casual' ? 'קשר קליל' : 'חברות'}
            </Badge>
          </div>
        </div>
        
        {user.preferredGender && user.preferredGender !== 'all' && (
          <div className="mt-2 text-xs text-gray-500 flex items-center">
            <UserIcon size={14} className="ml-1" />
            מחפש/ת: 
            {user.preferredGender === 'male' ? ' גברים' : 
             user.preferredGender === 'female' ? ' נשים' : 
             user.preferredGender === 'both' ? ' גברים ונשים' : ' הכל'}
          </div>
        )}
        
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
