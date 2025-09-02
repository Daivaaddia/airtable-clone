import { z } from "zod";
import { faker } from '@faker-js/faker';
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

const defaultColumns = ["Name", "Notes", "Number"]
const DEFAULTROWS = 15

const filterCondInput = z.object({
  columnName: z.string(),
  operator: z.enum([
    "is",
    "is not",
    "contains",
    "not contains",
    "is empty",
    "is not empty",
    "gt",
    "lt"
  ]),
  value: z.string().optional()
});

export type FilterCondInput = z.infer<typeof filterCondInput>

type FilterGroup = {
  combineWith: "AND" | "OR";
  conditions: (FilterCondInput | FilterGroup)[];
};

const filterGroupInput: z.ZodType<FilterGroup> = z.lazy(() =>
    z.object({
        combineWith: z.enum(["AND", "OR"]),
        conditions: z.array(z.union([filterCondInput, filterGroupInput])),
    })
);


export type FilterGroupInput = z.infer<typeof filterGroupInput>

function filterToSql(colAlias: string, filter: FilterCondInput) {
    switch (filter.operator) {
    case "is":
        return `${colAlias}.value = '${filter.value}'`
    case "is not":
        return `${colAlias}.value <> '${filter.value}'`
    case "contains":
        return `${colAlias}.value ILIKE '%${filter.value}%'`
    case "not contains":
        return `NOT (${colAlias}.value ILIKE '%${filter.value}%')`
    case "is empty":
        return `${colAlias}.value = ''`
    case "is not empty":
        return `${colAlias}.value <> ''`
    case "gt":
        return `(${colAlias}.value)::numeric > ${filter.value}`
    case "lt":
        return `(${colAlias}.value)::numeric < ${filter.value}`
    default:
        return "TRUE";
  }
}

function groupToSql(group: FilterGroupInput, joins: string[], depth = 0): string {
    if (group.conditions.length === 0) {
        return "TRUE"
    }

    const parts = group.conditions.map((cond: FilterCondInput | FilterGroup, i) => {
        if ("operator" in cond) {
            const alias = `f${depth}_${i}`
            joins.push(
                `LEFT JOIN "Cell" ${alias} ON ${alias}."rowId" = r.id AND ${alias}."columnName" = '${cond.columnName}'`
            )
            return filterToSql(alias, cond)
        } else {
            return `(${groupToSql(cond, joins, depth + 1)})`
        }
    });

    return parts.join(` ${group.combineWith} `)
}

