'use client'

import { useState } from "react";
import type { SortRule } from "../basepage/table";
import type { Column } from "@prisma/client";

export default function TableSort({ sortRules, setSortRules, cols }: { sortRules: SortRule[], setSortRules: (val: SortRule[]) => void, cols: Column[] }) {
    const [open, setOpen] = useState<boolean>(false)
    const [openDropdown, setOpenDropdown] = useState(false);

    const toggleOpen = () => {
        const isOpen = open
        setOpen(!isOpen)
    }

    const availableCols = cols.filter(col => !sortRules.some(rule => rule.columnName === col.name))

    const handleRuleChange = (index: number, columnName: string, columnType: "TEXT" | "NUMBER", order: "ASC" | "DESC") => {
        const newRules = [...sortRules];
        newRules[index] = { columnName, columnType, order };
        setSortRules(newRules);
    }

    const handleRemoveRule = (index: number) => {
        setSortRules(sortRules.filter((_, i) => i !== index));
    }

    const handleAddRule = (columnName: string, columnType: "TEXT" | "NUMBER") => {
        setSortRules([...sortRules, { columnName, columnType, order: "ASC" }]);
        setOpenDropdown(false);
    }
            
    return (
        <div className="relative inline-block">
            <button onClick={toggleOpen} className="cursor-pointer hover:bg-gray-200 py-2 px-4 rounded-md">
                Sort
            </button>

            {open && 
            (<div className="bg-white absolute right-0 text-gray-800 w-100 flex flex-col shadow-sm border border-gray-800">
                <span className="p-3">Sort By</span>
                <div className="flex flex-col">
                    {sortRules.map((rule, index) => (
                        <div key={index} className="flex flex-row items-center gap-2 mb-2">
                            <select
                            value={rule.columnName}
                            onChange={(e) => {
                                const { name, type } = JSON.parse(e.target.value) as { name: string, type: "TEXT" | "NUMBER" }
                                handleRuleChange(index, name, type, rule.order)
                            }}
                            className="border border-gray-800 rounded-md"
                            >
                                {cols.map((col) => (
                                    <option key={col.name} value={JSON.stringify({ name: col.name, type: col.type })}>{col.name}</option>
                                ))}
                            </select>

                            <select
                            value={rule.order}
                            onChange={(e) => handleRuleChange(index, rule.columnName, rule.columnType, e.target.value as "ASC" | "DESC")}
                            className="border border-gray-800 rounded-md"
                            >
                               {rule.columnType === "TEXT" ? (
                                    <>
                                        <option value="ASC">{"A -> Z"}</option>
                                        <option value="DESC">{"Z -> A"}</option>
                                    </>
                                    ) : (
                                    <>
                                        <option value="ASC">{"1 -> 9"}</option>
                                        <option value="DESC">{"9 -> 1"}</option>
                                    </>
                                )}                        
                            </select>

                            <button
                            onClick={() => handleRemoveRule(index)}
                            className="cursor-pointer hover:bg-gray-200"
                            >
                            X
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => setOpenDropdown(true)}
                    className="cursor-pointer hover:bg-gray-200"
                >
                + Add another sort
                </button>

                {openDropdown && (
                    <select
                    onChange={(e) => {
                        if (e.target.value) {
                            const { name, type } = JSON.parse(e.target.value) as { name: string, type: "TEXT" | "NUMBER" }
                            handleAddRule(name, type)
                        }
                    }}
                    className="cursor-pointer hover:bg-gray-200"
                    value=""
                    >
                        <option value="" disabled>Select row</option>
                        {availableCols.map((col) => (
                            <option key={col.name} value={JSON.stringify({ name: col.name, type: col.type })}>{col.name}</option>
                        ))}
                    </select>
                )}
            </div>
            )}
        </div>
    )
}