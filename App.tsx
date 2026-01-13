
import React, { useState, useMemo, useEffect } from 'react';
import Navigation from './components/Navigation';
import DataManagement from './components/DataManagement';
import Dashboard from './components/Dashboard';
import { UploadedFile, DataType } from './types';
import { getAllFilesFromDB, saveFileToDB, deleteFileFromDB, clearAllFilesFromDB } from './utils/db';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'data' | 'dashboard'>('data');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from IndexedDB on mount with improved error handling
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedFiles = await getAllFilesFromDB();
        if (storedFiles) {
          setFiles(storedFiles);
        }
      } catch (error) {
        console.error("Failed to load data from IndexedDB. This might be due to private browsing mode.", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleUpload = async (newFiles: UploadedFile[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    try {
      for (const file of newFiles) {
        await saveFileToDB(file);
      }
    } catch (error) {
      console.error("Storage limit exceeded or DB error", error);
      alert("데이터를 로컬 저장소에 저장하는 데 실패했습니다. 용량이 부족할 수 있습니다.");
    }
  };

  const handleDelete = async (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    try {
      await deleteFileFromDB(id);
    } catch (error) {
      console.error("Delete from DB failed", error);
    }
  };

  const handleClear = async () => {
    try {
      setFiles([]);
      await clearAllFilesFromDB();
      setActiveTab('data');
    } catch (error) {
      console.error("Clear DB failed", error);
      // Even if DB fails, clear memory
      setFiles([]);
      setActiveTab('data');
    }
  };

  const isReady = useMemo(() => {
    const requiredTypes = [DataType.SELECTED, DataType.TOTAL_TRADE, DataType.FOREIGNER, DataType.INSTITUTIONAL];
    return requiredTypes.every(type => files.some(f => f.type === type));
  }, [files]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-medium">로컬 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navigation 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isReady={isReady} 
      />
      
      <main className="flex-1">
        {activeTab === 'data' ? (
          <DataManagement 
            files={files} 
            onUpload={handleUpload} 
            onDelete={handleDelete} 
            onClear={handleClear}
          />
        ) : (
          <Dashboard files={files} onClear={handleClear} />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-400 text-sm">
        &copy; {new Date().getFullYear()} StockInsight Dashboard. 브라우저 저장소(IndexedDB)를 사용하며 서버에 데이터가 저장되지 않습니다.
      </footer>
    </div>
  );
};

export default App;
