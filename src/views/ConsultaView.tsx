import React, { useEffect, useState } from 'react';
import { Building2, Calendar, LogOut, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SEED_ACTIVITIES, SEED_SUPPLIERS } from '../data/seedData';
import { useAutoLcrSync } from '../hooks/useAutoLcrSync';
import { supabase } from '../lib/supabase';
import { syncLcrCalendarWithShield } from '../services/lcrSyncService';
import { ActivityRecord, SupplierRecord } from '../types/database';
import { CalendarView } from './CalendarView';
import { LeadersDirectoryView } from './LeadersDirectoryView';
import { SuppliersView } from './SuppliersView';

export const ConsultaView: React.FC = () => {
  const { user, isSimulating, signOut, realAuthEmail } = useAuth();
  const [activeTab, setActiveTab] = useState<'DIRECTORY' | 'CALENDAR' | 'SUPPLIERS'>('DIRECTORY');
  const [activities, setActivities] = useState<ActivityRecord[]>(SEED_ACTIVITIES);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(SEED_SUPPLIERS);

  useEffect(() => {
    let mounted = true;
    async function loadPublicData() {
      try {
        const [{ data: actData, error: actErr }, { data: supData, error: supErr }] =
          await Promise.all([
            supabase.from('activities').select('*').order('event_date', { ascending: true }),
            supabase.from('suppliers').select('*').order('commercial_name', { ascending: true }),
          ]);
        if (!mounted) return;

        if (!supErr && supData && supData.length > 0) {
          setSuppliers(supData as SupplierRecord[]);
        }

        const baseActivities: ActivityRecord[] =
          !actErr && actData && actData.length > 0
            ? (actData.map((a) => ({
                ...a,
                estimated_cost: Number(a.estimated_cost || 0),
                origin:
                  a.ical_uid?.startsWith('PROPUESTA_LIDER') ||
                  a.ical_uid?.startsWith('PENDIENTE_LCR') ||
                  a.status === 'PROPUESTA'
                    ? 'propuesta_lider'
                    : 'lcr',
              })) as ActivityRecord[])
            : SEED_ACTIVITIES;

        const syncResult = await syncLcrCalendarWithShield({
          currentActivities: baseActivities,
          isSimulating,
          canPersistToDb: false,
        });
        if (mounted) {
          setActivities(syncResult.activities);
        }
      } catch {
        // Fallback silencioso a datos semilla
      }
    }
    loadPublicData();
    return () => {
      mounted = false;
    };
  }, [isSimulating]);

  useAutoLcrSync({
    activities,
    isSimulating,
    canPersistToDb: false,
    onSynced: setActivities,
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">
              Estaca Este · Acceso Consulta
            </p>
            <h1 className="text-base font-extrabold text-slate-900">
              {user.full_name} · {user.calling}
            </h1>
          </div>

          <nav className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('DIRECTORY')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition ${
                activeTab === 'DIRECTORY'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Directorio</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CALENDAR')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition ${
                activeTab === 'CALENDAR'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Calendario</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('SUPPLIERS')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition ${
                activeTab === 'SUPPLIERS'
                  ? 'bg-emerald-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Proveedores</span>
            </button>
            <button
              type="button"
              data-testid="consulta-signout-btn"
              title={realAuthEmail ? `Salir (${realAuthEmail})` : 'Salir'}
              onClick={() => signOut()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Salir</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'DIRECTORY' && <LeadersDirectoryView />}
        {activeTab === 'CALENDAR' && (
          <CalendarView
            selectedYear={new Date().getFullYear()}
            activitiesProp={activities}
            onActivitiesUpdate={setActivities}
            embedded
          />
        )}
        {activeTab === 'SUPPLIERS' && (
          <SuppliersView
            suppliers={suppliers}
            onBack={() => setActiveTab('DIRECTORY')}
            embedded
          />
        )}
      </main>
    </div>
  );
};
