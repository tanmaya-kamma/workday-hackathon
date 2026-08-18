import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { Select } from '../../components/common/Select.jsx';

export function SignupPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: 'Engineering',
    password: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Redirect to login with prefill message
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f5f7f8] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-[#dfe5e8] p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="w-12 h-12 rounded-full bg-[#087f8c] text-white flex items-center justify-center mb-2 shadow-sm">
            <span className="material-symbols-outlined text-[24px]">person_add</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0f1d27]">Create Workspace Account</h1>
          <p className="text-sm text-[#5c6574]">Join the LeaveTrack enterprise workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="signup-name"
            label="Full Name"
            placeholder="Jane Doe"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            id="signup-email"
            label="Work Email Address"
            type="email"
            placeholder="jane.doe@company.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />

          <Select
            id="signup-dept"
            label="Department"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            options={[
              { value: 'Engineering', label: 'Engineering' },
              { value: 'Marketing', label: 'Marketing' },
              { value: 'Sales', label: 'Sales' },
              { value: 'Operations', label: 'Operations' },
              { value: 'HR', label: 'Human Resources' },
            ]}
          />

          <Input
            id="signup-pass"
            label="Create Password"
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />

          <Button type="submit" variant="primary" size="lg" className="w-full mt-2">
            Create Account
          </Button>
        </form>

        <div className="text-center text-xs text-[#0f1d27]">
          Already have an account?{' '}
          <Link to="/login" className="text-[#00646f] font-semibold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
