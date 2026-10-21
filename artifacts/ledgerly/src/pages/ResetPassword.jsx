import React from 'react';
import { Navigate } from 'react-router-dom';

/** Redirect old recovery URLs to Clerk instead of accepting legacy reset tokens. */
export default function ResetPassword() {
  return <Navigate to="/sign-in" replace />;
}
