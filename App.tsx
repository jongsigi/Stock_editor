
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

  // Load data from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedFiles = await getAllFilesFromDB();
        setFiles(storedFiles);
      } catch (error) {
        console.error("Failed to load data from IndexedDB", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleUpload = async (newFiles: UploadedFile[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    // Save each file to IndexedDB
    for (const file of newFiles) {
      await saveFileToDB(file);
    }
  };

  const handleDelete = async (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    await deleteFileFromDB(id);
  };

  const handleClear = async () => {
    setFiles([]);
    await clearAllFilesFromDB();
    setActiveTab('data'); // Reset to data management tab
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
          <p className="text-slate-500 font-medium">저장된 데이터를 불러오는 중...</p>
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
        &copy; 2024 StockInsight Dashboard. 브라우저 로컬 저장소(IndexedDB)에 데이터가 안전하게 보관됩니다.
      </footer>
    </div>
  );
};

export default App;
