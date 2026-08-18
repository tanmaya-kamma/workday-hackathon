import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api.js';

const AuthContext = createContext(null);

const STORAGE_KEY = 'leavetrack_auth_user';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load user from localStorage:', e);
    }
    return null;
  });

  useEffect(() => {
    if (currentUser) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
      } catch (e) {
        console.error('Failed to save user to localStorage:', e);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('wd_token');
    }
  }, [currentUser]);

  // Synchronize token expiration logout events
  useEffect(() => {
    const handleLogoutEvent = () => {
      setCurrentUser(null);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('wd_token');
    };
    window.addEventListener('auth_logout', handleLogoutEvent);
    return () => window.removeEventListener('auth_logout', handleLogoutEvent);
  }, []);

  const login = async (email, password) => {
    try {
      const cleanEmail = email.trim();
      const res = await api.post('/auth/login', {
        email: cleanEmail,
        password: password,
      });

      const { access_token, user: profile } = res.data;
      localStorage.setItem('wd_token', access_token);

      // Map backend UserProfile schema to frontend user object
      const formattedUser = {
        id: profile.id,
        _id: profile.id,
        name: profile.full_name,
        full_name: profile.full_name,
        email: profile.email,
        role: profile.role,
        department: profile.department || 'Engineering',
        region: profile.region || 'IN',
        employee_id: profile.employee_id,
        employeeId: profile.employee_id,
        managerId: profile.manager_id,
        manager_id: profile.manager_id,
        position: profile.role === 'manager' ? 'Team Lead / Manager' : (profile.role === 'hr' ? 'HR Administrator' : 'Staff Member'),
        avatar: profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=0875e1&color=fff`,
        leave_balances: profile.leave_balances || { annual: 20, sick: 12, casual: 6, unpaid: 0 },
        balances: {
          annual: { total: profile.leave_balances?.annual ?? 20, remaining: profile.leave_balances?.annual ?? 20, used: 0 },
          sick: { total: profile.leave_balances?.sick ?? 12, remaining: profile.leave_balances?.sick ?? 12, used: 0 },
          casual: { total: profile.leave_balances?.casual ?? 6, remaining: profile.leave_balances?.casual ?? 6, used: 0 },
          unpaid: { total: 0, remaining: 999, used: 0 },
        },
      };

      setCurrentUser(formattedUser);
      return { success: true, user: formattedUser };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.detail || 'Invalid credentials. Please verify your email and password.',
      };
    }
  };

  const loginAsRole = async (roleKey) => {
    let creds = { email: 'john.doe@company.com', password: 'employee123' };
    if (roleKey === 'manager' || roleKey === 'manager2') {
      creds = { email: 'sarah.manager@company.com', password: 'manager123' };
    } else if (roleKey === 'hr') {
      creds = { email: 'helen.hr@company.com', password: 'hr123' };
    }
    return await login(creds.email, creds.password);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('wd_token');
  };

  const value = {
    currentUser,
    role: currentUser?.role || null,
    isAuthenticated: Boolean(currentUser),
    login,
    loginAsRole,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
