'use client'

import { api } from "~/trpc/react";
import { Table } from "../_components/basepage/table";
import { use, useState } from "react";

export default function BasePage({ params }: { params: Promise<{ slug: string }>}) {
    const  { slug } =  use(params)
    const { data: base, isLoading} = api.base.getBase.useQuery({ id: slug });
    const tableId = base?.tables[0]?.id ?? "";

    const utils = api.useUtils()
    const createTable = api.table.createDefault.useMutation({
        onSuccess: async () => {
            await utils.base.getBase.invalidate({ id: slug })
        },
    });

    const [activeTable, setActiveTable] = useState<string>(tableId);

    if (isLoading) return <div>Loading...</div>
    if (!base) return <div>Something went wrong</div>;

    return (
        <main>
            <div className="sticky top-0 flex flex-row justify-between items-center text-xl px-6 py-3.5 shadow-sm bg-white">
                <span>{base.name}</span>
            </div>

            <div className="flex flex-row gap-3 px-6 py-3 border-b">
                {base.tables.map((t) => (
                <button
                    key={t.id}
                    className={`px-4 py-2 rounded-md cursor-pointer ${
                    activeTable === t.id
                        ? "bg-[#166ee1] text-white"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                    onClick={() => setActiveTable(t.id)}
                >
                    {t.name}
                </button>
                ))}
                <button
                className="hover:bg-gray-200 p-2 rounded-md cursor-pointer"
                onClick={() =>
                    createTable.mutate({ name: "New Table", baseId: base.id })
                }
                >
                    +
                </button>
            </div>

            {activeTable ? <Table id={activeTable} /> : <p></p> }
        </main>
    );
}