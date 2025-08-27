interface Props {
  params: { slug: string };
}

export default function BasePage({ params }: Props) {
    const { slug } = params;

    return (
        <main>
            <h1>Base {slug}</h1>
        </main>
        
    )
}