
import React, { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Header from '@/components/Header';
import AuthForm from '@/components/AuthForm';
import MatchFinder from '@/components/MatchFinder';
import CallInterface from '@/components/CallInterface';
import ProfileSection from '@/components/ProfileSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

const Index = () => {
  const { state } = useApp();
  const { currentUser, callStage } = state;

  // If user is not logged in, show auth form
  if (!currentUser) {
    return (
      <div className="min-h-screen py-10 px-4 bg-dating-background">
        <AuthForm />
      </div>
    );
  }

  // If user is in a call, show call interface
  if (callStage !== 'none') {
    return (
      <div className="min-h-screen py-6 px-4 bg-dating-background">
        <Header />
        <CallInterface />
      </div>
    );
  }

  // Normal logged-in view with tabs
  return (
    <div className="min-h-screen py-6 px-4 bg-dating-background">
      <Header />
      
      <Tabs defaultValue="match" className="w-full">
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="match">התאמה</TabsTrigger>
          <TabsTrigger value="profile">פרופיל</TabsTrigger>
        </TabsList>
        
        <TabsContent value="match">
          <MatchFinder />
        </TabsContent>
        
        <TabsContent value="profile">
          <ProfileSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
