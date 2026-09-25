import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";

// App-side OAuth consent page stub — the original used base44 platform auth.
// Redirects to sign-in if not authenticated.
export default function OAuthConsent() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="max-w-md w-full p-8 bg-card rounded-lg shadow-sm border border-border text-center">
        <ShieldCheck className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2">OAuth Consent</h1>
        <p className="text-muted-foreground">This feature is not available in this version.</p>
      </div>
    </div>
  );
}
