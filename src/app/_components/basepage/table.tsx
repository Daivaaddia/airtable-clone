'use client'
import { api } from "~/trpc/react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { Table, Column, Row, Cell} from '@prisma/client'
import { CellContext } from "@tanstack/react-table"

export function Table({ id }: { id: string }) {
    const { data: table, isLoading } = api.table.getTable.useQuery({ id });
    const updateCell = api.table.updateCell.useMutation();

    const data = useMemo(() => {
        if (!table) return [];
        
        return table.rows.map((row) => {
            const rowObj: Record<string, string> = {};
            row.cells.forEach((cell) => {
                rowObj[cell.columnId] = JSON.stringify({ id: cell.id, value: cell.value })
            });
            return rowObj;
        });
    }, [table]);

    const columns = useMemo(() => {
        if (!table) return [];

        return table.columns.map((col) => ({
            accessorKey: col.id,
            header: col.name,
            cell: (props: CellContext<Row, string>) => {
                const cellData = JSON.parse(props.getValue())
                const [localValue, setLocalValue] = useState(cellData.value);
                const handleCommit = () => {
                    if (localValue !== cellData.value) {
                    updateCell.mutate({
                        id: cellData.id,
                        value: localValue,
                    });
                    }
                };
                return (
                <input
                    className="border p-1 w-full"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleCommit}
                />
                );
            },
        }))
    }, [table]);

    const reactTable = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (isLoading) return <div>Loading Table...</div>

    return (
        <div className="overflow-x-auto border rounded-lg">
            <p>{table?.name}</p>
            <table className="min-w-full border-collapse">
                <thead>
                {reactTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                        <th
                        key={header.id}
                        className="border px-3 py-2 bg-gray-100 text-left"
                        >
                        {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                            )}
                        </th>
                    ))}
                    </tr>
                ))}
                </thead>
                <tbody>
                {reactTable.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="border px-3 py-2">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                    ))}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    )
}