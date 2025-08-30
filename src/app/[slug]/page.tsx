import { api } from "~/trpc/server";
import { Table } from "../_components/basepage/table";
import { cache, Suspense } from "react";

const getBaseCached = cache(async (slug: string) => {
    return await api.base.getBase({ id: slug })
})

async function BaseContent({ slug }: { slug: string }) {
    const base = await getBaseCached(slug);
    const tableId = base?.tables[0]?.id ?? "";

    if (!base) return <div>Something went wrong</div>;

    return (
    <>
        <h1>{base.name}</h1>
        <Table id={tableId} />
    </>
    );
}

export default async function BasePage({ params }: { params: Promise<{ slug: string }>}) {
    const  { slug } = await params
    
    return (
        <main>
            <Suspense fallback={<div>Loading...</div>}>
                <BaseContent slug={slug} />
            </Suspense>
        </main>
    )
}