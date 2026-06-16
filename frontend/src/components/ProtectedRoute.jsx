import React from 'react';
import { Navigate } from 'react-router-dom';
import { getSessionToken } from '../utils/api';

const ProtectedRoute = ({ children }) => {
  const token = getSessionToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
