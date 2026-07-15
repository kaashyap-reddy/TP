import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import EmptyState from '../../components/EmptyState';
import { useTrainingPlansStore } from '../../store/trainingPlansStore';
import { ROUTES } from '../../constants/routes';

/**
 * Admin's "Training Plans" tab: the org's fixed curricula. Creating a batch against one
 * auto-generates its sessions/assignments (see batchService.createBatch). "Edit Training Plan"
 * opens the full TrainingPlanDetailPage — general info plus complete session/assignment/resource/
 * announcement management lives there, not in this list.
 */
export default function TrainingPlansPanel() {
  const { trainingPlans, fetchTrainingPlans } = useTrainingPlansStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTrainingPlans();
  }, [fetchTrainingPlans]);

  return (
    <div>
      <Breadcrumbs trail={['Admin', 'Training Plans']} />
      <h2 className="text-2xl font-bold tracking-tight mb-2">Training Plans</h2>
      <p className="text-gray-500 text-sm mb-6">
        The org's standard curricula. Creating a batch against one of these automatically generates its full session and assignment
        schedule. Editing a template here never changes batches already created from it.
      </p>

      {trainingPlans.length === 0 ? (
        <EmptyState title="No training plans yet" icon="inbox" />
      ) : (
        <div className="space-y-4">
          {trainingPlans.map((plan) => (
            <div key={plan.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {plan.durationMonths} month{plan.durationMonths === 1 ? '' : 's'} • {plan.counts.sessions} sessions •{' '}
                    {plan.counts.assignments} assignments • {plan.counts.batches} batch{plan.counts.batches === 1 ? '' : 'es'}
                  </p>
                </div>
                <button
                  onClick={() => navigate(ROUTES.ADMIN_TRAINING_PLAN_DETAIL(plan.id))}
                  className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Edit Training Plan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
