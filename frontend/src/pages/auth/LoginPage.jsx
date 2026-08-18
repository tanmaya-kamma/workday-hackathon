import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Input } from '../../components/common/Input.jsx';
import { getRoleHome } from '../../utils/roleUtils.js';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate(getRoleHome(result.user.role), { replace: true });
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 sm:p-6">

      {/* ================================================================
          BACKGROUND IMAGE
          ================================================================ */}

      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.999]"
        style={{
          backgroundImage: "url('/images/leave-track-login-bg.png')",
        }}
      />

      {/* ================================================================
          LIGHT OVERLAY
          ================================================================ */}

      <div className="absolute inset-0 bg-[#f7fafc]/75" />

      {/* Soft blue atmospheric layer */}

      <div className="absolute inset-0 bg-gradient-to-br from-[#eef7ff]/50 via-white/40 to-[#edf7f3]/50" />

      {/* Subtle orange accent */}

      <div className="absolute top-[12%] right-[10%] w-40 h-40 rounded-full bg-[#f47b20]/10 blur-3xl pointer-events-none" />

      <div className="absolute bottom-[10%] left-[8%] w-48 h-48 rounded-full bg-[#0875e1]/10 blur-3xl pointer-events-none" />


      {/* ================================================================
          LOGIN CARD
          ================================================================ */}

      <div className="relative z-10 w-full max-w-md">

        <div className="w-full bg-white/98 backdrop-blur-sm rounded-2xl shadow-[0_24px_70px_rgba(8,43,76,0.15)] border border-white/90 p-6 sm:p-8 flex flex-col gap-6">

          {/* Brand Header */}

          <div className="flex flex-col items-center gap-1.5 text-center">

            <div className="w-12 h-12 rounded-xl bg-[#0875e1] text-white flex items-center justify-center mb-2 shadow-sm">

              <span className="material-symbols-outlined text-[24px]">
                calendar_clock
              </span>

            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#002244]">
              LeaveTrack
            </h1>

            <p className="text-xs sm:text-sm text-[#5c6574]">
              Workday Enterprise Leave Management Portal
            </p>

          </div>


          {/* Form */}

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >

            {error && (

              <div className="p-3 bg-[#fce8e6] border border-[#c5221f]/30 rounded-xl text-xs text-[#c5221f]">

                {error}

              </div>

            )}


            <Input
              id="login-email"
              label="Email Address or Employee ID"
              type="text"
              placeholder="e.g. employee@company.com or EMP001"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon="mail"
              required
            />


            <div className="flex flex-col gap-1.5">

              <div className="flex justify-between items-center">

                <label
                  htmlFor="login-password"
                  className="text-xs font-semibold uppercase tracking-wider text-[#5c6574]"
                >
                  Password
                </label>

                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();

                    alert(
                      'Please contact your HR administrator to reset your corporate password.'
                    );
                  }}
                  className="text-xs text-[#0875e1] hover:underline"
                >
                  Forgot password?
                </a>

              </div>


              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon="lock"
                required
              />

            </div>


            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              icon="arrow_forward"
              iconPosition="right"
              className="w-full mt-2"
            >
              Sign In to LeaveTrack
            </Button>

          </form>


          {/* Footer */}

          <div className="text-center">

            <p className="text-xs text-[#5c6574]">
              Enterprise single sign-on secured with Workday IAM & MongoDB
            </p>

          </div>

        </div>


        {/* Subtle caption */}

        <div className="mt-4 text-center">

          <p className="text-[10px] font-medium text-[#526b80]">
            LeaveTrack • Connected absence management for modern teams
          </p>

        </div>

      </div>

    </div>
  );
}