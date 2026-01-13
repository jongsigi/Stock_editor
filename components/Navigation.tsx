
import React from 'react';

interface Props {
  activeTab: 'data' | 'dashboard';
  setActiveTab: (tab: 'data' | 'dashboard') => void;
  isReady: boolean;
}

const Navigation: React.FC<Props> = ({ activeTab, setActiveTab, isReady }) => {
  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold text-blue-600 flex items-center">
              <span className="mr-2 text-2xl">📈</span> StockInsight
            </h1>
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('data')}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'data' 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                📊 데이터 관리
              </button>
              <button
                onClick={() => {
                  if (isReady) setActiveTab('dashboard');
                  else alert('모든 필수 데이터(1~4번)를 먼저 업로드해주세요.');
                }}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'dashboard' 
                    ? 'bg-blue-50 text-blue-700' 
                    : isReady 
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50' 
                      : 'text-slate-300 cursor-not-allowed'
                }`}
              >
                📈 대시보드
              </button>
            </div>
          </div>
          <div className="flex items-center">
            {isReady ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ● 데이터 준비 완료
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                ○ 데이터 부족
              </span>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
