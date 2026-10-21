import React from 'react';
import { Navigate } from 'react-router-dom';

/** Legacy URL alias; authentication is handled by Clerk's mounted sign-in flow. */
export default function Login() {
  return <Navigate to="/sign-in" replace />;
}