export const tableRouter = createTRPCRouter({
    create: protectedProcedure
    .input(z.object({ baseId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return ctx.db.table.create({
            data: {
                name: input.name,
                sorting: "",
                base: { connect: { id: input.baseId } }
            }
        });
    }),

    createDefault: protectedProcedure
    .input(z.object({ id: z.string().optional(), baseId: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return await ctx.db.$transaction(async (tx) => {
            const table = await ctx.db.table.create({
                data: {
                    name: input.name,
                    sorting: "",
                    base: { connect: { id: input.baseId } }
                }
            });

            const columnData = defaultColumns.map((colName, index) => ({
                name: colName,
                order: index,
                tableId: table.id,
                type: colName === "Number" ? "NUMBER" : "TEXT"
            }));

            await tx.column.createMany({ data: columnData });

            const columns = await tx.column.findMany({
                where: { tableId: table.id },
                orderBy: { order: "asc" },
            });

            const rowData = [];
            for (let i = 0; i < DEFAULTROWS; i++) {
                rowData.push({
                    order: i,
                    origOrder: i,
                    tableId: table.id
                })
            }; 

            await tx.row.createMany({ data: rowData });

            const rows = await tx.row.findMany({
                where: { tableId: table.id },
                orderBy: { order: "asc" },
            });

            const cellData = rows.flatMap((row) =>
                columns.map((col) => {
                let value: string;

                if (col.type === "NUMBER") {
                    value = faker.number.int().toString();
                } else {
                    value = faker.person.fullName()
                }

                return {
                    rowId: row.id,
                    columnId: col.id,
                    columnName: col.name,
                    value,
                    type: col.type
                };
                })
            );

            await tx.cell.createMany({ data: cellData });
            return table;
        }, {
            maxWait: 5000,
            timeout: 200000,
        })
    }),

    // getTable: protectedProcedure
    // .input(z.object({ id: z.string() }))
    // .query(async ({ ctx, input }) => {
    //     return ctx.db.table.findFirst({
    //         where: { id: input.id },
    //         include: {
    //             columns: {
    //                 orderBy: {order: "asc"}
    //             },
    //             rows: {
    //                 orderBy: {order: "asc"},
    //                 include: { cells: true },
    //             },
    //         },
    //     })
    // }),

    getTable: protectedProcedure
    .input(z.object({
        id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
        const table = await ctx.db.table.findFirst({
            where: { id: input.id },
            include: {
                columns: {
                    orderBy: {order: "asc"}
                },
                rows: {
                    orderBy: {order: "asc"},
                    include: { cells: true },
                },
            },
        })

        if (!table) return null

        if (table.filtering === "") {
            // no filters
            return table
        }

        const joins: string[] = [];
        const whereClause = groupToSql(JSON.parse(table.filtering) as FilterGroupInput, joins);

        const sqlJoins = joins.join('\n')

        const sql = `
            SELECT r.id
            FROM "Row" r
            ${sqlJoins}
            WHERE r."tableId" = '${input.id}'
            AND (${whereClause})
        `

        const rows: { id: string }[] = await ctx.db.$queryRawUnsafe(sql)
        const rowIds = rows.map(r => r.id)

        return await ctx.db.table.findFirst({
            where: { id: input.id },
            include: {
                columns: {
                    orderBy: {order: "asc"}
                },
                rows: {
                    where: { id: { in: rowIds } },
                    orderBy: { order: "asc" },
                    include: { cells: true }
                }
            }
        })
    }),

    updateTableFilter: protectedProcedure
    .input(z.object({ id: z.string(), filters: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return ctx.db.table.update({
            where: { id: input.id },
            data: {
                filtering: input.filters
            }
        })
    }),


    sortTable: protectedProcedure
    .input(z.object({ 
        id: z.string(),
        columns: z.array(z.object({ columnName: z.string(), columnType: z.enum(["TEXT", "NUMBER"]), order: z.enum(["ASC", "DESC"])})).min(1)
    }))
    .mutation(async ({ ctx, input }) => {
        return await ctx.db.$transaction(async (tx) => {
            const joins = input.columns
            .map((col, i) => `LEFT JOIN "Cell" c${i+1} ON c${i+1}."rowId" = r.id AND c${i+1}."columnName" = '${col.columnName}'`)
            .join("\n");
        
            const orderBy = input.columns
                .map((col, i) => {
                    if (col.columnType === "NUMBER") {
                        return `(c${i+1}.value)::numeric ${col.order}`
                    } else {
                        return `LOWER(c${i+1}.value) ${col.order}`
                    }
                })
                .join(", ");

            const sql = `
                WITH sorted AS (
                    SELECT r.id as rowId,
                    ROW_NUMBER() OVER (
                        ORDER BY ${orderBy}
                    ) AS new_order
                    FROM "Row" r
                    ${joins}
                    WHERE r."tableId" = '${input.id}'
                )
                UPDATE "Row" r
                SET "order" = sorted.new_order
                FROM sorted
                WHERE r.id = sorted.rowId
            `

            await tx.$executeRawUnsafe(sql)

            await tx.table.updateMany({ 
                where: { id: input.id },
                data: { sorting: JSON.stringify(input.columns) }
            })
        })
        
    }),

    resetOrder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return await ctx.db.$transaction(async (tx) => {
            await ctx.db.$executeRaw`
                UPDATE "Row"
                SET "order" = "origOrder"
                WHERE "tableId" = ${input.id}
            `

            await tx.table.update({
                where: { id: input.id },
                data: { sorting: "" }
            })
        })
    }),

    createRow: protectedProcedure
    .input(z.object({ 
        row: z.object({ id: z.string().optional(), order: z.number(), tableId: z.string() }),
        cells: z.array(z.object({ id: z.string().optional(), columnId: z.string(), type: z.string(), value: z.string(), rowId: z.string(), columnName: z.string() }))
    }))
    .mutation(async ({ ctx, input}) => {
        const row = await ctx.db.row.create({
            data: {
                id: input.row.id,
                order: input.row.order,
                origOrder: input.row.order,
                tableId: input.row.tableId
            }
        })

        await ctx.db.cell.createMany({ data: input.cells })

        return row;
    }),

    createCol: protectedProcedure
    .input(z.object({ 
        col: z.object({ id: z.string().optional(), name: z.string(), type: z.string(), order: z.number(), tableId: z.string() }),
        cells: z.array(z.object({ id: z.string().optional(), columnId: z.string(), type: z.string(), value: z.string(), rowId: z.string(), columnName: z.string() }))
    }))
    .mutation(async ({ ctx, input}) => {
        const col = await ctx.db.column.create({
            data: {
                name: input.col.name,
                id: input.col.id,
                order: input.col.order,
                tableId: input.col.tableId,
                type: input.col.type
            }
        })

        await ctx.db.cell.createMany({ data: input.cells })

        return col;
    }),

    updateCell: protectedProcedure
    .input(z.object({ id: z.string(), value: z.string() }))
    .mutation(async ({ ctx, input }) => {
        return ctx.db.cell.updateMany({
            where: { id: input.id },
            data: { value: input.value }
        })
    }),
});