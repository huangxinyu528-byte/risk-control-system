import { CustomerFullProfilePage } from "@/components/customers/customer-full-profile-page";

export default function CustomerArchivePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { projectId?: string; projectName?: string; sheetName?: string };
}) {
  return (
    <CustomerFullProfilePage
      customerId={params.id}
      preferredProjectId={searchParams?.projectId}
      preferredProjectName={searchParams?.projectName}
      preferredSheetName={searchParams?.sheetName}
    />
  );
}
