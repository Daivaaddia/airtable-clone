'use client'
import { api } from "~/trpc/react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import type { Row } from "@tanstack/react-table";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Cell, Column, Table } from '@prisma/client'
import { nanoid } from "nanoid";
import type { FilterGroupInput } from "~/server/api/routers/table";

type DataValue = { id: string, value: string, type: string }
type Data = Record<string, DataValue>
export type SortRule = {
  columnName: string
  columnType: "TEXT" | "NUMBER"
  order: "ASC" | "DESC"
};

export function Table({ 
    id,
    cols,
    setCols,
    filters,
    setFilters,
    sortRules,
    setSortRules,
    search,
    setSearch
}: { 
    id: string 
    cols: Column[]
    setCols: React.Dispatch<React.SetStateAction<Column[]>>
    filters: FilterGroupInput,
    setFilters: React.Dispatch<React.SetStateAction<FilterGroupInput>>
    sortRules: SortRule[]
    setSortRules: React.Dispatch<React.SetStateAction<SortRule[]>>
    search: string
    setSearch: React.Dispatch<React.SetStateAction<string>>
}) {
    const [data, setData] = useState<Data[]>([])
    // useState for row IDs to be used in col updates
    const [rows, setRows] = useState<string[]>([]) 
    const [refreshCounter, setRefreshCounter] = useState(0);

    const { data: table, isLoading, isRefetching } = api.table.getTable.useQuery({ id, search });

    function EditableCell({
        getValue,
    }: {
        getValue: () => DataValue;
    }) {
        const cellData = getValue()
        const cellId = cellData.id
        const initialValue = cellData.value
        
        const [localValue, setLocalValue] = useState(initialValue);
        const updateCell = api.table.updateCell.useMutation({
            onSuccess: () => {
                sortRows()
            }
        });

        const handleCommit = () => {
            if (initialValue != localValue) {
                updateCell.mutate({ id: cellId, value: localValue });
            }
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

    const columns = useMemo(() => {
        return cols.map((col) => ({
            accessorKey: col.name,
            header: col.name,
            cell: EditableCell,
            sortingFn: (a: Row<Data>, b: Row<Data>) => {
                const valA = a.getValue<DataValue>(col.name).value
                const valB = b.getValue<DataValue>(col.name).value
                return valA.localeCompare(valB)
            }
        }))
    }, [cols]);

    const utils = api.useUtils()

    const createRow = api.table.createRow.useMutation({
        onSuccess: () => {
            sortRows()
        },
    });

    const createCol = api.table.createCol.useMutation({
        onSuccess: async () => {
            await utils.table.getTable.invalidate({ id })
        }
    });

    const sortTable = api.table.sortTable.useMutation({
        onSuccess: async () => {
            await utils.table.getTable.invalidate({ id });
            setRefreshCounter((prev) => prev + 1)
        }
    });

    const resetTableOrder = api.table.resetOrder.useMutation({
        onSuccess: async () => {
            await utils.table.getTable.invalidate({ id });
        }
    })

    const updateTableFilter = api.table.updateTableFilter.useMutation({
        onSuccess: async () => {
            await utils.table.getTable.invalidate({ id });
            setRefreshCounter((prev) => prev + 1)
        }
    })

    const initialLoaded = useRef(false)

    useEffect(() => {
        if (!table || initialLoaded.current) return;

        if (table.sorting) {
            const initial: SortRule[] = JSON.parse(table.sorting) as SortRule[];
            setSortRules(initial);
        }

        if (table.filtering) {
            setFilters(JSON.parse(table.filtering) as FilterGroupInput);
        }

        initialLoaded.current = true;
    }, [table]);

    useEffect(() => {
        if (!initialLoaded.current) return;
        updateTableFilter.mutate({ id, filters: JSON.stringify(filters) })
    }, [filters])

    const sortRows = () => {
        const sortRulesBackend = sortRules.map(r => ({ columnName: r.columnName, columnType: r.columnType, order: r.order }));
        if (sortRules.length === 0) {
            resetTableOrder.mutate({ id });
        } else {
            sortTable.mutate({ id, columns: sortRulesBackend });
        }
    }

    useEffect(() => {
        if (!initialLoaded.current) return;

        sortRows()
    }, [sortRules]);

    useEffect(() => {
        if (!table) {
            setData([])
            return
        }

        const rowIds: string[] = [] 
        const rows = table.rows.map((row) => {
            rowIds.push(row.id)

            const rowObj: Data = {};
            row.cells.forEach((cell) => {
                rowObj[cell.columnName] = { id: cell.id, value: cell.value, type: cell.type }
            });
            return rowObj;
        });

        setData(rows)
        setRows(rowIds)
    }, [table])

    useEffect(() => {
        if (!table) {
            setCols([])
            return
        }

        setCols([...table.columns])
    }, [table])

    const handleAddRow = () => {
        if (!table) return

        const newId = nanoid()

        const newCells: Cell[] = table.columns.map((col) => ({
            id: nanoid(),
            columnId: col.id,
            value: "",
            rowId: newId,
            columnName: col.name,
            type: col.type
        }))

        const newData: Record<string, DataValue> = {}
        newCells.forEach((cell) => {
            newData[cell.columnName] = { id: cell.id, value: cell.value, type: cell.type }
        });

        setData((prev) => [...prev, newData])
        setRows((prev) => [...prev, newId])

        const newRow = {
            id: newId, order: data.length, tableId: id
        }
        
        createRow.mutate({ row: newRow, cells: newCells })
    }

    const handleAddCol = () => {
        if (!table) return

        const newId = nanoid()

        const inputName = window.prompt("Enter column name", "Text")
        if (!inputName) return
        
        const newCells: Cell[] = []
        rows.map((rowId) => {
            newCells.push({
                id: nanoid(),
                columnId: newId,
                value: "",
                rowId,
                columnName: inputName,
                type: "TEXT"
            })
        })

        setData((prev) =>
            prev.map((row, rowIndex) => {
                const cell = newCells[rowIndex];
                if (!cell) return {...row}

                return {
                    ...row,
                    [inputName]: { id: cell.id, value: cell.value, type: cell.type },
                };
            })
        );

        const newCol: Column = {
            name: inputName,
            id: newId,
            order: cols.length,
            type: "TEXT",
            tableId: id
        }

        setCols((prev: Column[]) => [...prev, newCol])

        createCol.mutate({ col: newCol, cells: newCells })
    }

    const reactTable = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    if (isLoading) return <div>Loading Table...</div>

    return (
        <div>
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
                <tbody key={refreshCounter}>
                {reactTable.getRowModel().rows.map((row, index) => (
                    <tr key={index}>
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
            <button onClick={handleAddCol} className="border px-3 py-1.5 cursor-pointer rounded-md bg-[#166ee1] text-white">
                + Add Col
            </button>
        </div>
    )
}