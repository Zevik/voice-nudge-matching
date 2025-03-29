
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { Mic, Video, Phone, Flag, ThumbsUp, ThumbsDown, MicOff, Volume2, Volume1, VolumeX } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const CallInterface: React.FC = () => {
  const { state, endCall, makeDecision, reportUser } = useApp();
  const { callStage, callTimeRemaining, currentCall } = state;
  const [reportReason, setReportReason] = useState("");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1); // 1 = full volume, 0 = muted
  const { toast } = useToast();
  
  // Refs for audio/video
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Format time remaining as mm:ss
  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Setup camera/mic
  useEffect(() => {
    if (callStage === 'voice' || callStage === 'video') {
      const setupMedia = async () => {
        try {
          // Get user media based on call type
          const constraints = {
            audio: true,
            video: callStage === 'video'
          };
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          localStreamRef.current = stream;
          
          // If it's a video call, set up local video
          if (callStage === 'video' && localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          
          // In a real implementation, we would now connect to peer
          // For demo, simulate remote connection
          simulateRemoteConnection();
          
          toast({
            title: `${callStage === 'voice' ? 'שיחה קולית' : 'שיחת וידאו'} מוכנה`,
            description: `מכרופון ו${callStage === 'video' ? 'מצלמה ' : ''}מופעלים`
          });
        } catch (error) {
          console.error('Error setting up media:', error);
          toast({
            title: 'שגיאה בהגדרת המדיה',
            description: 'לא ניתן לגשת למצלמה או למיקרופון',
            variant: 'destructive'
          });
        }
      };
      
      setupMedia();
    }
    
    // Cleanup on unmount
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, [callStage]);

  // Simulate a remote connection (for demo purposes)
  const simulateRemoteConnection = () => {
    // In a real app, this would involve WebRTC or other tech to connect peers
    console.log('Simulating remote connection...');
  };

  // Handle muting
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        track.enabled = isMuted; // Enable if currently muted, disable if unmuted
        setIsMuted(!isMuted);
        
        toast({
          title: isMuted ? 'מיקרופון מופעל' : 'מיקרופון מושתק',
          description: isMuted ? 'אחרים יכולים לשמוע אותך עכשיו' : 'אחרים לא יכולים לשמוע אותך'
        });
      }
    }
  };

  // Handle volume change
  const changeVolume = () => {
    // Toggle between 3 volume levels
    let newVolume = 0;
    if (volume === 0) newVolume = 0.5;
    else if (volume === 0.5) newVolume = 1;
    else newVolume = 0;
    
    setVolume(newVolume);
    
    // In a real implementation, we would adjust the remote audio volume
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = newVolume;
    }
    
    toast({
      title: newVolume === 0 ? 'קול מושתק' : newVolume === 0.5 ? 'קול נמוך' : 'קול מלא',
    });
  };

  const handleReport = () => {
    if (reportReason.trim()) {
      reportUser("2", reportReason); // Using mock ID for reported user
      setReportDialogOpen(false);
    }
  };

  // Preparation stage - quick tips before starting the call
  if (callStage === 'preparing') {
    return (
      <div className="dating-card flex flex-col items-center gap-6 max-w-md w-full mx-auto">
        <h2 className="text-2xl font-bold dating-gradient-text">Getting Ready...</h2>
        <div className="bg-dating-light p-4 rounded-lg w-full">
          <h3 className="font-semibold text-lg mb-2">Quick Tips:</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li>Be yourself and stay authentic</li>
            <li>Listen actively and ask questions</li>
            <li>Keep the conversation light and positive</li>
            <li>Respect the other person's boundaries</li>
          </ul>
        </div>
        <p className="text-sm text-gray-500 text-center">
          Your call will begin in a few seconds...
        </p>
      </div>
    );
  }

  // Voice call stage
  if (callStage === 'voice') {
    return (
      <div className="dating-card flex flex-col items-center gap-6 max-w-md w-full mx-auto">
        <div className="w-full flex justify-between items-center">
          <span className="text-sm font-medium text-gray-500">Voice Call</span>
          <span className="font-mono text-dating-primary font-bold">
            {formatTimeRemaining(callTimeRemaining)}
          </span>
        </div>
        
        <div className="w-32 h-32 bg-gradient-dating rounded-full flex items-center justify-center shadow-lg">
          <Mic className="text-white" size={48} />
        </div>
        
        <p className="text-lg font-medium">שיחה עם מישהו חדש</p>
        
        <div className="flex items-center gap-4 mt-4">
          <Button 
            onClick={toggleMute}
            variant="outline" 
            className={`rounded-full h-12 w-12 p-0 flex items-center justify-center ${isMuted ? 'border-dating-danger text-dating-danger' : ''}`}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </Button>
          
          <Button 
            onClick={changeVolume}
            variant="outline" 
            className="rounded-full h-12 w-12 p-0 flex items-center justify-center"
          >
            {volume === 0 ? <VolumeX size={20} /> : 
             volume === 0.5 ? <Volume1 size={20} /> : 
             <Volume2 size={20} />}
          </Button>
          
          <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="rounded-full h-12 w-12 p-0 flex items-center justify-center border-dating-danger text-dating-danger"
              >
                <Flag size={20} />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>דווח על משתמש</DialogTitle>
                <DialogDescription>
                  תאר מדוע אתה מדווח על משתמש זה. הדיווח ייבדק על ידי צוות המנהלים שלנו.
                </DialogDescription>
              </DialogHeader>
              <Textarea 
                value={reportReason} 
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="אנא ספק פרטים על הבעיה..."
                className="min-h-[100px]"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setReportDialogOpen(false)}>ביטול</Button>
                <Button onClick={handleReport} variant="destructive">שלח דיווח</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button 
            onClick={endCall} 
            className="rounded-full h-14 w-14 p-0 flex items-center justify-center bg-dating-danger hover:bg-red-700"
          >
            <Phone size={24} className="rotate-135" />
          </Button>
        </div>
        
        <p className="text-sm text-gray-500 text-center">
          השיחה תסתיים אוטומטית כאשר הטיימר מגיע ל-0:00
        </p>
      </div>
    );
  }

  // Video call stage
  if (callStage === 'video') {
    return (
      <div className="dating-card flex flex-col items-center gap-6 max-w-md w-full mx-auto">
        <div className="w-full flex justify-between items-center">
          <span className="text-sm font-medium text-gray-500">Video Call</span>
          <span className="font-mono text-dating-primary font-bold">
            {formatTimeRemaining(callTimeRemaining)}
          </span>
        </div>
        
        <div className="w-full aspect-video bg-gray-200 rounded-lg relative overflow-hidden">
          {/* This would be the video stream in a real implementation */}
          <video 
            ref={remoteVideoRef}
            autoPlay 
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Small self-view */}
          <div className="absolute bottom-4 right-4 w-1/4 aspect-video bg-gray-300 rounded-md overflow-hidden">
            <video 
              ref={localVideoRef}
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-2">
          <Button 
            onClick={toggleMute}
            variant="outline" 
            className={`rounded-full h-10 w-10 p-0 flex items-center justify-center ${isMuted ? 'border-dating-danger text-dating-danger' : ''}`}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </Button>
          
          <Button 
            onClick={changeVolume}
            variant="outline" 
            className="rounded-full h-10 w-10 p-0 flex items-center justify-center"
          >
            {volume === 0 ? <VolumeX size={18} /> : 
             volume === 0.5 ? <Volume1 size={18} /> : 
             <Volume2 size={18} />}
          </Button>
          
          <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                className="rounded-full h-10 w-10 p-0 flex items-center justify-center border-dating-danger text-dating-danger"
              >
                <Flag size={18} />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>דווח על משתמש</DialogTitle>
                <DialogDescription>
                  תאר מדוע אתה מדווח על משתמש זה. הדיווח ייבדק על ידי צוות המנהלים שלנו.
                </DialogDescription>
              </DialogHeader>
              <Textarea 
                value={reportReason} 
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="אנא ספק פרטים על הבעיה..."
                className="min-h-[100px]"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setReportDialogOpen(false)}>ביטול</Button>
                <Button onClick={handleReport} variant="destructive">שלח דיווח</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button 
            onClick={endCall} 
            className="rounded-full h-12 w-12 p-0 flex items-center justify-center bg-dating-danger hover:bg-red-700"
          >
            <Phone size={20} className="rotate-135" />
          </Button>
        </div>
        
        <p className="text-sm text-gray-500 text-center">
          שיחת הוידאו תסתיים אוטומטית כאשר הטיימר יגיע ל-0:00
        </p>
      </div>
    );
  }

  // Decision stage after call ends
  if (callStage === 'decision') {
    return (
      <div className="dating-card flex flex-col items-center gap-6 max-w-md w-full mx-auto">
        <h2 className="text-2xl font-bold dating-gradient-text">Call Ended</h2>
        
        <p className="text-lg text-center">
          Would you like to continue with this match?
        </p>
        
        <div className="grid grid-cols-2 gap-4 w-full mt-4">
          <Button 
            onClick={() => makeDecision('end')} 
            variant="outline"
            className="border-dating-danger text-dating-danger hover:bg-dating-danger hover:text-white flex items-center justify-center gap-2"
          >
            <ThumbsDown size={20} />
            End
          </Button>
          
          <Button 
            onClick={() => makeDecision('continue')} 
            className="dating-button flex items-center justify-center gap-2"
          >
            <ThumbsUp size={20} />
            Continue
          </Button>
        </div>
        
        {currentCall?.type === 'voice' && (
          <p className="text-sm text-gray-500 text-center">
            If you both choose "Continue", you'll move to a video call next!
          </p>
        )}
        
        {currentCall?.type === 'video' && (
          <p className="text-sm text-gray-500 text-center">
            If you both choose "Continue", you'll be able to exchange contact information!
          </p>
        )}
        
        <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="link" 
              className="text-dating-danger"
            >
              <Flag size={16} className="mr-1" />
              Report this user
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report User</DialogTitle>
              <DialogDescription>
                Describe why you're reporting this user. This will be reviewed by our moderation team.
              </DialogDescription>
            </DialogHeader>
            <Textarea 
              value={reportReason} 
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Please provide details about the issue..."
              className="min-h-[100px]"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReportDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleReport} variant="destructive">Submit Report</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Fallback - should never happen
  return <div>Invalid call stage</div>;
};

export default CallInterface;
