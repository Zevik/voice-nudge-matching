
import React, { useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import Header from '@/components/Header';
import AuthForm from '@/components/AuthForm';
import MatchFinder from '@/components/MatchFinder';
import CallInterface from '@/components/CallInterface';
import ProfileSection from '@/components/ProfileSection';
import UsersGallery from '@/components/UsersGallery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  const { state } = useApp();
  const { currentUser, callStage } = state;

  // Update site URL for proper redirects if not already set
  useEffect(() => {
    const updateSiteUrl = async () => {
      // Get current URL
      const currentUrl = window.location.origin;
      
      // Check if we're in a browser environment
      if (typeof window !== 'undefined' && window.localStorage) {
        // Get stored URL
        const storedUrl = localStorage.getItem('siteUrl');
        
        // Only update if URL has changed
        if (storedUrl !== currentUrl) {
          localStorage.setItem('siteUrl', currentUrl);
          console.log('Site URL updated to:', currentUrl);
        }
      }
    };

    updateSiteUrl();
  }, []);

  // If user is not logged in, show auth form
  if (!currentUser) {
    return (
      <div className="min-h-screen py-10 px-4 bg-dating-background" dir="rtl">
        <AuthForm />
      </div>
    );
  }

  // If user is in a call, show call interface
  if (callStage !== 'none') {
    return (
      <div className="min-h-screen py-6 px-4 bg-dating-background" dir="rtl">
        <Header />
        <CallInterface />
      </div>
    );
  }

  // Normal logged-in view with tabs
  return (
    <div className="min-h-screen py-6 px-4 bg-dating-background" dir="rtl">
      <Header />
      
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="users">משתמשים</TabsTrigger>
          <TabsTrigger value="match">התאמות</TabsTrigger>
          <TabsTrigger value="profile">פרופיל</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users" className="focus-visible:outline-none focus-visible:ring-0">
          <UsersGallery />
        </TabsContent>
        
        <TabsContent value="match" className="focus-visible:outline-none focus-visible:ring-0">
          <MatchFinder />
        </TabsContent>
        
        <TabsContent value="profile" className="focus-visible:outline-none focus-visible:ring-0">
          <ProfileSection />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
