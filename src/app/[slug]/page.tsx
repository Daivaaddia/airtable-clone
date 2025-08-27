type Params = Promise<{ slug: string[] }>

export default async function BasePage({ params }: { params: Params }) {
    const { slug } = await params;

    return (
        <main>
            <h1>Base {slug}</h1>
        </main>
        
    )
}