import { api } from "~/trpc/server";

type Params = Promise<{ slug: string[] }>

export default async function BasePage({ params }: { params: Params }) {
    const { slug } = await params;
    const base = slug ? await api.base.getBase({ id: slug }) : null

    return (
        <main>
            <h1>Base {base?.name}</h1>
        </main>
        
    )
}