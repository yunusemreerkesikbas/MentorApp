import PageHeader from "@/components/shared/pageHeader/PageHeader";
import ZoneForm from "../ZoneForm";

export default function NewZonePage() {
    return (
        <>
            <PageHeader>{null}</PageHeader>
            <div className="main-content">
                <div className="row">
                    <div className="col-lg-8">
                        <ZoneForm />
                    </div>
                </div>
            </div>
        </>
    );
}
