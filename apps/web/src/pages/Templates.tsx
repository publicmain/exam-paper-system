import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function TemplatesPage() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { api.listTemplates().then(setItems); }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Templates</h1>
      <div className="card divide-y">
        {items.length === 0 && <div className="py-6 text-center text-gray-500">No templates yet. (Built-in presets are available in the paper wizard.)</div>}
        {items.map((t: any) => (
          <div key={t.id} className="py-3">
            <div className="font-medium">{t.name}{t.isSchoolDefault && <span className="badge ml-2">default</span>}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {t.subject?.name} · {t.component?.code || '—'} · {t.durationMin} min · {t.totalMarks} marks
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
