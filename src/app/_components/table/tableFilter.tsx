'use client'
import type { Column } from "@prisma/client";
import { useMemo, useState } from "react"
import type { FilterCondInput, FilterGroupInput } from "~/server/api/routers/table"

export const initialFilter: FilterGroupInput = {
    combineWith: "AND",
    conditions: [],
}

function ConditionRow({
    condition,
    onChange,
    onDelete,
    columns,
}: {
    condition: FilterCondInput;
    onChange: (newCond: FilterCondInput) => void;
    onDelete: () => void;
    columns: Column[];
}) {
    return (
        <div className="flex flex-row items-center gap-2">
            <select
            value={condition.columnName}
            onChange={(e) => onChange({ ...condition, columnName: e.target.value })}
            className="border rounded px-2 py-1 cursor-pointer"
            >
            {columns.map((col) => (
                <option key={col.name} value={col.name}>
                {col.name}
                </option>
            ))}
            </select>
        
            <select
            value={condition.operator}
            onChange={(e) =>
                onChange({ ...condition, operator: e.target.value as FilterCondInput["operator"] })
            }
            className="border rounded px-2 py-1 cursor-pointer"
            >
                <option value="is">is</option>
                <option value="is not">is not</option>
                <option value="contains">contains</option>
                <option value="not contains">not contains</option>
                <option value="is empty">is empty</option>
                <option value="is not empty">is not empty</option>
                <option value="gt">greater than</option>
                <option value="lt">less than</option>
            </select>
        
            {!["is empty", "is not empty"].includes(condition.operator) ? (
                <input
                    type="text"
                    value={condition.value ?? ""}
                    onChange={(e) => onChange({ ...condition, value: e.target.value })}
                    className="border rounded px-2 py-1 cursor-text"
                />
            ): (
                <input
                    type="text"
                    value={""}
                    disabled
                    className="border rounded px-2 py-1"
                />      
            )}
    
            <button onClick={onDelete} className="px-2 py-1 border rounded cursor-pointer">
            ✕
            </button>
        </div>
    );
}

function ConditionGroup({
    group,
    onChange,
    columns,
    onDelete,
    isInitial
}: {
    group: FilterGroupInput
    onChange: (updated: FilterGroupInput) => void
    columns: Column[]
    onDelete?: () => void
    isInitial?: boolean
}) {
    const handleAddCondition = () => {
        const newCond: FilterCondInput = {
            columnName: columns[0]?.name ?? "",
            operator: "contains",
            value: "",
        }

        onChange({...group, conditions: [...group.conditions, newCond]})
    }

    const handleAddGroup = () => {
        const newGroup: FilterGroupInput = { combineWith: "AND", conditions: [] }
        onChange({...group,conditions: [...group.conditions, newGroup]})
    }

    const handleUpdateChild = (index: number, updated: FilterCondInput | FilterGroupInput) => {
        const newConditions = [...group.conditions]
        newConditions[index] = updated
        onChange({ ...group, conditions: newConditions })
    }

    const handleDeleteChild = (index: number) => {
        const newConditions = group.conditions.filter((_, i) => i !== index)
        onChange({ ...group, conditions: newConditions })
    };

    return (
        <div className="text-sm bg-white border rounded-sm p-3 space-y-2">
            {!onDelete ? (
                isInitial ? (
                    <p>No filter conditions are applied</p>
                ): (
                    <p>In this view, show records</p>
                )
            ): null}
            <div className="flex items-center space-x-2">
                <label>Combine with:</label>
                <select
                    value={group.combineWith}
                    onChange={(e) =>
                    onChange({ ...group, combineWith: e.target.value as "AND" | "OR" })
                    }
                    className="border rounded px-2 py-1"
                >
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                </select>
                {onDelete && (
                    <button onClick={onDelete} className="px-2 py-1 border rounded">
                    ✕
                    </button>
                )}
                
            </div>

            <div className="space-y-2">
                {group.conditions.map((cond, i) =>
                    "operator" in cond ? (
                        <ConditionRow
                            key={i}
                            condition={cond}
                            columns={columns}
                            onChange={(updated) => handleUpdateChild(i, updated)}
                            onDelete={() => handleDeleteChild(i)}
                        />
                    ) : (
                        <ConditionGroup
                            key={i}
                            group={cond}
                            onChange={(updated) => handleUpdateChild(i, updated)}
                            columns={columns}
                            onDelete={() => handleDeleteChild(i)}
                        />
                    )
                )}
            </div>

            <div className="flex space-x-2">
                <button
                    className="whitespace-nowrap px-2 py-1 cursor-pointer text-gray-700 hover:text-black"
                    onClick={handleAddCondition}
                >
                + Add condition
                </button>
                <button
                    className="whitespace-nowrap px-2 py-1 cursor-pointer text-gray-700 hover:text-black"
                    onClick={handleAddGroup}
                >
                + Add condition group
                </button>
            </div>
        </div>
    );
}

export default function TableFilter({
    columns,
    filters,
    setFilters,
    open,
    setOpen
}: {
    columns: Column[]
    filters: FilterGroupInput,
    setFilters: (update: FilterGroupInput) => void,
    open: boolean
    setOpen: (a: boolean) => void
}) {
    const toggleOpen = () => {
        const isOpen = open
        setOpen(!isOpen)
    }

    const isInitial = useMemo(() => {
        return JSON.stringify(filters) === JSON.stringify(initialFilter)
    }, [filters])

    return (
        <div className="relative inline-block">
            <button onClick={toggleOpen} className="cursor-pointer hover:bg-gray-200 py-2 px-4 rounded-md">
                Filter
            </button>

            {open && (
                <div className="absolute right-0">
                    <ConditionGroup group={filters} onChange={setFilters} columns={columns} isInitial={isInitial}/>
                </div>
            )}

        </div>
    )
}