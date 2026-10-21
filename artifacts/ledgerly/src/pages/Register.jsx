import React from 'react';
import { Navigate } from 'react-router-dom';

/** Legacy URL alias; authentication is handled by Clerk's mounted sign-up flow. */
export default function Register() {
  return <Navigate to="/sign-up" replace />;
}
