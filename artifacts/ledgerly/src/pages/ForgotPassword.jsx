import React from 'react';
import { Navigate } from 'react-router-dom';

/** Clerk's sign-in component owns its supported password recovery flow. */
export default function ForgotPassword() {
  return <Navigate to="/sign-in" replace />;
}
