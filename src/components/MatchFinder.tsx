
import React from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { Mic, Video, Search, X } from 'lucide-react';

const MatchFinder: React.FC = () => {
  const { state, startSearchingMatch, stopSearchingMatch, acceptMatch, rejectMatch } = useApp();
  const { isSearchingMatch, currentMatch } = state;

  return (
    <div className="dating-card flex flex-col items-center gap-6 max-w-md w-full mx-auto">
      {!isSearchingMatch && !currentMatch && (
        <>
          <h2 className="text-2xl font-bold dating-gradient-text">Ready to Connect?</h2>
          <p className="text-center text-gray-600">
            Find someone available right now for a quick voice chat.
          </p>
          <div className="mt-4 w-full">
            <Button 
              onClick={startSearchingMatch} 
              className="w-full dating-button flex items-center justify-center gap-2"
            >
              <Search size={20} />
              Start Searching
            </Button>
          </div>
        </>
      )}

      {isSearchingMatch && !currentMatch && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24 bg-dating-light rounded-full flex items-center justify-center">
            <div className="absolute w-full h-full rounded-full bg-dating-primary opacity-20 animate-pulse-slow"></div>
            <Search className="text-dating-primary" size={40} />
          </div>
          <h2 className="text-xl font-semibold">Searching for matches...</h2>
          <p className="text-gray-600 text-center">
            We're looking for someone available right now.
          </p>
          <Button 
            onClick={stopSearchingMatch} 
            variant="outline"
            className="mt-2"
          >
            Cancel
          </Button>
        </div>
      )}

      {currentMatch && currentMatch.status === 'pending' && (
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-24 h-24 bg-dating-light rounded-full flex items-center justify-center">
            <Mic className="text-dating-primary" size={40} />
          </div>
          <h2 className="text-xl font-semibold">Match Found!</h2>
          <p className="text-gray-600 text-center">
            Someone is available for a voice chat right now.
          </p>
          <div className="flex gap-4 mt-2">
            <Button
              onClick={() => rejectMatch(currentMatch.id)}
              variant="outline"
              className="border-dating-danger text-dating-danger hover:bg-dating-danger hover:text-white"
            >
              <X className="mr-2" size={16} />
              Decline
            </Button>
            <Button
              onClick={() => acceptMatch(currentMatch.id)}
              className="dating-button"
            >
              <Mic className="mr-2" size={16} />
              Start Voice Chat
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchFinder;
