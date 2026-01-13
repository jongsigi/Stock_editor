
import React, { useState, useMemo, useEffect } from 'react';
import { UploadedFile, DataType } from '../types';
import { isWithinRange, formatYYMMDD } from '../utils/dateUtils';
import * as XLSX from 'xlsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Props {
  files: UploadedFile[];
  onClear?: () => void;
}

type SortKey = 'name' | 'changeRate' | 'cumulativeInst' | 'specificInst' | 'specificTradeVal';
type SortOrder = 'asc' | 'desc' | null;
type ChartMode = 'daily' | 'cumulative';
type MetricType = 'tradeVal' | 'foreignVal' | 'instVal';

const Dashboard: React.FC<Props> = ({ files, onClear }) => {
  const fileDates = useMemo(() => {
    return files
      .filter(f => f.date)
      .map(f => formatYYMMDD(f.date!))
      .sort();
  }, [files]);

  const defaultStart = fileDates.length > 0 ? fileDates[0] : '2024-01-01';
  const defaultEnd = fileDates.length > 0 ? fileDates[fileDates.length - 1] : '2024-12-31';

  const [snapStartDate, setSnapStartDate] = useState(defaultStart);
  const [snapEndDate, setSnapEndDate] = useState(defaultEnd);
  const [snapSpecificDate, setSnapSpecificDate] = useState(defaultEnd);
  
  const [chartMode, setChartMode] = useState<ChartMode>('daily');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('tradeVal');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (fileDates.length > 0) {
      setSnapStartDate(fileDates[0]);
      setSnapEndDate(fileDates[fileDates.length - 1]);
      setSnapSpecificDate(fileDates[fileDates.length - 1]);
    }
  }, [fileDates]);

  const [sortKey, setSortKey] = useState<SortKey>('changeRate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterMin, setFilterMin] = useState<Record<string, string>>({ changeRate: '', cumulativeInst: '', specificInst: '', specificTradeVal: '' });
  const [filterMax, setFilterMax] = useState<Record<string, string>>({ changeRate: '', cumulativeInst: '', specificInst: '', specificTradeVal: '' });

  const getValue = (row: any, keys: string[], index: number): any => {
    for (const key of keys) {
      if (row[key] !== undefined) return row[key];
    }
    const values = Object.values(row);
    if (values.length > index) return values[index];
    return undefined;
  };

  const parseRate = (val: any): number => {
    let num = 0;
    if (typeof val === 'number') {
      num = val;
    } else if (typeof val === 'string') {
      const cleaned = val.replace(/[%,]/g, '');
      num = parseFloat(cleaned) || 0;
    }
    if (num !== 0 && Math.abs(num) < 1) return num * 100;
    return num;
  };

  const rawSnapshotData = useMemo(() => {
    const selectedFile = files.find(f => f.type === DataType.SELECTED);
    if (!selectedFile) return [];

    const instFilesForRange = files.filter(f => f.type === DataType.INSTITUTIONAL && f.date && isWithinRange(f.date, snapStartDate, snapEndDate));
    const specificDateKey = snapSpecificDate.replace(/-/g, '').substring(2);
    
    const instFileForSpecific = files.find(f => f.type === DataType.INSTITUTIONAL && f.date === specificDateKey);
    const tradeFileForSpecific = files.find(f => f.type === DataType.TOTAL_TRADE && f.date === specificDateKey);

    return selectedFile.data.map(stock => {
      const code = getValue(stock, ['종목코드', 'Code'], 0);
      const name = getValue(stock, ['종목명', 'Name'], 1);
      const rawChangeRate = getValue(stock, ['등락률', 'ChangeRate'], 5);
      const changeRate = parseRate(rawChangeRate);

      let cumulativeInst = 0;
      instFilesForRange.forEach(file => {
        const row = file.data.find(r => getValue(r, ['종목코드', 'Code'], 0) === code);
        cumulativeInst += Number(getValue(row || {}, ['거래대금'], 7)) || 0;
      });

      const specificInstRow = instFileForSpecific?.data.find(r => getValue(r, ['종목코드', 'Code'], 0) === code);
      const specificInst = Number(getValue(specificInstRow || {}, ['거래대금'], 7)) || 0;

      const specificTradeRow = tradeFileForSpecific?.data.find(r => getValue(r, ['종목코드', 'Code'], 0) === code);
      const specificTradeVal = Number(getValue(specificTradeRow || {}, ['거래대금'], 7)) || 0;

      return { code, name, changeRate, cumulativeInst, specificInst, specificTradeVal };
    });
  }, [files, snapStartDate, snapEndDate, snapSpecificDate]);

  const snapshotData = useMemo(() => {
    let filtered = [...rawSnapshotData];
    const keys = ['changeRate', 'cumulativeInst', 'specificInst', 'specificTradeVal'];
    keys.forEach(key => {
      if (filterMin[key] !== '') filtered = filtered.filter(d => (d as any)[key] >= parseFloat(filterMin[key]));
      if (filterMax[key] !== '') filtered = filtered.filter(d => (d as any)[key] <= parseFloat(filterMax[key]));
    });

    if (sortKey && sortOrder) {
      filtered.sort((a, b) => {
        const valA = (a as any)[sortKey];
        const valB = (b as any)[sortKey];
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [rawSnapshotData, sortKey, sortOrder, filterMin, filterMax]);

  const chartData = useMemo(() => {
    if (selectedCodes.size === 0) return [];
    const totalFiles = files.filter(f => f.type === DataType.TOTAL_TRADE && f.date && isWithinRange(f.date, snapStartDate, snapEndDate));
    const foreignFiles = files.filter(f => f.type === DataType.FOREIGNER && f.date && isWithinRange(f.date, snapStartDate, snapEndDate));
    const instFiles = files.filter(f => f.type === DataType.INSTITUTIONAL && f.date && isWithinRange(f.date, snapStartDate, snapEndDate));
    const allDates = Array.from(new Set([...totalFiles.map(f => f.date!), ...foreignFiles.map(f => f.date!), ...instFiles.map(f => f.date!)])).sort();
    const cumulativeMap: Record<string, number> = {};
    selectedCodes.forEach(code => { cumulativeMap[code] = 0; });
    return allDates.map(date => {
      const dataPoint: any = { name: formatYYMMDD(date) };
      selectedCodes.forEach(code => {
        let val = 0;
        if (selectedMetric === 'tradeVal') {
          const row = totalFiles.find(f => f.date === date)?.data.find(r => getValue(r, ['종목코드', 'Code'], 0) === code);
          val = Number(getValue(row || {}, ['거래대금'], 7)) || 0;
        } else if (selectedMetric === 'foreignVal') {
          const row = foreignFiles.find(f => f.date === date)?.data.find(r => getValue(r, ['종목코드', 'Code'], 0) === code);
          val = Number(getValue(row || {}, ['거래대금'], 7)) || 0;
        } else {
          const row = instFiles.find(f => f.date === date)?.data.find(r => getValue(r, ['종목코드', 'Code'], 0) === code);
          val = Number(getValue(row || {}, ['거래대금'], 7)) || 0;
        }
        if (chartMode === 'cumulative') { cumulativeMap[code] += val; dataPoint[code] = cumulativeMap[code]; } 
        else { dataPoint[code] = val; }
      });
      return dataPoint;
    });
  }, [files, selectedCodes, snapStartDate, snapEndDate, chartMode, selectedMetric]);

  const toggleSelection = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) next.delete(code); else next.add(code);
    setSelectedCodes(next);
  };

  const downloadExcel = () => {
    const dataToExport = snapshotData.map(d => ({
      '종목코드': d.code,
      '종목명': d.name,
      '등락률(%)': d.changeRate,
      '기관 누적 거래대금': d.cumulativeInst,
      '특정일 기관 거래대금': d.specificInst,
      '특정일 거래대금': d.specificTradeVal
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "분석결과");
    XLSX.writeFile(workbook, `주식분석결과_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const chartColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#475569'];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 pb-20">
      <div className="flex justify-end">
        <button onClick={() => { if(confirm('모든 업로드된 데이터를 삭제하시겠습니까?')) onClear?.(); }} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-bold border border-red-100">데이터 전체 삭제</button>
      </div>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">종목별 추이 비교 차트</h2>
              <p className="text-sm text-slate-500">지표: {selectedMetric === 'tradeVal' ? '거래대금' : selectedMetric === 'foreignVal' ? '외국인' : '기관'} ({chartMode === 'daily' ? '일별' : '누적'})</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                {(['tradeVal', 'foreignVal', 'instVal'] as MetricType[]).map(m => (
                  <button key={m} onClick={() => setSelectedMetric(m)} className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${selectedMetric === m ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{m === 'tradeVal' ? '거래대금' : m === 'foreignVal' ? '외국인' : '기관'}</button>
                ))}
              </div>
              <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                {(['daily', 'cumulative'] as ChartMode[]).map(m => (
                  <button key={m} onClick={() => setChartMode(m)} className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${chartMode === m ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{m === 'daily' ? '일별' : '누적'}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="h-[400px] w-full">
            {selectedCodes.size > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => (val / 1000000).toLocaleString() + 'M'} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }} formatter={(value: any, name: string) => [Number(value).toLocaleString(), rawSnapshotData.find(s => s.code === name)?.name || name]} />
                  <Legend formatter={(value: string) => rawSnapshotData.find(s => s.code === value)?.name || value} wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />
                  {Array.from(selectedCodes).map((code, idx) => (
                    <Line key={code} type="monotone" dataKey={code} stroke={chartColors[idx % chartColors.length]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <span className="text-4xl mb-3">📈</span>
                <p className="text-sm font-medium">아래 테이블에서 종목을 체크하여 추이를 비교해 보세요.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-slate-800">선정 종목 상세 분석</h2>
              <button onClick={downloadExcel} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm">📥 엑셀 다운로드</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:flex items-end gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">누적 계산 기간</label>
                <div className="flex items-center space-x-2">
                  <input type="date" value={snapStartDate} onChange={e => setSnapStartDate(e.target.value)} className="px-2 py-1.5 border rounded text-xs outline-none" />
                  <span className="text-slate-300">~</span>
                  <input type="date" value={snapEndDate} onChange={e => setSnapEndDate(e.target.value)} className="px-2 py-1.5 border rounded text-xs outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">특정 날짜 스냅샷</label>
                <input type="date" value={snapSpecificDate} onChange={e => setSnapSpecificDate(e.target.value)} className="px-2 py-1.5 border rounded text-xs outline-none w-full" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 bg-white p-4 rounded-xl border border-slate-200">
            {['changeRate', 'cumulativeInst', 'specificInst', 'specificTradeVal'].map(key => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">{key === 'changeRate' ? '등락률 (%)' : key === 'cumulativeInst' ? '기관 누적' : key === 'specificInst' ? '특정일 기관' : '특정일 거래'} 필터</label>
                <div className="flex gap-2">
                  <input type="number" placeholder="Min" value={filterMin[key]} onChange={e => setFilterMin(p => ({ ...p, [key]: e.target.value }))} className="w-full px-2 py-1 text-xs border rounded outline-none" />
                  <input type="number" placeholder="Max" value={filterMax[key]} onChange={e => setFilterMax(p => ({ ...p, [key]: e.target.value }))} className="w-full px-2 py-1 text-xs border rounded outline-none" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase w-10">비교</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">종목코드</th>
                  <th onClick={() => { setSortKey('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">종목명 {sortKey === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => { setSortKey('changeRate'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">등락률 {sortKey === 'changeRate' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => { setSortKey('cumulativeInst'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">기관 누적 {sortKey === 'cumulativeInst' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => { setSortKey('specificInst'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">특정일 기관 {sortKey === 'specificInst' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                  <th onClick={() => { setSortKey('specificTradeVal'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">특정일 거래대금 {sortKey === 'specificTradeVal' && (sortOrder === 'asc' ? '↑' : '↓')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {snapshotData.map((d, i) => (
                  <tr key={i} className={`hover:bg-slate-50 text-xs transition-colors ${selectedCodes.has(d.code) ? 'bg-blue-50/40' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <input type="checkbox" checked={selectedCodes.has(d.code)} onChange={() => toggleSelection(d.code)} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" />
                    </td>
                    <td className="px-6 py-3 font-mono">{d.code}</td>
                    <td className="px-6 py-3 font-bold text-slate-900">{d.name}</td>
                    <td className={`px-6 py-3 text-center font-bold ${d.changeRate > 0 ? 'text-red-500' : d.changeRate < 0 ? 'text-blue-500' : 'text-slate-600'}`}>{d.changeRate > 0 ? '▲' : d.changeRate < 0 ? '▼' : ''} {Math.abs(d.changeRate).toFixed(2)}%</td>
                    <td className={`px-6 py-3 text-right font-mono ${d.cumulativeInst < 0 ? 'text-blue-600 font-bold' : 'text-slate-600'}`}>{d.cumulativeInst.toLocaleString()}</td>
                    <td className={`px-6 py-3 text-right font-bold font-mono ${d.specificInst < 0 ? 'text-blue-600' : 'text-slate-900'}`}>{d.specificInst.toLocaleString()}</td>
                    <td className={`px-6 py-3 text-right font-bold font-mono ${d.specificTradeVal < 0 ? 'text-blue-600' : 'text-slate-900'}`}>{d.specificTradeVal.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
