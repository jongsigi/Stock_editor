
export const parseFileNameDate = (fileName: string): string | undefined => {
  // f_240115.xlsx, inst_240115.xlsx 등에서 6자리 숫자만 추출
  const match = fileName.match(/(\d{6})/);
  if (match) return match[1];
  return undefined;
};

export const formatYYMMDD = (dateStr: string): string => {
  if (!dateStr || dateStr.length !== 6) return dateStr;
  return `20${dateStr.substring(0, 2)}-${dateStr.substring(2, 4)}-${dateStr.substring(4, 6)}`;
};

export const isWithinRange = (target: string, start: string, end: string): boolean => {
  try {
    const t = new Date(formatYYMMDD(target)).getTime();
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (isNaN(t) || isNaN(s) || isNaN(e)) return false;
    return t >= s && t <= e;
  } catch (e) {
    return false;
  }
};
