import PageHeader from '@/components/shared/pageHeader/PageHeader'
import DuplicateLayout from './duplicateLayout'
import HomeCards from './HomeCards'

// Mentor admin home. Replaces the Duralux CRM demo dashboard with a lean landing that links to the
// live admin features. Cards are role-gated (HomeCards) so EDITOR sees only what it can use.
const Home = () => {
    return (
        <DuplicateLayout>
            <PageHeader>{null}</PageHeader>
            <div className="main-content">
                <HomeCards />
            </div>
        </DuplicateLayout>
    )
}

export default Home
