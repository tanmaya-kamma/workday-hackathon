import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button.jsx';
import { Card } from '../../components/common/Card.jsx';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="py-16 flex items-center justify-center">
      <Card className="max-w-md text-center p-8">
        <div className="w-16 h-16 bg-[#ebf5ff] text-[#00646f] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[32px]">error</span>
        </div>
        <h1 className="text-2xl font-bold text-[#0f1d27] mb-1">Page Not Found</h1>
        <p className="text-xs text-[#687781] mb-6">
          The requested page route could not be found or has been moved.
        </p>
        <Button variant="primary" icon="home" onClick={() => navigate('/')}>
          Return Home
        </Button>
      </Card>
    </div>
  );
}
