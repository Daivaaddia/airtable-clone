'use client'

import type { Column } from "@prisma/client"
import { useEffect, useState } from "react"
import type { FilterGroupInput } from "~/server/api/routers/table"
import { Table, type SortRule } from "./table"
import TableFilter, { initialFilter } from "../table/tableFilter"
import TableSort from "../table/tableSort"

export default function TableContainer({ id }: { id: string }) {  
    const [cols, setCols] = useState<Column[]>([])
    const [filters, setFilters] = useState<FilterGroupInput>(initialFilter)
    const [sortRules, setSortRules] = useState<SortRule[]>([])
    const [search, setSearch] = useState<string>("")

    const [filterOpen, setFilterOpen] = useState<boolean>(false)
    const [sortOpen, setSortOpen] = useState<boolean>(false)

    const toggleFilter = (open: boolean) => {
        setFilterOpen(open)
        if (open) setSortOpen(false)
    }

    const toggleSort = (open: boolean) => {
        setSortOpen(open)
        if (open) setFilterOpen(false)
    }

    const closeAll = () => {
        setFilterOpen(false)
        setSortOpen(false)
    }

    return (
        <div>
            <div className="flex flex-row justify-between">
                <p></p>
                <div className="flex flex-row ">
                    <TableFilter open={filterOpen} setOpen={toggleFilter} columns={cols} filters={filters} setFilters={setFilters}/>
                    <TableSort open={sortOpen} setOpen={toggleSort} sortRules={sortRules} setSortRules={setSortRules} cols={cols}/>
                    <input placeholder="Find in view" onFocus={closeAll} onChange={(e) => setSearch(e.target.value)} value={search} className="border rounded-md px-2 py-1"/>
                </div>
            </div>
            <Table 
                id={id}
                cols={cols}
                setCols={setCols}
                filters={filters}
                setFilters={setFilters}
                sortRules={sortRules}
                setSortRules={setSortRules}
                search={search}
                setSearch={setSearch}
            />
        </div>
    )
}