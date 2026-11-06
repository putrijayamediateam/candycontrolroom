import { useTranslation } from 'react-i18next';
import { useApi } from '../api';
import { Avatar, Badge, Loading } from '../ui';

export const DEPARTMENTS = ['leadership', 'strategy_content', 'creative_production', 'publishing_community', 'quality_performance', 'systems', 'designer_team'] as const;

/**
 * Accessible 2D office view, built only from stored staff/task state.
 * The 3D office (React Three Fiber) is the next milestone and will use the same data and events.
 */
export function OfficePreview({ department }: { department?: string }) {
  const { t } = useTranslation();
  const st = useApi<any>('/api/staff');
  if (!st.data) return <Loading />;
  const staff = st.data.staff.filter((s: any) => !department || s.department === department);
  return (
    <div>
      <p className="muted small"><Badge tone="info">{t('office.twoD')}</Badge> {t('office.threeDPlanned')}</p>
      <div className="office-2d">
        {DEPARTMENTS.filter((d) => staff.some((s: any) => s.department === d)).map((d) => (
          <section key={d} className={`office-zone zone-${d}`} aria-label={t(`department.${d}`)}>
            <h3>{t(`department.${d}`)}</h3>
            <ul>
              {staff.filter((s: any) => s.department === d).map((s: any) => (
                <li key={s.id}>
                  <a href={`#/team/${s.id}`} className="desk">
                    <Avatar name={s.display_name} colour={s.colour} size={30} />
                    <span className="desk-name">{s.display_name}</span>
                    <span className="desk-status">
                      {s.paused ? <Badge tone="warn">{t('staffStatus.paused')}</Badge> : <Badge>{t(`staffStatus.${s.status}`, { defaultValue: s.status })}</Badge>}
                      {s.open_questions > 0 && <Badge tone="pink">{t('office.waitingAin')}</Badge>}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
