import { AdminPageHeader } from '@/components/shared/admin/AdminPageHeader'
import DuplicateLayout from './duplicateLayout'
import HomeCards from './HomeCards'
import MetricsCards from './MetricsCards'
import AiCostCards from './AiCostCards'
import EconomyCards from './EconomyCards'
import CoachFeedbackCards from './CoachFeedbackCards'

// Mentor admin home. Replaces the Duralux CRM demo dashboard with a lean landing: a read-only KPI
// snapshot (ADMIN only) on top, then role-gated feature links (HomeCards) so EDITOR sees only what
// it can use.
const Home = () => {
    return (
        <DuplicateLayout>
            <AdminPageHeader title="Panel" breadcrumbs={[{ label: 'Panel' }]} />
            <div className="main-content">
                <MetricsCards />
                <AiCostCards />
                <EconomyCards />
                <CoachFeedbackCards />
                <HomeCards />
            </div>
        </DuplicateLayout>
    )
}

export default Home
