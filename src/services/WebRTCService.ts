
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';

type IceCandidate = {
  sdpMLineIndex: number | null;
  sdpMid: string | null;
  candidate: string;
};

type SignalData = {
  type: 'offer' | 'answer' | 'candidate';
  data: RTCSessionDescriptionInit | IceCandidate;
  from: string;
  to: string;
  callId: string;
};

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentUser: User | null = null;
  private matchedUser: User | null = null;
  private callId: string | null = null;
  private callType: 'voice' | 'video' | null = null;
  private supabaseChannel: any = null;
  
  // Event callbacks
  private onLocalStreamReady: ((stream: MediaStream) => void) | null = null;
  private onRemoteStreamReady: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null = null;
  private onCallEnded: (() => void) | null = null;
  private onError: ((error: Error) => void) | null = null;

  constructor() {
    // Configure STUN servers for NAT traversal
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };
    
    try {
      this.peerConnection = new RTCPeerConnection(configuration);
    } catch (error) {
      console.error('Failed to create RTCPeerConnection:', error);
    }
  }

  public setEventHandlers(handlers: {
    onLocalStreamReady?: (stream: MediaStream) => void;
    onRemoteStreamReady?: (stream: MediaStream) => void;
    onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
    onCallEnded?: () => void;
    onError?: (error: Error) => void;
  }) {
    this.onLocalStreamReady = handlers.onLocalStreamReady || null;
    this.onRemoteStreamReady = handlers.onRemoteStreamReady || null;
    this.onConnectionStateChange = handlers.onConnectionStateChange || null;
    this.onCallEnded = handlers.onCallEnded || null;
    this.onError = handlers.onError || null;
  }

  public async initializeCall(
    currentUser: User,
    matchedUser: User,
    callId: string,
    callType: 'voice' | 'video',
    isInitiator: boolean
  ) {
    try {
      this.currentUser = currentUser;
      this.matchedUser = matchedUser;
      this.callId = callId;
      this.callType = callType;

      // Set up RTCPeerConnection event listeners
      this.setupPeerConnectionListeners();

      // Get local media stream (audio or audio+video)
      await this.getLocalMedia();

      // Setup Supabase channel for signaling
      this.setupSignaling();

      // If this user is initiating the call, create and send an offer
      if (isInitiator) {
        await this.createAndSendOffer();
      }
      
      return true;
    } catch (error) {
      console.error('Error initializing call:', error);
      if (this.onError) this.onError(error as Error);
      return false;
    }
  }

  private setupPeerConnectionListeners() {
    if (!this.peerConnection) return;

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'candidate',
          data: {
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
          },
          from: this.currentUser?.id || '',
          to: this.matchedUser?.id || '',
          callId: this.callId || '',
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.onConnectionStateChange && this.peerConnection) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }

      // Handle call ending (on disconnect)
      if (
        this.peerConnection &&
        (this.peerConnection.connectionState === 'disconnected' ||
          this.peerConnection.connectionState === 'failed' ||
          this.peerConnection.connectionState === 'closed')
      ) {
        if (this.onCallEnded) this.onCallEnded();
      }
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      if (this.onRemoteStreamReady) this.onRemoteStreamReady(this.remoteStream);
    };
  }

  private async getLocalMedia() {
    try {
      const constraints = {
        audio: true,
        video: this.callType === 'video',
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (this.onLocalStreamReady) this.onLocalStreamReady(this.localStream);
      
      // Add local stream tracks to peer connection
      if (this.localStream && this.peerConnection) {
        this.localStream.getTracks().forEach(track => {
          if (this.localStream && this.peerConnection) {
            this.peerConnection.addTrack(track, this.localStream);
          }
        });
      }
    } catch (error) {
      console.error('Error getting local media:', error);
      throw error;
    }
  }

  private setupSignaling() {
    // Create a unique channel name based on the call ID
    const channelName = `call_${this.callId}`;
    
    // Create Supabase Realtime channel for signaling
    this.supabaseChannel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'signal' }, async (payload) => {
        const signal = payload.payload as SignalData;
        
        // Only process signals intended for this user
        if (signal.to !== this.currentUser?.id) return;
        
        try {
          if (signal.type === 'offer' && this.peerConnection) {
            await this.peerConnection.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.sendSignal({
              type: 'answer',
              data: answer,
              from: this.currentUser?.id || '',
              to: this.matchedUser?.id || '',
              callId: this.callId || '',
            });
          }
          else if (signal.type === 'answer' && this.peerConnection) {
            await this.peerConnection.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
          }
          else if (signal.type === 'candidate' && this.peerConnection) {
            const candidate = signal.data as IceCandidate;
            await this.peerConnection.addIceCandidate(
              new RTCIceCandidate({
                sdpMLineIndex: candidate.sdpMLineIndex,
                sdpMid: candidate.sdpMid,
                candidate: candidate.candidate,
              })
            );
          }
        } catch (error) {
          console.error('Error processing signal:', error);
          if (this.onError) this.onError(error as Error);
        }
      })
      .subscribe();
  }

  private async createAndSendOffer() {
    if (!this.peerConnection) return;
    
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.sendSignal({
        type: 'offer',
        data: offer,
        from: this.currentUser?.id || '',
        to: this.matchedUser?.id || '',
        callId: this.callId || '',
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      if (this.onError) this.onError(error as Error);
    }
  }

  private sendSignal(signal: SignalData) {
    if (!this.supabaseChannel) return;
    
    this.supabaseChannel.send({
      type: 'broadcast',
      event: 'signal',
      payload: signal,
    });
  }

  public toggleMute(muted: boolean) {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public setVolume(volume: number) {
    // Volume can only be controlled on the media element in the UI
    // We'll handle this in the UI component
    return volume;
  }

  public async endCall() {
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    // Stop local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    
    // Unsubscribe from Supabase channel
    if (this.supabaseChannel) {
      await supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }
    
    // Reset call data
    this.callId = null;
    this.callType = null;
    this.matchedUser = null;
    
    if (this.onCallEnded) this.onCallEnded();
  }
}

export const webRTCService = new WebRTCService();
export default webRTCService;
