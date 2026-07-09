import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';

const VALID_MODULES = new Set(['food', 'quickCommerce', 'porter']);

export default function ModuleEnabledRoute({ moduleKey, fallbackTo = '/food/user', children }) {
  const { settings, loading } = useSettings();

  if (!VALID_MODULES.has(moduleKey)) {
    return <Navigate to={fallbackTo} replace />;
  }

  if (loading) {
    return null;
  }

  if (settings?.modules?.[moduleKey] === false) {
    return <Navigate to={fallbackTo} replace />;
  }

  return children;
}
