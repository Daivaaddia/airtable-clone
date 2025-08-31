'use client'
import { api } from "~/trpc/react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import type { Cell, Column, Table } from '@prisma/client'
import { nanoid } from "nanoid";

function EditableCell({
    getValue,
}: {
    getValue: () => string;
}) {
    const cellData: { id: string, value: string, type: string } = JSON.parse(getValue()) as {id: string; value: string; type: string }
    const cellId = cellData.id
    const initialValue = cellData.value
    
    const [localValue, setLocalValue] = useState(initialValue);
    const updateCell = api.table.updateCell.useMutation();

    const handleCommit = () => {
        updateCell.mutate({ id: cellId, value: localValue });
    };

    return (
        <input
            className="w-full px-2 py-1"
            value={localValue}
            type={cellData.type === "TEXT" ? "text" : "number"}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleCommit}
        />
    );
}

export function Table({ id }: { id: string }) {
    const { data: table, isLoading } = api.table.getTable.useQuery({ id });

    const [data, setData] = useState<Record<string, string>[]>([])
    const [cols, setCols] = useState<Column[]>([])

    const utils = api.useUtils()

    const createRow = api.table.createRow.useMutation({
        onSuccess: async () => {
            await utils.table.getTable.invalidate({ id })
        }
    });

    useEffect(() => {
        if (!table) {
            setData([])
            return
        }

        const rows = table.rows.map((row) => {
            const rowObj: Record<string, string> = {};
            row.cells.forEach((cell) => {
                rowObj[cell.columnId] = JSON.stringify({ id: cell.id, value: cell.value, type: cell.type })
            });
            return rowObj;
        });
        setData(rows)
    }, [table])

    useEffect(() => {
        if (!table) {
            setCols([])
            return
        }

        setCols(table.columns)
    }, [table])

    const columns = useMemo(() => {
        return cols.map((col) => ({
            accessorKey: col.id,
            header: col.name,
            cell: EditableCell
        }))
    }, [cols]);

    const reactTable = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (isLoading) return <div>Loading Table...</div>

    const handleAddRow = () => {
        if (!table) return

        const newId = nanoid()

        const newCells: Cell[] = table.columns.map((col) => ({
            id: nanoid(),
            value: "",
            rowId: newId,
            columnId: col.id,
            type: col.type
        }))

        const newData: Record<string, string> = {}
        newCells.forEach((cell) => {
            newData[cell.columnId] = JSON.stringify({ id: cell.id, value: cell.value, type: cell.type })
        });

        setData((prev) => [...prev, newData])

        const newRow = {
            id: newId, order: data.length, tableId: id
        }
        
        createRow.mutate({ row: newRow, cells: newCells })
    }

    return (
        <div className="">
            <div className="text-lg">{table?.name}</div>
            <table className="min-w-full border border-gray-400">
                <thead>
                {reactTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                        <th
                        key={header.id}
                        className="border px-2 border-gray-400 py-2 bg-white text-sm w-[100px] text-left"
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
                        <td key={cell.id} className="border border-gray-400">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                    ))}
                    </tr>
                ))}
                </tbody>
            </table>
            <button onClick={handleAddRow} className="border px-3 py-1.5 cursor-pointer rounded-md bg-[#166ee1] text-white">
                + Add Row
            </button>
        </div>
    )
}