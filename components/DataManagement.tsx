
import React, { useState } from 'react';
import { DataType, UploadedFile } from '../types';
import { parseFileNameDate } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

interface Props {
  files: UploadedFile[];
  onUpload: (newFiles: UploadedFile[]) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const DataManagement: React.FC<Props> = ({ files, onUpload, onDelete, onClear }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<UploadedFile | null>(null);

  const determineType = (fileName: string, suggestedType: DataType): DataType => {
    const lowerName = fileName.toLowerCase();
    if (lowerName.startsWith('f_')) return DataType.FOREIGNER;
    if (lowerName.startsWith('inst_')) return DataType.INSTITUTIONAL;
    return suggestedType;
  };

  const processFiles = async (fileList: FileList, defaultType: DataType) => {
    setIsProcessing(true);
    const newUploadedFiles: UploadedFile[] = [];

    const promises = Array.from(fileList).map(async (file) => {
      const actualType = determineType(file.name, defaultType);
      
      return new Promise<UploadedFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(worksheet) as any[];

          resolve({
            id: Math.random().toString(36).substr(2, 9),
            type: actualType,
            name: file.name,
            rowCount: json.length,
            uploadTime: new Date().toLocaleString(),
            date: parseFileNameDate(file.name),
            data: json
          });
        };
        reader.readAsArrayBuffer(file);
      });
    });

    try {
      const results = await Promise.all(promises);
      onUpload(results);
    } catch (error) {
      console.error("File processing failed", error);
      alert("파일 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
      // Reset file input value to allow re-uploading the same file
      const inputs = document.querySelectorAll('input[type="file"]');
      inputs.forEach((input: any) => { input.value = ''; });
    }
  };

  const typeLabels = {
    [DataType.SELECTED]: '1. 선정 주식',
    [DataType.TOTAL_TRADE]: '2. 전체 거래대금',
    [DataType.FOREIGNER]: '3. 외국인 (f_)',
    [DataType.INSTITUTIONAL]: '4. 기관 (inst_)'
  };

  const handleGlobalClear = () => {
    if (confirm('모든 데이터를 삭제하시겠습니까? 업로드된 모든 파일과 분석 데이터가 초기화됩니다.')) {
      onClear();
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">데이터 관리</h2>
          <p className="text-sm text-slate-500 mt-1">
            외국인 데이터는 <code className="bg-slate-100 px-1 rounded">f_</code>, 기관 데이터는 <code className="bg-slate-100 px-1 rounded">inst_</code>로 시작하면 자동 분류됩니다.
          </p>
        </div>
        <button 
          onClick={handleGlobalClear}
          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-semibold border border-red-100"
        >
          전체 초기화
        </button>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-bold text-slate-800">대량 데이터를 분석 중입니다...</p>
            <p className="text-sm text-slate-500 mt-2">잠시만 기다려 주세요.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {(Object.entries(typeLabels) as [DataType, string][]).map(([type, label]) => (
          <div key={type} className="relative group">
            <input 
              type="file" 
              className="hidden" 
              id={`file-input-${type}`}
              accept=".xlsx, .xls"
              multiple
              onChange={(e) => e.target.files && processFiles(e.target.files, type)}
            />
            <label 
              htmlFor={`file-input-${type}`}
              className={`block border-2 border-dashed rounded-xl p-6 transition-all text-center cursor-pointer h-full ${
                files.some(f => f.type === type) 
                  ? 'border-blue-400 bg-blue-50/30' 
                  : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              <div className="text-3xl mb-3">
                {files.some(f => f.type === type) ? '📁' : '📥'}
              </div>
              <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">{label}</p>
              <p className="text-[10px] text-slate-400">여러 파일 동시 선택 가능</p>
            </label>
            {files.filter(f => f.type === type).length > 0 && (
              <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                {files.filter(f => f.type === type).length}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">업로드된 파일 목록 ({files.length})</h3>
        </div>
        
        {files.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200 text-slate-400 italic">
            업로드된 파일이 없습니다. 상단에서 파일을 추가해주세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {files.slice().reverse().map(file => (
              <div key={file.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <div className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    file.type === DataType.SELECTED ? 'bg-indigo-100 text-indigo-700' :
                    file.type === DataType.TOTAL_TRADE ? 'bg-emerald-100 text-emerald-700' :
                    file.type === DataType.FOREIGNER ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {typeLabels[file.type].split('.')[0]}번
                  </div>
                  <button onClick={() => onDelete(file.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <h4 className="font-bold text-slate-800 text-sm truncate mb-1" title={file.name}>{file.name}</h4>
                <div className="text-[11px] text-slate-500 space-y-0.5 flex-1">
                  <p>• {file.rowCount.toLocaleString()} 행</p>
                  {file.date && <p>• 20{file.date.substring(0,2)}-{file.date.substring(2,4)}-{file.date.substring(4,6)}</p>}
                </div>
                <button 
                  onClick={() => setPreviewData(file)}
                  className="mt-3 w-full py-1.5 bg-slate-50 border border-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-100 transition-colors"
                >
                  미리보기
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 truncate">{previewData.name} (상위 50행)</h3>
              <button onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-slate-600 text-2xl px-2">×</button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {Object.keys(previewData.data[0] || {}).map(col => (
                      <th key={col} className="px-4 py-2 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {previewData.data.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="px-4 py-2 whitespace-nowrap text-[11px] text-slate-600 font-mono">{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataManagement;
