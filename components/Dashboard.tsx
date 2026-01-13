
import React, { useState, useMemo } from 'react';
import { UploadedFile, DataType } from '../types';
import { isWithinRange } from '../utils/dateUtils';
import * as XLSX from 'xlsx';

interface Props {
  files: UploadedFile[];
}

type SortKey = 'name' | 'changeRate' | 'cumulativeInst' | 'specificInst';
type SortOrder = 'asc' | 'desc' | null;

const Dashboard: React.FC<Props> = ({ files }) => {
  const [snapStartDate, setSnapStartDate] = useState('2024-01-01');
  const [snapEndDate, setSnapEndDate] = useState('2024-12-31');
  const [snapSpecificDate, setSnapSpecificDate] = useState('2024-01-15');

  // Sort & Filter states
  const [sortKey, setSortKey] = useState<SortKey>('changeRate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterMin, setFilterMin] = useState<Record<string, string>>({ changeRate: '', cumulativeInst: '', specificInst: '' });
  const [filterMax, setFilterMax] = useState<Record<string, string>>({ changeRate: '', cumulativeInst: '', specificInst: '' });

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
    if (num !== 0 && Math.abs(num) < 1) {
      return num * 100;
    }
    return num;
  };

  const rawSnapshotData = useMemo(() => {
    const selectedFile = files.find(f => f.type === DataType.SELECTED);
    if (!selectedFile) return [];

    const instFilesForRange = files.filter(f => f.type === DataType.INSTITUTIONAL && f.date && isWithinRange(f.date, snapStartDate, snapEndDate));
    const specificDateKey = snapSpecificDate.replace(/-/g, '').substring(2);
    const instFileForSpecific = files.find(f => f.type === DataType.INSTITUTIONAL && f.date === specificDateKey);

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

      return { code, name, changeRate, cumulativeInst, specificInst };
    });
  }, [files, snapStartDate, snapEndDate, snapSpecificDate]);

  const snapshotData = useMemo(() => {
    let filtered = [...rawSnapshotData];
    const keys = ['changeRate', 'cumulativeInst', 'specificInst'];
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

  const SortIcon = ({ current, k, order }: { current: SortKey, k: SortKey, order: SortOrder }) => {
    if (current !== k) return <span className="ml-1 opacity-20">⇅</span>;
    if (order === 'asc') return <span className="ml-1 text-blue-600">↑</span>;
    if (order === 'desc') return <span className="ml-1 text-blue-600">↓</span>;
    return <span className="ml-1 opacity-20">⇅</span>;
  };

  const downloadExcel = () => {
    const dataToExport = snapshotData.map(d => ({
      '종목코드': d.code,
      '종목명': d.name,
      '등락률(%)': d.changeRate,
      '기관 누적 거래대금': d.cumulativeInst,
      '특정일 기관 거래대금': d.specificInst
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "분석결과");
    XLSX.writeFile(workbook, `주식분석결과_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-12 pb-20">
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800">선정 종목 상세 분석</h2>
                <button 
                  onClick={downloadExcel}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
                >
                  <span>📥 엑셀 다운로드</span>
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-1">결과: {snapshotData.length}건</p>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 bg-white p-4 rounded-xl border border-slate-200">
            {['changeRate', 'cumulativeInst', 'specificInst'].map(key => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  {key === 'changeRate' ? '등락률 (%)' : key === 'cumulativeInst' ? '기관 누적 거래대금' : '특정일 기관 거래대금'} 필터
                </label>
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
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">종목코드</th>
                  <th onClick={() => { setSortKey('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">종목명 <SortIcon current={sortKey} k="name" order={sortOrder} /></th>
                  <th onClick={() => { setSortKey('changeRate'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">등락률 <SortIcon current={sortKey} k="changeRate" order={sortOrder} /></th>
                  <th onClick={() => { setSortKey('cumulativeInst'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">기관 누적 거래대금 <SortIcon current={sortKey} k="cumulativeInst" order={sortOrder} /></th>
                  <th onClick={() => { setSortKey('specificInst'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }} className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100">특정일 기관 거래대금 <SortIcon current={sortKey} k="specificInst" order={sortOrder} /></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {snapshotData.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50 text-xs">
                    <td className="px-6 py-3 whitespace-nowrap font-mono">{d.code}</td>
                    <td className="px-6 py-3 whitespace-nowrap font-bold text-slate-900">{d.name}</td>
                    <td className={`px-6 py-3 text-center font-bold ${d.changeRate > 0 ? 'text-red-500' : d.changeRate < 0 ? 'text-blue-500' : 'text-slate-600'}`}>
                      {d.changeRate > 0 ? '▲' : d.changeRate < 0 ? '▼' : ''} {Math.abs(d.changeRate).toFixed(2)}%
                    </td>
                    <td className={`px-6 py-3 text-right font-mono ${d.cumulativeInst < 0 ? 'text-blue-600' : 'text-slate-700'}`}>{d.cumulativeInst.toLocaleString()}</td>
                    <td className={`px-6 py-3 text-right font-bold font-mono bg-blue-50/20 ${d.specificInst < 0 ? 'text-blue-600' : 'text-slate-900'}`}>{d.specificInst.toLocaleString()}</td>
                  </tr>
                ))}
                {snapshotData.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">조건에 맞는 데이터가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
