
export interface User {
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  preferredGender: 'male' | 'female' | 'both' | 'all';
  location: string;
  bio?: string;
  profilePicture?: string;
  relationshipGoal: 'serious' | 'casual' | 'friendship';
  premium: boolean;
}

export interface Match {
  id: string;
  userId: string;
  matchedUserId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt: Date;
}

export interface Call {
  id: string;
  matchId: string;
  type: 'voice' | 'video';
  status: 'pending' | 'active' | 'completed' | 'rejected';
  startTime?: Date;
  endTime?: Date;
  duration: number; // in seconds
}

export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  callId: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: Date;
}

export interface AppState {
  currentUser?: User;
  currentMatch?: Match;
  currentCall?: Call;
  isSearchingMatch: boolean;
  callTimeRemaining: number;
  callStage: 'none' | 'preparing' | 'voice' | 'video' | 'decision';
}

// Database schema types that match Supabase structure
export interface DbMatch {
  id: string;
  user_id: string;
  matched_user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  call_id: string | null;
  reason: string;
  status: string;
  created_at: string;
}
