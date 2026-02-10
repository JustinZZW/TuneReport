import React from 'react';
import { UploadCloud } from 'lucide-react';

const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
      <div className="bg-white p-4 rounded-full shadow-sm mb-4">
        <UploadCloud className="w-8 h-8 text-blue-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800">No reports processed yet</h3>
      <p className="text-slate-500 max-w-sm mt-2 text-sm">
        Upload your first PDF instrument report to automatically extract data and build your database.
      </p>
    </div>
  );
};

export default EmptyState;
