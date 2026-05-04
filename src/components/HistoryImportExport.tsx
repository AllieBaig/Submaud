import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Download, Upload, FileJson, FileText, CheckCircle2, AlertCircle, 
  RefreshCcw, ShieldCheck, Info
} from 'lucide-react';
import { useSettings } from '../SettingsContext';
import { useUIState } from '../UIStateContext';
import { VersionEntry } from '../types';

export const HistoryImportExport = () => {
  const { settings, updateHistoryOperations, updateSettings } = useSettings();
  const { showToast } = useUIState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportHistory = (format: 'json' | 'txt') => {
    try {
      const history = settings.versionHistory;
      let content = '';
      let filename = `app_history_${new Date().toISOString().split('T')[0]}`;

      if (format === 'json') {
        content = JSON.stringify(history, null, 2);
        filename += '.json';
      } else {
        content = history.map(entry => {
          let text = `Version: ${entry.version}\nDate: ${entry.date}\n`;
          if (entry.changes.added) text += `Added: ${entry.changes.added.join(', ')}\n`;
          if (entry.changes.improved) text += `Improved: ${entry.changes.improved.join(', ')}\n`;
          if (entry.changes.fixed) text += `Fixed: ${entry.changes.fixed.join(', ')}\n`;
          return text;
        }).join('\n---\n\n');
        filename += '.txt';
      }

      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      updateHistoryOperations({ lastExportAt: Date.now() });
      showToast(`${format.toUpperCase()} History Exported`);
    } catch (error) {
      showToast('Export Failed');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let importedHistory: VersionEntry[] = [];

      if (file.name.endsWith('.json')) {
        importedHistory = JSON.parse(text);
      } else {
        // Simple text parser (naive)
        const sections = text.split('\n---\n\n');
        importedHistory = sections.map(s => {
          const lines = s.split('\n');
          const entry: any = { changes: {} };
          lines.forEach(line => {
            if (line.startsWith('Version: ')) entry.version = line.replace('Version: ', '').trim();
            if (line.startsWith('Date: ')) entry.date = line.replace('Date: ', '').trim();
            if (line.startsWith('Added: ')) entry.changes.added = line.replace('Added: ', '').split(',').map(x => x.trim());
            if (line.startsWith('Improved: ')) entry.changes.improved = line.replace('Improved: ', '').split(',').map(x => x.trim());
            if (line.startsWith('Fixed: ')) entry.changes.fixed = line.replace('Fixed: ', '').split(',').map(x => x.trim());
          });
          return entry;
        }).filter(e => e.version && e.date);
      }

      if (!Array.isArray(importedHistory) || importedHistory.length === 0) {
        throw new Error('Invalid structure');
      }

      // Merge logic: Append only, avoiding duplicates by version
      const existingVersions = new Set(settings.versionHistory.map(h => h.version));
      const newEntries = importedHistory.filter(h => !existingVersions.has(h.version));

      if (newEntries.length === 0) {
        showToast('No new entries to import');
        return;
      }

      // Keep chronological order (assuming version history is sorted newest first)
      const mergedHistory = [...newEntries, ...settings.versionHistory].sort((a, b) => {
        // Naive version sort or date sort
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      updateSettings({ versionHistory: mergedHistory });
      updateHistoryOperations({ lastImportAt: Date.now() });
      showToast(`Imported ${newEntries.length} new entries`);
    } catch (error) {
      showToast('Import Failed: Invalid File');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-6 mt-4">
      <div className="bg-secondary-system-background/50 border border-apple-border/30 rounded-2xl p-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-apple-blue/10 flex items-center justify-center text-apple-blue shadow-inner">
            <RefreshCcw size={16} />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-apple-blue uppercase tracking-wider">Sync Operations</h4>
            <p className="text-[8px] text-system-secondary-label font-bold uppercase tracking-tight">Version history backup & restore</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
           <div className="flex flex-col gap-2">
             <button 
               onClick={() => exportHistory('json')}
               className="w-full flex items-center justify-between p-3 bg-system-background border border-apple-border rounded-xl hover:bg-apple-blue/5 group transition-all"
             >
               <div className="flex items-center gap-2">
                 <FileJson size={14} className="text-apple-blue" />
                 <span className="text-[10px] font-bold text-system-label">JSON</span>
               </div>
               <Download size={12} className="text-system-tertiary-label group-hover:text-apple-blue" />
             </button>
             <button 
               onClick={() => exportHistory('txt')}
               className="w-full flex items-center justify-between p-3 bg-system-background border border-apple-border rounded-xl hover:bg-apple-blue/5 group transition-all"
             >
               <div className="flex items-center gap-2">
                 <FileText size={14} className="text-system-secondary-label" />
                 <span className="text-[10px] font-bold text-system-label">TXT</span>
               </div>
               <Download size={12} className="text-system-tertiary-label group-hover:text-apple-blue" />
             </button>
             <span className="text-[8px] font-black uppercase text-center text-system-tertiary-label px-1">Export History</span>
           </div>

           <div className="flex flex-col gap-2">
             <label className="w-full h-full flex flex-col items-center justify-center gap-2 bg-apple-blue/5 border border-dashed border-apple-blue/30 rounded-xl hover:bg-apple-blue/10 transition-colors cursor-pointer p-4 group">
                <Upload size={18} className="text-apple-blue group-hover:scale-110 transition-transform" />
                <div className="flex flex-col items-center">
                   <span className="text-[10px] font-black text-apple-blue uppercase">Import</span>
                   <span className="text-[7px] font-bold text-apple-blue/60 uppercase">JSON/TXT Support</span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".json,.txt" 
                  className="hidden" 
                  onChange={handleImport} 
                />
             </label>
           </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 bg-secondary-system-background/30 rounded-xl p-3 border border-apple-border/20">
         <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-system-tertiary-label">
            <div className="flex items-center gap-1">
              <CheckCircle2 size={10} className="text-green-500" />
              <span>Status Ledger</span>
            </div>
            <div className="flex items-center gap-1">
              <ShieldCheck size={10} className="text-apple-blue" />
              <span>Secure Merge</span>
            </div>
         </div>
         <div className="h-px bg-apple-border/10 my-1" />
         <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-system-tertiary-label uppercase">Last Export</span>
              <span className="text-[9px] font-black text-system-label">
                {settings.historyOperations.lastExportAt ? new Date(settings.historyOperations.lastExportAt).toLocaleDateString() : 'Never'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-bold text-system-tertiary-label uppercase">Last Import</span>
              <span className="text-[9px] font-black text-system-label">
                {settings.historyOperations.lastImportAt ? new Date(settings.historyOperations.lastImportAt).toLocaleDateString() : 'Never'}
              </span>
            </div>
         </div>
      </div>

      <div className="flex items-start gap-2 px-1">
        <Info size={12} className="text-apple-blue mt-0.5" />
        <p className="text-[9px] font-medium text-system-secondary-label italic leading-relaxed">
          Import logic uses version matching to prevent duplicates. Historical entries are merged chronologically based on version timestamps.
        </p>
      </div>
    </div>
  );
};
